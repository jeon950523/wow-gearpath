import {defineConfig} from '@playwright/test';

const port = Number(process.env.GEARPATH_TEST_PORT ?? 3100);
const url = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  use: {baseURL: url, browserName: 'chromium'},
  webServer: {command: `npm run start -- --hostname 127.0.0.1 --port ${port}`, url, timeout:60_000},
});
