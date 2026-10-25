
import { resolveBrowserLaunchPlan, resolveLocalChromeExecutable } from './generate-pdf';
import { test, expect } from 'vitest';

test('resolveLocalChromeExecutable returns the first available local browser', () => {
  const executablePath = resolveLocalChromeExecutable((candidate) => candidate === '/usr/bin/chromium');

  expect(executablePath).toBe('/usr/bin/chromium');
});

test('resolveLocalChromeExecutable returns null when no local browser exists', () => {
  const executablePath = resolveLocalChromeExecutable(() => false);

  expect(executablePath).toBe(null);
});

test('resolveBrowserLaunchPlan uses a valid CHROME_PATH', () => {
  expect(resolveBrowserLaunchPlan(
      { CHROME_PATH: '/custom/chromium' },
      (candidate) => candidate === '/custom/chromium',
    )).toEqual({
      kind: 'local',
      executablePath: '/custom/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
});

test('resolveBrowserLaunchPlan falls back when CHROME_PATH is invalid', () => {
  // Upstream #85: a bad CHROME_PATH must not abort the export; it falls
  // through to autodetection and the explicit download fallback.
  expect(() => resolveBrowserLaunchPlan({ CHROME_PATH: '/missing/chromium' }, () => false))
    .toThrow(/No local Chrome\/Chromium executable found/);
  expect(resolveBrowserLaunchPlan(
    { CHROME_PATH: '/missing/chromium', ALLOW_CHROMIUM_DOWNLOAD: 'true' },
    () => false,
  )).toEqual({ kind: 'download' });
});

test('resolveBrowserLaunchPlan requires explicit permission for runtime Chromium download', () => {
  expect(() => resolveBrowserLaunchPlan({}, () => false)).toThrow(/ALLOW_CHROMIUM_DOWNLOAD=true/);

  expect(resolveBrowserLaunchPlan({ ALLOW_CHROMIUM_DOWNLOAD: 'true' }, () => false)).toEqual({ kind: 'download' });
});
