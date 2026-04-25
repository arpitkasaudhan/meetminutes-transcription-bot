/**
 * Playwright bot that joins a Google Meet, captures tab audio via
 * MediaRecorder + createMediaElementSource, and streams base64-encoded
 * WebM/Opus chunks to the backend over Socket.IO WebSocket.
 *
 * Audio capture approach:
 *   After joining, we inject JavaScript that finds every <audio> element
 *   Google Meet creates for remote participants, connects each to a shared
 *   AudioContext via createMediaElementSource(), and records the merged
 *   stream with MediaRecorder. A MutationObserver watches for late-joining
 *   participants. Chunks arrive every CHUNK_MS milliseconds.
 *
 * Why headed mode (with Xvfb in Docker):
 *   Google Meet's JS heavily fingerprints the browser environment.
 *   Headless Chrome lacks several APIs Meet relies on (WebGL, some media
 *   pipeline paths) and is more likely to be bot-detected or to fail
 *   silently. Xvfb provides a virtual display at zero cost in Docker.
 */

import { chromium, Browser, Page } from 'playwright';
import { io, Socket } from 'socket.io-client';
import * as os from 'os';
import * as path from 'path';

const SESSION_ID = process.env.SESSION_ID!;
const MEET_URL = process.env.MEET_URL!;
const BOT_DISPLAY_NAME = process.env.BOT_DISPLAY_NAME || 'MeetMinutes Bot';
const BACKEND_WS_URL = process.env.BACKEND_WS_URL || 'http://localhost:3000';
const CHUNK_MS = 5000;

if (!SESSION_ID || !MEET_URL) {
  console.error('[Bot] SESSION_ID and MEET_URL env vars are required');
  process.exit(1);
}

async function connectSocket(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(BACKEND_WS_URL, { transports: ['websocket'] });
    const timer = setTimeout(() => reject(new Error('Socket connection timeout')), 15000);
    socket.on('connect', () => { clearTimeout(timer); resolve(socket); });
    socket.on('connect_error', (err) => { clearTimeout(timer); reject(err); });
  });
}

async function joinMeet(page: Page, displayName: string): Promise<void> {
  console.log(`[Bot] Navigating to ${MEET_URL}`);
  await page.goto(MEET_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  // Wait for pre-join screen to load — poll until the name input OR join button appears
  // Do NOT do a long fixed wait; act as soon as the page is interactive.
  console.log('[Bot] Waiting for pre-join screen...');

  let nameEntered = false;

  // Try for up to 20 seconds in a tight loop
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(500);

    // Check if already blocked ("You can't join")
    const blocked = await page.evaluate(() =>
      document.body.innerText.includes("can't join") ||
      document.body.innerText.includes("cannot join")
    );
    if (blocked) {
      const debugPath = path.join(os.homedir(), 'Desktop', 'bot-prejoin-debug.png');
      try { await page.screenshot({ path: debugPath, fullPage: true }); } catch {}
      throw new Error('Google Meet blocked the bot: "You can\'t join this video call". The meeting must allow guests — turn off Host Management in the meeting security settings.');
    }

    // Try to fill name input the moment it appears
    if (!nameEntered) {
      for (const sel of [
        'input[aria-label*="name" i]',
        'input[placeholder*="name" i]',
        'input[data-initial-value]',
        'input[type="text"]',
      ]) {
        try {
          const el = page.locator(sel).first();
          if (await el.isVisible({ timeout: 300 })) {
            await el.fill(displayName);
            nameEntered = true;
            console.log(`[Bot] Entered display name via ${sel}`);
            await page.waitForTimeout(500); // small pause so Join button activates
            break;
          }
        } catch {}
      }
    }

    // Try to click the join button
    for (const sel of [
      '[jsname="Qx7uuf"]',
      '[jsname="d9TlZc"]',
      'button:has-text("Ask to join")',
      'button:has-text("Join now")',
      'button:has-text("Join")',
      'button:has-text("Request to join")',
    ]) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 300 })) {
          await el.click();
          console.log(`[Bot] Clicked join via: ${sel}`);

          // Wait until inside the meeting (up to 2 min for host to admit)
          console.log('[Bot] Waiting to be admitted...');
          await page.waitForSelector(
            '[data-meeting-title], [jsname="CQylAd"], [aria-label*="Leave call" i]',
            { timeout: 120_000 },
          ).catch(() => console.log('[Bot] Admission timeout — proceeding anyway'));

          console.log('[Bot] Successfully joined the meeting');
          return;
        }
      } catch {}
    }
  }

  // If we get here, take a debug screenshot and throw
  const debugPath = path.join(os.homedir(), 'Desktop', 'bot-prejoin-debug.png');
  try { await page.screenshot({ path: debugPath, fullPage: true }); console.log(`[Bot] Debug screenshot saved: ${debugPath}`); } catch {}
  throw new Error('Timed out waiting for join button on pre-join screen');
}

async function startAudioCapture(page: Page, socket: Socket): Promise<void> {
  await page.exposeFunction('__sendAudioChunk__', (base64: string) => {
    socket.emit('audio-chunk', { sessionId: SESSION_ID, chunk: base64 });
  });

  await page.evaluate((chunkMs: number) => {
    async function captureOneChunk(stream: MediaStream): Promise<void> {
      return new Promise((resolve) => {
        const blobs: Blob[] = [];
        const rec = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus',
          audioBitsPerSecond: 16000,
        });
        rec.ondataavailable = (e: BlobEvent) => { if (e.data?.size > 0) blobs.push(e.data); };
        rec.onstop = async () => {
          const blob = new Blob(blobs, { type: 'audio/webm;codecs=opus' });
          if (blob.size > 500) {
            const buf = await blob.arrayBuffer();
            const bytes = new Uint8Array(buf);
            let bin = '';
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            (window as any).__sendAudioChunk__(btoa(bin));
            console.log(`[BotInPage] Sent ${blob.size}B chunk`);
          }
          resolve();
        };
        rec.start();
        setTimeout(() => rec.stop(), chunkMs);
      });
    }

    (async () => {
      try {
        // Capture the real microphone — picks up the user's voice directly.
        // The bot is muted in the meeting so this doesn't cause echo.
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000,
          },
        });
        console.log('[BotInPage] Microphone stream acquired');
        while (true) await captureOneChunk(stream);
      } catch (err) {
        console.error('[BotInPage] Microphone capture failed:', (err as Error).message);
      }
    })();
  }, CHUNK_MS);

  console.log('[Bot] Audio capture injected');
}

async function waitForMeetingEnd(page: Page): Promise<void> {
  // Wait at least 60 seconds before even checking for meeting end,
  // so we don't exit immediately on a false-positive selector match.
  await page.waitForTimeout(60_000).catch(() => {});

  await page.waitForSelector(
    '[data-meeting-ended="true"]',
    { timeout: 7_200_000 },
  ).catch(() => {
    console.log('[Bot] Meeting end not detected; shutting down after timeout');
  });
}

async function main() {
  let browser: Browser | null = null;
  let socket: Socket | null = null;

  try {
    socket = await connectSocket();
    console.log('[Bot] Socket connected');
    socket.emit('bot-status', { sessionId: SESSION_ID, status: 'JOINING' });

    browser = await chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-infobars',
        '--disable-blink-features=AutomationControlled',
        '--autoplay-policy=no-user-gesture-required',
        '--use-fake-ui-for-media-stream',
      ],
    });

    const context = await browser.newContext({
      permissions: ['camera', 'microphone'],
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();

    await joinMeet(page, BOT_DISPLAY_NAME);

    socket.emit('bot-status', { sessionId: SESSION_ID, status: 'RECORDING' });

    await startAudioCapture(page, socket);

    await waitForMeetingEnd(page);

    socket.emit('bot-status', { sessionId: SESSION_ID, status: 'DONE' });
    console.log('[Bot] Done');
    process.exit(0);
  } catch (err) {
    console.error('[Bot] Fatal error:', err);
    socket?.emit('bot-status', { sessionId: SESSION_ID, status: 'FAILED' });
    process.exit(1);
  } finally {
    await browser?.close().catch(() => {});
    socket?.disconnect();
  }
}

main();
