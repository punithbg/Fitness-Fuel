import { expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'

export function initializeCloudTests() {
  return initializeTestEnvironment({
    projectId: 'demo-form-and-fuel', firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
}

export async function login(page: Page, identity: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Log in / Register', exact: true }).click()
  await page.getByRole('button', { name: 'Continue with Google', exact: true }).waitFor()
  await page.evaluate(async (email) => {
    const servicePath = '/src/data/cloud/firebase.ts'
    const authPath = '/node_modules/.vite/deps/firebase_auth.js'
    const { firebaseServices } = await import(servicePath)
    const { GoogleAuthProvider, signInWithCredential } = await import(authPath)
    await signInWithCredential(firebaseServices().auth, GoogleAuthProvider.credential(
      JSON.stringify({ sub: email, email, email_verified: true, name: email.split('@')[0] }),
    ))
  }, identity)
  await expect(page.locator('.topbar button[aria-label="Sign out"]')).toBeVisible()
}