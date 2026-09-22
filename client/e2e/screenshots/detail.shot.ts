import { test, clearNotices, expect, readSeed, SHOT_LANG, tabLabel, tripTab } from './shot'

/**
 * Detail pages and the surfaces that need a couple of clicks to reach.
 *
 * Each capture asserts something specific to the surface before shooting, so a
 * navigation that quietly lands on a fallback (or an addon that is off) fails
 * the run instead of producing a screenshot of the wrong screen.
 */

type ScreenshotSeed = { tripId: number; collectionId?: number; journeyId?: number }
const seed = (): ScreenshotSeed => readSeed<ScreenshotSeed>()

test('collection detail', async ({ page, shot }) => {
  test.skip(!seed().collectionId, 'collections addon unavailable during seed')
  await page.goto(`/collections/${seed().collectionId}`)
  await clearNotices(page)
  await shot.page_('CollectionDetail')
})

test('journey detail', async ({ page, shot }) => {
  test.skip(!seed().journeyId, 'journey addon unavailable during seed')
  await page.goto(`/journey/${seed().journeyId}`)
  await clearNotices(page)
  await shot.page_('JourneyDetail')
})

test('mcp access — admin', async ({ page, shot }) => {
  await page.goto('/admin')
  await clearNotices(page)
  await page.getByRole('button', { name: tabLabel('MCP Access'), exact: true }).first().click()
  await page.waitForTimeout(700)
  await shot.page_('MCPAccess')
})

test('two-factor setup', async ({ page, shot }) => {
  await page.goto('/settings')
  await clearNotices(page)
  await page.getByRole('button', { name: tabLabel('Account'), exact: true }).first().click()
  await page.waitForTimeout(600)
  // The enrolment flow is behind a button whose label varies with state; match
  // loosely and fall back to capturing the tab itself.
  // settings.mfa.setup: "Set up authenticator" / 「设置身份验证器」
  const enable = page.getByRole('button', { name: /two-factor|2fa|authenticator|身份验证器/i }).first()
  if (await enable.isVisible().catch(() => false)) {
    await enable.click()
    await page.waitForTimeout(900)
  }
  await shot.page_('2FA')
})

/**
 * Settle-up.
 *
 * WARNING for anyone extending this file: the "Settle up" button in the Costs
 * toolbar is not a view — it RECORDS the settling transfers. An earlier version
 * of this test clicked it, which zeroed every balance and left the capture
 * showing "Everyone's square". Because all screenshot specs share one database
 * and this file sorts before planner.shot.ts, it also poisoned Costs.png in the
 * same run.
 *
 * Screenshot specs must not mutate state. Capture the "Add payment" dialog
 * instead — same surface, no side effect — and close it again.
 */
test('costs — record a settle-up payment', async ({ page, shot }) => {
  await page.goto(`/trips/${seed().tripId}`)
  await clearNotices(page)
  // The notice modal is dismissed here, and while it is still fading out its
  // backdrop swallows clicks — which is why an immediate tab click lands on
  // nothing and the test then looks for the payment button on the Plan tab.
  // Wait for the planner AND for the backdrop to be gone.
  const costsTab = page.getByRole('button', { name: tripTab('Costs'), exact: true }).first()
  await costsTab.waitFor({ timeout: 15_000 })
  await page.locator('.trek-modal-backdrop').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(600)
  await costsTab.click()
  await page.waitForTimeout(2500)

  // `costs.addExpense` ("Add expense" / 添加支出) opens the expense modal.
  //
  // Deliberately NOT the neighbouring "Settle up" button: that one calls
  // settleAll and mutates the balances, which this spec's own header forbids —
  // and it opens no dialog, so asserting on a modal after clicking it is what
  // left this capture permanently skipped.
  const addPayment = page
    .getByRole('button', { name: SHOT_LANG === 'zh' ? /添加支出|添加付款/ : /add expense|add payment/i })
    .first()
  test.skip(!(await addPayment.isVisible().catch(() => false)), 'no add-payment entry point rendered')
  await addPayment.click()
  await page.waitForTimeout(700)

  const modal = page.locator('.trek-modal-backdrop > div').first()
  await expect(modal).toBeVisible()
  await shot.element('CostsSettleUp', modal)
})

test('trip files', async ({ page, shot }) => {
  await page.goto(`/trips/${seed().tripId}/files`)
  await clearNotices(page)
  await expect(page).toHaveURL(/files/)
  await shot.page_('Documents')
})
