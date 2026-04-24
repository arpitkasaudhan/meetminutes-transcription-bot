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

const SESSION_ID = process.env.SESSION_ID!;
const MEET_URL = process.env.MEET_URL!;
const BOT_DISPLAY_NAME = process.env.BOT_DISPLAY_NAME || 'MeetMinutes Bot';
const BACKEND_WS_URL = process.env.BACKEND_WS_URL || 'http://localhost:3000';
const CHUNK_MS = 5000; // 5-second audio chunks

if (!SESSION_ID || !MEET_URL) {
  console.error('SESSION_ID and MEET_URL env vars are required');
  process.exit(1);
}

async function connectSocket(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(BACKEND_WS_URL, { transports: ['websocket'] });
    const timer = setTimeout(() => reject(new Error('Socket connection timeout')), 15000);

    socket.on('connect', () => {
      clearTimeout(timer);
      console.log(`[Bot] Socket connected: ${socket.id}`);
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function joinMeet(page: Page, displayName: string): Promise<void> {
  console.log(`[Bot] Navigating to ${MEET_URL}`);
  await page.goto(MEET_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  // --- Pre-join screen ---

  // Dismiss cookie / sign-in prompts
  for (const selector of [
    'button[aria-label="Accept all"]',
    'button:has-text("Accept all")',
    'button:has-text("Got it")',
  ]) {
    const btn = await page.$(selector).catch(() => null);
    if (btn) { await btn.click().catch(() => {}); await page.waitForTimeout(500); }
  }

  // Enter bot display name
  const nameSelectors = [
    'input[aria-label*="name" i]',
    'input[placeholder*="name" i]',
    'input[data-initial-value]',
    'input[type="text"]',
  ];
  for (const sel of nameSelectors) {
    const input = await page.$(sel).catch(() => null);
    if (input) {
      await input.click({ clickCount: 3 });
      await input.fill(displayName);
      console.log(`[Bot] Entered display name via: ${sel}`);
      break;
    }
  }

  // Mute microphone (we don't want the bot's fake mic stream leaking)
  for (const sel of [
    '[data-priv="cameraButton"]',
    '[aria-label*="microphone" i]',
    '[aria-label*="Turn off mic" i]',
  ]) {
    const btn = await page.$(sel).catch(() => null);
    if (btn) { await btn.click().catch(() => {}); }
  }

  // Click "Ask to join" / "Join now"
  const joinSelectors = [
    'button[data-id="join-button"]',
    '[jsname="Qx7uuf"]',
    '[jsname="d9TlZc"]',
    'button:has-text("Ask to join")',
    'button:has-text("Join now")',
    'button:has-text("Join")',
  ];

  let joined = false;
  for (const sel of joinSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 5000 });
      await page.click(sel);
      joined = true;
      console.log(`[Bot] Clicked join via: ${sel}`);
      break;
    } catch {}
  }

  if (!joined) throw new Error('Could not find join button — check Meet URL or pre-join selectors');

  // Wait until we are actually inside the meeting
  await page.waitForSelector(
    '[data-meeting-title], [aria-label*="Leave call" i], [jsname="CQylAd"]',
    { timeout: 60_000 },
  );
  console.log('[Bot] Successfully joined the meeting');
}

async function startAudioCapture(page: Page, socket: Socket): Promise<void> {
  // Expose a Node.js callback that the browser JS can call with each chunk
  await page.exposeFunction('__sendAudioChunk__', (base64: string) => {
    socket.emit('audio-chunk', { sessionId: SESSION_ID, chunk: base64 });
  });

  await page.evaluate((chunkMs: number) => {
    const ctx = new AudioContext({ sampleRate: 16000 });
    const dest = ctx.createMediaStreamDestination();

    function connectElement(el: HTMLAudioElement) {
      if ((el as any).__botCaptured__) return;
      (el as any).__botCaptured__ = true;
      try {
        const src = ctx.createMediaElementSource(el);
        src.connect(dest);
        src.connect(ctx.destination); // keep audio playing for the bot
      } catch (_) {}
    }

    // Connect all existing <audio> elements
    document.querySelectorAll<HTMLAudioElement>('audio').forEach(connectElement);

    // Watch for new participants
    new MutationObserver(() => {
      document.querySelectorAll<HTMLAudioElement>('audio').forEach(connectElement);
    }).observe(document.body, { childList: true, subtree: true });

    const recorder = new MediaRecorder(dest.stream, {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 16000,
    });

    recorder.ondataavailable = async (e: BlobEvent) => {
      if (!e.data || e.data.size < 200) return; // skip silence/tiny chunks
      const buf = await e.data.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = btoa(binary);
      (window as any).__sendAudioChunk__(b64);
    };

    recorder.start(chunkMs);
    console.log(`[BotInPage] MediaRecorder started, chunk interval: ${chunkMs}ms`);
  }, CHUNK_MS);

  console.log('[Bot] Audio capture injected');
}

async function waitForMeetingEnd(page: Page): Promise<void> {
  // Poll until the meeting ends (leave button disappears, or the page redirects)
  await page.waitForSelector(
    '[data-meeting-ended="true"], [aria-label*="You\'ve left" i], [jsname="r8qRAd"]',
    { timeout: 7_200_000 }, // 2-hour max
  ).catch(() => {
    console.log('[Bot] Meeting end selector not found; assuming ended by timeout');
  });
}

async function main() {
  let browser: Browser | null = null;
  let socket: Socket | null = null;

  try {
    socket = await connectSocket();
    socket.emit('bot-status', { sessionId: SESSION_ID, status: 'JOINING' });

    browser = await chromium.launch({
      headless: false,  // headed + Xvfb (see README for why)
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-infobars',
        '--autoplay-policy=no-user-gesture-required',
        // Grant microphone/camera without a real device; audio capture is
        // done via createMediaElementSource so fake devices are fine.
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--allow-running-insecure-content',
      ],
    });

    const context = await browser.newContext({
      permissions: ['camera', 'microphone'],
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    await joinMeet(page, BOT_DISPLAY_NAME);

    socket.emit('bot-status', { sessionId: SESSION_ID, status: 'RECORDING' });

    await startAudioCapture(page, socket);

    await waitForMeetingEnd(page);

    socket.emit('bot-status', { sessionId: SESSION_ID, status: 'DONE' });
    console.log('[Bot] Meeting ended, shutting down');
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
