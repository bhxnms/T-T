# In-App Help

Read the whole Tourism-Team wiki from inside Tourism-Team, without leaving the app or opening GitHub.

![In-App Help](assets/HelpInApp.png)

## Where to find it

Click your avatar in the top-right navbar and choose **Help**, or go to `/help` directly. Individual pages live at `/help/{slug}` — for example `/help/Packing-Lists`.

The page is titled **Help & Docs**. You must be signed in to reach the route.

## Languages

The wiki ships in more than one language. A **language switcher** sits next to the **Help & Docs** heading in the sidebar (and at the top of the mobile drawer), offering each language the bundled docs actually contain. Picking one reloads the page and the navigation in that language; it does **not** change the language of the app around it, so you can read the docs in one language while the interface stays in another.

The choice is remembered. It is also written to the URL as `?lang=`, so a link you copy keeps its language — and opening a `?lang=zh` link wins over both the remembered choice and the app's own language.

Pages that have not been translated yet are served in English rather than showing an error, so a partially translated wiki is always readable end to end. The same goes for images: screenshots that are language-neutral (third-party interfaces we cannot re-shoot) fall back to the English set.

Under the hood each language is a directory beside the others — `wiki/zh/Home.md` next to `wiki/Home.md` — and every endpoint takes an optional `?lang=` (`en` is the default):

| Endpoint | Purpose |
|---|---|
| `GET /api/help/index?lang=` | sidebar sections and page titles |
| `GET /api/help/page/:slug?lang=` | one page's markdown |
| `GET /api/help/asset/*?lang=` | one image or walkthrough |

## The docs ship with your install

Since **v3.4.0** the wiki is bundled into the Tourism-Team image and served from disk (commit `6c87bf2f`). That means:

- The help you read always matches the version you are running. A v3.4 install shows v3.4 docs, not whatever `main` says.
- Help works with no outbound network access at all.
- Screenshots and other images are served by Tourism-Team, not fetched from GitHub — your browser never talks to github.com for help content.

### The GitHub fallback

If the bundled `wiki/` directory cannot be found — an unusual layout, or an image built without it — Tourism-Team logs a warning and falls back to fetching the public GitHub wiki over the network instead, caching each page and image for an hour and serving a stale copy rather than failing outright. Help degrades instead of disappearing, but the content then tracks the latest release rather than your version.

Tourism-Team probes for `_Sidebar.md` specifically, not just the directory, so a half-copied `wiki/` folder falls back rather than serving an empty table of contents.

### `TREK_WIKI_DIR`

The bundled directory is found automatically. `TREK_WIKI_DIR` overrides where Tourism-Team looks — an escape hatch for unusual layouts, not something a normal install needs to set. See [Environment-Variables](Environment-Variables).

## The sidebar

The left sidebar mirrors this wiki's own table of contents, parsed straight out of `_Sidebar.md`: the same sections, in the same order, with the same page titles. On screens narrower than desktop the sidebar collapses behind a **Contents** button that opens it as a drawer.

The page you are reading is highlighted with a chevron.

## Search

The **Search docs…** box at the top of the sidebar filters the navigation as you type. It matches **page titles only** — it does not search inside page text. Sections with no matching page disappear; when nothing matches you get **No matching pages.**

To search page contents, use the wiki on GitHub or your browser's in-page find.

## Rendering

Pages render with Tourism-Team's own styling: headings, tables, code blocks, blockquotes, and images. A few things are handled specially so the same Markdown works both here and on GitHub:

- Wiki links in either GitHub spelling — `[[Title|Slug]]` and the bare relative `[Currencies](Currencies)` — become in-app links that navigate without a page reload.
- Relative image paths are rewritten to Tourism-Team's own asset endpoint.
- Heading anchors use GitHub's slug scheme, so a `](#some-heading)` link inside a page lands in the right place.
- HTML comments (such as `<!-- TODO: screenshot -->` placeholders) are stripped rather than shown.

External links open in a new tab.

If a page cannot be loaded you get **Couldn't load this page** — *The help content is fetched from the Tourism-Team wiki. Check your connection and try again.*

## Permissions

No permission gates the help browser; any signed-in user sees the same pages. The underlying `/api/help` endpoints are unauthenticated, because the content is public documentation — that is also what lets image tags load without sending credentials.

## See also

- [FAQ](FAQ)
- [Troubleshooting](Troubleshooting)
- [Environment-Variables](Environment-Variables)
- [Updating](Updating)
- [Contributing](Contributing)
