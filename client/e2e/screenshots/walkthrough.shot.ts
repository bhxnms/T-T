import { test, clearNotices, readSeed, SHOT_LANG, tripTab } from './shot'
import type { Page } from '@playwright/test'

/**
 * Animated walkthroughs, recorded as MP4.
 *
 * These replace the six GIFs the wiki used to ship (13 MB between them, the
 * largest 9.1 MB on its own — a third of the whole asset directory). A short
 * MP4 is a fraction of that at better quality, and streams instead of forcing a
 * full download before the first frame.
 *
 * The interaction is the point, so unlike a still capture these settle the page
 * FIRST and then act, letting the motion play out. `Shot.walkthrough` registers
 * the recording; shot.ts's afterEach closes the page and moves the file, because
 * Playwright only finalises a video when the context closes.
 */

type ScreenshotSeed = { tripId: number; dayIds: number[]; placeIds: number[] }
const seed = (): ScreenshotSeed => readSeed<ScreenshotSeed>()

/** The trip's tab bar labels, per language (`trip.tabs.*`). */
const costsTab = () => tripTab('Costs')

/** Open the trip's Costs tab, where the money walkthroughs happen. */
async function openCosts(page: Page) {
  await page.getByRole('button', { name: costsTab(), exact: true }).first().click()
  await page.waitForTimeout(900)
}

test.describe.configure({ timeout: 150_000 })

test.describe('budget walkthroughs', () => {
  test('creating a budget entry', async ({ page, shot }) => {
    await page.goto(`/trips/${seed().tripId}`)
    await clearNotices(page)
    await openCosts(page)

    await shot.walkthrough('BudgetCreateBudget', async () => {
      // Creating a budget here means adding a spending category: the empty state
      // renders a name field (budget.emptyPlaceholder: "Enter category name…" /
      // 「输入分类名称...」) plus a create button. Typing into that field is the
      // motion the wiki illustrates, so drive the field directly rather than
      // hunting for a "+" that the empty state does not have.
      const field = page.getByPlaceholder(SHOT_LANG === 'zh' ? /分类名称/ : /category name/i).first()
      if (await field.isVisible().catch(() => false)) {
        await field.click()
        await page.keyboard.type(SHOT_LANG === 'zh' ? '交通' : 'Transport')
        await page.waitForTimeout(700)
        await page.keyboard.press('Enter')
        await page.waitForTimeout(1000)
      }
    })
  })

  test('adding an expense', async ({ page, shot }) => {
    await page.goto(`/trips/${seed().tripId}`)
    await clearNotices(page)
    await openCosts(page)

    await shot.walkthrough('BudgetAddExpensive', async () => {
      await page.getByRole('button', { name: /add expense|add|支出|新增/i }).first().click()
      await page.waitForTimeout(800)
      await page.keyboard.type('Shinkansen tickets')
      await page.waitForTimeout(500)
      await page.keyboard.press('Tab')
      await page.keyboard.type('14000')
      await page.waitForTimeout(900)
    })
  })

  test('final settlement', async ({ page, shot }) => {
    await page.goto(`/trips/${seed().tripId}`)
    await clearNotices(page)
    await openCosts(page)

    await shot.walkthrough('BudgetFinalSettlement', async () => {
      // Open the settle-up view; the balances it lists are what the wiki shows.
      await page.getByText(/settle|结算/i).first().click().catch(() => {})
      await page.waitForTimeout(1200)
    })
  })
})

test.describe('day plan walkthroughs', () => {
  test('adding a place by button', async ({ page, shot }) => {
    await page.goto(`/trips/${seed().tripId}`)
    await clearNotices(page)

    await shot.walkthrough('DayItineraryAddPlaceByButton', async () => {
      // The probe showed the real control is labelled "Add Place/Activity".
      await page.getByRole('button', { name: /add place|添加地点/i }).first().click()
      await page.waitForTimeout(1000)
      await page.keyboard.type('Nishiki')
      await page.waitForTimeout(1200)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(900)
    })
  })

  test('removing a place by button', async ({ page, shot }) => {
    await page.goto(`/trips/${seed().tripId}`)
    await clearNotices(page)

    await shot.walkthrough('DayItineraryRemovePlaceByButton', async () => {
      // Hover a placed row so its controls appear, then remove it. The probe
      // listed real place names, so match one of those.
      const row = page.getByText(/Senso-ji|teamLab|Nishiki/i).first()
      if (await row.isVisible().catch(() => false)) {
        await row.hover()
        await page.waitForTimeout(600)
        // The row's own menu button, not the page-level controls.
        const remove = page.getByRole('button', { name: /remove|delete|移除|删除/i }).first()
        if (await remove.isVisible().catch(() => false)) {
          await remove.click()
        } else {
          await page.keyboard.press('Delete')
        }
        await page.waitForTimeout(1200)
      }
    })
  })

  test('adding a place by dragging', async ({ page, shot }) => {
    await page.goto(`/trips/${seed().tripId}`)
    await clearNotices(page)
    await page.waitForTimeout(1500)

    await shot.walkthrough('DayItineraryAddPlaceDragging', async () => {
      // Drag a placed row from one day column onto another — visible motion,
      // which is the whole reason this one is a recording.
      const draggable = page.locator('[draggable="true"]').first()
      if (!(await draggable.isVisible().catch(() => false))) return
      const from = await draggable.boundingBox()
      // Aim at a lower day header, so the drop target is a different day.
      const target = page.getByText(/Day 3|第 3 天/i).first()
      const to = await target.boundingBox().catch(() => null)
      if (!from || !to) return

      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
      await page.mouse.down()
      // Step the move: HTML5 dragstart does not fire on a single jump.
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 25 })
      await page.waitForTimeout(500)
      await page.mouse.up()
      await page.waitForTimeout(1000)
    })
  })
})
