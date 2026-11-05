import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  projects: [
    { name: 'accounts', testMatch: '**/*.cloud.spec.ts' },
    { name: 'journal', testMatch: '**/fitness.spec.ts', grep: /@cloud/ },
  ],
  timeout: 90000,
  workers: 1,
  outputDir: 'test-results-cloud',
  use: {
    baseURL: 'http://127.0.0.1:5181',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5181 --strictPort',
    url: 'http://127.0.0.1:5181',
    reuseExistingServer: false,
    env: {
      VITE_FIREBASE_API_KEY: 'demo-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-form-and-fuel.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'demo-form-and-fuel',
      VITE_FIREBASE_APP_ID: '1:123:web:demo',
      VITE_FIREBASE_EMULATORS: 'true',
    },
  },
})
