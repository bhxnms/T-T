// Moves captured screenshots from the staging directory into wiki/assets/,
// downscaling and re-encoding on the way.
//
// Captures are taken at 1440px CSS width with deviceScaleFactor 2, i.e. 2880px
// of raw pixels. The wiki renders images at roughly 800–1000px, so shipping
// 2880px costs ~10x the bytes for detail nobody sees — that is how the existing
// assets reached 26 MB (one GIF alone was 9.1 MB). 1600px keeps the image sharp
// on HiDPI displays at the size it is actually shown.
//
// Language: SHOT_LANG=zh promotes the Chinese run into wiki/zh/assets/ instead
// of wiki/assets/. The two sets are deliberately separate — a Chinese page
// showing an English UI is the half-finished look this whole pass exists to fix.
//
// Animated walkthroughs arrive as .webm (Playwright's recording format) and are
// transcoded to .mp4 here, because MP4 is what browsers and GitHub render
// inline. That step shells out to ffmpeg, which ships inside Playwright's own
// browser bundle — no system dependency to install.
//
// Usage:  node e2e/screenshots/promote.mjs [--dry]
//         SHOT_LANG=zh node e2e/screenshots/promote.mjs
import sharp from 'sharp'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, mkdirSync, statSync, rmSync } from 'node:fs'
import path from 'node:path'

const LANG = process.env.SHOT_LANG === 'zh' ? 'zh' : 'en'
const SRC = path.join(process.cwd(), 'e2e', '.tmp', LANG === 'en' ? 'shots' : `shots-${LANG}`)
const DEST =
  LANG === 'en'
    ? path.join(process.cwd(), '..', 'wiki', 'assets')
    : path.join(process.cwd(), '..', 'wiki', LANG, 'assets')
const MAX_WIDTH = 1600
const dry = process.argv.includes('--dry')

/**
 * Locate an ffmpeg that can actually write H.264/MP4.
 *
 * Deliberately NOT Playwright's bundled build: that one is compiled with
 * `--disable-everything` and supports only VP8/WebM, so it cannot produce the
 * MP4 the wiki renders. Prefer the repo-local download (fetch-ffmpeg.mjs), then
 * whatever is on PATH.
 */
function ffmpegPath() {
  const local = path.join(process.cwd(), 'e2e', '.tools', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
  if (existsSync(local)) return local
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    const p = path.join(dir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
    if (existsSync(p)) return p
  }
  return null
}

/** WebM → MP4, trimmed to at most `limitSeconds` and scaled to fit the wiki. */
function transcode(src, dest, ffmpeg) {
  execFileSync(
    ffmpeg,
    [
      '-y',
      '-i', src,
      // Scale to 1600px wide at most, keeping the aspect ratio and forcing even
      // dimensions (H.264 rejects odd ones).
      '-vf', `scale='min(${MAX_WIDTH},iw)':-2`,
      // No audio track exists; asking for none keeps the muxer quiet.
      '-an',
      '-c:v', 'libx264',
      '-crf', '28',
      '-preset', 'slow',
      // yuv420p is the compatibility profile every browser decodes.
      '-pix_fmt', 'yuv420p',
      // Fast-start moves the index to the front so the video streams.
      '-movflags', '+faststart',
      dest,
    ],
    { stdio: 'pipe' },
  )
}

mkdirSync(DEST, { recursive: true })

const all = existsSync(SRC) ? readdirSync(SRC) : []
const pngs = all.filter((f) => f.endsWith('.png'))
const videos = all.filter((f) => f.endsWith('.webm'))

if (!pngs.length && !videos.length) {
  console.error(`No screenshots in ${SRC} — run \`npm run shots\` first${LANG === 'en' ? '' : ` with SHOT_LANG=${LANG}`}.`)
  process.exit(1)
}

let before = 0
let after = 0

for (const file of pngs.sort()) {
  const src = path.join(SRC, file)
  const dest = path.join(DEST, file)
  const srcBytes = statSync(src).size
  before += srcBytes

  const img = sharp(src)
  const { width } = await img.metadata()

  const pipeline = sharp(src)
    .resize({ width: Math.min(width ?? MAX_WIDTH, MAX_WIDTH), withoutEnlargement: true })
    .png({ compressionLevel: 9, effort: 10 })

  const buf = await pipeline.toBuffer()
  after += buf.length

  const pct = Math.round((1 - buf.length / srcBytes) * 100)
  console.log(
    `${dry ? '[dry] ' : ''}${file.padEnd(28)} ${kb(srcBytes).padStart(8)} → ${kb(buf.length).padStart(8)}  (-${pct}%)`,
  )
  if (!dry) await sharp(buf).toFile(dest)
}

// Walkthroughs: WebM in, MP4 out.
const ffmpeg = ffmpegPath()
for (const file of videos.sort()) {
  const src = path.join(SRC, file)
  const outName = file.replace(/\.webm$/, '.mp4')
  const dest = path.join(DEST, outName)
  const srcBytes = statSync(src).size
  before += srcBytes

  if (!ffmpeg) {
    console.warn(
      `${file.padEnd(28)} skipped — no usable ffmpeg.\n` +
        '   Run `npm run shots:ffmpeg` to fetch one (Playwright\'s bundled build cannot write MP4).',
    )
    continue
  }
  if (dry) {
    console.log(`[dry] ${file.padEnd(28)} ${kb(srcBytes).padStart(8)} → (would transcode to ${outName})`)
    continue
  }
  try {
    transcode(src, dest, ffmpeg)
    const outBytes = statSync(dest).size
    after += outBytes
    const pct = Math.round((1 - outBytes / srcBytes) * 100)
    console.log(
      `${outName.padEnd(28)} ${kb(srcBytes).padStart(8)} → ${kb(outBytes).padStart(8)}  (-${pct}%)  [webm→mp4]`,
    )
  } catch (err) {
    console.error(`${file}: transcode failed — ${err.message}`)
  }
  // The staged WebM is an intermediate; keep the tree clean for the next run.
  if (!dry) rmSync(src, { force: true })
}

console.log(
  `\n[${LANG}] ${pngs.length} image(s)${videos.length ? ` + ${videos.length} walkthrough(s)` : ''}: ` +
    `${kb(before)} → ${kb(after)} (-${before ? Math.round((1 - after / before) * 100) : 0}%)`,
)
console.log(`Target: ${DEST}`)
if (dry) console.log('Dry run — nothing written. Drop --dry to promote.')

function kb(bytes) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}
