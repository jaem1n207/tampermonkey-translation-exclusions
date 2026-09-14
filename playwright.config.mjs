import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve('work/browsers');

export default defineConfig({
    testDir: './tests/browser',
    workers: 1,
    timeout: 10000,
    expect: { timeout: 1500 },
    outputDir: 'work/test-results',
    reporter: 'list',
    use: { browserName: 'chromium', headless: true },
});
