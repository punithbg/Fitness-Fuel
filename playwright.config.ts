import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testIgnore: '**/*.cloud.spec.ts',
  grepInvert: /@cloud/,
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5180',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5180 --strictPort',
    url: 'http://127.0.0.1:5180',
    reuseExistingServer: false,
    env: {
      VITE_FIREBASE_API_KEY: '', VITE_FIREBASE_AUTH_DOMAIN: '',
      VITE_FIREBASE_PROJECT_ID: '', VITE_FIREBASE_APP_ID: '', VITE_FIREBASE_EMULATORS: 'false',
    },
  },
})
