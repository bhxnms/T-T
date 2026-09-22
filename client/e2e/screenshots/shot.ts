import { test as base, expect, type Page, type Locator } from '@playwright/test'
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Shared plumbing for the documentation screenshot run (`npm run shots`).
 *
 * These are not assertions about behaviour — they drive the app to a known
 * state and capture it for the wiki. They live behind their own Playwright
 * project (`screenshots`, testMatch /\.shot\.ts/) so a normal `npm run e2e`
 * never pays for them.
 *
 * Output goes to a staging directory, NOT straight into wiki/assets/, so a
 * bad run can never clobber good artwork. Promote with `npm run shots:promote`.
 */

// Playwright runs from the client workspace root, matching how
// playwright.config.ts spells `storageState: 'e2e/.tmp/state.json'`.

/**
 * Which language the captures are taken in, from SHOT_LANG (`npm run shots` for
 * English, `SHOT_LANG=zh npm run shots` for Chinese).
 *
 * One variable drives three things that must agree, or a capture shows a Chinese
 * UI over English demo data (or the reverse):
 *   - the app's own language, written to localStorage before the page boots;
 *   - the demo data seed.ts posts;
 *   - which wiki/assets directory the run stages into.
 */
export const SHOT_LANG: 'en' | 'zh' = process.env.SHOT_LANG === 'zh' ? 'zh' : 'en'

/** Staging is per language so a zh run can never overwrite the English set. */
export const OUT_DIR = path.join(
  process.cwd(),
  'e2e',
  '.tmp',
  SHOT_LANG === 'en' ? 'shots' : `shots-${SHOT_LANG}`,
)

/**
 * Read screenshot seed data at test execution time, not module evaluation time.
 * Playwright collects every project's test files before it runs project
 * dependencies, so a top-level read races the seed project's setup file.
 */
export function readSeed<T extends object = { tripId: number }>(): T {
  return JSON.parse(readFileSync(path.join(process.cwd(), 'e2e', '.tmp', 'seed.json'), 'utf8')) as T
}

/** Desktop capture size. 2x scale keeps text crisp; images are squeezed on promote. */
export const VIEWPORT = { width: 1440, height: 900 }

/**
 * The Settings and Admin sidebar tab labels, per language.
 *
 * Both sidebars are rows of plain buttons whose labels come from the i18n
 * bundles, so a selector written against the English word simply does not exist
 * in a Chinese run — the click times out and the capture fails. Keyed by the
 * ENGLISH label (what the specs already pass) and translated here once, so no
 * spec has to know about languages.
 *
 * Values are copied from `shared/src/i18n/{en,zh}/{settings,admin}.ts`:
 * `settings.tabs.*` and `admin.tabs.*`. Keep them in step with those files.
 */
const TAB_LABELS: Record<string, string> = {
  // Settings
  General: '显示',
  Appearance: '外观',
  Map: '地图',
  Notifications: '通知',
  Offline: '离线',
  Account: '账户',
  Integrations: '集成',
  // Admin
  Users: '用户',
  'User Defaults': '用户默认设置',
  Personalization: '个性化',
  'Packing Templates': '打包模板',
  Addons: '扩展',
  Plugins: '插件',
  Storage: '存储',
  'Cloudflare Tunnel': 'Cloudflare 隧道',
  'MCP Access': 'MCP 访问',
  Backup: '备份',
  Audit: '审计',
}

/**
 * A sidebar tab's label in the language this run captures.
 *
 * Falls through unchanged for anything not in the map (including labels that are
 * identical in both languages, like GitHub), so a missing entry degrades to the
 * English selector rather than an empty string.
 */
export function tabLabel(english: string): string {
  return SHOT_LANG === 'zh' ? (TAB_LABELS[english] ?? english) : english
}

/** The trip tab bar labels, per language (`trip.tabs.*`). */
const TRIP_TABS: Record<string, string> = {
  Plan: '计划',
  Transports: '交通',
  Book: '预订',
  Lists: '列表',
  Costs: '费用',
  Files: '文件',
  Collab: '协作',
}

/** A trip tab's label in the language this run captures. */
export function tripTab(english: string): string {
  return SHOT_LANG === 'zh' ? (TRIP_TABS[english] ?? english) : english
}

export const test = base.extend<{ shot: Shot }>({
  // Overriding `page` (rather than doing this inside the `shot` fixture) is
  // deliberate: fixtures initialise lazily, so a route registered in `shot`
  // lands AFTER any beforeEach hook has already navigated — too late to
  // intercept the config request.
  page: async ({ page }, use) => {
    await page.setViewportSize(VIEWPORT)
    if (SHOT_LANG !== 'en') {
      // Must run before any script on the page: settingsStore reads
      // `localStorage.app_language` at module init, so setting it after load
      // would leave the first render in English.
      await page.addInitScript((lang) => {
        localStorage.setItem('app_language', lang)
      }, SHOT_LANG)
    }
    await hideDevOnlyUi(page)
    await use(page)
  },
  shot: async ({ page }, use) => {
    mkdirSync(OUT_DIR, { recursive: true })
    await use(new Shot(page))
  },
})

/**
 * The E2E backend runs with NODE_ENV=development, so /auth/app-config reports
 * `dev_mode: true` (authService.ts) and the admin sidebar grows a
 * "Dev: Notifications" tab that no real deployment ever shows.
 *
 * Rewriting the response is the surgical fix. Flipping the server to
 * NODE_ENV=production would also enable HSTS (globalMiddleware.ts), and an
 * HSTS header on localhost would upgrade the run to https and break it.
 *
 * The handler is written to survive the page being torn down mid-fetch. Several
 * screens (Atlas among them) re-request app-config on their own schedule, and a
 * request still in flight when the capture finishes makes `route.fetch()` reject
 * with "route.fetch: Test ended" — which fails the capture for a reason that has
 * nothing to do with what it was photographing. Letting the untouched response
 * through in that case is correct: the only thing lost is hiding a dev tab on a
 * page that is already closing.
 */
async function hideDevOnlyUi(page: Page): Promise<void> {
  await page.route('**/api/auth/app-config', async route => {
    try {
      const res = await route.fetch()
      const body = await res.json()
      await route.fulfill({ response: res, json: { ...body, dev_mode: false } })
    } catch {
      // Test tearing down (or the request aborted) — pass it through untouched
      // rather than failing the capture.
      await route.continue().catch(() => {})
    }
  })
}

export { expect }

export class Shot {
  constructor(private readonly page: Page) {}

  /**
   * Capture the full viewport. `name` is the target filename in wiki/assets/
   * (without extension) so the mapping from screenshot to doc page is literal.
   */
  async page_(name: string): Promise<void> {
    await this.settle()
    await this.page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) })
  }

  /** Capture one element — preferred for dialogs, panels and cards. */
  async element(name: string, target: Locator): Promise<void> {
    await this.settle()
    await expect(target).toBeVisible()
    await target.screenshot({ path: path.join(OUT_DIR, `${name}.png`) })
  }

  /**
   * Run a scripted interaction and keep the recording as a walkthrough.
   *
   * Replaces the six animated GIFs the wiki used to ship (13 MB together, the
   * largest 9.1 MB on its own). Playwright's video capture is WebM; promote.mjs
   * transcodes it to MP4, which is a fraction of the size at better quality and
   * streams instead of downloading whole.
   *
   * The video is NOT fetched here. Playwright only flushes the file when the
   * page's context closes, and `video.path()` blocks until then — calling it
   * inside the test deadlocks until the test times out. So this only records the
   * intent; the afterEach hook below closes the page and moves the file.
   */
  async walkthrough(name: string, drive: (page: Page) => Promise<void>): Promise<void> {
    await this.settle()
    await drive(this.page)
    await this.page.waitForTimeout(500)
    pendingWalkthrough.set(this.page, name)
  }

  /**
   * Quiet the page before capturing: fonts loaded, images decoded, animations
   * finished, no pending network. Without this, screenshots catch skeleton
   * loaders and half-faded modals, which is exactly how the current wiki
   * assets ended up inconsistent.
   */
  private async settle(): Promise<void> {
    // Bounded: the app holds a WebSocket open at /ws, so the network never goes
    // fully idle and an unbounded wait would burn the whole test timeout.
    await this.page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})
    // Await, but return nothing — the resolved FontFaceSet is not serialisable.
    await this.page.evaluate(async () => { await document.fonts.ready }).catch(() => {})
    await this.page
      .evaluate(async () => {
        await Promise.all(
          Array.from(document.images)
            .filter(img => !img.complete)
            .map(img => new Promise(res => { img.onload = img.onerror = res })),
        )
      })
      .catch(() => {})
    // Let CSS transitions land (modal fade-in, sidebar slide).
    await this.page.waitForTimeout(400)
  }
}

/** Pages whose recording should be kept, and under which wiki filename. */
const pendingWalkthrough = new WeakMap<Page, string>()

/**
 * Flush any walkthrough recording.
 *
 * Runs before the page fixture's own teardown, so closing here is what makes the
 * video file exist; `path()` after the close returns a real path instead of
 * blocking. Failures are swallowed: a missing video should not fail a test whose
 * interaction actually worked (promote.mjs warns about the missing asset).
 */
test.afterEach(async ({ page }) => {
  const name = pendingWalkthrough.get(page)
  if (!name) return
  pendingWalkthrough.delete(page)
  try {
    const video = page.video()
    if (!video) return
    await page.close()
    const src = await video.path()
    mkdirSync(OUT_DIR, { recursive: true })
    copyFileSync(src, path.join(OUT_DIR, `${name}.webm`))
  } catch {
    /* recording unavailable — the still captures are unaffected */
  }
})

/**
 * Dismiss the first-run system notice. Copied in spirit from e2e/helpers.ts,
 * but tolerant: on a seeded DB the notice may already be cleared.
 */
export async function clearNotices(page: Page): Promise<void> {
  const next = page.getByRole('button', { name: /next/i })
  for (let i = 0; i < 6 && (await next.isVisible().catch(() => false)); i++) {
    if (!(await next.isEnabled().catch(() => false))) break
    await next.click().catch(() => {})
  }
  for (const label of ['Dismiss', 'OK']) {
    const btn = page.getByRole('button', { name: label, exact: true })
    for (let i = 0; i < 4 && (await btn.isVisible().catch(() => false)); i++) {
      await btn.click().catch(() => {})
      await page.waitForTimeout(300)
    }
  }
}
