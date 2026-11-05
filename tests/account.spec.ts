import { expect, test } from '@playwright/test'

for (const width of [360, 375, 768, 1100, 1440, 1920]) {
  test(`demo is automatic and login options are adjacent to settings at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 })
    await page.goto('/food')
    await expect(page).toHaveTitle('Fitness&Fuel | Fitness Journal')
    await expect(page.locator('.brand')).toContainText('Fitness&Fuel')
    if (width <= 700) await expect(page.locator('.mobile-brand')).toHaveText('Fitness&Fuel')
    if (width > 1000) {
      const brandFits = await page.locator('.brand > span:last-child').evaluate((element) => {
        const sidebar = element.closest('.sidebar')!.getBoundingClientRect()
        return element.getBoundingClientRect().right <= sidebar.right - 10
      })
      expect(brandFits).toBe(true)
    }
    await expect(page.getByText(/Demo preview - two weeks/)).toBeVisible()
    await expect(page.locator('.food-row').first()).toBeVisible()
    const count = await page.locator('.food-row').count()
    const login = page.getByRole('button', { name: 'Log in / Register', exact: true })
    expect(await login.evaluate((element) => element.previousElementSibling?.getAttribute('aria-label'))).toBe('Settings')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    const assertToolbar = async () => {
      const layout = await page.evaluate(() => {
        const date = document.querySelector('.date-picker')!.getBoundingClientRect()
        const tools = document.querySelector('.header-tools')!.getBoundingClientRect()
        const main = document.querySelector('main')!
        return {
          centerDifference: Math.abs(date.top + date.height / 2 - tools.top - tools.height / 2),
          gap: tools.left - date.right,
          toolbarRight: tools.right,
          contentRight: main.getBoundingClientRect().right - parseFloat(getComputedStyle(main).paddingRight),
        }
      })
      expect(layout.centerDifference).toBeLessThanOrEqual(1)
      expect(layout.gap).toBeGreaterThanOrEqual(0)
      expect(layout.gap).toBeLessThanOrEqual(8)
      if (width > 700) expect(Math.abs(layout.toolbarRight - layout.contentRight)).toBeLessThanOrEqual(1)
    }
    await assertToolbar()
    await page.getByRole('button', { name: 'Previous day', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible()
    await assertToolbar()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.getByRole('button', { name: 'Today', exact: true }).click()
    await page.screenshot({ path: testInfo.outputPath('demo-header.png') })
    await login.click()
    await expect(page.getByRole('button', { name: 'Continue with email', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue with Google', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue with email', exact: true })).toBeDisabled()
    await page.screenshot({ path: testInfo.outputPath('login-options.png') })
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('.food-row')).toHaveCount(count)
    await page.reload()
    await expect(page.locator('.food-row')).toHaveCount(count)
  })
}
