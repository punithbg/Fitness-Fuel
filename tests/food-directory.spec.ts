import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

for (const width of [360, 768, 1440]) {
  test(`food directory search, export and layout at ${width}px`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/food-directory')
    await expect(page.getByRole('heading', { name: 'Food directory', exact: true })).toBeVisible()
    await expect(page.locator('.directory-table tbody tr')).toHaveCount(60)
    await expect(page.locator('.date-picker')).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Add starter foods', exact: true }),
    ).toBeDisabled()
    const downloading = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export starter DB', exact: true }).click()
    const download = await downloading
    const directory = JSON.parse(readFileSync((await download.path())!, 'utf8'))
    expect(directory.format).toBe('form-and-fuel-foods')
    expect(directory.foods).toHaveLength(60)
    await page.getByRole('combobox', { name: 'Food group', exact: true }).selectOption('Chicken')
    await page.getByRole('combobox', { name: 'Preparation', exact: true }).selectOption('Raw')
    await page.getByRole('textbox', { name: 'Search food directory' }).fill('bone-in')
    await expect(page.locator('.directory-table tbody tr')).toHaveCount(1)
    await page.getByText('Portion & source', { exact: true }).click()
    await expect(page.getByText(/Exclude bones from the logged weight/)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
    if (width === 360) {
      const table = page.getByRole('region', { name: 'Food nutrient table' })
      expect(
        await table.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      ).toBe(true)
      const positions = await page
        .locator('.mobile-nav a')
        .evaluateAll((links) => links.map((link) => link.getBoundingClientRect().top))
      expect(new Set(positions).size).toBe(1)
    }
    await page.screenshot({ path: testInfo.outputPath('food-directory.png'), fullPage: true })
    await page.getByRole('tab', { name: 'My foods', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Export my food DB', exact: true }),
    ).toBeDisabled()
    expect(errors).toEqual([])
  })
}
