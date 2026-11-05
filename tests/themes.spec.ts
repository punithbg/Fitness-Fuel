import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('theme selection persists and follows system changes only when requested', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.goto('/settings')
  await expect(page.getByRole('combobox', { name: 'Color mode' })).toHaveValue('dark')
  await page.getByRole('combobox', { name: 'Color mode' }).selectOption('system')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('combobox', { name: 'Color mode' }).selectOption('light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('dark is the fallback when theme storage is unavailable', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'getItem', {
      value: () => {
        throw new Error('Storage unavailable')
      },
    })
  })
  await page.goto('/settings')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('combobox', { name: 'Color mode' })).toHaveValue('dark')
})

test('the downloadable fixture is a complete fourteen-day journal', async ({ page }) => {
  await page.goto('/settings')
  const downloadReady = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download two-week JSON' }).click()
  const download = await downloadReady
  expect(download.suggestedFilename()).toBe('two-week-demo.json')
  const fixture = JSON.parse(await readFile((await download.path())!, 'utf8'))
  expect(fixture.days).toHaveLength(14)
  expect(fixture.days.filter((day: { workout?: unknown }) => day.workout)).toHaveLength(8)
  expect(fixture.days[0].date).toBe(fixture.startDate)
  expect(fixture.days.at(-1).date).toBe(fixture.endDate)
})

for (const theme of ['light', 'dark'] as const) {
  for (const width of [375, 768, 1440]) {
    test(`${theme} theme across pages and forms at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 })
      await page.emulateMedia({ colorScheme: theme })
      await page.addInitScript((preference) => {
        localStorage.setItem('form-and-fuel-theme', preference)
      }, theme)
      page.on('dialog', (dialog) => dialog.accept())
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto('/')
      await expect(page.getByText(/Demo preview - two weeks/)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Load sample data', exact: true })).toHaveCount(
        0,
      )
      for (const route of ['/', '/food', '/workouts', '/library', '/progress', '/settings']) {
        await page.goto(route)
        await expect(page.locator('main h1')).toBeVisible()
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          route,
        ).toBe(true)
        const bodyColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
        expect(bodyColor).toBe(theme === 'dark' ? 'rgb(32, 32, 36)' : 'rgb(246, 246, 248)')
        await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
          'content',
          theme === 'dark' ? '#202024' : '#f6f6f8',
        )
        const primaryColor = await page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
        )
        expect(primaryColor).toBe(theme === 'dark' ? '#eaa16a' : '#bf4b09')
        if (route === '/') {
          const chartGreen = theme === 'dark' ? 'rgb(106, 195, 159)' : 'rgb(8, 118, 90)'
          const ringBackground = await page
            .locator('.calorie-ring')
            .evaluate((element) => getComputedStyle(element).backgroundImage)
          expect(ringBackground).toContain(chartGreen)
          await expect(page.locator('.recharts-bar-rectangle path').first()).toHaveCSS(
            'fill',
            chartGreen,
          )
        }
        if (route === '/settings') {
          const swatches = await page
            .locator('.palette-swatches .swatch')
            .evaluateAll((elements) =>
              elements.map((element) => getComputedStyle(element).backgroundColor),
            )
          expect(swatches).toEqual(
            theme === 'dark'
              ? [
                  'rgb(234, 161, 106)',
                  'rgb(215, 128, 108)',
                  'rgb(201, 175, 117)',
                  'rgb(181, 154, 205)',
                ]
              : ['rgb(191, 75, 9)', 'rgb(232, 121, 97)', 'rgb(139, 101, 21)', 'rgb(128, 98, 179)'],
          )
        }
        if (
          route === '/' ||
          route === '/library' ||
          route === '/settings' ||
          route === '/progress'
        ) {
          await page.evaluate(() => document.fonts.ready)
          await page.screenshot({
            path: testInfo.outputPath(
              `${theme}-${route === '/' ? 'overview' : route.slice(1)}-${width}.png`,
            ),
            fullPage: true,
          })
        }
        if (route === '/workouts') {
          await page.getByRole('button', { name: 'Log workout', exact: true }).first().click()
          await page
            .getByRole('combobox', { name: 'Start from a routine' })
            .selectOption({ label: 'Full body A' })
          await expect(page.locator('.set-row')).toHaveCount(6)
          expect(
            await page
              .getByRole('dialog')
              .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth + 1),
          ).toBe(true)
          await page.screenshot({ path: testInfo.outputPath(`${theme}-workout-form-${width}.png`) })
          await page.getByRole('button', { name: 'Cancel', exact: true }).click()
        }
      }
      expect(errors).toEqual([])
    })
  }
}
