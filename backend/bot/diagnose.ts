import { chromium } from 'playwright';
import * as path from 'path';
import * as os from 'os';

async function diagnose() {
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const context = await browser.newContext({
    permissions: ['camera', 'microphone'],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();

  const url = process.env.MEET_URL || 'https://meet.google.com/ycx-zqzc-tcw';
  console.log(`Navigating to: ${url}`);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Poll every 2 seconds for 30 seconds, logging what's on screen
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(2000);
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 200));
    const btns = await page.$$eval('button', b => b.filter(x => (x as any).offsetParent).map(x => (x as HTMLButtonElement).innerText.trim().slice(0, 40)));
    console.log(`t=${2*(i+1)}s | text: ${bodyText.replace(/\n/g,' ').slice(0,80)} | buttons: ${btns.join(', ')}`);
    if (!bodyText.includes('Getting ready')) break;
  }

  const screenshotPath = path.join(os.homedir(), 'Desktop', 'meet-debug.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Screenshot saved to: ${screenshotPath}`);

  const title = await page.title();
  console.log(`Page title: ${title}`);
  console.log(`URL after load: ${page.url()}`);

  // Dump all visible buttons
  const buttons = await page.$$eval('button', (btns) =>
    btns.filter(b => b.offsetParent !== null).map(b => ({
      text: b.innerText.trim().slice(0, 60),
      ariaLabel: b.getAttribute('aria-label'),
      jsname: b.getAttribute('jsname'),
    }))
  );
  console.log('\nVisible buttons:');
  buttons.forEach(b => console.log(' -', JSON.stringify(b)));

  // Check for input fields
  const inputs = await page.$$eval('input', (inputs) =>
    inputs.map(i => ({
      type: i.type,
      placeholder: i.placeholder,
      ariaLabel: i.getAttribute('aria-label'),
      value: i.value,
    }))
  );
  console.log('\nInput fields:');
  inputs.forEach(i => console.log(' -', JSON.stringify(i)));

  await browser.close();
}

diagnose().catch(console.error);
