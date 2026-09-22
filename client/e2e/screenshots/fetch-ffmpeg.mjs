// Fetches the static ffmpeg used to transcode the wiki walkthroughs.
//
// Why this exists rather than a dependency: Playwright ships its OWN ffmpeg, but
// it is a minimal build (`--disable-everything`, VP8/WebM only) with no libx264
// and no MP4 muxer — it can record a walkthrough but cannot produce the .mp4 the
// wiki and GitHub render inline. The obvious fix, the `ffmpeg-static` npm
// package, downloads its binary from GitHub in a postinstall step with a
// hardcoded 30-second timeout, which fails on a slow link.
//
// So the download lives here instead, with a timeout that suits a 76 MB binary
// and a clear error when it cannot complete. Run it once per checkout; the
// binary lands in `e2e/.tools/` (gitignored) and promote.mjs picks it up.
//
// Usage:  node e2e/screenshots/fetch-ffmpeg.mjs
import { createWriteStream, existsSync, mkdirSync, chmodSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

const URL = 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-linux-x64'
const PLATFORM = { linux: 'ffmpeg-linux-x64', darwin: 'ffmpeg-darwin-x64', win32: 'ffmpeg-win32-x64' }
const DEST_DIR = path.join(process.cwd(), 'e2e', '.tools')
const DEST = path.join(DEST_DIR, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')

if (existsSync(DEST) && statSync(DEST).size > 1_000_000) {
  console.log(`ffmpeg already present: ${DEST}`)
  process.exit(0)
}

const asset = PLATFORM[process.platform]
if (!asset) {
  console.error(`No ffmpeg build configured for ${process.platform}. Install ffmpeg manually and put it at ${DEST}.`)
  process.exit(1)
}

mkdirSync(DEST_DIR, { recursive: true })
const url = URL.replace(/ffmpeg-linux-x64$/, asset)
console.log(`Downloading ${asset} …\n  from ${url}\n  to   ${DEST}`)
console.log('(~76 MB; allow a couple of minutes on a slow link)\n')

try {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10 * 60 * 1000) })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
  await pipeline(res.body, createWriteStream(DEST))
  if (process.platform !== 'win32') chmodSync(DEST, 0o755)
  console.log(`\nDone: ${(statSync(DEST).size / 1024 / 1024).toFixed(0)} MB → ${DEST}`)
} catch (err) {
  rmSync(DEST, { force: true })
  console.error(`\nDownload failed: ${err.message}`)
  console.error('The walkthrough captures need this to produce MP4. Either retry, or install ffmpeg')
  console.error(`yourself and place it at ${DEST}.`)
  process.exit(1)
}
