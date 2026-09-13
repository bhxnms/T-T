import { test, clearNotices, readSeed } from './shot'

/**
 * Top-level navigable surfaces. One capture per route; anything that needs a
 * dialog opened or a tab clicked lives in its own spec so a failure there
 * cannot take these down with it.
 *
 * Names are the target filenames in wiki/assets/ — see docs/screenshot-map.md
 * for which wiki page consumes which file.
 */

type ScreenshotSeed = { tripId: number; collectionId?: number; journeyId?: number }
const seed = (): ScreenshotSeed => readSeed<ScreenshotSeed>()

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard')
  await clearNotices(page)
})

test('dashboard', async ({ page, shot }) => {
  await page.goto('/dashboard')
  await clearNotices(page)
  await shot.page_('DashboardWidgets')
})

test('trip planner', async ({ page, shot }) => {
  await page.goto(`/trips/${seed().tripId}`)
  await shot.page_('TripPlanner')
})

test('atlas', async ({ page, shot }) => {
  await page.goto('/atlas')
  await shot.page_('Atlas')
})

test('vacay', async ({ page, shot }) => {
  await page.goto('/vacay')
  await shot.page_('Vacay')
})

test('collections', async ({ page, shot }) => {
  await page.goto('/collections')
  await shot.page_('Collections')
})

test('journey', async ({ page, shot }) => {
  await page.goto('/journey')
  await shot.page_('Journey')
})

test('notifications inbox', async ({ page, shot }) => {
  await page.goto('/notifications')
  await shot.page_('NotificationsInbox')
})

test('in-app help', async ({ page, shot }) => {
  await page.goto('/help')
  await shot.page_('HelpInApp')
})

test('files', async ({ page, shot }) => {
  await page.goto(`/trips/${seed().tripId}/files`)
  await shot.page_('Files')
})
