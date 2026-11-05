import { expect, test, type Page } from '@playwright/test'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { initializeCloudTests, login } from './helpers/cloud'

let environment: RulesTestEnvironment | undefined
test.beforeAll(async ({}, testInfo) => {
  if (testInfo.project.name === 'journal') environment = await initializeCloudTests()
})
test.afterAll(async () => { await environment?.cleanup() })
test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(() =>
    Object.defineProperty(window.crypto, 'randomUUID', { value: undefined }),
  )
  if (testInfo.tags.includes('@cloud')) await login(page, `workflow-${Date.now()}@example.test`)
})

async function createFood(page: Page) {
  await page.goto('/library')
  await page.getByRole('button', { name: 'New food', exact: true }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Food name', { exact: true }).fill('Test oats')
  for (const [label, value] of [
    ['Calories (kcal)', '200'],
    ['Protein (g)', '10'],
    ['Carbs (g)', '20'],
    ['Fat (g)', '8'],
    ['Fiber (g)', '2'],
    ['Sugar (g)', '4'],
  ])
    await dialog.getByLabel(label, { exact: true }).fill(value)
  await dialog.getByLabel('Serving name (optional)').fill('scoop')
  await dialog.getByLabel('One serving equals (g, optional)').fill('30')
  await dialog.getByRole('button', { name: 'Save food' }).click()
  await expect(dialog).toHaveCount(0)
}
test('food portions, favorites, history snapshots, copy, edit, delete, and persistence', { tag: '@cloud' }, async ({
  page,
}) => {
  page.on('dialog', (dialog) => dialog.accept())
  await createFood(page)
  await page.getByRole('button', { name: 'Favorite Test oats', exact: true }).click()
  await page.getByLabel('Favorites', { exact: true }).check()
  await expect(page.getByRole('heading', { name: 'Test oats' })).toBeVisible()
  await page.goto('/food')
  await page.getByLabel('Selected date').fill('2026-11-02')
  await page.getByRole('button', { name: 'Add food to Breakfast' }).click()
  await page.getByLabel('Quantity', { exact: true }).fill('150')
  await expect(page.locator('.nutrition-preview')).toContainText('300')
  await page.getByRole('button', { name: 'Save entry' }).click()
  await expect(page.locator('.food-row')).toHaveCount(1)
  await expect(page.locator('.food-energy')).toContainText('300')
  await expect(page.locator('.food-macro').filter({ hasText: 'Sugar' })).toContainText('6 g')
  await expect(page.locator('.stat').filter({ hasText: 'Sugar' })).toContainText('6')
  await page.goto('/library')
  await page.getByRole('button', { name: 'Edit Test oats', exact: true }).click()
  await page.getByLabel('Calories (kcal)', { exact: true }).fill('1')
  await page.getByLabel('Sugar (g)', { exact: true }).fill('0')
  await page.getByRole('button', { name: 'Save food' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.goto('/food')
  await page.getByLabel('Selected date').fill('2026-11-02')
  await expect(page.locator('.food-energy')).toContainText('300')
  await page.getByRole('button', { name: 'Copy day', exact: true }).click()
  await page.getByLabel('Destination date').fill('2026-11-03')
  await page.getByRole('button', { name: 'Copy entries' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByLabel('Selected date').fill('2026-11-03')
  await expect(page.locator('.food-energy')).toContainText('300')
  await expect(page.locator('.food-macro').filter({ hasText: 'Sugar' })).toContainText('6 g')
  await page.getByRole('button', { name: 'Edit Test oats entry' }).click()
  await page.getByLabel('Quantity', { exact: true }).fill('200')
  await page.getByRole('button', { name: 'Save entry' }).click()
  await expect(page.locator('.food-energy')).toContainText('400')
  await page.reload()
  await page.getByLabel('Selected date').fill('2026-11-03')
  await expect(page.locator('.food-energy')).toContainText('400')
  await expect(page.locator('.food-macro').filter({ hasText: 'Sugar' })).toContainText('8 g')
  await page.goto('/progress')
  await page.getByRole('tab', { name: 'Custom' }).click()
  await page.getByLabel('From', { exact: true }).fill('2026-11-02')
  await page.getByLabel('To', { exact: true }).fill('2026-11-03')
  await page.getByRole('combobox', { name: 'Nutrition chart metric' }).selectOption('sugar')
  await expect(
    page.getByRole('img', { name: 'Sugar across 2 logged days; total 14 grams' }),
  ).toBeVisible()
  await page.goto('/food')
  await page.getByLabel('Selected date').fill('2026-11-03')
  await page.getByRole('button', { name: 'Delete Test oats entry' }).click()
  await expect(page.locator('.food-row')).toHaveCount(0)
  await page.getByLabel('Selected date').fill('2026-11-02')
  await expect(page.locator('.food-row')).toHaveCount(1)
})
test('exercise catalog, reusable routines, set logging, manual calories, and reports', { tag: '@cloud' }, async ({
  page,
}) => {
  page.on('dialog', (dialog) => dialog.accept())
  await page.goto('/library')
  await page.getByRole('tab', { name: 'Exercises', exact: true }).click()
  await page.getByRole('button', { name: 'New exercise', exact: true }).first().click()
  await page.getByLabel('Exercise name').fill('Bench press')
  await page.getByLabel('Muscle group').fill('Chest')
  await page.getByRole('button', { name: 'Save exercise' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Routines', exact: true }).click()
  await page.getByRole('button', { name: 'New routine', exact: true }).first().click()
  await page.getByLabel('Routine name').fill('Upper body')
  await page
    .getByRole('combobox', { name: 'Exercise', exact: true })
    .selectOption({ label: 'Bench press' })
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click()
  await page.getByLabel('Bench press set 1 kg').fill('20')
  await page.getByRole('button', { name: 'Add set', exact: true }).click()
  await page.getByLabel('Bench press set 2 reps').fill('8')
  await page.getByLabel('Bench press set 2 kg').fill('25')
  await page.getByRole('button', { name: 'Save routine' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.goto('/workouts')
  await page.getByRole('button', { name: 'Log workout', exact: true }).first().click()
  await page.getByLabel('Start from a routine').selectOption({ label: 'Upper body' })
  await page.getByLabel('Duration (minutes)').fill('45')
  await page.getByLabel('Calories burned (optional)').fill('300')
  await page.getByLabel('Bench press set 1 RPE').fill('7.5')
  await page.getByRole('button', { name: 'Save workout' }).click()
  await expect(page.locator('.workout-card')).toContainText('400 kg volume')
  await expect(page.locator('.workout-card')).toContainText('300 kcal recorded')
  await page.reload()
  await expect(page.locator('.workout-card')).toContainText('RPE 7.5')
  await page.getByRole('button', { name: 'Edit Upper body', exact: true }).click()
  await page.getByRole('button', { name: 'Remove Bench press', exact: true }).click()
  await expect(page.locator('.exercise-editor')).toHaveCount(0)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.goto('/progress')
  await page.getByRole('tab', { name: 'All time' }).click()
  await expect(page.locator('.stat').filter({ hasText: 'Recorded gym burn' })).toContainText('300')
  await expect(
    page.getByRole('img', { name: /Maximum load: 1 recorded values; latest 25 kg/ }),
  ).toBeVisible()
})
test('goals, categories, body-weight edits and valid custom ranges', { tag: '@cloud' }, async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept())
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Set goals', exact: true }).click()
  await page.getByLabel('Effective from').fill('2026-11-01')
  await page.getByLabel('Calories (kcal)', { exact: true }).fill('2200')
  await page.getByLabel('Protein (g)', { exact: true }).fill('140')
  await page.getByLabel('Sugar (g)', { exact: true }).fill('45')
  await page.getByRole('button', { name: 'Save goals' }).click()
  await expect(page.locator('.goal-row')).toContainText('2,200')
  await expect(page.locator('.goal-row')).toContainText('Sugar 45 g')
  await page.reload()
  await expect(page.locator('.goal-row')).toContainText('Sugar 45 g')
  await page.getByRole('button', { name: 'New category', exact: true }).click()
  await page.getByLabel('Category name').fill('Post-workout')
  await page.getByRole('button', { name: 'Save category' }).click()
  await expect(page.getByRole('button', { name: 'Edit Post-workout category' })).toBeVisible()
  await page.goto('/progress')
  await page.getByRole('button', { name: 'Log weight', exact: true }).click()
  await page.getByLabel('Measurement date').fill('2026-11-01')
  await page.getByLabel('Body weight (kg)').fill('74.5')
  await page.getByRole('button', { name: 'Save weight' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Custom' }).click()
  await page.getByLabel('From', { exact: true }).fill('2026-11-01')
  await page.getByLabel('To', { exact: true }).fill('2026-11-03')
  await expect(page.locator('.stat').filter({ hasText: 'Latest body weight' })).toContainText(
    '74.5',
  )
  await page.getByText('Measurements (1)', { exact: true }).click()
  await page.getByRole('button', { name: 'Edit weight 2026-11-01' }).click()
  await page.getByLabel('Body weight (kg)').fill('74.2')
  await page.getByRole('button', { name: 'Save weight' }).click()
  await expect(page.locator('.stat').filter({ hasText: 'Latest body weight' })).toContainText(
    '74.2',
  )
  await page.getByLabel('From', { exact: true }).fill('2026-11-04')
  await expect(page.getByRole('alert')).toContainText('Start date must be on or before end date')
})
for (const viewport of [
  { width: 360, height: 740 },
  { width: 375, height: 812 },
  { width: 812, height: 375 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 1000 },
]) {
  test(`responsive app and forms at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('dialog', (dialog) => dialog.accept())
    await page.goto('/')
    await expect(page.getByText(/Demo preview - two weeks/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Load sample data', exact: true })).toHaveCount(0)
    for (const path of ['/', '/food', '/workouts', '/library', '/progress', '/settings']) {
      const navNames: Record<string, string> = {
        '/': 'Overview',
        '/food': 'Food diary',
        '/workouts': 'Workouts',
        '/library': 'Library',
        '/progress': 'Progress',
      }
      if (path === '/settings')
        await page.locator('.topbar').getByRole('link', { name: 'Settings', exact: true }).click()
      else
        await page
          .getByRole('navigation', {
            name: viewport.width <= 700 ? 'Mobile navigation' : 'Main navigation',
            exact: true,
          })
          .getByRole('link', { name: navNames[path], exact: true })
          .click()
      await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : path + '$'}`))
      await expect(page.locator('main h1')).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      await expect(page.locator('.app-error')).toHaveCount(0)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        `No horizontal overflow on ${path}`,
      ).toBe(true)
      await expect
        .poll(() =>
          page
            .locator('img')
            .evaluateAll((images) =>
              images.every((image) => image.complete && image.naturalWidth > 0),
            ),
        )
        .toBe(true)
      if (path === '/' || path === '/food' || path === '/library')
        await page.screenshot({
          path: testInfo.outputPath(
            `${path === '/' ? 'overview' : path.slice(1)}-${viewport.width}.png`,
          ),
          fullPage: true,
        })
      if (path === '/food') {
        await expect(page.locator('.food-macro').filter({ hasText: 'Sugar' }).first()).toBeVisible()
        await page.getByRole('button', { name: 'Add food to Breakfast' }).click()
        await expect(page.locator('.nutrition-preview')).toContainText('Sugar')
        await expect(page.locator('.nutrition-preview > div')).toHaveCount(6)
        expect(
          await page
            .getByRole('dialog')
            .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth + 1),
        ).toBe(true)
        await page.screenshot({ path: testInfo.outputPath(`food-form-${viewport.width}.png`) })
        await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      }
      if (path === '/workouts') {
        await page.getByRole('button', { name: 'Log workout', exact: true }).first().click()
        await page.getByLabel('Start from a routine').selectOption({ label: 'Full body A' })
        await expect(page.locator('.set-row')).toHaveCount(6)
        expect(
          await page
            .getByRole('dialog')
            .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth + 1),
        ).toBe(true)
        await page.screenshot({ path: testInfo.outputPath(`workout-form-${viewport.width}.png`) })
        await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      }
      if (path === '/settings')
        await expect(
          page.getByRole('button', { name: 'Sample data added', exact: true }),
        ).toBeDisabled()
    }
    expect(errors).toEqual([])
  })
}
