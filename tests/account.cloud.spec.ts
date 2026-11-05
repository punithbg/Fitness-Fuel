import { expect, test } from '@playwright/test'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { initializeCloudTests, login } from './helpers/cloud'

let environment: RulesTestEnvironment
test.beforeAll(async () => {
  environment = await initializeCloudTests()
})
test.afterAll(async () => {
  await environment?.cleanup()
})

test('cloud account isolation, live updates, offline errors and Excel restore', async ({
  page,
  browser,
}, testInfo) => {
  page.on('dialog', (dialog) => dialog.accept())
  const identity = `alice-${Date.now()}@example.test`
  await login(page, identity)
  await page.goto('/library')
  await page.getByRole('button', { name: 'New food', exact: true }).first().click()
  await page.getByLabel('Food name', { exact: true }).fill('Private oats')
  for (const [label, value] of [
    ['Calories (kcal)', '200'],
    ['Protein (g)', '10'],
    ['Carbs (g)', '20'],
    ['Fat (g)', '8'],
    ['Fiber (g)', '2'],
    ['Sugar (g)', '4'],
  ])
    await page.getByLabel(label, { exact: true }).fill(value)
  await page.getByRole('button', { name: 'Save food', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const secondContext = await browser.newContext()
  const second = await secondContext.newPage()
  await login(second, identity)
  await second.goto('/library')
  await expect(second.getByRole('heading', { name: 'Private oats' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit Private oats', exact: true }).click()
  await page.getByLabel('Food name', { exact: true }).fill('Updated private oats')
  await page.getByRole('button', { name: 'Save food', exact: true }).click()
  await expect(second.getByRole('heading', { name: 'Updated private oats' })).toBeVisible()
  await page.context().setOffline(true)
  await page.getByRole('button', { name: 'Edit Updated private oats', exact: true }).click()
  await page.getByLabel('Sugar (g)', { exact: true }).fill('99')
  await page.getByRole('button', { name: 'Save food', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('not been saved')
  await page.context().setOffline(false)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.goto('/settings')
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download Excel backup', exact: true }).click()
  const download = await downloading
  const path = (await download.path())!
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/)
  await page.getByRole('button', { name: 'Clear all data', exact: true }).click()
  await expect(second.getByRole('heading', { name: 'Updated private oats' })).toHaveCount(0)
  await page.getByLabel('Choose Excel backup').setInputFiles(path)
  await expect(page.getByRole('heading', { name: 'Restore preview' })).toBeVisible()
  await page.getByRole('button', { name: 'Merge missing records', exact: true }).click()
  await expect(page.getByText(/Restore complete:/)).toBeVisible()
  await expect(second.getByRole('heading', { name: 'Updated private oats' })).toBeVisible()
  await page.setViewportSize({ width: 375, height: 812 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('cloud-settings-mobile.png'), fullPage: true })
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Log in / Register', exact: true })).toBeVisible()
  await page.goto('/library')
  await expect(page.getByRole('heading', { name: 'Updated private oats' })).toHaveCount(0)
  await login(page, `bob-${Date.now()}@example.test`)
  await page.goto('/library')
  await expect(page.getByRole('heading', { name: 'Updated private oats' })).toHaveCount(0)
  await secondContext.close()
})

test('cloud sample import uses account storage and survives reload', async ({ page }, testInfo) => {
  page.on('dialog', (dialog) => dialog.accept())
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await login(page, `demo-${Date.now()}@example.test`)
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Load sample data', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sample data added', exact: true })).toBeDisabled()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Sample data added', exact: true })).toBeDisabled()
  await page.getByRole('combobox', { name: 'Color mode' }).selectOption('light')
  await page.screenshot({ path: testInfo.outputPath('cloud-settings-desktop.png'), fullPage: true })
  await page.goto('/progress')
  await expect(page.locator('main h1')).toBeVisible()
  expect(errors).toEqual([])
})

test('personal food directory imports, edits, exports and transfers without overwriting conflicts', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept())
  await login(page, `foods-alice-${Date.now()}@example.test`)
  await page.goto('/food-directory')
  await page.getByRole('button', { name: 'Add starter foods', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Food import preview' })).toContainText('60 missing')
  await page.getByRole('button', { name: 'Merge foods into my library', exact: true }).click()
  await expect(page.getByText(/Food import complete: 60 added/)).toBeVisible()
  await expect(page.locator('.directory-table tbody tr')).toHaveCount(60)
  await page.getByRole('button', { name: 'Edit Apple with skin', exact: true }).click()
  await page.getByLabel('Food name', { exact: true }).fill('My personal apple')
  await page.getByLabel('Portion notes', { exact: true }).fill('My custom serving note')
  await page.getByRole('button', { name: 'Save food', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.reload()
  await page.getByRole('tab', { name: 'My foods', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit My personal apple', exact: true })).toBeVisible()
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export my food DB', exact: true }).click()
  const path = (await (await downloading).path())!
  await page.getByLabel('Choose food directory').setInputFiles(path)
  await expect(page.getByRole('region', { name: 'Food import preview' })).toContainText('60 identical')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('tab', { name: 'Starter foods', exact: true }).click()
  await page.getByRole('button', { name: 'Add starter foods', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Food import preview' })).toContainText('1 conflicts kept')
  await page.getByRole('button', { name: 'Merge foods into my library', exact: true }).click()
  await expect(page.getByText(/Food import complete: 0 added, 59 identical, 1 conflicts kept/)).toBeVisible()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await login(page, `foods-bob-${Date.now()}@example.test`)
  await page.goto('/food-directory')
  await page.getByRole('tab', { name: 'My foods', exact: true }).click()
  await expect(page.locator('.directory-table tbody tr')).toHaveCount(0)
  await page.getByLabel('Choose food directory').setInputFiles(path)
  await expect(page.getByRole('region', { name: 'Food import preview' })).toContainText('60 missing')
  await page.getByRole('button', { name: 'Merge foods into my library', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit My personal apple', exact: true })).toBeVisible()
  await page.getByLabel('Choose food directory').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{') })
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.locator('.directory-table tbody tr')).toHaveCount(60)
})

test('local import requires consent, can be reopened, and keeps originals', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept())
  await page.goto('/')
  await page.evaluate(async () => {
    const databasePath = '/src/data/database.ts'
    const domainPath = '/src/domain/index.ts'
    const { db } = await import(databasePath)
    const { stamp } = await import(domainPath)
    await db.weights.add({ ...stamp(), date: '2026-11-01', weight: 72.25 })
  })
  await login(page, `legacy-${Date.now()}@example.test`)
  await expect(page.getByRole('dialog', { name: 'Existing browser journal' })).toBeVisible()
  await page.getByRole('button', { name: 'Skip import', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Review existing browser data' }).click()
  await page.getByRole('button', { name: 'Import into this account', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText(/Local import complete: 1 added/)).toBeVisible()
  const values = await page.evaluate(async () => {
    const databasePath = '/src/data/database.ts'
    const sessionPath = '/src/data/cloud/session.ts'
    const { db } = await import(databasePath)
    const { activeRepository } = await import(sessionPath)
    return {
      local: await db.weights.toArray(),
      cloud: (await activeRepository().snapshot()).weights,
    }
  })
  expect(values.local).toHaveLength(1)
  expect(values.local[0].ownerId).toBe('local')
  expect(values.cloud).toHaveLength(1)
  expect(values.cloud[0].id).toBe('2026-11-01')
  expect(values.cloud[0].weight).toBe(72.25)
  expect(values.cloud[0].ownerId).not.toBe('local')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Log in / Register', exact: true })).toBeVisible()
  const preview = await page.evaluate(async () => {
    const sessionPath = '/src/data/cloud/session.ts'
    const { isCloudSession, isPreviewSession, cloudSnapshot } = await import(sessionPath)
    return { cloud: isCloudSession(), demo: isPreviewSession(), weights: cloudSnapshot().data.weights.length }
  })
  expect(preview).toEqual({ cloud: false, demo: true, weights: 14 })
})

test('email registration, verification, login and password reset', async ({ page, request }, testInfo) => {
  page.on('dialog', (dialog) => dialog.accept())
  const email = `email-${Date.now()}@example.test`
  await page.goto('/')
  await expect(page.getByText(/Demo preview - two weeks/)).toBeVisible()
  await page.getByRole('button', { name: 'Log in / Register', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Continue with Google', exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('login-options-desktop.png') })
  await page.getByRole('button', { name: 'Continue with email', exact: true }).click()
  await page.getByRole('tab', { name: 'Register', exact: true }).click()
  await page.getByLabel('Email address', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('Preview-test-42!')
  await page.getByLabel('Confirm password', { exact: true }).fill('Mismatch-42!')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Passwords do not match')
  await page.getByLabel('Confirm password', { exact: true }).fill('Preview-test-42!')
  await page.setViewportSize({ width: 375, height: 812 })
  await page.screenshot({ path: testInfo.outputPath('register-mobile.png') })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Verify your email', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'I have verified my email', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('not verified yet')
  const denied = await page.evaluate(async () => {
    const servicePath = '/src/data/cloud/firebase.ts'
    const firestorePath = '/node_modules/.vite/deps/firebase_firestore.js'
    const { firebaseServices } = await import(servicePath)
    const { doc, getDocFromServer } = await import(firestorePath)
    const { auth, firestore } = firebaseServices()
    try { await getDocFromServer(doc(firestore, 'users', auth.currentUser.uid)); return false }
    catch (error) { return (error as { code: string }).code === 'permission-denied' }
  })
  expect(denied).toBe(true)
  const codes = await (await request.get('http://127.0.0.1:9099/emulator/v1/projects/demo-form-and-fuel/oobCodes')).json()
  const verification = codes.oobCodes.find((entry: { email: string; requestType: string }) => entry.email === email && entry.requestType === 'VERIFY_EMAIL')
  expect(verification).toBeDefined()
  await page.evaluate(async (code) => {
    const servicePath = '/src/data/cloud/firebase.ts'
    const authPath = '/node_modules/.vite/deps/firebase_auth.js'
    const { firebaseServices } = await import(servicePath)
    const { applyActionCode } = await import(authPath)
    await applyActionCode(firebaseServices().auth, code)
  }, verification.oobCode)
  await page.getByRole('button', { name: 'I have verified my email', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
  const records = await page.evaluate(async () => {
    const sessionPath = '/src/data/cloud/session.ts'
    const { activeRepository } = await import(sessionPath)
    const data = await activeRepository().snapshot()
    return { meals: data.meals.length, foods: data.foods.length, weights: data.weights.length }
  })
  expect(records).toEqual({ meals: 0, foods: 0, weights: 0 })
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByRole('button', { name: 'Log in / Register', exact: true }).click()
  await page.getByRole('button', { name: 'Continue with email', exact: true }).click()
  await page.getByLabel('Email address', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('Wrong-password-42!')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('incorrect')
  await page.getByRole('button', { name: 'Forgot password?', exact: true }).click()
  await page.getByRole('button', { name: 'Send reset email', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'If an account' })).toBeVisible()
  const resetCodes = await (await request.get('http://127.0.0.1:9099/emulator/v1/projects/demo-form-and-fuel/oobCodes')).json()
  const reset = resetCodes.oobCodes.find((entry: { email: string; requestType: string }) => entry.email === email && entry.requestType === 'PASSWORD_RESET')
  expect(reset).toBeDefined()
  await page.evaluate(async (code) => {
    const servicePath = '/src/data/cloud/firebase.ts'
    const authPath = '/node_modules/.vite/deps/firebase_auth.js'
    const { firebaseServices } = await import(servicePath)
    const { confirmPasswordReset } = await import(authPath)
    await confirmPasswordReset(firebaseServices().auth, code, 'Changed-test-42!')
  }, reset.oobCode)
  await page.getByRole('button', { name: 'Other sign-in options', exact: true }).click()
  await page.getByRole('button', { name: 'Continue with email', exact: true }).click()
  await page.getByLabel('Email address', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('Changed-test-42!')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
})
