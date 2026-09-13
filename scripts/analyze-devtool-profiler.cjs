#!/usr/bin/env node
// Chrome Performance Trace Analyzer — outputs a compact summary
// Usage: node analyze-trace.js <trace.json>

const fs = require('fs')
const path = require('path')

const file = process.argv[2]
if (!file) { console.error('Usage: node analyze-trace.js <trace.json>'); process.exit(1) }

console.log(`Reading ${path.basename(file)} (${(fs.statSync(file).size / 1e6).toFixed(1)} MB)...`)
const raw = fs.readFileSync(file, 'utf8')
console.log('Parsing...')
const trace = JSON.parse(raw)
const events = Array.isArray(trace) ? trace : (trace.traceEvents || [])
console.log(`Total events: ${events.length.toLocaleString()}\n`)

// ── 1. Long Tasks (> 50ms on main thread) ────────────────────────────────────
const LONG_TASK_MS = 50
const tasks = events
  .filter(e => e.ph === 'X' && e.dur && e.dur > LONG_TASK_MS * 1000)
  .sort((a, b) => b.dur - a.dur)
  .slice(0, 30)

console.log(`═══ TOP LONG TASKS (>${LONG_TASK_MS}ms) ═══`)
for (const t of tasks) {
  const ms = (t.dur / 1000).toFixed(1)
  const name = t.name || '(unknown)'
  const cat = t.cat || ''
  console.log(`  ${ms.padStart(8)}ms  ${name}  [${cat}]`)
}

// ── 2. Summarise all complete events by name ──────────────────────────────────
const byName = new Map()
for (const e of events) {
  if (e.ph !== 'X' || !e.dur) continue
  const key = e.name
  const existing = byName.get(key)
  if (existing) {
    existing.totalMs += e.dur / 1000
    existing.count++
    if (e.dur > existing.maxMs * 1000) existing.maxMs = e.dur / 1000
  } else {
    byName.set(key, { totalMs: e.dur / 1000, count: 1, maxMs: e.dur / 1000 })
  }
}
const topByTotal = [...byName.entries()]
  .sort((a, b) => b[1].totalMs - a[1].totalMs)
  .slice(0, 40)

console.log('\n═══ TOP EVENTS BY TOTAL TIME ═══')
console.log('  Total(ms)   Max(ms)   Count   Name')
for (const [name, s] of topByTotal) {
  console.log(
    `  ${s.totalMs.toFixed(1).padStart(9)}   ${s.maxMs.toFixed(1).padStart(7)}   ${String(s.count).padStart(5)}   ${name}`
  )
}

// ── 3. React-specific events ──────────────────────────────────────────────────
const reactKeywords = ['react', 'React', 'setState', 'useState', 'useMemo', 'useEffect',
  'reconcil', 'Reconcil', 'render', 'Render', 'commit', 'Commit', 'fiber', 'Fiber',
  'Marker', 'MapView', 'photoUrl', 'createPlace', 'markers']
const reactEvents = [...byName.entries()]
  .filter(([name]) => reactKeywords.some(k => name.includes(k)))
  .sort((a, b) => b[1].totalMs - a[1].totalMs)
  .slice(0, 30)

if (reactEvents.length > 0) {
  console.log('\n═══ REACT / MAP EVENTS ═══')
  for (const [name, s] of reactEvents) {
    console.log(`  ${s.totalMs.toFixed(1).padStart(9)}ms total   ${s.maxMs.toFixed(1).padStart(7)}ms max   ${s.count}x   ${name}`)
  }
}

// ── 4. V8 / JS heavy hitters ─────────────────────────────────────────────────
const jsEvents = [...byName.entries()]
  .filter(([, s]) => s.totalMs > 20)
  .filter(([name]) => {
    const cat = (events.find(e => e.name === name)?.cat || '')
    return cat.includes('v8') || cat.includes('devtools.timeline') || name.includes('JS') || name.includes('Compile') || name.includes('GC')
  })
  .sort((a, b) => b[1].totalMs - a[1].totalMs)
  .slice(0, 20)

if (jsEvents.length > 0) {
  console.log('\n═══ V8 / JS EVENTS (>20ms total) ═══')
  for (const [name, s] of jsEvents) {
    console.log(`  ${s.totalMs.toFixed(1).padStart(9)}ms   ${s.count}x   ${name}`)
  }
}

// ── 5. CPU profile — top self-time functions ─────────────────────────────────
const profileChunks = events.filter(e => e.name === 'ProfileChunk')
if (profileChunks.length > 0) {
  const selfTime = new Map()
  for (const chunk of profileChunks) {
    const nodes = chunk.args?.data?.cpuProfile?.nodes || []
    const samples = chunk.args?.data?.cpuProfile?.samples || []
    const timeDeltas = chunk.args?.data?.timeDeltas || []
    // Build node map
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    // Accumulate self time per node
    for (let i = 0; i < samples.length; i++) {
      const nodeId = samples[i]
      const dt = (timeDeltas[i] || 0) / 1000 // µs → ms
      const node = nodeMap.get(nodeId)
      if (!node) continue
      const fn = node.callFrame?.functionName || '(anonymous)'
      const url = node.callFrame?.url || ''
      const line = node.callFrame?.lineNumber || 0
      const key = `${fn} @ ${url.split('/').slice(-2).join('/')}:${line}`
      selfTime.set(key, (selfTime.get(key) || 0) + dt)
    }
  }
  const topSelf = [...selfTime.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)

  console.log('\n═══ CPU PROFILE — TOP SELF-TIME FUNCTIONS ═══')
  for (const [name, ms] of topSelf) {
    console.log(`  ${ms.toFixed(1).padStart(8)}ms   ${name}`)
  }
}

// ── 6. Paint / Layout costs ───────────────────────────────────────────────────
const renderCats = ['Layout', 'UpdateLayoutTree', 'Paint', 'CompositeLayers', 'RasterTask']
console.log('\n═══ RENDERING COSTS ═══')
for (const cat of renderCats) {
  const s = byName.get(cat)
  if (s) console.log(`  ${s.totalMs.toFixed(1).padStart(9)}ms total   ${s.maxMs.toFixed(1).padStart(7)}ms max   ${s.count}x   ${cat}`)
}

console.log('\nDone.')
