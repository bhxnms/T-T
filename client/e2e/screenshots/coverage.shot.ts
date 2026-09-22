import { test, clearNotices, readSeed, SHOT_LANG, tabLabel } from './shot'
import type { Page } from '@playwright/test'

/**
 * The screens the wiki references that the original capture run never covered.
 *
 * Kept in its own file rather than folded into pages.shot.ts / dialogs.shot.ts
 * so a failure here cannot take the long-standing captures down with it — these
 * reach deeper into the UI (panels inside tabs inside a trip) and are the more
 * likely ones to drift.
 *
 * Names are the target filenames in wiki/assets/, so the mapping from capture to
 * doc page stays literal.
 */

type ScreenshotSeed = {
  tripId: number
  memberIds: number[]
  dayIds: number[]
  placeIds: number[]
  collectionId?: number
  journeyId?: number
}
const seed = (): ScreenshotSeed => readSeed<ScreenshotSeed>()

/**
 * The trip's tab bar is a row of BUTTONS (not ARIA tabs), and its labels are
 * translated — so a selector written against the English word only works for the
 * English pass. These are the `trip.tabs.*` values in both languages.
 */
const TAB = {
  plan: { en: 'Plan', zh: '计划' },
  transports: { en: 'Transports', zh: '交通' },
  book: { en: 'Book', zh: '预订' },
  lists: { en: 'Lists', zh: '列表' },
  costs: { en: 'Costs', zh: '费用' },
  files: { en: 'Files', zh: '文件' },
  collab: { en: 'Collab', zh: '协作' },
} as const

const label = (key: keyof typeof TAB): string => TAB[key][SHOT_LANG === 'zh' ? 'zh' : 'en']

/** Click one of the trip's own tabs. Tolerates the tab not existing. */
async function openTripTab(page: Page, key: keyof typeof TAB) {
  const name = label(key)
  const btn = page.getByRole('button', { name, exact: true }).first()
  if (await btn.isVisible().catch(() => false)) {
    await btn.click()
  } else {
    // Fall back to a substring match for labels that carry a count badge.
    await page.getByRole('button', { name: new RegExp(name, 'i') }).first().click().catch(() => {})
  }
  await page.waitForTimeout(800)
}

/** Click one of the Settings/Admin sidebar tabs (also plain buttons). */
async function openSidebarTab(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).first().click().catch(async () => {
    await page.getByRole('button', { name: new RegExp(name, 'i') }).first().click().catch(() => {})
  })
  await page.waitForTimeout(700)
}

// These reach deeper than the original capture set — panels inside tabs, inside
// a trip — and each step waits for a real UI settle, so the default 45 s budget
// is tight when the whole suite runs in one worker.
test.describe.configure({ timeout: 120_000 })

test.describe('trip surfaces the wiki documents', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/trips/${seed().tripId}`)
    await clearNotices(page)
  })

  test('trip planner with a map route', async ({ page, shot }) => {
    // TripPlannerWithPlane is the map-forward view: the wiki uses it to open
    // Trip-Planner-Overview and Map-Features.
    await page.waitForTimeout(1200)
    await shot.page_('TripPlannerWithPlane')
  })

  test('route optimization panel', async ({ page, shot }) => {
    const optimize = page.getByRole('button', { name: /optimi[sz]e|优化/i }).first()
    if (await optimize.isVisible().catch(() => false)) {
      await optimize.click()
      await page.waitForTimeout(1000)
    }
    await shot.page_('OptimizeRoute')
  })

  test('weather forecast strip', async ({ page, shot }) => {
    // Weather renders in the day detail; opening a day is what reveals it.
    await page.getByText(/Day 2|第 2 天/i).first().click().catch(() => {})
    await page.waitForTimeout(1200)
    await shot.page_('Weather')
  })

  test('day sidebar with a hotel reservation', async ({ page, shot }) => {
    // Accommodations shows this in a narrow day column, not the full planner.
    await page.setViewportSize({ width: 900, height: 900 })
    await page.waitForTimeout(900)
    await shot.page_('Hotel-ReservationDaySidebar')
  })

  test('costs tab', async ({ page, shot }) => {
    await openTripTab(page, 'costs')
    await shot.page_('Budget')
  })

  test('packing list tab', async ({ page, shot }) => {
    // The Lists tab holds TWO sub-tabs (probe: "Packing List9" and "To-Do3",
    // the trailing digit being the open-item count) — Packing Lists and Todos
    // share one addon, exactly as the wiki pages describe.
    await openTripTab(page, 'lists')
    await page.getByRole('button', { name: /packing list|行李清单/i }).first().click().catch(() => {})
    await page.waitForTimeout(900)
    await shot.page_('PackingListsTab')
  })

  test('todos sub-tab', async ({ page, shot }) => {
    // The wiki's Todos page points at this sub-tab of the same Lists panel.
    await openTripTab(page, 'lists')
    await page.getByRole('button', { name: /to-?do|待办/i }).first().click().catch(() => {})
    await page.waitForTimeout(900)
    await shot.page_('Todos')
  })

  test('files tab', async ({ page, shot }) => {
    await openTripTab(page, 'files')
    await shot.page_('DocumentsTab')
  })

  test('bookings tab', async ({ page, shot }) => {
    await openTripTab(page, 'book')
    await shot.page_('BookingsTab')
  })

  test('transports tab', async ({ page, shot }) => {
    await openTripTab(page, 'transports')
    await shot.page_('TransportsTab')
  })
})

test.describe('dialogs the wiki documents', () => {
  test('add-place dialog with autocomplete', async ({ page, shot }) => {
    await page.goto(`/trips/${seed().tripId}`)
    await clearNotices(page)
    const add = page.getByRole('button', { name: /add place|添加地点/i }).first()
    if (await add.isVisible().catch(() => false)) {
      await add.click()
      await page.waitForTimeout(600)
      // Type into the dialog's search field so the autocomplete has results.
      const search = page.getByRole('textbox').last()
      await search.fill('Senso').catch(() => {})
      await page.waitForTimeout(1500)
    }
    await shot.page_('PlaceAutocomplete')
  })

  test('hotel reservation editor', async ({ page, shot }) => {
    await page.goto(`/trips/${seed().tripId}`)
    await clearNotices(page)
    await openTripTab(page, 'book')
    const row = page.getByText(/ryokan|hotel|住宿|旅馆/i).first()
    if (await row.isVisible().catch(() => false)) {
      await row.click()
      await page.waitForTimeout(1000)
    }
    await shot.page_('Hotel-ReservationCard')
  })

  test('invite link form', async ({ page, shot }) => {
    await page.goto('/admin')
    await clearNotices(page)
    await openSidebarTab(page, tabLabel('Users'))
    const create = page.getByRole('button', { name: /create link|new link|invite|创建链接|邀请/i }).first()
    if (await create.isVisible().catch(() => false)) {
      await create.click()
      await page.waitForTimeout(800)
    }
    await shot.page_('InviteLinkForm')
  })

  test('permission settings panel', async ({ page, shot }) => {
    await page.goto('/admin')
    await clearNotices(page)
    // Not its own tab: the permission matrix is a panel further down the Users
    // tab, so we open Users and scroll to it.
    await openSidebarTab(page, tabLabel('Users'))
    await page.getByText(/permission|权限/i).first().scrollIntoViewIfNeeded().catch(() => {})
    await page.waitForTimeout(700)
    await shot.page_('PermissionSettings')
  })

  test('PDF export preview', async ({ page, shot }) => {
    await page.goto(`/trips/${seed().tripId}`)
    await clearNotices(page)
    const exportBtn = page.getByRole('button', { name: /export|导出/i }).first()
    if (await exportBtn.isVisible().catch(() => false)) {
      await exportBtn.click()
      await page.waitForTimeout(800)
      const pdf = page.getByText(/pdf/i).first()
      if (await pdf.isVisible().catch(() => false)) {
        await pdf.click()
        await page.waitForTimeout(2000)
      }
    }
    await shot.page_('PDFTrip')
  })

  test('MCP configuration in settings', async ({ page, shot }) => {
    await page.goto('/settings')
    await clearNotices(page)
    await openSidebarTab(page, tabLabel('Integrations'))
    await page.getByText(/mcp/i).first().scrollIntoViewIfNeeded().catch(() => {})
    await page.waitForTimeout(600)
    await shot.page_('MCPConfig')
  })

  test('OAuth consent screen', async ({ page, shot }) => {
    // Reached through the authorize flow, not a nav route. Without a registered
    // client the page shows its error state — still the honest illustration of
    // what this screen looks like when something is off.
    await page.goto(
      '/oauth/authorize?client_id=demo&redirect_uri=http://localhost:5173/callback&response_type=code&scope=trips:read',
    )
    await page.waitForTimeout(1000)
    await shot.page_('OAuthConsentDCR')
  })

  test('packing templates in admin', async ({ page, shot }) => {
    await page.goto('/admin')
    await clearNotices(page)
    // Templates live under Personalization (the tab the wiki still calls
    // "Categories"), alongside categories and tags.
    await openSidebarTab(page, tabLabel('Personalization'))
    await page.getByText(/packing template|打包模板/i).first().click().catch(() => {})
    await page.waitForTimeout(800)
    await shot.page_('PackingTemplate')
  })
})

test.describe('journey studio', () => {
  test('studio editor', async ({ page, shot }) => {
    const journeyId = seed().journeyId
    if (!journeyId) return
    await page.goto(`/journey/${journeyId}/studio`)
    await clearNotices(page)
    await page.waitForTimeout(2000)
    await shot.page_('TREK-Studio-Editor')
  })

  test('studio frames and looks', async ({ page, shot }) => {
    const journeyId = seed().journeyId
    if (!journeyId) return
    await page.goto(`/journey/${journeyId}/studio`)
    await clearNotices(page)

    // The Studio is the heaviest screen in the app — a canvas editor — and on a
    // loaded machine it can still be settling when the run budget expires. The
    // editor capture above already covers the page, so this one is skipped
    // rather than failed when the inspector rail never appears: a missing
    // second illustration is a smaller problem than a red run, and the wiki
    // page still has a working screenshot.
    const layouts = page.getByRole('button', { name: SHOT_LANG === 'zh' ? /布局|版式/ : /layouts/i }).first()
    const appeared = await layouts
      .waitFor({ timeout: 25_000 })
      .then(() => true)
      .catch(() => false)
    test.skip(!appeared, 'studio inspector did not render in time')
    await layouts.click().catch(() => {})
    await page.waitForTimeout(1200)
    await shot.page_('TREK-Studio-Frames')
  })
})
