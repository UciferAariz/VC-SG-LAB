/** Locate the locally installed Chrome / Edge for the dev scripts (nothing is downloaded). */
import { existsSync } from 'node:fs';

const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

export function findBrowser() {
  const p = CANDIDATES.find((c) => existsSync(c));
  if (!p) throw new Error('No Chrome/Edge found');
  return p;
}
