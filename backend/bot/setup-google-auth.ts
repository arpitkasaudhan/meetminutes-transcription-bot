/**
 * Run this ONCE to sign into Google in the bot's Chrome profile.
 * After signing in, close the browser — credentials are saved permanently.
 *
 * Run: npx ts-node --project tsconfig.bot.json bot/setup-google-auth.ts
 */

import { chromium } from 'playwright';
import * as path from 'path';
import * as os from 'os';

const userDataDir = path.join(os.homedir(), '.meetminutes-bot-profile');

async function main() {
  console.log('Opening Chrome for Google sign-in...');
  console.log('1. Sign into your Google account in the browser that opens');
  console.log('2. Once signed in and on Google homepage, CLOSE the Chrome window');
  console.log('3. Credentials will be saved for all future bot sessions\n');

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome',
    args: [
      '--no-sandbox',
      '--disable-infobars',
      '--disable-blink-features=AutomationControlled',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const page = await context.newPage();
  await page.goto('https://accounts.google.com');

  console.log('Waiting for you to sign in... (close Chrome window when done)');

  // Wait until the browser is closed by the user
  await new Promise<void>((resolve) => {
    context.on('close', resolve);
    page.on('close', resolve);
  }).catch(() => {});

  console.log('\nDone! Google credentials saved.');
  console.log('You can now run the bot — it will join Google Meet as a signed-in user.');
  process.exit(0);
}

main().catch(console.error);
