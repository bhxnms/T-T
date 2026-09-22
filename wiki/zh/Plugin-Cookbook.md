# 插件示例集

插件能做的事情的简短、可直接复制粘贴的配方。每一项都会说明它需要的权限（在 `trek-plugin.json` → `permissions` 中声明）以及它使用的能力。完整的 API 见 [[插件开发|Plugin-Development]]；权限目录见 [[插件权限|Plugin-Permissions]]。

> 每一个旅行/地点/日程操作都**由主机做成员校验**，依据与
> 本次调用绑定的用户 —— 你的插件永远不传用户 id。写入还
> 需要该用户的 `*_edit` 权限。你不被允许的读/写会
> 显式失败；它绝不会静默提权。

其中若干配方的可运行版本 —— 读取旅行的地点和预订、发出校验警告、贡献一行地点详情，以及它背后的实体元数据 —— 就是 [`trip-doctor`](https://github.com/bhxnms/T-T/tree/main/plugin-sdk/examples/trip-doctor) 示例插件。

---

## 读取旅行的地点和预订

**需要：** `db:read:trips`

```js
async handler(req, ctx) {
  const places = await ctx.trips.getPlaces(Number(req.query.tripId))
  const bookings = await ctx.trips.getReservations(Number(req.query.tripId))
  // …use them; the host already checked req.user can see this trip
}
```

## 读取旅行的行李清单或文件

**需要：** `db:read:packing` · `db:read:files`（只声明你用到的）

```js
const packing = await ctx.packing.list(tripId)   // hydrated bags/assignees
const files   = await ctx.files.list(tripId)      // trash excluded
```

两者都会针对当前用户做成员校验 —— 与 `ctx.trips.*` 是同一道门。

## 在行程上添加 / 移动内容

**需要：** `db:write:places` · `db:write:days` · `db:write:itinerary`（只声明你用到的）

```js
const place = await ctx.places.create(tripId, { name: 'Teamlab', lat: 35.62, lng: 139.78 })
const day   = await ctx.days.create(tripId, { date: '2027-04-02', notes: 'Odaiba' })
await ctx.itinerary.assign(tripId, day.id, place.id, 'buy tickets first')
// days.create reads { date?, notes? } and always appends at the end — a position is honoured on the REST route only, not on the plugin path.
// Set a day title later with ctx.days.update(tripId, day.id, { title: 'Odaiba' }).
```

更新和删除与 REST 应用完全对应（`ctx.places.update/delete`、`ctx.days.update/delete`、`ctx.itinerary.unassign`）。它们广播相同的实时事件，因此打开着的网页会话会立即更新。

## 给核心实体打标签 —— 无需分叉 schema

**需要：** `db:meta`

把你自己可 JSON 序列化的数据存到旅行、地点或日程上。行数据按**你的插件 id** 划分命名空间 —— 其他插件无法读取或覆盖它们。

```js
await ctx.meta.set('place', placeId, 'lastCheckedAt', Date.now())
const when = await ctx.meta.get('place', placeId, 'lastCheckedAt')
const all  = await ctx.meta.list('place', placeId)   // { lastCheckedAt: 172… }
await ctx.meta.delete('place', placeId, 'lastCheckedAt')
```

读取需要旅行访问权限；写入还额外需要该实体的编辑权限。

## 为地点贡献额外信息（原生渲染）

**需要：** `hook:place-detail-provider`

返回行数据，Tourism-Team 会把它们绘制在地点面板底部 —— 没有 iframe。

```js
module.exports = {
  hooks: {
    placeDetailProvider: {
      async getDetails(placeId, ctx) {
        return [
          { label: 'Crowd', value: 'Quiet right now' },
          { label: 'Official site', url: 'https://…' },
        ]
      },
    },
  },
}
```

## 对旅行发出校验警告

**需要：** `hook:trip-warning-provider`

返回问题，它们会在规划器中显示为一条非阻塞横幅。

```js
hooks: {
  warningProvider: {
    async getWarnings(tripId, ctx) {
      const places = await ctx.trips.getPlaces(tripId)
      return places
        .filter((p) => p.lat == null)
        .map((p) => ({ level: 'warning', message: `"${p.name}" has no location`, placeId: p.id }))
    },
  },
}
```

`level` 为 `'info' | 'warning' | 'error'`；`dayId`/`placeId` 是可选的锚点。

## 向旅行 / 用户推送实时更新

**需要：** `ws:broadcast:trip` 和/或 `ws:broadcast:user`

```js
ctx.ws.broadcastToTrip(tripId, 'doctor:rechecked', { count })   // → plugin:<id>:doctor:rechecked
ctx.ws.broadcastToUser(userId, 'nudge', { text: '…' })          // (userId, event, data) — only that user
```

事件会自动按 `plugin:<your-id>:…` 划分命名空间，因此不会与核心事件冲突。

## 响应核心活动

**需要：** `events:subscribe`

处理函数在无用户的情况下运行，并会收到 `{ event, tripId, entity?, entityId?, snapshot? }` —— `snapshot`（变更实体的白名单字段视图）仅在你的插件同时持有该族的 `db:read:*` 授权时才会送达；删除/批量/重排事件不携带它。

```js
events: [
  { on: 'file:created', async handler({ tripId, entityId }, ctx) {
      await notifySlack(`New file on trip ${tripId}`)   // needs http:outbound:<host>
  } },
]
```

即发即忘，有较短的超时 —— 绝不阻塞核心写入。旅行读取会被拒绝（没有用户），`ctx.ws.*` 广播同样如此；请改用 `ctx.db` 或一次出站调用。你自己的 `plugin:*` 广播永远不会被再次投递，因此处理函数不会形成循环。

## 依赖另一个插件 —— 调用它并接收它的事件

**需要：** 为另一个插件添加一条 `pluginDependencies` 条目（不需要权限）。

从**被依赖方**暴露一份契约（在 `capabilities.provides` / `capabilities.emits` 中声明名称）：

```js
// plugin "koffi"  ·  manifest: "capabilities": { "provides": ["convert"], "emits": ["rate.updated"] }
exports: {
  async convert({ amount, from, to }) { return { amount: amount * rate(from, to), to } },
},
async onLoad(ctx) { ctx.events.emit('rate.updated', { pair: 'USD/EUR' }) },
```

从**依赖方**消费它（把 koffi 声明为依赖）：

```js
// manifest: "pluginDependencies": [{ "id": "koffi", "version": ">=1.0.0 <2.0.0" }]
routes: [
  { method: 'GET', path: '/price', async handler(_req, ctx) {
      const out = await ctx.plugins.call('koffi', 'convert', { amount: 10, from: 'USD', to: 'EUR' })
      return { status: 200, body: JSON.stringify(out) }
  } },
],
subscriptions: [
  { plugin: 'koffi', event: 'rate.updated', async handler(payload, ctx) { ctx.log.info('rates changed', payload) } },
],
```

Tourism-Team 会在你的插件之前自动启用 koffi，以你的操作用户身份路由该调用，并在 koffi 不是已满足的依赖或未导出 `convert` 时拒绝它。见 [[插件开发#talking-to-other-plugins|Plugin-Development]]。

## 与 Tourism-Team 的外观保持一致

在你的小组件 `<head>` 中加入 `<!-- trek:ui -->`。开发服务器和 `pack` 会内联 Tourism-Team 由令牌驱动的套件（玻璃质感表面、按钮、输入框、深色模式）以及一个带有实时主题和令牌的 `window.trek` 桥接。见 [[插件开发#the-design-kit-recommended|Plugin-Development]]。`window.trek.ui` 为你提供无需打包器、套件风格的 DOM 构建器（`ui.el/button/card/chip/input/mount`）。

---

## 通知用户或旅行

**需要：** `notify:send`

插件提供目标和纯文本；主机负责投递以及用户的通知偏好。

```js
await ctx.notify.send({
  title: 'Trip rechecked',
  body: '3 places still need a location',
  scope: 'trip', targetId: tripId,   // or scope:'user', targetId: the acting user
  link: '/trips/' + tripId,
})
```

接收者由主机**强制**决定：`scope:'user'` 只能到达操作用户，`scope:'trip'` 只能到达他所属的旅行。你无法通知其他任何人。

---

## 成为通知渠道（Gotify、Pushover……）

**需要：** `hook:notification-channel` + `http:outbound:<host>`（以及一条匹配的 `egress`）

上面的配方*产生*一条通知。这一个则**投递**通知 —— 你的插件会成为用户通知偏好中与电子邮件 / webhook / ntfy 并列的一个渠道。

```bash
npx create-trek-plugin my-gotify --type integration --template notification-channel
```

```js
module.exports = definePlugin({
  hooks: {
    notificationChannel: {
      async send(msg, config, ctx) {
        // msg is ALREADY rendered in the recipient's language, deep link included.
        // config is that recipient's own scope:'user' settings, decrypted for you.
        const res = await fetch(`${config.serverUrl}/message`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'X-Gotify-Key': config.appToken },
          body: JSON.stringify({ title: msg.title, message: msg.body }),
        })
        if (!res.ok) throw new Error(`Gotify responded ${res.status}`)  // host logs + isolates
      },
      async test(config) { /* backs the "Send test" button */ },
    },
  },
})
```

```json
"permissions": ["hook:notification-channel", "http:outbound:gotify.example.com"],
"egress": ["gotify.example.com"],
"capabilities": { "notificationChannel": { "title": "Gotify" } },
"settings": [
  { "key": "serverUrl", "scope": "user", "required": true },
  { "key": "appToken",  "scope": "user", "required": true, "secret": true }
]
```

值得提前知道的坑：这个钩子是**由主机为任意接收者发起的**，因此与所有其他钩子不同，它在运行时**没有操作用户**。`ctx.settings.get()` 返回 `undefined`，旅行读取会被拒绝 —— 接收者的凭据改为通过 `config` 传入。这正是关键所在：你可以被交到某人的推送令牌，而不会被交到他的旅行。

目标是**自托管**的 Gotify？你的清单无法指定用户的主机名，因此请加上 `"operatorEgress": true`，让管理员在安装后添加真实主机（管理 → 插件 → 允许的主机）。见 [插件开发 → 运营者提供的出站主机](Plugin-Development#operator-supplied-egress-hosts-operatoregress)，以及 [通知渠道](Plugin-Development#notification-channels) 了解事件列表、「已配置」规则，以及当服务运行在你自己的局域网时需要设置的 `TREK_PLUGIN_ALLOW_PRIVATE_EGRESS` 标志。

---

## 在设置页上放一个「测试连接」按钮

**需要：** 无需任何权限 —— 操作就是你自己的代码，为点击它的用户运行。

在清单中声明按钮，在定义上实现它们：

```json
"actions": [
  { "key": "testConnection", "label": "Test connection", "hint": "Pings the API." },
  { "key": "purge",          "label": "Delete my data", "danger": true }
]
```

```js
module.exports = definePlugin({
  actions: {
    async testConnection(ctx) {
      // USER-INITIATED: the acting user is whoever clicked, so ctx.settings.get()
      // returns THEIR value — which is what makes "test MY credentials" possible.
      const token = await ctx.settings.get('appToken')
      const res = await fetch('https://api.example.com/ping', { headers: { authorization: token } })
      return { ok: res.ok, message: res.ok ? 'Connected' : `Failed: ${res.status}` }
    },
  },
})
```

这些按钮会渲染在 **设置 → 插件** 中你的字段下方，结果显示在旁边。返回 `{ ok, message? }`；抛出异常等同于携带错误文本的 `{ ok: false }`。`danger: true` 会先请求确认。主机拒绝你的清单未声明的任何 key，并限制它显示的消息长度（200 字符，emoji 会被剥离）。

**……再给管理员来一个。** 作用于**实例**配置而不是某个人的凭据的按钮需要 `"scope": "instance"`：

```json
"actions": [
  { "key": "purgeCache", "label": "Purge cache", "scope": "instance" }
]
```

它会渲染在 **管理 → 插件 → ⋯ → 实例设置** 中，而不是任何人的设置页上，并以点击的**管理员**身份运行 —— 因此 `ctx.config` 就是正显示在它上方的实例设置，而 `ctx.settings.get()` 仍是该管理员自己的值。该按钮在**插件激活之前处于禁用状态**（操作需要一个运行中的子进程），并且被编辑过的表单会在操作触发前保存，因此你绝不会针对插件尚未收到的配置进行测试。需要清单的 `trek` 下限为 `>=4.2.0` —— 低于 4.2.0 的主机会忽略 `scope`，从而把按钮显示给每个用户。

与 `notificationChannel` 钩子对比：后者由**主机**发起，因此*没有*操作用户 —— 在那里 `ctx.settings.get()` 返回 `undefined`，接收者的凭据改为以参数形式传入。

---

## 调用已配置的 LLM

**需要：** `ai:invoke`

使用管理员/用户设置的任何提供商 —— 你的插件永远不持有密钥。

```js
const { text } = await ctx.ai.complete('Summarise this trip in one line', 'You are a concise travel assistant')

const { results } = await ctx.ai.extract(
  pastedBookingText,
  { type: 'object', properties: { hotel: { type: 'string' }, checkIn: { type: 'string' } } },
)
```

输出是**数据**。要存储它，请自己通过一次受门控的写入来完成（例如 `ctx.reservations.create`）。

---

## 调用用户已连接的第三方 API

**需要：** `oauth:client`（以及用于 fetch 的 `http:outbound:<host>`）

用户在 设置 → 插件 → 连接 下连接该服务。主机保管刷新令牌和客户端密钥；你只能拿到操作用户的一个短期访问令牌。

```js
const token = await ctx.oauth.getAccessToken()   // null if not connected, or in a userless context
if (token) {
  const res = await fetch('https://api.example.com/me', { headers: { Authorization: `Bearer ${token}` } })
}
```

---

## 换算货币

**需要：** `rates:read`

```js
const rates = await ctx.rates.get('EUR')   // { USD: 1.08, GBP: 0.85, … } — or null on an upstream failure
const usd = 100 * rates.USD
```

与租户无关且在上游缓存 —— 无需旅行访问权限。

---

## 按计划运行任务

**需要：** `jobs:run`

两种形式：在插件定义上声明的固定 **cron 任务**，或你在运行时通过 `ctx.scheduler` 设置的**动态定时器**。

```js
module.exports = {
  // fixed cron — standard 5-field (or 6-field with seconds) expressions
  jobs: [
    { id: 'nightly', schedule: '0 3 * * *', async handler(ctx) { /* … */ } },
  ],

  // dynamic timers fire back into `scheduled`
  scheduled(input, ctx) {
    ctx.log.info('fired', { name: input.name, payload: input.payload })
  },

  routes: [
    { method: 'POST', path: '/remind', async handler(req, ctx) {
        await ctx.scheduler.in(60_000, 'remind', { tripId: 1 })
        // also: .at(epochMs, name, payload) · .every(ms, name, payload) · .cancel(name)
        return { status: 200 }
    } },
  ],
}
```

任务和定时任务运行时都**没有操作用户**（旅行读取会被拒绝；只有你自己的 db + 已声明的出站）。`at`、`in` 和 `every` 按名称 upsert —— 用同一名称再次调度会替换待执行的任务 —— 并且能跨重启存活。上限：每插件 ≤100 个任务、名称 ≤128 字符、负载 ≤8 KB、重复间隔 ≥60s、最远 ≤1 年。

---

## 向核心视图贡献原生基础元素

七个声明式钩子让插件把数据推送到 Tourism-Team 自己的屏幕中 —— 主机负责渲染和净化一切，因此画布上没有 iframe，也没有插件的 JS。每个都需要各自的 `hook:*` 权限，在当前用户绑定下以较短超时运行，缓慢或失败的调用会被跳过（绝不会致命）。主机限制数量和长度。

```js
hooks: {
  // hook:table-contributor — cells/buttons on a row. view ∈ reservations|transports|places|day|costs|packing|files|todos
  tableContributor: { async getContributions(view, tripId, ctx) {
    return [{ kind: 'column', entityId: 42, id: 'crowd', label: 'Crowd', value: 'Quiet', tone: 'success' }]
  } },

  // hook:map-marker-provider — pins on the trip map (#587)
  mapMarkerProvider: { async getMarkers(tripId, ctx) {
    return [{ id: 'm1', lat: 35.62, lng: 139.78, label: 'Teamlab', popupText: 'Opens 10:00' }]
  } },

  // hook:map-layer-provider — routes/corridors/zones drawn on the trip map
  mapLayerProvider: { async getLayers(tripId, ctx) {
    return [{ id: 'route', name: 'Suggested route', features: [
      { type: 'polyline', points: [[35.62, 139.78], [35.66, 139.70]], tone: 'success', width: 4 },
      { type: 'circle', center: [35.66, 139.70], radiusM: 1500, dash: 'dash', fill: true, label: 'Reachable on foot' },
    ] }]
  } },

  // hook:pdf-section-provider — text sections appended to the trip PDF export
  pdfSectionProvider: { async getSections(tripId, ctx) {
    return [{ title: 'Notes', paragraphs: ['Bring cash.'], table: { headers: ['Day', 'Plan'], rows: [['1', 'Odaiba']] } }]
  } },

  // hook:atlas-layer-provider — country tint layers on the Atlas map (user-scoped, no target arg)
  atlasLayerProvider: { async getLayers(ctx) {
    return [{ id: 'wishlist', name: 'Wishlist', countries: [{ code: 'JP', tone: 'warn' }] }]
  } },

  // hook:journal-entry-provider — extra rows under a journal entry
  journalEntryProvider: { async getRows(entryId, ctx) {
    return [{ label: 'Weather', value: 'Sunny 22°C' }]
  } },

  // hook:trip-card-provider — badges on dashboard trip cards (tripIds = the cards on screen)
  tripCardProvider: { async getCards(tripIds, ctx) {
    return tripIds.map((id) => ({ tripId: id, id: 'days', label: 'Days left', value: '12' }))
  } },
}
```

`tone` 为 `'default' | 'success' | 'warn' | 'danger'`；任何 `url` 必须是 http/https/mailto；`icon` 是 lucide 图标名 —— 而它是把字形送进来的唯一途径，因为钩子返回的每个字符串都会在渲染边界被剥离 emoji，然后 Tourism-Team 才会绘制它。表格的 `action`（代替 `column`）是一个带标签的按钮，其目标会打开你的沙箱化框架或调用你的某个路由。

---

## 提供一种路线规划方案（电动车充电停靠点）

声明一个 profile 并实现 `routeProvider` 钩子 —— 你的 profile 会出现在规划器路线开关中「驾车/步行」的旁边，Tourism-Team 会请*你*来规划当天路线。需要 `hook:route-provider`；如果你调用外部路线服务，还需加上 `http:outbound:<solver-host>`。

```json
"permissions": ["hook:route-provider", "http:outbound:api.example-ev.com"],
"egress": ["api.example-ev.com"],
"capabilities": { "routeProfiles": [{ "id": "ev", "label": "EV (charging)" }] }
```

```js
hooks: {
  routeProvider: {
    async getRoute({ tripId, dayId, profile, waypoints }, ctx) {
      // waypoints = the day's located stops in visit order (2..30).
      const plan = await solveEvRoute(waypoints) // your solver / external API
      return {
        coordinates: plan.polyline,          // [lat,lng][] for the map line
        distance: plan.meters,
        duration: plan.seconds,              // driving + charging
        legs: waypoints.slice(1).map((_, i) => ({
          distance: plan.legs[i].meters,
          duration: plan.legs[i].seconds,
          note: plan.legs[i].chargeMin ? `${plan.legs[i].chargeMin} min charge` : undefined,
        })),
        viaPoints: plan.chargers.map((c) => ({
          lat: c.lat, lng: c.lng, tone: 'success',
          label: `${c.name} · to ${c.targetSoc}%`, dwellSeconds: c.chargeMin * 60,
        })),
      }
    },
  },
},
```

各 leg 必须与路点对一一对应（否则 Tourism-Team 会整体拒绝该结果），`note` 会显示在日程计划的连接线上，而途经点会作为站点绘制在路线线上。每个请求你有 20 秒；抛出异常或超时只会回退到直线。如果你还想要走廊/区域，请把它与 `mapLayerProvider` 配合使用；如果用户应当能把充电停靠点保存为真实地点，请再加上 `db:write:places` + `db:write:itinerary`。

若还要让*时间计划*反映你的停靠点，请加上 `hook:day-schedule-provider` 并返回带锚点的时间行 —— 它们会在桌面端和移动端的日程计划中渲染，其分钟数会计入当天的路线页脚总计：

```js
dayScheduleProvider: {
  async getSchedule(tripId, ctx) {
    const days = await ctx.trips.getDays(tripId)
    return days.flatMap((d) => (d.assignments ?? [])
      .filter((a) => needsCharge(a))
      .map((a) => ({
        id: `charge-${a.id}`, dayId: d.id, assignmentId: a.id,
        minutes: 35, label: 'Charge to 80% nearby', tone: 'warn',
      })))
  },
},
```

### 为多目的地旅行的各天着色

`hook:day-schedule-provider` 可以把「金泽开始」作为一行公布出来，但它无法让第 12 天*看起来*属于金泽。`hook:day-tint-provider` 可以 —— 它为「计划」侧边栏中的日期卡片（以及当天的移动端胶囊按钮）着色，使用四种色调之一或你自己的颜色：

```js
dayTintProvider: {
  async getDayTints(tripId, ctx) {
    const legs = await loadLegs(ctx, tripId)          // your own db:own rows
    const days = await ctx.trips.getDays(tripId)
    return days
      .map((d) => ({ d, leg: legs.find((l) => covers(l, d)) }))
      .filter(({ leg }) => leg)                        // days no leg covers stay untinted
      .map(({ d, leg }) => ({ dayId: d.id, tone: leg.tone, label: leg.name }))
  },
},
```

**每天返回一个条目** —— 这里的约束是旅行的天数，而不是固定的条目上限，因此对于六个月的行程它依然正确，而在那里，≤60 条目的日程钩子只会给前 60 天着色。

#### 使用你自己的颜色

四种色调无法把一趟二十站行程的各段区分开。改为发送 `color` —— 仅限 `#rrggbb`，其他任何形式都无法通过（`#abc`、`rgb(...)` 和 CSS 颜色名都会被忽略，因为该值最终会进入主机构建的某个 CSS 颜色中）：

```js
// One hue per leg, from your own palette.
return days.map((d) => ({ dayId: d.id, color: legColor(d), label: legName(d) }))

// Mix freely: your colour on the badge, a shared tone for the rest of the card.
return days.map((d) => ({ dayId: d.id, tone: 'default', badgeColor: legColor(d) }))
```

每个区域都可以在 `<region>Tone` 之外接受 `<region>Color`。在同一个区域内，颜色优先于色调，而你在某个区域上指定的任何东西都胜过简写 —— 因此上面的第二个例子会用你的颜色给徽章着色，并用 `default` 给标题和活动列表着色。

你选择色相；主机仍然决定权重。它会按主题和区域设置透明度，并把颜色的明度钳制到一个在浅色和深色侧边栏上都清晰可读的区间，因此着色始终作为日期背后的一层淡色而不是填充落下，你发送的任何颜色都不会让某天变得无法阅读。普通的中段颜色会按你发送的原样呈现；只有极端值（近白、近黑）会被拉回。

颜色是装饰，不是信息 —— 把它与 `label` 搭配（在含义重要的地方再加一行日程）以便它对无法靠色相区分你各段行程的人也依然可用。

#### 只给一个区域着色而不是整张卡片

日期卡片有三个可分别着色的区域，上面的 `tone` 只是把它们全部填充的简写。当给整张卡片着色会与内容冲突时，请逐个指定它们 —— 一个排满的日期只标记其徽章要易读得多：

```js
// Bold on the badge (and the mobile day chip), plain everywhere else.
return days.map((d) => ({ dayId: d.id, badgeTone: legTone(d), label: legName(d) }))

// Or: a quiet leg colour on the card, with the activity list left completely alone.
return days.map((d) => ({
  dayId: d.id,
  badgeTone: legTone(d),
  headerTone: legTone(d),
  label: legName(d),
}))

// Or: reserve the activity list for a per-day signal of your own.
return days.map((d) => ({ dayId: d.id, headerTone: legTone(d), activityTone: overbooked(d) ? 'danger' : undefined }))
```

| 字段 | 区域 |
|---|---|
| `badgeTone` / `badgeColor` | 天数徽章 —— 最小也最醒目；同时也是移动端的日期胶囊按钮 |
| `headerTone` / `headerColor` | 日期标题行（编号、标题、日期、费用）；悬停会加深着色 |
| `activityTone` / `activityColor` | 展开的活动列表 —— 最大，位于最密集的文字之后，着色最淡 |

你从未指定的区域不会被着色，其渲染结果与你没有该插件时完全一样。

这些区域对应的是**桌面端**的日期卡片。在移动端只有徽章会渲染，作为日期胶囊按钮的着色 —— 标题和活动着色不会显示在手机上。把每个用户都必须看到的内容放在徽章上（或放在包含它的那些简写上），并把更细的区域当作桌面端的精修。

`label` 会成为当天的工具提示。某一天最多接受一份贡献，并且它会被**整体**决定 —— 在你的列表中，某一天的第一条条目获胜；如果另一个插件也给那一天着色，则第一个被授予的提供方完全获胜，因此天数永远不会闪烁，两个插件也无法各自拥有同一张卡片的一部分。

---

## 遵守账户删除和数据导出（GDPR）

**需要：** `hook:user-data`

当 Tourism-Team 账户被抹除或其数据被导出时，主机会调用这些函数。两者都是**无用户**的 —— 你只会拿到一个 `userId` 并作用于你自己的 db，因此该授权不会泄漏任何对核心数据的读取。

```js
module.exports = {
  // Erasure — called durably (queued, retried until it succeeds), so make it idempotent.
  async deleteUserData({ userId }, ctx) {
    await ctx.db.exec('DELETE FROM my_rows WHERE user_id = ?', userId)
  },
  // Portability — return a JSON-serialisable value the host aggregates into the export.
  async exportUserData({ userId }, ctx) {
    return await ctx.db.query('SELECT * FROM my_rows WHERE user_id = ?', userId)
  },
}
```

---

## 写入每一个子系统

在地点/日程/行程之外，Tourism-Team 对几乎每个旅行子系统都开放了创建/更新/删除。每一项都会针对操作用户做成员校验，并需要其 `db:write:*` 权限范围**加上**该应用的编辑权限 —— 只声明你用到的。

```js
// Bookings & lodging — needs 'reservation_edit' / 'day_edit'
await ctx.reservations.create(tripId, { type: 'flight', title: 'NRT → HND', endpoints: [/* legs */] })
await ctx.accommodations.create(tripId, { place_id, start_day_id, end_day_id, check_in: '15:00' })
// Packing & to-dos — needs 'packing_edit'
await ctx.packing.create(tripId, { name: 'Passport', visibility: 'personal' })
await ctx.todos.create(tripId, { name: 'Buy JR pass', due_date: '2027-04-01' })
// Costs (budget) — needs 'budget_edit' + the Costs addon
await ctx.costs.create(tripId, { name: 'Hotel', total_price: 120, currency: 'EUR' })
// Collab notes/polls/chat — needs 'collab_edit' + the Collab addon
await ctx.collab.createNote(tripId, { title: 'Meeting point' })
// Day notes — needs 'day_edit'
await ctx.daynotes.create(tripId, dayId, { text: 'Rainy — swap plans' })
// Tags (the acting user's own)
const tag = await ctx.tags.create({ name: 'foodie', color: '#4F46E5' })
```

对应的读取与应用 1:1 对应：`ctx.trips.getReservations/getAccommodations/getDays`、`ctx.packing.list`、`ctx.costs.getByTrip`、`ctx.collab.listNotes/listPolls/listMessages`、`ctx.daynotes.list`、`ctx.todos.list`、`ctx.tags.list`、`ctx.categories.list`。

---

## 写入操作用户自己的足迹 / 假期 / 旅程 / 收藏

这些属于**用户**（而不是某一趟旅行），每一项都以对应的扩展已启用为前提。

```js
await ctx.atlas.markCountry('JP')                                   // db:write:atlas
await ctx.atlas.createBucketItem({ name: 'See Mt Fuji', country_code: 'JP' })
await ctx.vacay.toggleEntry('2027-04-02')                          // db:write:vacay — toggles one PTO day
const j = await ctx.journal.createJourney({ title: 'Japan 2027' })  // db:write:journal
await ctx.journal.createEntry(j.id, { entry_date: '2027-04-02' })
const c = await ctx.collections.create({ name: 'Tokyo eats' })      // db:write:collections
await ctx.collections.savePlace({ collection_id: c.id, name: 'Ramen shop', lat: 35.6, lng: 139.7 })
```

读取：`ctx.atlas.visited()/bucketList()`、`ctx.vacay.mine()`、`ctx.journal.listMine()/getEntries()`、`ctx.collections.listMine()/get()`。

---

## 原子地批量写入，并读取按用户的设置

**需要：** `db:own`（用于 `db.tx`）；`ctx.settings` 不需要权限。

```js
// db.tx — all commit or all roll back, on your OWN db (≤100 statements; reads see the batch's earlier writes)
await ctx.db.tx([
  { sql: 'INSERT INTO cache(k, v) VALUES(?, ?)', args: ['a', 1] },
  { sql: 'UPDATE cache SET v = v + 1 WHERE k = ?', args: ['a'] },
])

// ctx.settings.get — the ACTING USER's own value for a scope:'user' settings field (decrypted host-side)
const apiKey = await ctx.settings.get('apiKey')   // undefined when unset or userless → fall back to ctx.config
```

`ctx.config` 是管理员拥有的实例设置；`ctx.settings` 是该用户为你在清单中声明的 `scope:'user'` 字段所设的私有值。

---

## 各部分在哪里运行

| 表面 | 运行于 | 获得 |
|---|---|---|
| `routes` | 派生的服务器子进程 | 绑定到 HTTP 请求用户的 `ctx` |
| `jobs` | 派生的服务器子进程，按计划 | **没有**用户的 `ctx`（无法读取用户范围的数据） |
| `hooks` | 派生的服务器子进程，核心请求时 | 绑定到触发该次读取的用户的 `ctx`，超时较短 |
| `widget` / `page` | 沙箱化 iframe（无同源） | `postMessage` 桥接；通过 `trek:invoke` 调用自己的路由 |
