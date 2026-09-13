#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const file = process.argv[2]
if (!file) { console.error('Usage: node analyze-react-profiler.cjs <profile.json>'); process.exit(1) }

const raw = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))
const root = raw.dataForRoots[0]
const commits = root.commitData

// snapshots: array of [fiberId, {displayName, ...}]
const nameMap = new Map()
for (const snap of root.snapshots) {
  const id = snap[0]
  const data = snap[1]
  if (data?.displayName) nameMap.set(id, data.displayName)
}

console.log(`Commits: ${commits.length}   Tracked components: ${nameMap.size}`)

// Probe the unit of fiberActualDurations against the known commit duration
// fiberActualDurations contains durations for the subtree — the root fiber's
// actual duration should be >= commit.duration.  Find a plausible scale factor.
const c0 = commits[0]
const knownDur = c0.duration  // already in ms per React DevTools spec
const rootId = root.rootID ?? 1
// Check a few values to pick scale
const sampleDurs = c0.fiberActualDurations.slice(0, 10).map(e => e[1])
console.log(`\nDebug — commit[0].duration=${knownDur}ms, first 5 raw fiberActualDurations values:`, sampleDurs.slice(0,5))
// If max sample > 10*knownDur, values are in units of 1/100 ms; otherwise already ms
const maxSample = Math.max(...c0.fiberActualDurations.map(e => e[1]))
const scale = maxSample > knownDur * 10 ? 0.01 : 1

console.log(`Unit scale: ${scale === 0.01 ? '1/100 ms (dividing by 100)' : 'ms (no conversion)'}\n`)

// --- 1. Commit summary ---
const fmt = (v) => v == null ? '    -' : (v * 1).toFixed(1).padStart(7)
console.log('=== Commit summary ===')
console.log('  #   t(s)    dur(ms)  passive(ms)  effects(ms)  priority')
const sorted = [...commits].map((c, i) => ({ i, ...c })).sort((a, b) => b.duration - a.duration)
for (const c of sorted.slice(0, 15)) {
  const ts = (c.timestamp / 1000).toFixed(3)
  console.log(`  ${String(c.i).padStart(2)}  ${ts}  ${fmt(c.duration)}  ${fmt(c.passiveEffectDuration)}     ${fmt(c.effectDuration)}    ${c.priorityLevel ?? ''}`)
}

// --- 2. Aggregate self + actual duration per component ---
const selfTotals   = new Map()   // name → { total, count, max }
const actualTotals = new Map()

for (const commit of commits) {
  for (const [id, raw] of commit.fiberActualDurations) {
    const dur = raw * scale
    const name = nameMap.get(id) ?? `(fiber#${id})`
    const e = actualTotals.get(name) ?? { total: 0, count: 0, max: 0 }
    e.total += dur; e.count += 1; e.max = Math.max(e.max, dur)
    actualTotals.set(name, e)
  }
  for (const [id, raw] of commit.fiberSelfDurations) {
    const dur = raw * scale
    const name = nameMap.get(id) ?? `(fiber#${id})`
    const e = selfTotals.get(name) ?? { total: 0, count: 0, max: 0 }
    e.total += dur; e.count += 1; e.max = Math.max(e.max, dur)
    selfTotals.set(name, e)
  }
}

const ranked = [...selfTotals.entries()]
  .sort((a, b) => b[1].total - a[1].total)
  .filter(([, s]) => s.total > 0.5)

console.log('\n=== Top 40 components by SELF render time (excludes children) ===')
console.log('  Component                                        Self total   Renders  Self max   Actual total')
for (const [name, s] of ranked.slice(0, 40)) {
  const actual = actualTotals.get(name) ?? { total: 0 }
  console.log(
    `  ${name.padEnd(48)} ${s.total.toFixed(1).padStart(8)} ms` +
    `  ${String(s.count).padStart(6)}x` +
    `  ${s.max.toFixed(1).padStart(7)} ms` +
    `  ${actual.total.toFixed(1).padStart(10)} ms`
  )
}

console.log('\n=== Most frequently re-rendering components (top 20) ===')
const byCount = [...selfTotals.entries()].sort((a, b) => b[1].count - a[1].count)
console.log('  Component                                        Renders  Self total')
for (const [name, s] of byCount.slice(0, 20)) {
  console.log(`  ${name.padEnd(48)} ${String(s.count).padStart(6)}x  ${s.total.toFixed(1).padStart(8)} ms`)
}

const totalPassive = commits.reduce((a, c) => a + (c.passiveEffectDuration ?? 0), 0)
const totalCommit  = commits.reduce((a, c) => a + c.duration, 0)
console.log(`\n=== Totals ===`)
console.log(`  Total commit render time:   ${totalCommit.toFixed(1)} ms  (${commits.length} commits)`)
console.log(`  Total passive effect time:  ${totalPassive.toFixed(1)} ms  (useEffect)`)
console.log(`  Avg commit duration:        ${(totalCommit / commits.length).toFixed(1)} ms`)
