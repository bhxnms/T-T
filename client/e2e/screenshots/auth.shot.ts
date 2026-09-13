import { test, expect } from './shot'

/**
 * Unauthenticated surfaces. An explicit empty state is required here: `undefined`
 * leaves the screenshots project's inherited admin state in place.
 */
test.use({ storageState: { cookies: [], origins: [] } })

test('login page', async ({ page, shot }) => {
  await page.goto('/login')
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await shot.page_('Login')
})

test('registration page', async ({ page, shot }) => {
  await page.goto('/register')
  await page.waitForTimeout(500)
  await shot.page_('Registration')
})

test('forgot password', async ({ page, shot }) => {
  await page.goto('/forgot-password')
  await page.waitForTimeout(500)
  await shot.page_('PasswordReset')
})
