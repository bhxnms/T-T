# 插件开发

用 `trek-plugin-sdk` 包构建插件。插件是一个目录，含一份清单（`trek-plugin.json`）、一个
构建好的服务端入口，以及——对于页面/小组件插件——一个静态客户端包。Tourism-Team 在一个
**隔离的子进程**中运行你的服务端代码，并且只通过 RPC 访问它；浏览器部分运行在一个
**沙箱化的不透明来源 iframe** 中。除此之外没有别的进出通道。

## 开始之前

有两个资源与本页并列：

- **[Plugin-Skill](https://github.com/liketrek/Plugin-Skill)** —— 一个 agent 技能，
  教 Claude Code 和其他兼容 SKILL.md 的编码 agent 如何构建、测试和发布 Tourism-Team
  插件。它覆盖与本页相同的范围，但读它的是 agent 而不是你。把它加到你构建插件的
  仓库里，只要任务涉及 Tourism-Team 插件它就会自动加载。
- **[TREK-Plugins](https://github.com/bhxnms/T-T-Plugins)** —— 社区注册表。它是一个
  静态索引，没有服务器也没有账号：你通过发起一个添加单个 JSON 文件的 pull request 来
  登记插件。你插件的代码留在你自己的仓库里；注册表只指向它。提交流程与 CI 关卡见
  [发布插件](Plugin-Publishing)。

两者都不是必需的。你可以在完全不碰它们的情况下构建、安装和运行插件——只有当你希望
其他人的 Tourism-Team 实例能发现它时，注册表才重要。

## 脚手架

```bash
npx trek-plugin-sdk create                # interactive wizard
npx trek-plugin-sdk create my-plugin --type integration|page|widget|trip-page   # or direct
cd my-plugin
```

向导（不带名称运行 `create`）会询问 id、类型、作者、图标（对照 lucide 校验——那里的
拼写错误在本地看不出来，但会被注册表拒绝）、权限、出站主机和必需扩展；直接形式则把
这些作为标志传入。

它会生成：

```
my-plugin/
  trek-plugin.json      # manifest — including `icon`, and a widget's `slot`
  package.json          # CommonJS marker + the SDK as a devDependency
  server/index.js       # your plugin code (built, plain JS)
  client/index.html     # native UI via the design kit (page / widget / trip-page only)
  README.md             # fill this in — the registry requires four sections and a screenshot
  docs/                 # where docs/screenshot.png goes; `trek-plugin shot` writes it
  .gitattributes        # LF everywhere, so the packed artifact's sha256 is reproducible
```

脚手架声明 `"trek": ">=4.0.0 <5.0.0"`——它针对编写的主机接口是 Tourism-Team 4 接口，
而声明一个更旧的下限会让插件安装到一个缺少它部分功能的主机上。在向导中选择
`oauth:client` 还会脚手架出 OAuth broker 读取的那五个实例范围设置（见
[主机中转的 OAuth](#host-brokered-oauth-ctxoauth)）。

你得到的东西**能立即运行和打包**，但它**还不能**通过 `validate`：README 还是模板，
也没有截图。这是刻意的——那些该由你来写——而 `trek-plugin status` 会准确说出还缺什么。

## 在本地以热重载运行

```bash
npx trek-plugin-sdk dev        # http://localhost:4317
```

`dev` 在 `create` 之后直接可用——不需要 `npm install`，因为它从 CLI 自身注入
`require('trek-plugin-sdk')`，正如 Tourism-Team 在生产中注入它一样。它通过与主机相同的
`definePlugin` 契约加载你的 `server/index.js`，并给你一个**真实的请求循环而无需完整的
Tourism-Team**：一个列出你路由的仪表盘、在 `/api/<path>` 下提供服务的路由、位于 `/ui`
的页面/小组件 UI、一个**位于 `/preview` 的带主题主机预览**（一个真实的沙箱化框架，
带主题/强调色/外观切换，`trek.invoke()` 代理到你的路由），以及每次保存后的重载。注入的
`ctx` 是**完整接口**——每一项能力（`costs`、`packing`、`files`、`notify`、`ai`、
`settings`、`scheduler`、`meta`、`oauth`、`weather`、`rates`、`journal`、`db.tx` 等），
而不只是 routes + `db:own`——并且**严格执行你清单授予的权限**：未被授予的调用会抛出
`PERMISSION_DENIED`，因此你在这里就能捕获缺失的授权，而不是等到安装之后。当运行时有
`node:sqlite` 时，`db:own` 由一个真实的 SQLite 文件（`.trek-dev/db.sqlite`）支撑；
其他每项能力都由你的 fixture 按与生产相同的规则提供。

- 用 `?_anon=1` 以未认证请求访问某个路由（此时 `auth: true` 的路由会返回 401，与
  主机一致）。
- 通过在清单旁边放一个 `dev-fixtures.json` 来喂入 fixture——它采用**与
  `createMockHost` 选项相同的形状**，因此你可以预置旅行、用户、费用、设置、天气、
  预设的 AI 结果等：`{ "actingUserId": 1, "trips": { "1": {
  "members": [1], "data": { … }, "costs": [ … ] } }, "users": {} }`。
- 用 `GET /__dev/fire/<kind>[/<name>][/<fn>]` 触发**非路由**入口（JSON body 或查询参数
  成为 payload/args）：`/__dev/fire/job/refresh`、`/__dev/fire/scheduled/daily`、
  `/__dev/fire/event/place:created`、`/__dev/fire/hook/tripCardProvider/getCards`、
  `/__dev/fire/deleteUserData?userId=1`——因此任务、定时器、事件订阅和提供方钩子都能在
  与你的路由同一个热重载循环中测试。

### 针对真实实例的数据测试（dev-link）

上面的 `dev` 很快，但它的主机数据是**合成的**（fixture / 一个临时的 `db:own`）。当你
需要插件针对**真实**的旅行、地点、预订、费用和真实的成员/权限运行时，把它链接进一个
运行中的 Tourism-Team 实例，而不是每次都打包 + 上传。

在**服务器**上（一个本地 `trek-dev` 或一个开发实例——**绝不要在生产环境**），设置：

```bash
TREK_PLUGINS_DEV_LINK=1
```

设置该标志后，**管理 → 插件** 标签页会显示一个 **「链接本地插件」** 字段。粘贴你的
**已构建**插件目录的绝对路径（即含有 `trek-plugin.json` + `server/index.js` 的那个
——先构建，加载器运行的是编译后的产物，不是 TS 源码），然后点击 **链接**。插件会被
符号链接进插件卷并以未激活状态注册，并在列表中显示一个 **Dev-link** 徽章。

更喜欢脚本方式？同样的事情也可以通过 HTTP 完成：

```bash
curl -XPOST /api/admin/plugins/link -H 'content-type: application/json' \
  -d '{ "path": "/abs/path/to/your/plugin" }'
```

在管理 UI 中激活它，并像往常一样同意它的权限。它现在通过与任何已安装插件**相同的
能力 RPC 主机**运行：真实的、受成员门控的数据，操作用户由主机侧解析，没有冒充——
代码来源永远不触及安全门。

**热重载：** 重新构建你的插件（例如 `tsc --watch` 输出 `server/index.js`），
Tourism-Team 会自动重新派生它（对被链接目录的文件监听）。要强制进行，
`POST /api/admin/plugins/:id/reload`，或者直接在管理 UI 中点击 **重启**——两者都会
重新派生子进程，拾取新代码（一个扩大了权限的重新构建清单仍然需要显式重新同意）。

> Dev-link 在管理员 + 插件终止开关之上还受 `TREK_PLUGINS_DEV_LINK` 门控，并且
> **默认关闭**。它会加载未签名的本地代码，这些代码在重启之间会实时变动，而在
> `npm run dev` 下操作系统权限牢笼是关闭的——因此只在你掌控的、指向开发实例的机器上
> 启用它。

## 插件类型

- **integration** —— 后台逻辑（任务、路由），没有自己的 UI。每个提供方钩子都是
  **可用的**——从 placeDetailProvider 和 warningProvider 到 photoProvider（照片）和
  calendarSource——见 [提供方钩子](#provider-hooks)。
- **page** —— 添加一个导航条目，打开一个整页的沙箱化 iframe。
- **widget** —— 添加一张卡片到仪表盘（`sidebar` 槽位）、一个主视觉栏浮层
  （`hero` 槽位）、一个位于旅行规划器 **place-detail** 视图内的面板
  （`place-detail` 槽位——框架还会在 `trek:context` 中收到打开的 `placeId`，因此它
  可以显示评价或评分之类的地点专属信息）、一个位于 **day-detail** 视图内的面板
  （`day-detail` 槽位——收到打开的 `dayId`；是穿搭规划、实时航班状态或物流等逐日
  内容的归属地），或者一个位于 **reservation-detail** 视图中预订卡片底部的面板
  （`reservation-detail` 槽位——收到打开的 `reservationId`，用于实时入住状态或座位图
  之类的东西）。在 `capabilities.widget.slot` 中设置槽位。
- **trip-page** —— 在**每个旅行规划器内部**添加一个标签页，因此你的 UI 与
  计划 / 交通 / 文件 并列存在于旅行中。框架与 `page` 是同一个沙箱化 iframe，但它会在
  `trek:context` 中收到当前的 `tripId`（因此你可以把数据限定在打开的旅行上），并且
  没有仪表盘导航条目。该标签页在桌面端和移动端都会显示。通过
  `capabilities.tripPage`，插件还可以**接管核心标签页**：
  `replaces: ['transports', 'buchungen', …]` 在插件激活期间隐藏指定的标签页（它们在
  插件被停用的一刻恢复；`plan` 永远不可替代），而 `position` 在栏中选择你标签页的
  0 起始索引，而不是把它追加在末尾。替代标签页的插件会在管理列表中拿到一个
  「替代规划器标签页」标签，因此接管在激活之前就是可见的。

## SDK 包

`trek-plugin-sdk` 是**在运行时注入**的——主机让 `require('trek-plugin-sdk')` 在子进程内
可解析，因此**不要把它打包（vendor）**进你的产物。只把它加为**开发依赖**，这样你能
得到类型、用于测试的 `createMockHost`，以及 `trek-plugin` CLI：

```bash
npm i -D trek-plugin-sdk
```

## 编写服务端

你的 `server/index.js` 导出一个 `definePlugin(...)` 对象。一切都通过 `ctx` 参数抵达
Tourism-Team。

```js
const { definePlugin } = require('trek-plugin-sdk')

module.exports = definePlugin({
  // Runs once when the plugin is activated. NOTE: onLoad has no user context —
  // ctx.trips.* is refused here (see the ctx table).
  async onLoad(ctx) {
    await ctx.db.migrate('001_init', 'CREATE TABLE IF NOT EXISTS cache (k TEXT PRIMARY KEY, v TEXT)')
    ctx.log.info('loaded')
  },

  // Runs once on deactivation/stop. Use it to flush or release resources.
  async onUnload(ctx) {
    ctx.log.info('unloading')
  },

  // HTTP routes, mounted at /api/plugins/<id><path>.
  routes: [
    { method: 'GET', path: '/status', auth: true, async handler(req, ctx) {
      const rows = await ctx.db.query('SELECT COUNT(*) AS n FROM cache')
      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ n: rows[0].n, user: req.user?.username }),
      }
    }},
  ],

  // Scheduled jobs — Tourism-Team owns the cron and calls your handler on the schedule.
  // Requires the `jobs:run` permission (opt-in: scheduled work runs with NO user,
  // so its trip reads are refused — a job can only use ctx.db and declared egress).
  // An invalid cron expression is skipped; jobs stop when the plugin is deactivated.
  jobs: [
    { id: 'refresh', schedule: '*/15 * * * *', async handler(ctx) { /* … */ } },
  ],

  // Persistent, userless timers you arm at runtime with ctx.scheduler — they
  // survive restarts and call this handler when due. Also needs `jobs:run`.
  //   await ctx.scheduler.in(3_600_000, 'remind', { tripId })   // once, in 1h
  //   await ctx.scheduler.every(86_400_000, 'digest')           // daily
  async scheduled({ name, payload }, ctx) {
    if (name === 'remind') { /* … one-shot fired; re-arm if you want another */ }
  },

  // GDPR data-subject rights (needs `hook:user-data`). Userless — you only get the
  // userId and act on your OWN db. deleteUserData is delivered DURABLY (queued and
  // retried until it succeeds, even across restarts), so make it idempotent.
  async deleteUserData({ userId }, ctx) {
    await ctx.db.exec('DELETE FROM my_prefs WHERE user_id = ?', userId)
  },
  async exportUserData({ userId }, ctx) {
    return await ctx.db.query('SELECT * FROM my_prefs WHERE user_id = ?', userId)
  },
})
```

你在这里声明的路由和任务 id 是**权威**的：主机从你加载的定义中读取它们（路由的数组
索引就是它的内部 id）。脚手架不会往 `trek-plugin.json` 里写 `routes` 块，而清单解析器
即使你加了也会忽略它。

### `ctx` 对象

| 区域 | 方法 | 需要 |
|---|---|---|
| `ctx.db` | 针对你**自己的** SQLite 文件执行 `query(sql, …args)` / `exec(sql, …args)` / `migrate(id, sql)` / `tx(ops)`。`tx([{sql, args?}, …])` 在一个事务中运行最多 100 条语句（要么全部提交要么全部回滚；读取能看到该批次自己更早的写入）→ `{ results: [{changes?}\|{rows?}, …] }`。你的文件上限为 **256 MB**（超出它的写入会以 `SQLITE_FULL` 失败，并被限制在你的插件内），单个结果集上限为 **100,000 行**——请对你的读取分页，而不是物化一个笛卡尔积 | `db:own` |
| `ctx.trips` | `getById` / `getPlaces` / `getReservations` / `getDays` / `getAccommodations` / `listMine()` —— 枚举操作用户能访问的每个旅行（做成员校验）。`getDays` 包含每一天的 `assignments` + `notes_items`；`getReservations` 包含 `endpoints` + `day_positions` | `db:read:trips` |
| `ctx.trips.update(tripId, fields)` | 更新旅行字段（title/dates/currency/reminder_days/…） | `db:write:trips` |
| `ctx.trips.create(input)` | 创建一个**归操作用户所有的新旅行**（导入器）——`title` 必填，另有 `description?`/`start_date?`/`end_date?`/`currency?`/`reminder_days?`/`day_count?` | `db:create:trips`（+ `trip_create`） |
| `ctx.places` | `create(tripId, fields)` / `update(tripId, placeId, fields)` / `delete(tripId, placeId)` | `db:write:places` |
| `ctx.days` | `create(tripId, {date?, notes?})` / `update(tripId, dayId, {notes?, title?})` / `delete(tripId, dayId)` | `db:write:days` |
| `ctx.itinerary` | `assign(tripId, dayId, placeId, notes?)` / `unassign(tripId, assignmentId)` —— 地点↔日程 | `db:write:itinerary` |
| `ctx.meta` | 在 `trip`/`place`/`day`/`reservation`/`accommodation` 上 `get` / `set` / `list` / `delete` 你**自己的**命名空间数据（无需分叉 schema 就能丰富核心实体） | `db:meta` |
| `ctx.packing` | `list(tripId)` —— 某次旅行的行李项（做成员校验，遵守私有项可见性） | `db:read:packing` |
| `ctx.files` | `list(tripId)` —— 某次旅行的文件，排除回收站（做成员校验） | `db:read:files` |
| `ctx.files.getContent` | `getContent(tripId, fileId)` → `{ name, mimetype, size, content_base64 }` —— 文件的字节内容，base64 编码（上限 10MB；已放入回收站的文件被拒绝） | `db:read:files:content` |
| `ctx.journal` | `listMine()` —— 操作用户自己的旅行日志；`getEntries(journeyId)` —— 一次旅程的条目（照片/故事/打卡，做访问校验） | `db:read:journal`（+ 旅程扩展） |
| `ctx.atlas` | `visited()` —— 操作用户已访问的国家 + 地区；`bucketList()` —— 其心愿单条目 | `db:read:atlas`（+ 足迹扩展） |
| `ctx.vacay` | `mine()` —— 操作用户的假期计划 | `db:read:vacay`（+ 假期扩展） |
| `ctx.collections` | `listMine()` / `get(id)` —— 操作用户已保存地点的收藏 | `db:read:collections`（+ 收藏扩展） |
| `ctx.collections`（写入） | `create(input)` / `update(id, input)` / `savePlace(input)` / `copyToTrip(input)` / `deletePlace(placeId)` —— 按收藏的角色由服务强制执行 | `db:write:collections`（+ 收藏扩展） |
| `ctx.atlas`（写入） | `markCountry(code)` / `unmarkCountry` / `markRegion(regionCode, countryCode, regionName?)` / `unmarkRegion` / `createBucketItem(input)` / `deleteBucketItem(itemId)` —— 操作用户自己的行 | `db:write:atlas`（+ 足迹扩展） |
| `ctx.vacay`（写入） | `toggleEntry(date)` —— 操作用户在其启用计划上自己的 PTO 日；`toggleCompanyHoliday(date, note?)` | `db:write:vacay`（+ 假期扩展） |
| `ctx.journal`（写入） | `createEntry(journeyId, {entry_date, ...})` / `updateEntry(entryId, fields)` / `deleteEntry(entryId)` —— 受所有者/贡献者门控；`createJourney({title, subtitle?, trip_ids?})` / `deleteJourney(journeyId)` —— 一个归操作用户所有的新日志（导入器先创建日志再填充它） | `db:write:journal`（+ 旅程扩展） |
| `ctx.files`（写入） | `create(tripId, {name, content_base64, mimetype?, ...})`（上限 10MB，被阻止的扩展名会被拒绝） / `createLink(tripId, fileId, opts)` / `update` / `softDelete` —— 广播 `file:*` | `db:write:files`（+ 操作用户的 `file_upload`/`file_edit`/`file_delete`） |
| `ctx.collab` | `listNotes(tripId)` / `listPolls(tripId)` / `listMessages(tripId, before?)` —— 某次旅行的笔记、投票（含选项 + 投票人）和聊天（最新 100 条，最早的在前；`before` = 用于向前翻页的消息 id），做成员校验 | `db:read:collab`（+ 协作扩展） |
| `ctx.collab`（写入） | `createNote(tripId, {title, ...})` / `createPoll(tripId, {question, options})` / `votePoll(tripId, pollId, optionIndex)` / `createMessage(tripId, text, replyTo?)` —— 广播 `collab:*` | `db:write:collab`（+ `collab_edit`、协作扩展） |
| `ctx.trips.addMember` / `.removeMember` | `addMember(tripId, userId)` —— **授予旅行访问权**；`removeMember(tripId, userId)` —— 撤销它（永远不是所有者），因此一个目录同步集成也能对离职做核对 | `db:write:members`（+ `member_manage`） |
| `ctx.notify` | `send({title, body, link?, scope, targetId})` —— 通知铃收件箱 + 邮件/ntfy 扇出；接收者被强制为操作用户（`scope:'user'`）或他所属的某个旅行（`scope:'trip'`） | `notify:send` |
| `ctx.ai` | `complete(prompt, system?)` → `{ text }`；`extract(text, jsonSchema, prompt?)` → `{ results }` —— 管理员/用户配置的提供方；主机持有密钥；输出是**数据**（不会自动写入） | `ai:invoke` |
| `ctx.oauth` | `getAccessToken()` → 为主机代表操作用户连接（设置 → 插件 → 连接）的第三方服务，获取该操作用户的一个**短期访问令牌**；未连接 / 无用户时为 `null`。主机持有刷新令牌 + 客户端密钥 | `oauth:client` |
| `ctx.scheduler` | `at(whenMs, name, payload?)` / `in(ms, name, payload?)` / `every(ms, name, payload?)` / `cancel(name)` —— **持久、无用户**的定时器，能跨重启存活并触发你的 `scheduled(input, ctx)` 处理函数。`set` 按 `name` upsert；上限：≤100 个任务、8 KB 负载、重复间隔 ≥ 60 秒、最远 ≤ 约 1 年。与 `jobs` 属于同一风险类别（没有操作用户 → 旅行读取被拒绝） | `jobs:run` |
| `ctx.settings` | `get(key)` —— 你的 `scope:'user'` 设置字段中某一个的**操作用户自己**的值（主机侧解密），或者当他们从未设置时该字段在清单中的 `default`。对于两者都没有的字段，以及在无用户上下文（任务/onLoad）中，返回 `undefined`——在那里回退到 `ctx.config`。用户在 **设置 → 插件** 下填写它们；机密加密存储且从不回显 | 无（你自己的设置） |
| `ctx.daynotes` | `list(tripId, dayId)` —— 某一天的备注（做成员校验） | `db:read:daynotes` |
| `ctx.daynotes`（写入） | `create(tripId, dayId, {text, time?, icon?, sort_order?})` / `update(tripId, dayId, noteId, fields)` / `delete(tripId, dayId, noteId)` —— 广播 `dayNote:*` | `db:write:daynotes` |
| `ctx.packing`（写入） | `create(tripId, {name, category?, checked?, is_private?, visibility?, recipient_ids?})` / `update(tripId, itemId, fields)` / `delete(tripId, itemId)` —— 广播 `packing:*`，私有项（#858）保持以所有者为范围 | `db:write:packing` |
| `ctx.packing`（行李） | `listBags(tripId)` / `createBag(tripId, {name, color?})` / `updateBag` / `deleteBag` / `setBagMembers(tripId, bagId, userIds)` —— 行李不携带隐私 | `db:write:packing` |
| `ctx.weather` | `get(lat, lng, date?)` —— 主机缓存的预报（免租户） | `weather:read` |
| `ctx.rates` | `get(base)` → 一个相对于 `base` 的报价 → 汇率映射（例如 `'EUR'` → `{ USD: 1.08, … }`；上游缓存，免租户）；上游失败时为 `null` | `rates:read` |
| `ctx.categories` | `list()` —— 全局地点分类列表 | `db:read:categories` |
| `ctx.tags` | `list()` / `create({name, color?})` / `update(tagId, fields)` / `delete(tagId)` —— 操作用户自己的标签 | `db:read:tags` / `db:write:tags` |
| `ctx.trips.members` | `members(tripId)` —— 旅行成员名单（id + 显示字段），做成员校验 | `db:read:trips` |
| `ctx.todos` | `list(tripId)` / `create(tripId, {name, ...})` / `update(tripId, todoId, fields)` / `delete(tripId, todoId)` —— 广播 `todo:*` | `db:read:todos` / `db:write:todos`（+ `packing_edit`） |
| `ctx.costs` | `getByTrip(tripId)` / `listMine()` —— 读取预算项（做成员校验） | `db:read:costs` |
| `ctx.costs`（写入） | `create(tripId, input)` / `update(tripId, itemId, input)` / `delete(tripId, itemId)` —— 广播 `budget:*` | `db:write:costs` |
| `ctx.reservations` | `listMine()` —— 操作用户可访问的每趟旅行上的每一笔预订（做成员校验） | `db:read:trips` |
| `ctx.reservations`（写入） | `create(tripId, input)` / `update(tripId, reservationId, input)` / `delete(tripId, reservationId)` —— 与应用完全对等（住宿、预算同步、通知、广播 `reservation:*`）。`input.endpoints` = `{ role: 'from'\|'to'\|'stop', name, lat, lng, code?, sequence?, timezone?, local_time?, local_date? }` 的数组；更新语义：省略 = 保留，`[]` = 全部删除，数组 = 替换（endpoint id 不稳定） | `db:write:reservations` |
| `ctx.accommodations` | `create(tripId, { place_id, start_day_id, end_day_id, check_in?, check_in_end?, check_out?, confirmation?, notes? })` / `update(tripId, accommodationId, fields)` / `delete(tripId, accommodationId)` —— 住宿区块；创建会自动创建配对的酒店预订，删除会级联它（像应用一样广播） | `db:write:accommodations`（+ `day_edit`） |
| `ctx.users` | `getById(id)` —— 仅公开个人资料（`id, username, display_name, avatar`） | `db:read:users` |
| `ctx.ws.broadcastToTrip(tripId, event, data)` | 广播给某次旅行的成员（事件被强制为 `plugin:<id>:<event>`） | `ws:broadcast:trip` |
| `ctx.ws.broadcastToUser(userId, event, data)` | 广播给一个用户 | `ws:broadcast:user` |
| `ctx.plugins.call(id, fn, args?)` | 调用另一个插件**暴露**的函数并拿到其结果——`id` 必须是一条已声明、已满足的 `pluginDependency`，且它在其 `capabilities.provides` 中列出 `fn` | 一条插件依赖（不需要权限） |
| `ctx.events.emit(name, payload?)` | 向已订阅的依赖方发布一个事件——`name` 必须在你自己的 `capabilities.emits` 中 | —（不需要权限） |
| `ctx.config` | 你的 `scope:'instance'` 设置（机密以解密形式送达，无人设置的字段解析为其清单 `default`），在激活时冻结 | — |
| `ctx.log` | `info` / `warn` / `error` → 你的错误日志 | — |
| `ctx.id` | 你的插件 id（字符串） | — |

调用一个你清单未授予的方法会返回 `PERMISSION_DENIED`；一个主机根本不暴露的方法会
返回 `UNKNOWN_METHOD`。

**`ctx.trips` 只在路由处理函数内有效。** 主机从已认证的请求绑定操作用户，并对每一次
旅行读取针对他做成员校验。`onLoad` 和 `jobs` **没有用户**，因此它们的旅行读取会以
`RESOURCE_FORBIDDEN` 被拒绝。SDK 的 `getById(tripId, asUserId?)` 签名出于源码兼容
保留了一个 `asUserId` 参数，但**主机会忽略它**——你无法通过传一个 id 来读取另一个
用户的旅行。

**写入（`ctx.trips.update` / `ctx.places` / `ctx.days` / `ctx.itinerary` /
`ctx.costs.create`）同样只在路由上下文中有效，并且受双重门控：** 主机会检查操作用户
能否**访问**该旅行，以及是否持有该实体的应用编辑权限（`place_edit` / `day_edit` /
`trip_edit`），与 Web 界面完全一样。它们经过相同的服务并广播相同的事件，因此打开着的
会话会实时更新。输入会按 Tourism-Team 自己的 schema 校验（错误的负载是
`BAD_PARAMS`），而每一次写入都会以防篡改的能力审计日志针对操作用户记录。插件只能
改变它的用户能手动改变的东西。

**`ctx.costs`（"costs" = 预算项）** 的行为与 `ctx.trips` 完全一样：读取会针对请求的
用户做成员校验，并且只在**路由处理函数内**有效（`onLoad`/`jobs` 没有用户 →
`RESOURCE_FORBIDDEN`）。`getByTrip(tripId)` 返回某趟旅行的预算项（用成员/付款人
水合）；`listMine()` 聚合操作用户能访问的每趟旅行的预算项。
`create/update/delete(tripId, …)` 修改某趟旅行的预算项——门控与一次普通的预算写入
完全一样（与规划器写入对 `db:write:places`/`days`/`itinerary`/`trips` 所用的同一
模型）：操作用户需要该旅行上的 **`budget_edit`** 权限，输入会按 Tourism-Team 的预算
schema 校验，而一次成功的创建会广播应用所发出的同一个 `budget:created` 事件。
**每一次 `ctx.costs.*` 调用还要求费用（预算）扩展处于启用状态**——如果管理员关闭了
它，该调用会以 `RESOURCE_FORBIDDEN` 被拒绝。

### 路由认证

路由默认是已认证的（`req.user` 是已登录用户）。对于无法携带会话的 OAuth 回调或
webhook，设置 `auth: false`。

代理会转发 `{ method, path, query, body, rawBodyBase64, headers, user }`。
**`req.headers` 只在 `auth: false` 路由上被填充**（已认证路由拿到 `{}`），并且只有
一份显式、不含凭据的**允许清单**——常见提供方签名 + 事件头
（`stripe-signature`、`x-hub-signature-256`、`svix-signature`、`x-gitlab-event`、
`content-type`、`user-agent` 等）。**`Cookie`、`Authorization`、`X-Socket-Id` 以及
每一个会话/转发认证头都会被剥离**，永远不会到达你的代码，因此一个被转发的头无法
泄漏 Tourism-Team 会话。

**`req.rawBodyBase64` 同样只在 webhook 场景下出现**——即 `auth: false` 路由上请求的
确切字节，base64 编码，而已认证路由上不存在（它永远不需要）。要信任一个 webhook，
请用你保存在 `ctx.config`（管理员设置的实例设置）或 `ctx.settings`（按用户）中的
密钥，对*那些*字节验证提供方的签名。绝不要为了该校验而重新序列化 `req.body`：
`JSON.stringify` 无法复现发送方所签的键顺序、空白和 unicode 转义，因此 HMAC 不会
匹配。

下面的片段处理两件事，你的也必须如此。Tourism-Team 只在有 body 解析器运行时才保留
原始字节，即对 `application/json` 和 `application/x-www-form-urlencoded`——一个以
`text/plain` 提交的 webhook，或一个没有 body 的 GET 回调，会带着
`rawBodyBase64: null` 到达，因此请**失败关闭**，而不是在一个空缓冲区上运行 HMAC，
那是一个任何人都能伪造的常量。而请求体的上限是 100 kB；更大的负载会在你的路由运行
之前被拒绝。

```js
const crypto = require('node:crypto')

if (typeof req.rawBodyBase64 !== 'string') return { status: 400, body: { error: 'no raw body' } }
const raw  = Buffer.from(req.rawBodyBase64, 'base64')
const mac  = crypto.createHmac('sha256', ctx.config.webhookSecret).update(raw).digest()
const sent = Buffer.from(String(req.headers['x-hub-signature-256'] || '').replace(/^sha256=/, ''), 'hex')
if (sent.length !== mac.length || !crypto.timingSafeEqual(mac, sent)) return { status: 401, body: { error: 'bad signature' } }
```

### 运行时限制

主机会对每个插件强制执行这些限制。对真实工作它们很宽松，只会咬住失控的插件，但它们
正是一个循环调用 `ctx.*` 或把二进制大对象存进 `ctx.db` 的插件会撞上的东西，因此请
针对它们来构建。

| 区域 | 限制 |
|---|---|
| 每一次 `ctx.*` 调用 | 突发 60，持续 20/秒，每插件 16 个在途；被限流的调用会以 `HOST_ERROR: rate limit exceeded — slow down ctx.* calls` 被拒绝。可用 `TREK_PLUGIN_RPC_BURST` / `TREK_PLUGIN_RPC_PER_SEC` / `TREK_PLUGIN_RPC_INFLIGHT` 调整（见 [环境变量](Environment-Variables#plugins)） |
| `ctx.db` | 每插件 256 MB，单个结果集上限 100,000 行 |
| 事件订阅 | 插件重启期间每插件缓冲 200 个事件，15 分钟后未重放的会被丢弃 |
| 插件进程 | 300 MB RSS（`TREK_PLUGIN_MAX_RSS_MB`）——超出后子进程会被杀死；在 5 分钟窗口内崩溃 5 次后会自动停用，状态为 `error` |

每日的 `ctx.ai` / `ctx.notify` 预算和 `ctx.meta` 配额在
[在没有运行中的 Tourism-Team 时测试](#testing-without-a-running-trek) 中说明，因为
mock 主机也会强制执行它们。

## 编写客户端（页面 / 小组件）

iframe 从 `/plugin-frame/<id>/…` 同源提供，但**不带 `allow-same-origin`** 地沙箱化，
因此它运行在一个**不透明来源**上：它读不到 cookie 或父级 DOM。它只通过 `postMessage`
与 Tourism-Team 通信（目标 origin 必须是 `'*'`——不透明框架没有可命名的 origin）。

你的整个 `client/` 目录都会被提供（并由 `pack` 打包发出）——不只是 `index.html`。
框架 CSP 允许插件使用它**自己的**静态文件（不允许来自任何其他主机的文件），因此一个
**多文件构建可以按原样工作**：把打包器指向 `client/` 并使用**相对资源路径**
（Vite：`base: './'`），把输出放进去，完成。这包括 React/Vue/Svelte 构建——不必再把
bundle 内联进 `index.html`（内联仍然可用，而且正是设计套件标记所做的）。

### 设计套件（推荐）

因为框架无法加载 Tourism-Team 的样式表，我们把它一并发出。在你的
`client/index.html` 的 `<head>` 中放入**一行**：

```html
<!-- trek:ui -->
```

`dev` 和 `pack` 会把该标记展开为内联的 **Tourism-Team 设计套件**——一份由令牌驱动的
样式表加上一个 `window.trek` 桥接。让源码保持一行没有代价，而重新构建总会带上当前的
套件。该套件：

- 给你原生组件——**玻璃面板、卡片、按钮、输入框、胶囊、列表行、悬停**——它们在浅色
  与深色之间正确切换；
- 跟随用户实时的**强调色方案、自定义强调色和高对比度**（它会应用 Tourism-Team 发送
  的令牌）；
- 镜像主机的**外观标志**（减少动效、无透明、密度）；
- **自动上报你的高度**（小组件/页面自动定尺寸——无需手动的 `trek:resize`）；
- 安装 `window.trek`，因此你永远不必手写 `postMessage`。

`window.trek` 还带有 **`trek.ui`**——一些小巧的 DOM 构建器，会发出套件风格的
元素，因此你可以在没有打包器也没有 CSS 的情况下构建 UI：

```js
const { ui } = trek
ui.mount(ui.card([
  ui.el('div', { class: 'trek-title', text: 'Nearby' }),
  ui.button('Refresh', { variant: 'primary', onClick: refresh }),
  ui.chip('open now', 'success'),
]))
// ui.el(tag, props, children) is the general builder; props take class/text/html/on:{event}.
```

脚手架会预置一个可用的示例。一个最小客户端：

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <!-- trek:ui -->
</head>
<body>
  <div class="trek-glass trek-stack" style="margin:16px">
    <div class="trek-title">Your plugin</div>
    <p class="trek-muted" id="hello">…</p>
    <button class="trek-btn trek-btn--primary" id="go">Say hello</button>
  </div>
  <script>
    trek.onContext((ctx) => { document.getElementById('hello').textContent = 'theme: ' + ctx.theme })
    document.getElementById('go').addEventListener('click', async () => {
      try { const data = await trek.invoke('/hello'); document.getElementById('hello').textContent = 'Hello ' + data.hello }
      catch (e) { trek.notify('error', e.message) }
    })
  </script>
</body>
</html>
```

**组件类**（引导会把 `trek-ui` 加到 `<body>` 上）：

| 类 | 作用 |
|---|---|
| `.trek-glass` | 标志性的磨砂玻璃表面 |
| `.trek-card` | 一张实心卡片 |
| `.trek-interactive` | 加到玻璃/卡片上以获得原生悬停上浮 |
| `.trek-btn` + `--primary` / `--secondary` / `--ghost` / `--danger` | 按钮 |
| `.trek-input` / `.trek-textarea` / `.trek-select` / `.trek-label` | 表单控件 |
| `.trek-chip` + `--accent` / `--success` / `--danger` / `--warning` / `--info` | 胶囊 / 徽章 |
| `.trek-row` | 一行悬停高亮的列表行 |
| `.trek-title` / `.trek-muted` / `.trek-faint` | 文本辅助类 |
| `.trek-stack` / `.trek-cluster` | 带间距的纵向 / 横向 flex |
| `.trek-menu-enter` / `.trek-menu-enter-left` | 下拉菜单入场（从它的触发角缩放） |
| `.trek-popover-enter` / `.trek-modal-enter` / `.trek-backdrop-enter` / `.trek-toast-enter` | 主机的入场动画（`trek-modal-enter` 在 640px 以下变为底部抽屉） |
| `.trek-page-enter` | 挂载时轻微的淡入上移 |
| `.trek-stagger` | 子元素以 40ms 级联淡入上移 |
| `.trek-skeleton` | 微光加载占位 |
| `.trek-pie-reveal` / `.trek-bar-fill` | 图表揭示动画（外加 `trek-progress-fill` 关键帧，由 `--trek-progress-to` 驱动） |

所有动画都遵守减少动效：在 `[data-reduce-motion]` 或 `prefers-reduced-motion` 下它们
降级为一次温和的 120ms 淡入，而骨架屏停止微光。

**下拉框会被自动升级。** 套件内联后，每个原生 `<select>` 都会变成一个由主机提供样式、
可用键盘访问的下拉框，与 Tourism-Team 一致——操作系统绘制的弹出框无法被主题化，因此
套件替换了它，同时保留真实的 `<select>` 作为取值/表单来源（它仍会触发 `change`）。
写一个普通的 `<select>` 就能用。给某个字段加上 `data-trek-native` 可保留浏览器默认；
`multiple` 和 `size` 下拉框始终保留原生。

**`window.trek` 桥接：**

| 调用 | 作用 |
|---|---|
| `trek.onContext(cb)` | 现在（如果已收到）以及每次更新时运行 `cb(context)`；返回一个取消订阅函数 |
| `trek.context` | 最后一个上下文（或 `null`） |
| `trek.invoke(sub, { method, body })` | 调用你自己的路由；返回一个 `Promise`（以一个 `Error` 拒绝，`.code` = HTTP 状态） |
| `trek.session.get(key, options?)`、`.set(key, value, options?)`、`.remove(key, options?)`、`.clear(options?)` | 由主机管理的、针对这个浏览器标签页的 JSON 会话状态。`scope: 'plugin'` 是默认值；`scope: 'trip'` 额外按当前所在的旅行分区，并在旅行之外以 `NO_TRIP_CONTEXT` 拒绝。缺失的 `get()` 值为 `undefined`。每个插件或单个旅行作用域限制为 32 个键、每键 64 字符、每值 1 KiB。不要用它存储机密。 |
| `trek.notify(level, message, duration?)` | toast（`info`/`success`/`warning`/`error`）；可选时长以毫秒计（钳制在 1.5–15 秒） |
| `trek.confirm({ title?, message, confirmLabel?, cancelLabel?, danger? })` | 主机渲染的原生确认对话框；解析为 `true`/`false`（一次一个——第二个并发请求解析为 `false`） |
| `trek.navigate(to)` | 应用内导航（仅相对路径） |
| `trek.openExternal(url)` | 在新标签页打开一个 `http(s)` URL（沙箱本身做不到） |
| `trek.onEvent(cb)` | 对当前所在旅行上的核心事件调用 `cb(event, tripId)`——只有名称，没有负载；通过 `invoke()` 重新获取；返回一个取消订阅函数 |
| `trek.resize(px)` | 覆盖自动高度（在整页上被忽略——见下方的 `trek:resize`） |
| `trek.geolocation.get()` | 一次浏览器定位，形式为 `{ lat, lng, accuracy, heading, speed, timestamp }`——**需要 `geolocation:read` 权限**；以 `.code` 为 `forbidden`/`denied`/`timeout`/`unavailable`/`unsupported` 拒绝。由**主机**读取位置（沙箱永远不会获得该 API），浏览器自身的站点提示仍然适用 |
| `trek.geolocation.watch(cb)` | 流式位置——`cb(position, error)`；返回一个取消订阅函数。主机每个框架只保留一个 GPS 监听，并在框架关闭时强制停止它 |
| `trek.ready()` / `trek.requestContext()` | 重新握手 / 重新请求上下文 |

**预览它：** `npx trek-plugin-sdk dev`，然后打开 **`/preview`**——它在一个真实的
沙箱化框架中渲染你的 UI，带主题/强调色/外观切换，并把 `trek.invoke()` 代理到你的路由。

### 原始桥接（不使用套件）

如果你不想用套件，就自己与框架通信。宣告就绪并处理消息：

```js
window.parent.postMessage({ type: 'trek:ready' }, '*') // Tourism-Team replies with trek:context
window.addEventListener('message', (e) => {
  if (e.source !== window.parent) return          // opaque frame: trust the parent window
  const m = e.data
  if (m.type === 'trek:context') { /* m.theme, m.tokens, m.appearance, … (below) */ }
  if (m.type === 'trek:response') { /* m.requestId, m.data */ }
  if (m.type === 'trek:error')    { /* m.requestId, m.code, m.message */ }
})
window.parent.postMessage({ type: 'trek:invoke', requestId: '1', sub: '/status', method: 'GET' }, '*')
```

**你发给 Tourism-Team 的消息：**

| 消息 | 负载 | 效果 |
|---|---|---|
| `trek:ready` | — | Tourism-Team 以 `trek:context` 回复 |
| `trek:context:request` | — | 重新请求上下文 |
| `trek:navigate` | `{ to }` | 应用内导航（仅相对路径） |
| `trek:notify` | `{ level, message, duration? }` | toast；`level` = `info`/`success`/`warning`/`error`；`duration` 以毫秒计，钳制在 1500–15000 |
| `trek:resize` | `{ height }` | 设置 iframe 高度（上限 2000px）；**在整页上被忽略**（`page` / `trip-page`），它们始终填满其宿主容器 |
| `trek:invoke` | `{ requestId, sub, method, body }` | 调用你自己的路由；以 `trek:response` 或 `trek:error` 解析 |
| `trek:confirm` | `{ requestId, title?, message?, confirmLabel?, cancelLabel?, danger? }` | 主机渲染的 ConfirmDialog；以 `trek:confirm:result` 回答 |
| `trek:openExternal` | `{ url }` | 在一个新的 `noopener` 标签页打开一个 `http(s)` URL；其他任何东西都被丢弃 |
| `trek:geolocation` | `{ requestId, action?: 'get'\|'watch'\|'clear' }` | 由主机中转的浏览器定位（需要 `geolocation:read`）；以 `trek:geolocation:result` 回答，watch 更新以 `trek:geolocation:update` 流式送达 |
| `trek:session:get` | `{ requestId, key, scope?: 'plugin'\|'trip' }` | 读取标签页范围的状态；以 `trek:response` 回答，`data` 为值（未设置时为 `undefined`） |
| `trek:session:set` | `{ requestId, key, value, scope? }` | 存储一个可 JSON 序列化的值；以 `trek:response` 回答 |
| `trek:session:remove` | `{ requestId, key, scope? }` | 删除一个键；以 `trek:response` 回答 |
| `trek:session:clear` | `{ requestId, scope? }` | 删除该作用域中的每个键；以 `trek:response` 回答 |

会话消息会以 `trek:error` 被拒绝，`code` 为 `NO_TRIP_CONTEXT`（旅行作用域但不在旅行
中）、`SESSION_INVALID_KEY`（为空或超过 64 字符）、`SESSION_INVALID_VALUE`（不可
JSON 序列化）、`SESSION_VALUE_TOO_LARGE`（序列化后超过 1 KiB）、`SESSION_KEY_LIMIT`
（该作用域中超过 32 个键）或 `SESSION_STORAGE_ERROR`（浏览器拒绝了该写入）。存储键
本身由主机拥有，并包含已登录用户和你的插件 id，因此各作用域永不冲突。

**Tourism-Team 发给你的消息：**

| 消息 | 负载 |
|---|---|
| `trek:context` | `{ tripId, placeId, dayId, reservationId, userId, theme, locale, dir, hostOrigin, user, formats, tokens, appearance }`（见下文）——每当主题、外观、**语言区域或格式**变化时重新发送 |
| `trek:response` | `{ requestId, data }` —— 一次成功的 `trek:invoke` 或 `trek:session:*` |
| `trek:error` | `{ requestId, code, message }` —— 一次失败的请求；对 `trek:invoke`，`code` 是 HTTP 状态或 `"error"`，对 `trek:session:*` 是上述 `SESSION_*` / `NO_TRIP_CONTEXT` 代码之一 |
| `trek:confirm:result` | `{ requestId, confirmed }` —— 用户对你 `trek:confirm` 的回答 |
| `trek:event` | `{ event, tripId }` —— 当前所在旅行上触发的一个核心事件；**只有名称，绝无负载**——通过 `trek:invoke` 重新获取你需要的 |
| `trek:geolocation:result` | `{ requestId, position? \| watching? \| cleared? \| error? }` —— 对一次 `trek:geolocation` 请求的回答（`error` ∈ `forbidden`/`denied`/`timeout`/`unavailable`/`unsupported`） |
| `trek:geolocation:update` | `{ position? , error? }` —— 一次流式的 watch 定位（`position` = `{ lat, lng, accuracy, heading, speed, timestamp }`） |

框架的 CSP 按插件锁定：`default-src 'none'`，仅自己的内联脚本/样式 + 插件**自己的**
`/plugin-frame/<id>/` 文件（不允许任何其他主机为它提供脚本/样式/图片），`connect-src`
限于你通过 `http:outbound:<host>` 权限**获授**的主机（而不只是你声明的 `egress[]`），
不允许弹窗。

### context 负载

| 字段 | 类型 |
|---|---|
| `tripId` | `string \| null` —— 当前所在的旅行（一个 `trip-page` 标签页，或旅行上的一个小组件），否则为 `null`。**ID 以字符串形式到达**——请用 `String(id)` 比较 |
| `placeId` | `string \| null` —— 当前所在的地点（一个 `place-detail` 槽位），否则为 `null` |
| `dayId` | `string \| null` —— 当前所在的日程（一个 `day-detail` 槽位），否则为 `null` |
| `reservationId` | `string \| null` —— 当前所在的预订（一个 `reservation-detail` 槽位），否则为 `null` |
| `dir` | `'ltr' \| 'rtl'` —— 主机的文本方向；套件会把它镜像到你的 `<html>` 上，因此 RTL 主机会得到 RTL 的插件 UI |
| `userId` | `string \| null` |
| `theme` | `'light' \| 'dark'` |
| `locale` | 例如 `'en'` |
| `hostOrigin` | 应用 origin |
| `user` | `{ name, avatar, isAdmin } \| null` —— **绝不**是邮箱；角色只以布尔值形式出现 |
| `formats` | `{ locale, currency, timeFormat, distanceUnit, temperatureUnit, timezone, blurBookingCodes }` —— `blurBookingCodes` 镜像用户的「模糊预订编号」偏好，因此你的 UI 可以在确认号被揭示之前隐藏它们。它是一个**显示提示，不是脱敏**：这些编号仍会通过 `trek:invoke` 完整抵达你的插件。 |
| `tokens` | Tourism-Team 为当前主题解析出的 CSS 设计令牌（见下文） |
| `appearance` | `{ scheme, density: 'comfortable'\|'compact', reducedMotion, noTransparency }` |

### 手工匹配 Tourism-Team 的外观（`m.tokens`）

`tokens` 是为**当前**主题解析出的全局调色板——表面（`--bg-card`、`--bg-hover` 等）、
文本（`--text-primary`/`-secondary`/`-muted`/`-faint`）、边框、**强调色族**
（`--accent`、`--accent-text`、`--accent-hover`、`--accent-subtle`）、语义 + 柔和填充
（`--success`/`--danger`/`--warning`/`--info` `-soft`）、阴影（`--shadow-*`）、圆角
（`--radius-*`）和字体（`--font-system`）。把它们作为 CSS 变量应用，你的 UI 就会跟随
主机经历一次主题切换、一个自定义强调色和高对比度，而不是硬编码一套会漂移的调色板。
（字体是命名的，不是随附的：文件住在主机的 bundle 里，因此请声明你自己的字体或回退到
系统字体栈。）

```js
function applyContext(m) {
  document.documentElement.dataset.theme = m.theme                 // for your dark rules
  for (const k in m.tokens) document.documentElement.style.setProperty(k, m.tokens[k])
  const a = m.appearance || {}
  document.documentElement.toggleAttribute('data-reduce-motion', !!a.reducedMotion)
  document.documentElement.toggleAttribute('data-no-transparency', !!a.noTransparency)
}
// in your trek:context handler: applyContext(m)
```

`tokens`/`appearance` 只是非机密的显示值，每次主题或外观变化时都会重新发送，使插件
感觉是原生的而不是外挂上去的。（仪表盘所用的玻璃质感令牌——`--glass-*`、`--r-*`、
`--sh-*`——不在 `tokens` 中；设计套件内置了它们，因为它们只随浅色/深色变化，不随强调色
变化。）请遵守 `appearance.reducedMotion` / `noTransparency`，而框架还会继承操作系统的
`prefers-reduced-motion`。仪表盘小组件被包在原生玻璃质感工具卡片中，并自动调整为你
通过 `trek:resize` 上报的高度，因此请渲染得平齐且透明——设计套件会替你上报高度。

## 在手机上

Tourism-Team 4 给手机设计了它自己的设计，而你的插件被挂载在其中。由此引出两件事，
它们都在 `trek:context` 中通过 `viewport` 到达：

```js
m.viewport = {
  surface: 'trip-tab',      // where you are mounted, see the table below
  formFactor: 'phone',      // 'phone' | 'desktop'
  fill: true,               // true = fill the host container, false = report your height
  insets: { top: 82, bottom: 106 },  // px the host ALREADY keeps clear around you
}
```

### 知道你在哪个界面上

| `surface` | 形状 | 说明 |
|---|---|---|
| `trip-tab` | 填满 | 你在旅行中自己的标签页。由你自己滚动。 |
| `plugin-page` | 填满 | `/plugins/:id`。由你自己滚动。 |
| `dashboard-widget` | 上报高度 | 仪表盘上的一张卡片。 |
| `user-settings` | 上报高度 | 你的 `settings.html`。 |
| `detail-slot` | 上报高度 | 地点/日程/预订面板内的一条窄列。 |
| `action-frame` | 填满 | 表格操作打开的模态框。 |

这很重要，因为契约不同：在**填满**型界面上，你的 `trek:resize` 高度会被刻意忽略，
因此请给你的文档设置 `height: 100%`，并把滚动放在内层元素上。在**上报**型界面上，
让内容决定高度，绝不要设 `100%`，否则主机会为两行文字预留一整屏。当设计套件看到
`viewport.fill` 时，它会替你完成这两者。

### `insets` 不是你要添加的内边距

它是主机*已经*为你留出的空间。在移动端旅行标签页上，浮动控件悬停在你的框架上方，
一个半透明 dock 悬停在它下方，主机为你把这两块区域都空了出来。用这些数值把你自己的
粘性头部与主机的界面装饰对齐，而不是用来添加外边距——那会让间隙翻倍。

### 移动端调色板

在移动端外壳内，`tokens` 与全局调色板并列携带了**第二**族：
`--m-ink`、`--m-muted`、`--m-faint`、`--m-bg`、`--m-card`、`--m-cbr`、`--m-glass`、
`--m-gbr`、`--m-inner`、`--m-act`、`--m-actfg`、`--m-ic`、`--m-rowbr`，状态规范色
（`--m-st-confirmed`、`--m-st-pending`、`--m-st-info`、`--m-st-danger`、
`--m-st-neutral`）以及 `--m-safe-top`。原生移动端屏幕就是用它们构建的；全局调色板
描述的是桌面端界面装饰，放在它们旁边会显得格格不入。

它们**在桌面端不存在**，因此请按它们是否存在来分支，而不是假定两族都在：

```css
.card {
  background: var(--m-card, var(--bg-card));
  border: 1px solid var(--m-cbr, var(--border-primary));
}
```

### 决定它是否像原生的四条规则

1. **输入框 16px 或更大。** 低于此值，iOS Safari 会在聚焦时缩放页面且不会缩回。
   这是嵌入式 UI 中最常见的移动端缺陷。
2. **触摸反馈放在 `:active`，而不是 `:hover`。** 悬停规则在手机上永远不会触发，
   因此一次点按完全没有反馈。
3. **目标至少 44px。** 比这更小就是拿拇指赌运气。
4. **移动端表面上不要投影。** 该设计是半透明的、以边框为主导并置于渐变之上；一个
   阴影看起来像贴上去的贴纸。

一旦设置了 `data-form-factor="phone"`（设计套件会根据 `viewport` 设置它），设计套件
会自动应用全部四条。如果你全部自己写样式，那这些就靠你自己。

### 查看它

`trek-plugin dev` 以桌面尺寸预览。在它长出手机宽度之前，请调整浏览器窗口大小并使用
浏览器的设备模拟——框架是一个真实的浏览上下文，因此其中的媒体查询测量的就是框架，
它们会正常工作。

## 设置

在清单中声明设置；Tourism-Team 渲染表单（你不写任何设置 UI）。`scope: "instance"`
设置由管理员一次性设置——在 **管理 → 插件 → ⋯ → 实例设置** 下，那里只存储你清单声明
的字段，且保存会重新派生一个运行中的插件——并以解析后的形式抵达 `ctx.config`。
`scope: "user"` 设置由每个用户在 **设置 → 插件** 下编辑，并通过
`await ctx.settings.get(key)` 一次读取一个键（无用户的任务 / `onLoad` 得到
`undefined`——在那里回退到 `ctx.config`）。`secret: true` 字段加密存储，并通过两者中
适用的那一个（仅在服务端）以解密形式送达——绝不会送到 iframe。

有两个属性的作用不只是装饰表单：

- **`default`** 是在无人设置时该字段的值。表单会预填它，**运行时也会解析它**——
  `ctx.config.api_url` 和 `ctx.settings.get('region')` 会返回该默认值，直到有人保存
  了别的值——因此一个自带合理默认值的插件在任何人打开表单之前就能工作。默认值可以
  满足 `required`。它在 `secret` 上会被拒绝（清单是公开的），在 `checkbox` 上必须是
  布尔值，而当声明了 `options` 时它必须是其中之一；违反这些规则的默认值会在安装时被
  主机丢弃，而 `trek-plugin validate` 会先报错。
- **`required`** 在两端都被强制执行：当字段为空时表单拒绝保存（并指出该字段名），
  而如果一次保存仍然到达了主机，主机会回答
  `400 { error: 'Missing required setting "<key>"' }`。`checkbox` 豁免。一个必需的
  `scope:'user'` 字段还决定一个通知渠道是否会给该用户投递。

任何超出 `key, label, input_type, placeholder, hint, required, secret, scope, options, oauth, default` 的属性都会在安装时被静默丢弃；`trek-plugin validate` 会对它发出警告
（`manifest.settings-known-keys`）。

### 自定义设置页（`capabilities.settingsUi`）

当声明的字段不够用时——一个带预览的选择器、任何视觉化的东西——设置
`"capabilities": { "settingsUi": true }` 并随附一个 `client/settings.html`。
Tourism-Team 会把它作为一个卡片框在用户的 **设置 → 插件** 页面上，使用与你的小组件
相同的不透明来源沙箱和 postMessage 桥接：它只能触达你自己声明的路由
（`trek:invoke`），会收到 `trek:context`，并应通过 `trek:resize` 上报它的高度。它
编辑的任何东西都请通过你自己的某个路由持久化（例如按 `req.user.id` 为键存进你的
`db:own` 数据库）——设置页没有任何特殊的存储能力。早于该能力的主机只会忽略这个标志，
因此声明它绝不会破坏安装。

## 主机中转的 OAuth（`ctx.oauth`）

插件可以充当第三方服务的 OAuth *客户端*，**而永远不接触机密**。整个流程
——授权 → 回调 → 令牌交换 → 刷新——由**主机**运行，使用 PKCE（S256）和 `state`
校验，并由主机持有令牌。插件只触发「连接」，并在运行时读取一个**短期访问令牌**。

**设置。** 把提供方声明为管理员填写的 `scope: "instance"` 设置：
`oauth_authorize_url`、`oauth_token_url`、`oauth_scopes`（可选），外加
`oauth_client_id` 和 `secret: true` 的 `oauth_client_secret`。（一个设置字段还可以
携带一个 `oauth: { initPath, callbackPath }` 块。）当你选择 `oauth:client` 权限时，
`trek-plugin create` 会为你脚手架出全部五项。

**连接。** 用户在 **设置 → 插件 → 连接** 下连接，这会把它们送到提供方的授权页。回调
返回到 `…/api/plugin-oauth/<id>/callback`；主机会校验 `state`（一次性、10 分钟 TTL、
绑定到该用户——CSRF 防御），交换 code，并把令牌**按用户、静态加密**存储。

**使用它。** 在路由处理函数中读取访问令牌：

```js
const token = await ctx.oauth.getAccessToken() // needs the `oauth:client` permission
if (!token) return { status: 401, body: 'connect this plugin first' }
// call the third-party API with `Authorization: Bearer ${token}`
```

- 当操作用户尚未连接时，或在**无用户**上下文（一个任务 / `onLoad`）中，返回 `null`。
- 主机使用它持有的刷新令牌**自动刷新**即将过期的令牌（60 秒偏差）。
- 插件**永远**看不到刷新令牌或客户端密钥。
- 授权/令牌 URL 必须是 `https` 且指向非私有主机，而主机侧的令牌交换会经过 SSRF 防护
  （阻断链路本地 / 云元数据网段，并把解析出的 IP 固定以对抗 DNS 重绑定；环回/局域网上
  一个自托管的内网 IdP 仍然可用）。

## GDPR 数据主体钩子

授予 `hook:user-data` 并实现其中任一处理函数，以履行数据主体权利。两者都是**无用户**
的——插件只收到 `userId`，并作用于它**自己的** `ctx.db`：

```js
// trek-plugin.json: "permissions": ["db:own", "hook:user-data"]
module.exports = definePlugin({
  async deleteUserData({ userId }, ctx) {           // erasure
    await ctx.db.exec('DELETE FROM my_prefs WHERE user_id = ?', userId)
  },
  async exportUserData({ userId }, ctx) {           // portability / access
    return await ctx.db.query('SELECT * FROM my_prefs WHERE user_id = ?', userId)
  },
})
```

- **抹除是持久的。** 当一个用户被删除时，`deleteUserData` 会被排队，并**重试直到插件
  ACK**，跨重启、甚至在插件后来被重新激活之后——因此请让它**幂等**。
- **导出是完整或标记。** 一次数据访问请求会聚合每一个已授予插件的
  `exportUserData`。一个当前**未激活**但持有 `hook:user-data` 的插件，或一个导出
  **出错/超时**的插件，会被标记为 `pending`（绝不静默省略），因此管理员知道要重新
  激活它来完成该请求。
- 卸载插件还会**清除它存储的 OAuth 令牌和 state**。

## 提供方钩子

钩子是核心为了数据**调用进**你的插件（主机→插件）。在插件定义上声明它，并授予匹配的
`hook:*` 权限：

```js
module.exports = definePlugin({
  hooks: {
    placeDetailProvider: {
      // Return extra rows Tourism-Team renders natively on a place. Runs with the current
      // user bound, on a short timeout — a slow/failing call is skipped, never fatal.
      async getDetails(placeId, ctx) {
        return [{ label: 'Crowd', value: 'Quiet now' }, { label: 'Guide', url: 'https://…' }]
      },
    },
  },
})
```

| 钩子 | 权限 | 状态 |
|---|---|---|
| `placeDetailProvider.getDetails(placeId, ctx)` → `{ label, value?, url? }[]` | `hook:place-detail-provider` | **可用** —— 显示在地点面板中；也有 `GET /api/place-details/:placeId` |
| `warningProvider.getWarnings(tripId, ctx)` → `{ level, message, dayId?, placeId? }[]` | `hook:trip-warning-provider` | **可用** —— 在旅行规划器中作为一条非阻塞横幅显示的校验警告；也有 `GET /api/trip-warnings/:tripId`，并且对已连接的助手以 `get_trip_warnings` MCP 工具形式提供（每个提供方 ≤20 条警告，消息 ≤300 字符）——那条路径只需要旅行读取权限范围，不需要 `plugins:use` |
| `tableContributor.getContributions(view, tripId, ctx)` → `TableContribution[]` | `hook:table-contributor` | **可用** —— 在预订、交通、地点、日程、费用、行李、文件和待办事项视图中，由主机渲染的、以 `entityId` 为键的**列/操作**。一个 `column` 是 `{kind:'column', entityId, id, label, value?, url?, icon?, tone?}`（url 仅限 http/https/mailto）；一个 `action` 是 `{kind:'action', entityId, id, label, icon?, target}`，其中 `target` 会打开你的沙箱化框架（`{kind:'frame', sub}`）或调用一个路由（`{kind:'route', method, sub}`）。所有字段都在主机侧被限界 + 规范化；也有 `GET /api/view-contributions/:view/:tripId` |
| `mapMarkerProvider.getMarkers(tripId, ctx)` → `MapMarkerContribution[]` | `hook:map-marker-provider` | **可用** —— 叠加在旅行地图上的有限数量的标记（#587）。每个是 `{id, lat, lng, label?, popupText?, url?, icon?, tone?}`；坐标会做范围检查（−90..90 / −180..180），文本长度受限，url 仅限 http/https/mailto，数量受限（每插件 ≤200）。仅声明式——插件的 JS 永远不会在地图画布上运行。也有 `GET /api/map-markers/:tripId` |
| `mapLayerProvider.getLayers(tripId, ctx)` → `MapLayerContribution[]` | `hook:map-layer-provider` | **可用** —— 旅行地图上有限数量的矢量叠加：一条计算出的路线、一条可达范围走廊、一个区域。每个图层是 `{id, name?, features}`，feature 为 `{type: 'polyline'\|'polygon'\|'circle', points?/center?+radiusM?, tone?, width?, dash?, opacity?, fill?, label?}`。样式仍留在色调调色板中；宽度（1–8）、不透明度（0.05–1）和半径（≤2000 km）会被钳制，`dash` 是枚举。每插件预算：≤4 个图层、≤150 个 feature、≤8000 个顶点、≤2000 顶点/形状——一个过大或部分无效的形状会被整体丢弃，绝不截断。仅声明式；在 Leaflet 和 GL 两种渲染器上都绘制在 Tourism-Team 自己的日程路线之下。也有 `GET /api/map-layers/:tripId` |
| `routeProvider.getRoute(request, ctx)` → `RouteProviderResult` | `hook:route-provider` | **可用** —— 在插件声明的某个 `capabilities.routeProfiles` 下为一天的停靠点规划路线（一个带充电停靠点的 EV profile、一个风景 profile……）。`request` 是 `{tripId, dayId, profile, waypoints}`（按访问顺序的 2–30 个已定位停靠点）；结果是 `{coordinates, distance, duration, legs, viaPoints?}`，并且是**整体**校验的：≤10000 个顶点，`legs` 必须恰好是 `waypoints−1` 个条目（每个 `{distance, duration, note?}`——`note` ≤120 字符，显示在侧边栏连接线上），≤40 个途经点（`{lat, lng, label?, tone?, dwellSeconds?}`，作为路线线上的站点绘制）。格式错误的结果会被丢弃，规划器回退到直线。**是有针对性的，不是扇出**：Tourism-Team 只调用用户在路线开关中所选 profile 对应的那个提供方，超时 20 秒（足够通过你声明的出站调用一个外部求解器）。`POST /api/plugin-routes/:pluginId/:profileId` |
| `dayScheduleProvider.getSchedule(tripId, ctx)` → `DayScheduleContribution[]` | `hook:day-schedule-provider` | **可用** —— 在桌面端和移动端渲染进日程计划的时间贡献：「在这个停靠点充电 35 分钟」、「这次航班前 45 分钟安检」。每个是 `{id, dayId, assignmentId?/reservationId?/position?, minutes?, label, tone?}`——锚定在一个地点/预订行之下，或在一天的开始/结束处（默认结束）。`dayId` 必须属于该旅行（服务端检查），`minutes`（1–1440）会显示在该行上**并折算进当天的路线页脚总计**，`label` ≤120 字符，每插件 ≤60 项。也有 `GET /api/day-schedule/:tripId` |
| `dayTintProvider.getDayTints(tripId, ctx)` → `DayTintContribution[]` | `hook:day-tint-provider` | **可用** —— 绘制进「计划」侧边栏中日期卡片（以及当天移动端胶囊按钮）的颜色，因此一趟分成多段的旅行在你滚动时会显示各天所属的段。每个是 `{dayId, tone?, color?, badgeTone?, badgeColor?, headerTone?, headerColor?, activityTone?, activityColor?, label?}`。卡片有**三个可分别着色的区域**——天数徽章（同时也是移动端胶囊按钮）、标题行，以及展开的活动列表——因此插件可以在徽章上醒目地标记某一段，同时让密集的活动列表保持朴素；`tone` / `color` 是填充所有你未指定区域的简写，而未指定的区域渲染结果与你没有该插件时完全一样。用一个调色板色调或你自己的 `#rrggbb` 给一个区域着色（不接受其他任何形式——该值最终会进入一个 CSS 颜色）；在一个区域内颜色优先于色调，而区域指定的任何东西优先于简写。你选择色相，主机选择权重：它按主题**并**按区域设置透明度，并把颜色的明度钳制到一个在两种主题下都清晰可读的区间，因此着色在浅色和深色下都保持微妙，没有任何贡献能让某天变得无法阅读，而一个着色标题悬停时会变成其自身颜色的更深混合。`dayId` 必须属于该旅行（服务端检查），`label` ≤ 60 字符会成为当天的工具提示，原始数组在 2000 处截断。**某一天最多接受一份贡献，并且是整体决定的**：在你自己的列表中，某一天的第一条条目获胜；跨插件时，第一个被授予的提供方获胜——因此一天永远不会在颜色之间闪烁，而落败的插件也无法填充获胜者未着色的区域。约束来自旅行的天数而不是固定的条目上限，这也是它不是 `dayScheduleProvider` 的原因（≤60 条目只会给一趟长途旅行的前 60 天着色）。也有 `GET /api/day-tints/:tripId` |
| `pdfSectionProvider.getSections(tripId, ctx)` → `PdfSection[]` | `hook:pdf-section-provider` | **可用** —— 追加到旅行 PDF 导出中的纯文本章节。每个是 `{title, paragraphs?, table?}`；主机会自己转义并排布一切（任何标记都不会到达文档），限制数量（每插件 ≤5 个章节、≤20 个段落、≤8 个表头、≤50 行）+ 长度（标题 120、段落 2000、表头 60、单元格 200），并把行裁剪到表头宽度。也有 `GET /api/pdf-sections/:tripId` |
| `atlasLayerProvider.getLayers(ctx)` → `AtlasLayer[]` | `hook:atlas-layer-provider` | **可用** —— 绘制在足迹世界地图上的国家着色图层（心愿单、旅行提示……）。**以用户为范围**：主机绑定操作用户，该钩子不接受目标参数。每个图层是 `{id, name?, countries: [{code, tone?, label?}]}`；code 必须是 ISO-3166 alpha-2（强制为大写），tone 是枚举白名单，数量受限（每插件 ≤3 个图层、每图层 ≤300 个国家）。仅声明式——插件的 JS 永远不会在地图画布上运行。也有 `GET /api/atlas-layers` |
| `journalEntryProvider.getRows(entryId, ctx)` → `{ label, value?, url? }[]` | `hook:journal-entry-provider` | **可用** —— 在一条日志条目卡片下渲染的额外行（需要旅程扩展；该条目所属的旅程会像日志详情路由一样做访问校验）。与地点详情相同的加固加上服务端规范化：每插件 ≤12 行、label ≤60、value ≤200、url 仅限 http/https/mailto。也有 `GET /api/journal-entry-rows/:entryId` |
| `tripCardProvider.getCards(tripIds, ctx)` → `TripCardContribution[]` | `hook:trip-card-provider` | **可用** —— 仪表盘旅行卡片上的小徽章。用所有可见的 `tripIds`（每个都已针对操作用户做过访问校验）调用**一次**，返回 `{ tripId, id, label, value?, icon?, tone?, url? }[]`；主机会对每个字段限界（label 64、value 256、tone 枚举、url 仅限 http/https/mailto），限制数量（每趟旅行 ≤4 个徽章，每插件总共 ≤240），并丢弃任何 `tripId` 不在请求中的徽章。仅声明式。也有 `GET /api/trip-card-contributions?tripIds=…` |
| `photoProvider.search(query, {page, limit}, ctx)` / `.getById(id, ctx)` | `hook:photo-provider` | **可用** —— 插件照片源在 `GET /api/plugin-photos/search`（以及 `/sources`、`/item`）聚合，供选择器使用。每个 `{id, title?, thumbnailUrl, fullUrl, takenAt?}`；缩略图/完整 URL 必须是 http/https，每源数量受限，失败的源会被跳过 |
| `calendarSource.getName(ctx)` / `.getEvents(userId, start, end, ctx)` | `hook:calendar-source` | **可用** —— 插件日历事件在 `GET /api/plugin-calendar?start=&end=` 为已登录用户聚合。每个 `{id, title, start, end, allDay}`（ISO 日期）；数量受限，失败的源会被跳过 |
| `notificationChannel.send(msg, config, ctx)` / `.test(config, ctx)` | `hook:notification-channel` | **可用** —— 注册一个新的通知渠道。**无用户**（见下文）。见 [通知渠道](#notification-channels) |
| `mcpToolProvider.callTool({name, args}, ctx)` + `tools: string[]` | `mcp:tools` | **可用** —— 在 Tourism-Team 自己的 MCP 服务器上发布 MCP 工具，以 `plugin_<id>_<name>` 向已连接的助手宣传。**以发起请求的 MCP 用户身份**运行（类似路由的 ctx）。在 `capabilities.mcpTools` 中声明；只有清单声明与 `tools` 数组的交集会被宣传。见 [MCP 工具](#mcp-tools) |

每个钩子方法都会收到它的参数加上每次调用的 `ctx`，因此它所做的任何 `ctx.trips.*`
读取都会针对当前用户做成员校验（像一个路由处理函数那样）——**有一个例外**，通知
渠道，它完全没有操作用户。

钩子返回的每个字符串都会**在渲染边界被剥离 emoji**——徽章、列、警告、PDF 章节、
地图标记标签、日历和照片标题、通知——因此插件文本会留在 Tourism-Team 自己的图标
语言之内；请改用声明式的 `icon` 字段（一个 lucide 名称）。你插件自己的沙箱化框架
不受影响：那些标记由你来设计。

## 通知渠道

`hook:notification-channel` 让你的插件成为与 Tourism-Team 内置的邮件 / webhook / ntfy
并列的一个投递渠道——Gotify、Pushover、Telegram，任何能接收消息的东西。

用以下命令脚手架一个：

```bash
npx create-trek-plugin my-gotify --type integration --template notification-channel
```

```js
module.exports = definePlugin({
  hooks: {
    notificationChannel: {
      // msg is ALREADY RENDERED in the recipient's language, with the deep link built.
      // config is that recipient's own scope:'user' settings, decrypted by the host.
      async send(msg, config, ctx) {
        const res = await fetch(`${config.serverUrl}/message`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'X-Gotify-Key': config.appToken },
          body: JSON.stringify({ title: msg.title, message: msg.body + '\n\n' + (msg.url ?? '') }),
        })
        // THROW on failure — the host logs and isolates it, so a dead channel
        // can never stop email/in-app/the other channels from being delivered.
        if (!res.ok) throw new Error(`Gotify responded ${res.status}`)
      },
      // Optional — backs the "Send test" button in the user's notification settings.
      async test(config, ctx) { /* … */ },
    },
  },
})
```

```json
{
  "type": "integration",
  "permissions": ["hook:notification-channel", "http:outbound:gotify.example.com"],
  "egress": ["gotify.example.com"],
  "capabilities": { "notificationChannel": { "title": "Gotify" } },
  "settings": [
    { "key": "serverUrl", "label": "Server URL", "scope": "user", "required": true },
    { "key": "appToken", "label": "App token", "scope": "user", "required": true, "secret": true }
  ]
}
```

**这个钩子由主机发起，因此它在没有操作用户的情况下运行。** 一条通知是**被投递给**
一个任意接收者的——没有人在「调用」你的插件——因此：

- 这里的 `ctx.settings.get()` 返回 `undefined`，而 `ctx.trips.*` 读取会被拒绝。
- 接收者的凭据改为以 `config` 参数到达：主机读取你插件针对该接收者的
  `scope:'user'` 设置，解密它们，并交给你。

这是刻意的。正是它让一个渠道插件能被交给某人的推送令牌，*而*不会被同时赋予以他的
身份读取他旅行的权利。

说明：

- **`title`** 命名通知偏好矩阵中的那一列（默认为你插件的名称）。**`events`** 可以
  *收窄*该渠道携带哪些事件；省略它则渠道携带全部十个可投递事件：`trip_invite`、
  `booking_change`、`trip_reminder`、`todo_due`、`vacay_invite`、`collection_invite`、
  `photos_shared`、`collab_message`、`packing_tagged`、`plugin_notification`。SDK 以
  `CHANNEL_EVENTS` 导出同一份列表，而 `trek-plugin validate` 和安装器都会拒绝该集合
  之外的任何东西，报 `capabilities.notificationChannel.events: "x" is not a plugin-deliverable event`。

  Tourism-Team 会发送、而插件渠道永远不会携带的四个事件，是管理员范围的
  `version_available` 和 `replica_failure`（它们走管理员自己的凭据）、仅应用内的
  `synology_session_cleared`，以及 `vacay_share`。不要从 [通知](Notifications) 中的
  表格去推断这个集合——那张表列出的是用户可以开关什么，而不是渠道可以携带什么。
- **「已配置」是推断出来的，不是问出来的。** 在每个 `required`、`scope:'user'` 字段
  都有值之前，某个用户的这一列都是「未配置」。一个没有必需用户字段的插件对所有人
  都算已配置（一个实例范围的渠道，例如一个共享工作区 webhook）。
- **按主机的出站是强制性的。** 裸 `http:outbound` **不会**在运行时打开任何主机——
  你需要按主机声明 `http:outbound:<host>`（见下文）。
- **对于自托管目标，请设置 `operatorEgress`** —— 见下一节。你的清单无法指定运营者的
  Gotify；由管理员在安装后指定。
- **访问你自己局域网上的服务**（与 Tourism-Team 相邻的一个 Gotify）额外需要
  Tourism-Team 进程上的 `TREK_PLUGIN_ALLOW_PRIVATE_EGRESS=on`——插件默认不能访问私有
  地址。它会为*每一个*已安装插件放宽该策略，因此只在你信任它们全部时才启用。

## MCP 工具

插件可以在 **Tourism-Team 自己的 MCP 服务器**上发布工具，这样用户已连接到
Tourism-Team 的助手（Claude，或任何 MCP 客户端）就能调用该插件。三个部分，全部必需
——漏掉一个就什么都不会被宣传：

1. **清单中的 `capabilities.mcpTools`** —— 管理员同意的声明。最多 **8** 个工具，每个
   `{ name, description, title?, inputSchema?, annotations? }`：`name` 为小写
   `^[a-z0-9_]{1,48}$`（唯一，不能有连字符/点），`description` 必填，`inputSchema`
   是一个可选的 JSON Schema，其根 `type`（如果存在）为 `"object"`。
2. **`mcp:tools` 权限** —— 唯一一个不叫 `hook:*` 的钩子授权。声明该能力却没有它会
   让 `trek-plugin validate` *和*安装都失败。
3. **定义上的 `hooks.mcpToolProvider`**：

```js
module.exports = definePlugin({
  hooks: {
    mcpToolProvider: {
      tools: ['pin_note', 'list_notes'],       // plugin-local names
      async callTool({ name, args }, ctx) {    // ONE function for all tools
        if (name === 'pin_note') { /* … */ }
        return { pinned: true }                // any JSON value; the host builds the MCP envelope
      },
    },
  },
})
```

在发布一个之前值得了解的语义：

- 只有 `capabilities.mcpTools[].name` 与代码的 `tools` 数组的**交集**会被宣传——
  而且是**静默地**。名称不匹配会丢弃该工具，任何地方都没有警告，因此一个从
  `tools/list` 中缺失的工具几乎总是这两个列表不一致。请让它们保持一致。
- **名称会加前缀**给助手看：`plugin_<id>_<name>`；`callTool` 收到的是本地名称。全局
  上限：所有已安装插件的插件工具共 32 个。
- **`callTool` 以发起请求的 MCP 用户身份运行**——类似路由，绝不是无用户。主机从 MCP
  会话绑定用户（插件无法指定）；用户范围的 `ctx.*` 读取会针对*那个*用户做成员校验，
  而 `mcp:tools` 本身不解锁任何 ctx 方法——该工具只能做你其他授权所允许的事。超时
  15 秒；演示用户会在你的代码运行之前被拒绝。
- **参数会在 `callTool` 运行之前按你声明的 `inputSchema` 校验。** `required` 会被
  强制执行，`additionalProperties: false` 会拒绝多余项，enum/const/范围/pattern/format
  都会被强制执行——并且任何无法被强制执行的 schema 都不得被宣传，因此一个不受支持的
  schema 关键字（`oneOf`、`$ref`、一个未知的 `format`）会**让安装失败**，而不是静默
  丢弃。`pattern` 上限为 **200 字符**，且不得是 ReDoS 形状（一个自身重复或交替的量化
  分组）；属性名必须看起来像标识符（`^[A-Za-z_][A-Za-z0-9_.-]{0,63}$`，因此
  `__proto__` 之流会被拒绝）；`additionalProperties` 必须是布尔值；而 schema 的**根**
  不得使用 `enum`、`const` 或 `nullable`。`default` 仅用于宣传——主机不会注入它；请
  自己应用默认值。
- **抛出是工具错误，不是崩溃**——助手会看到一条净化后的消息（≤ 300 字符）。结果上限
  为 64 KiB / 32 个内容块，并带一个可见的 `[truncated: …]` 标记；助手读到的每个字符串
  都会被净化（控制字符和换行被折叠，emoji 被剥离），因此插件文本无法伪造标题或指令。
- **注解会对照你的授权被钳制**：如果插件持有任何偏写入的授权，`readOnlyHint: true`
  会被降级；如果你持有任何 `http:outbound*`，`openWorldHint` 会被强制为 true；
  `destructiveHint` 默认为 true，除非是只读或显式为 `false`。
- **调用方一侧：** MCP 客户端的令牌需要 **`plugins:use`** OAuth 权限范围——刻意做得
  很粗（不是按插件或按工具）且仅限选择性加入；静态 `trek_` 令牌和 Web 会话 JWT 隐式
  拥有它。该权限范围本身不授予任何数据访问权：插件以**管理员**同意的授权行事。
- **工具表面按 MCP 会话冻结。** 激活、停用、更新、重新信任或卸载一个插件（或切换一个
  影响它的扩展）都会关闭每一个存活的 MCP 会话；客户端在下一次初始化时拾取新的表面。
  一次 dev-link **Reload** *不会*使其失效——在改变 `tools` 之后请自己重连你的 MCP
  客户端。

管理 → 插件 会显示一个插件将宣传哪些工具。`trek-plugin dev` 会在加载时对没有
`mcp:tools` 授权的 `mcpToolProvider` 发出警告，并像任何其他钩子一样对
`/__dev/fire/hook/mcpToolProvider/callTool` 返回 403。

## 设置页面操作

插件可以在**它自己的设置表单上放置按钮**——「测试连接」、「立即同步」、「清除缓存」
——放在某个用户的设置页面上，或者用 `scope: "instance"` 放在管理员的实例设置对话框
里。在清单中声明它们，并在定义上实现它们：

```json
"actions": [
  { "key": "testConnection", "label": "Test connection", "hint": "Pings the API." },
  { "key": "purge", "label": "Delete my data", "danger": true },
  { "key": "purgeCache", "label": "Purge cache", "scope": "instance" }
]
```

```js
module.exports = definePlugin({
  actions: {
    async testConnection(ctx) {
      const token = await ctx.settings.get('appToken')   // the CLICKING user's own
      const res = await fetch('https://api.example.com/ping', { headers: { authorization: token } })
      return { ok: res.ok, message: res.ok ? 'Connected' : `Failed: ${res.status}` }
    },
  },
})
```

一个操作是**用户发起的**，这正是它与 `notificationChannel` 钩子的区别：操作用户就是
*点击按钮的那个人*。因此 `ctx.settings.get()` 返回**他的**值，而任何旅行读取都会针对
他做成员校验——正是一个「测试我的凭据」按钮所需要的。

`scope` 决定*哪一个*点击者，以及按钮渲染在哪里。默认值 `"user"` 把它放在
**设置 → 插件** 下该插件自己字段的下方。`"instance"` 则把它放进管理员的实例设置
对话框（**管理 → 插件 → ⋯ → 实例设置**），与它所操作的 `scope: "instance"` 字段
相邻——一个作用于实例配置而不是某个人凭据的「清除缓存」或「测试 SMTP」。两者都把
点击者绑定为操作用户，因此一个实例操作是**由管理员呈现的**，而不是具有管理员特权：
它仍然在 `ctx.config` 旁边看到该管理员自己的 `ctx.settings`，而它的旅行读取会针对
他做成员校验。

说明：

- 返回 `{ ok, message? }`。抛出等同于带错误文本的 `{ ok: false }`。消息在显示之前
  会在主机侧被限界（200 字符）并剥离 emoji。
- `danger: true` 会以破坏性方式渲染它，并先请求确认。
- key 必须是一个有效的设置键，而主机会拒绝清单未声明的任何 key——该 key 从 URL 到达，
  因此它绝不会被盲目转发给插件。作用域同样由路由固定：一个 `"user"` 键永远无法从
  管理员路由触发，一个 `"instance"` 键也无法从设置页面触发。
- 最多 8 个操作，**跨两个作用域合计**，且 key 在它们之间也必须唯一；label 上限 60
  字符（空白的回退为 key），hint 上限 200。一个不是 `"user"` 或 `"instance"` 的
  `scope` 会让安装和 `trek-plugin validate` 以
  `action "<key>".scope must be "user" or "instance"` 失败。
- 一个实例操作需要一个**运行中的**插件：在插件激活之前按钮是禁用的，对话框会在触发它
  之前保存编辑过的表单，而如果子进程已经不在了，主机会回答
  `404 { error: 'Plugin is not active' }`。
- **早于 Tourism-Team 4.2.0 的主机会忽略 `scope`**，并把按钮渲染在每个用户的设置
  标签页上，因此使用 `scope: "instance"` 的插件应设置 `trek` 清单下限为 `>=4.2.0`。

## 运营者提供的出站主机（`operatorEgress`）

插件的 `egress` 列表**在发布时**就固定在其清单中。这对云 API（`api.pushover.net`）
没问题，但对一个**自托管**服务不行——你无法知道某个用户的 Gotify 位于
`gotify.alice.net`。没有出路的话，一个针对自托管目标的社区插件可能服务不了任何人。

声明 `operatorEgress`，由**管理员**在安装后提供真实主机：

```json
{
  "permissions": ["hook:notification-channel", "http:outbound:gotify.net"],
  "egress": ["gotify.net"],        // hosts you DO know (the cloud offering)
  "operatorEgress": true            // …plus whatever the admin adds
}
```

如果**没有**任何你能指定的主机——一个针对*只*会自托管的服务的插件——
`operatorEgress` 就是让你能以**空的 `egress[]`** 声明出站的方式（省略该键）。这是
唯一一个这样做合法的场合；没有该标志时，`http:outbound` 没有 egress 是一个清单错误：

```json
{
  "permissions": ["hook:notification-channel", "http:outbound"],
  "operatorEgress": true            // every host comes from the admin
}
```

这样的插件仍然**正常安装并激活**——它可能有用的非网络功能——但在管理员添加主机
之前，它触达*任何东西*：子进程的允许清单是你的 `http:outbound:<host>` 授权与管理员的
主机的并集，而两者都是空的，因此每一次出站调用都会失败，报
`egress: <host> is not in the plugin's declared hosts`。空的 `egress[]` 永远不是
「允许全部」。

然后管理员打开 **管理 → 插件 → ⋯ → 允许的主机** 并添加 `gotify.alice.net`。运行时把
它并入子进程的允许清单，并**重新派生插件**——出站防护在子进程启动时安装一次，第二次
`init` 被刻意拒绝，因此一个存活子进程的允许清单永远无法就地放宽。

这刻意*不*做的事：

- **终端用户永远无法扩大出站。** 只有管理员能，而且只对一个*声明了*
  `operatorEgress` 的插件——因此安装时给出的同意仍然限定了什么是可能的。一个从未
  请求它的插件永远无法被赋予主机。
- **主机会得到与清单出站项相同的校验**：不允许裸 `*`、不允许整段 TLD 的 `*.com`、
  不允许 scheme、不允许空格。一个通配符需要真实的多个标签后缀（`*.mydomain.com`）。
- **卸载会丢弃这些主机**，因此一个之后复用该 id 的插件无法继承授予给另一个插件的
  同意。

随后用户把他们自己的设置指向某个已批准的主机。其他任何东西都会被防护拒绝，报
`egress: <host> is not in the plugin's declared hosts`。

## 事件订阅

用 `events` + `events:subscribe` 权限对核心活动做出反应。处理函数**在没有用户的情况下**
触发（像一个任务），并收到 `{ event, tripId, entity?, entityId?, snapshot? }`：`entity`
是事件族（`'reservation'`、`'place'` 等），`entityId` 说明是**哪一个**实体变了，而
`snapshot` 是**变更实体的白名单字段视图**——仅当你的插件*同时*持有该族的读取授权
（地点/日程/预订/住宿/分配/旅行用 `db:read:trips`，预算用 `db:read:costs`，行李用
`db:read:packing`，dayNote 用 `db:read:daynotes`，文件用 `db:read:files`）时才会送达。
没有该授权时，你拿到的就只是 id 提示，与以前一样：

```js
// trek-plugin.json: "permissions": ["events:subscribe", "db:read:trips"]
module.exports = definePlugin({
  events: [
    { on: 'reservation:created', async handler({ event, tripId, entityId, snapshot }, ctx) {
        // with db:read:trips the snapshot carries the reservation's fields
        // (title, times, type, endpoints, ...) — no refetch needed
        await ctx.db.exec('INSERT INTO seen (trip, res, title) VALUES (?, ?, ?)', tripId, entityId, snapshot?.title ?? '')
    } },
    { on: '*', handler(e) { /* firehose: every core event */ } },
  ],
})
```

`entityId` 在批量/重排事件以及没有单一实体的事件中不存在；`snapshot` 在**删除**时
（没有东西可显示）以及**私有行李项**（它的广播以所有者为范围——#858）时额外不存在。
永远不要假定两者中任何一个已被设置。快照白名单永远不携带用户 id（所有者/付款人/
参与者）、`trips.feed_token` 或其他机密——那个 id 永远只是变更实体自己的 id（绝不是
父实体或用户 id）。

投递是即发即忘、超时很短的，因此缓慢的订阅者永远不会阻塞一次核心写入。因为没有
用户，处理函数内的旅行读取（`ctx.trips.*`）会被拒绝——除快照之外，请使用插件自己的
`ctx.db`、`ctx.ws.*` 或一次出站调用。插件自己的 `plugin:*` 广播永远不会被投递回来，
因此处理函数不会形成循环。事件名遵循 `<family>:<verb>`（`place:created`、
`day:updated`、`file:*`、`assignment:*`、`budget:*`、`accommodation:*` 等）；SDK 以
`EVENT_FAMILIES` 和 `EVENT_SNAPSHOT_GRANT` 导出权威的事件族列表和快照授权映射。

## 依赖

插件可以声明它在运行之前需要某些**扩展**处于启用状态，或其他**插件**已安装。两者
都是顶层清单数组，并且都在**激活时**强制执行——安装总是成功，因此一个缺失的依赖是
一个可修复的状态，绝不是一次损坏的下载。

### `requiredAddons`

```json
"requiredAddons": ["budget", "journey"]
```

插件要激活就必须**启用**的扩展 id（见 [[扩展概览|Addons-Overview]]）。如果某个是
关闭的，启用插件会被拒绝，管理面板会指出要打开哪个扩展。在插件运行期间把一个必需的
扩展**关闭**会**自动停用该插件**（以及任何依赖它的东西）——插件永远不会针对一个已
停用的扩展运行。id 只校验形状，因此插件可以指定某个 Tourism-Team 构建没有的扩展；
它只是在那里保持不可激活。

### `pluginDependencies`

```json
"pluginDependencies": [
  { "id": "koffi", "version": ">=1.2.0 <2.0.0" }
]
```

其他必须**已安装且版本满足**（一个标准 semver 范围）才能让本插件激活的插件。对于你在
该依赖上调用的任何东西，那个范围就是真正的契约（见
[与其他插件通信](#talking-to-other-plugins)）。

强制执行，全部在激活时：

- 依赖**缺失** → 激活被阻止，面板提供一个一键**下载**，它会获取满足你范围的最新注册表
  版本（并连带拉取*它*自己的依赖），然后重试。
- **已安装但超出范围** → 同样的阻止；面板提供更新它。
- **已安装但已停用** → 启用你的插件会**先自动启用该依赖**，传递地进行（最深的依赖
  优先）。
- **停用一个依赖**会级联：每个（传递地）依赖它的插件也会被停用。
- 一个依赖**环**（A → B → A）会被拒绝，并给出清晰的错误。

依赖在启动时也按依赖优先的顺序解析，因此一个插件的依赖在它启动之前就已经就绪。

## 与其他插件通信

隔离是默认——插件彼此看不见。要让一个插件能被依赖它的插件*使用*，它通过在其清单的
`capabilities` 中声明一份接口来选择性加入，而主机在两个子进程之间路由调用/事件。
这件事**没有权限**：授权就是依赖边本身——插件 A 只有在把 B 声明为一条已满足的
`pluginDependency` 时，才能调用或订阅插件 B，并且只能使用 B 公开声明的名称。

### 导出 —— 请求 / 响应

**被依赖方**（B）暴露具名函数，并在 `capabilities.provides` 中列出它们：

```js
// plugin "koffi"
module.exports = definePlugin({
  exports: {
    // `args` is whatever the caller passed; `ctx` is a per-call context.
    async convert({ amount, from, to }, ctx) {
      return { amount: amount * rate(from, to), to }
    },
  },
})
// manifest: "capabilities": { "provides": ["convert"] }
```

**依赖方**（A）把 koffi 声明为依赖并调用它：

```js
// manifest: "pluginDependencies": [{ "id": "koffi", "version": ">=1.0.0 <2.0.0" }]
const out = await ctx.plugins.call('koffi', 'convert', { amount: 10, from: 'USD', to: 'EUR' })
```

- 如果目标不是一条已满足的依赖、当前未激活，或该函数不在目标的 `provides` 中，调用
  会被拒绝（`RESOURCE_FORBIDDEN`）。
- **操作用户会被传播：** B 的导出以 A 当前的用户运行，因此 B 所做的任何
  `ctx.trips.*` 读取都会针对该用户做成员校验——B 无法被诱骗去读取调用用户看不到的
  数据。
- 该调用受超时约束，并被记录在能力审计日志中（`plugin:<target>#<fn>`），归属到 A 和
  操作用户。
- B 拥有自己的契约：只有 `provides` 中的函数可被触达——路由、任务和辅助函数保持私有。
  因为你的 `pluginDependencies` 范围锁定了 B 的版本，B 可以自由重构内部实现，只会在
  一次大版本升级时打破你。

### 事件 —— 发布 / 订阅

**发出方**（B）在 `capabilities.emits` 中声明事件名并发布它们：

```js
// manifest: "capabilities": { "emits": ["rate.updated"] }
ctx.events.emit('rate.updated', { pair: 'USD/EUR', rate: 0.92 })   // fire-and-forget
```

**依赖方**（A）通过指定来源插件 + 事件来订阅：

```js
module.exports = definePlugin({
  subscriptions: [
    { plugin: 'koffi', event: 'rate.updated', async handler(payload, ctx) {
        await ctx.db.exec('UPDATE cache SET rate = ?', payload.rate)
    } },
  ],
})
```

- 只有当 A 把 `koffi` 声明为一条已满足的依赖**并且**订阅了那个 `(plugin, event)`
  时，事件才会到达 A。发布一个不在你 `emits` 中的事件会被拒绝。
- 与核心 [事件订阅](#event-subscriptions) 一样，处理函数**没有用户**——但与它们不同
  的是，处理函数**确实**会收到发出方的负载。投递是即发即忘、超时很短的；缓慢的
  订阅者永远不会阻塞发出方。

## 在没有运行中的 Tourism-Team 时测试

`createMockHost` 给你一个强制执行**同一套**权限模型的 `ctx`，因此一个测试可以证明
你的插件在缺失某个授权时会优雅降级：

```js
import { createMockHost } from 'trek-plugin-sdk/testing'

const { ctx, broadcasts } = createMockHost({
  grants: ['db:read:trips'],
  actingUserId: 42,                                   // the user every read is checked against
  trips: {
    1: { members: [42], data: { id: 1, name: 'Japan' } },
    2: { members: [99], data: { id: 2, name: 'Peru' } },
  },
})
await ctx.trips.getById(1)                            // ok — member
await expect(ctx.trips.getById(2)).rejects…           // RESOURCE_FORBIDDEN
await expect(ctx.db.query('SELECT 1')).rejects…       // PERMISSION_DENIED (no db:own)
```

mock 数据库是一个记录器——为预设行设置 `queryResults`，或为真实 SQL 使用一次集成
测试。要测试插件间调用，传入
`pluginExports: { koffi: { convert: (args) => … } }`，并对你的插件通过
`ctx.events.emit` 发布的任何东西断言 `mock.emitted`。

mock 还会强制执行主机的运行限制，因此一个测试可以证明你的插件正确退避：**每日 AI 与
通知预算**（默认每天 200 / 100；用 `aiPerDay` / `notifyPerDay` 配置——`0` 会完全
禁用 broker，耗尽的调用会以主机的确切错误失败）以及 **`ctx.meta` 配额**（键 ≤256
字符、序列化值 ≤64 KB、每实体 ≤100 个键）。

### 驱动你插件的处理函数

`createMockHost` 还给你 `run(def)`——测试的另一半。`ctx` 记录器（`calls`、
`broadcasts`、`emitted`、`notifications`、`scheduled`）捕获你的插件*读了*什么，而
`run` 触发每个入口点，让你能断言它*做了*什么，全都针对同一个 mock `ctx`：

```js
const host = createMockHost({ grants: ['jobs:run', 'hook:trip-card-provider'], actingUserId: 7 })
const app  = host.run(myPlugin)

await app.route({ method: 'GET', path: '/ping' })          // → the route's response
await app.job('refresh')                                    // fire a background job (userless)
await app.scheduled('daily', { tripId: 1 })                 // fire the `scheduled` handler
await app.event('place:created', { tripId: 1, entityId: 9 })// deliver a core event to `events`
await app.deleteUserData(42)                                // GDPR erasure handler
const dump  = await app.exportUserData(42)                  // GDPR export handler
const cards = await app.hook('tripCardProvider', 'getCards', [1, 2]) // any provider hook

host.scheduled.get('daily')                                 // timers the plugin armed via ctx.scheduler
```

一个你的插件未声明的处理函数会抛出一个清晰的错误（而不是静默无操作），因此测试能在
发布之前捕获缺失的 `scheduled`/`deleteUserData`/任务。

#### 设置操作与通知渠道

这两个有它们自己的驱动方法，因为主机调用它们的方式是普通的 `hook()` 调用无法表达的：

```js
const host = createMockHost({ actingUserId: 7, userSettings: { token: 'abc' } })
const app  = host.run(myPlugin)

// A settings-page button. USER-INITIATED, so ctx.settings.get() returns the clicker's
// own value. You get back the result the user would actually see: a handler that
// returns nothing is { ok: true }, and one that THROWS is { ok: false, message } —
// the documented contract, so this never rejects.
await app.action('test')            // → { ok: true, message: 'Connected' }

// A notification channel. USERLESS — the host fires it for an arbitrary recipient, so
// ctx.settings.get() returns undefined and trip reads are refused; the recipient's
// decrypted settings arrive as the `config` ARGUMENT instead (defaulting to the
// `userSettings` fixture). That asymmetry is the security property of a channel
// plugin — it is handed someone's push token without the right to read their trips.
await app.channel.send({ event: 'trip_invite', title: 'Hi', body: 'Japan' })
await app.channel.test({ token: 'abc' })
```

一个在 [`CHANNEL_EVENTS`](#notification-channels) 之外的事件——或在你清单的
`capabilities.notificationChannel.events` 之外的事件，而后者只能*收窄*那个集合——
会被拒绝而不是投递，因此一个测试无法靠一条主机会永不路由给你的通知通过。传入
`declaredActions` / `channelEvents` 来模拟你清单声明了什么。

`declaredActions` 接受纯 key 或 `{ key, scope? }` 条目，因此一个同时具有两个作用域的
清单能被忠实模拟：

```js
const host = createMockHost({
  actingUserId: 7,
  declaredActions: ['testConnection', { key: 'purgeCache', scope: 'instance' }],
})
```

`app.action(key)` 驱动其中任何一个，而驱动一个你未声明的 key 会像主机一样抛出
（`RESOURCE_FORBIDDEN`）。作用域本身在 mock 中没有运行时效果：两个作用域都得到
操作用户的 ctx，正如主机给两者都是点击者的 ctx。

## 规则

- **不要原生模块**（`.node`、`binding.gyp`、`prebuilds/`）——在打包和安装时都会被
  拒绝。
- **不要打包（vendor）`trek-plugin-sdk`**——它在运行时注入（仅作开发依赖）。请打包
  *其他*任何运行时依赖：Tourism-Team 从不对插件运行 `npm install`。
- **发布构建好的 JS** 到 `server/index.js`，并把预构建的静态文件放进 `client/`。
  `.ts` 和 `.map` 文件会被 `pack` 剥离。
- 每当你使用 `http:outbound` 时，都要在 `egress[]` 中声明每一台出站主机——**并且给
  每一台授予一条匹配的 `http:outbound:<host>` 权限**。运行时只从那些*权限*构建子进程
  的网络允许清单和 iframe 的 CSP；它从不读取 `egress[]`，后者是为管理员的同意界面而
  存在的。一台列在 `egress[]` 中却没有匹配权限的主机可以安装、激活、被同意——然后就
  静默地不可达。`validate` 会对此报错。

## 清单参考（`trek-plugin.json`）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string，**必填** | 小写 slug，`^[a-z][a-z0-9-]{2,39}$`（3–40 字符）。必须与目录名一致。 |
| `name` | string，**必填** | 显示名；同时也是页面导航标签。 |
| `version` | string，**必填** | semver（`1.2.3`，可选预发布）。 |
| `apiVersion` | number | 插件 API 版本（当前为 `1`；`PLUGIN_API_VERSION`）。默认为 `1`；必须是正整数，而一个比主机支持的更新的版本会在安装时被拒绝且不会激活（`API_VERSION_INCOMPATIBLE`）。 |
| `type` | string，**必填** | `integration` \| `page` \| `widget` \| `trip-page`。 |
| `trek` | string，**必填** | 本插件支持的 Tourism-Team 版本，作为一个 semver **范围**：`">=4.0.0 <5.0.0"`（脚手架写入的值）。必须*可满足*（`">=4.0.0 <3.0.0"` 能解析但没有任何东西能满足它——被拒绝）。**在安装和激活时强制执行**（见下文）；它会被原样复制到注册表条目上，而那是该条目唯一的兼容性字段。请让它保持**有界**——一个无界的范围等于宣称支持尚不存在的 Tourism-Team 版本。 |
| `author` | string | 显示在商店中。 |
| `description` | string | 商店用的一行摘要。 |
| `icon` | string | lucide-react 图标名（默认 `Blocks`）；用于页面导航条目。 |
| `homepage` | string | 项目 URL。 |
| `tags` | string[] | 商店关键词，原样复制到注册表条目上。每个必须是 2–24 字符的小写 slug（`[a-z0-9-]`），最多 8 个——`validate` 会拒绝大写字母或空格，因为注册表的 schema 会拒绝。 |
| `license` | string | 显示在商店详情中（从清单读取，不做强制）。 |
| `nativeModules` | boolean | 必须是 `false`/不存在——`true` 会被拒绝。 |
| `permissions` | string[] | 见下文。 |
| `egress` | string[] | 允许的出站主机；当存在任何 `http:outbound` 权限时必需（非空、不允许裸 `*`）——**除非** `operatorEgress` 为 `true`，此时它可以为空/省略，由管理员提供主机。 |
| `capabilities.widget` | object | `{ title, slot, defaultSize }` —— `slot` 为 `sidebar`（默认）、`hero`、`place-detail`、`day-detail` 或 `reservation-detail`。 |
| `capabilities.tripPage` | object | 供 `trip-page` 插件使用的 `{ replaces?, position? }` —— `replaces` 指定激活期间要隐藏的核心规划器标签页（`transports`、`buchungen`、`listen`、`finanzplan`、`dateien`、`collab`；永远不是 `plan`），`position` 是标签页在栏中的 0 起始索引（0–50；省略 = 追加在末尾）。 |
| `actions` | array | 插件设置表单上的按钮——`{ key, label, hint?, danger?, scope? }`（跨两个作用域最多 8 个，key 在它们之间唯一）。每个都在定义上实现为 `actions[key](ctx)`。`scope` 是 `user`（默认——渲染在 **设置 → 插件** 下）或 `instance`（渲染在 **管理 → 插件 → ⋯ → 实例设置** 中，需要 `trek` ≥ 4.2.0）。无论哪种，该操作都是**由点击它的人发起的**，并以他的身份运行，因此 `ctx.settings.get()` 返回*那个*用户的值。见 [设置页面操作](#settings-page-actions)。 |
| `operatorEgress` | boolean | 插件与一个**自托管**服务通信，其主机名只有运营者知道。管理员在安装后添加真实主机（管理 → 插件 → 允许的主机），运行时把它们并入出站允许清单。需要一条 `http:outbound` 权限，并且是用空 `egress[]` 声明它的唯一方式。见 [运营者提供的出站主机](#operator-supplied-egress-hosts-operatoregress)。 |
| `capabilities.notificationChannel` | object | 供实现 `notificationChannel` 钩子的插件使用的 `{ title?, events? }` —— `title` 命名通知偏好矩阵中的那一列（默认：插件的 `name`），`events` **收窄**该渠道携带哪些事件（默认：全部十个可投递事件；`events` 只能收窄该集合）。需要 `hook:notification-channel` 权限。见 [通知渠道](#notification-channels)。 |
| `capabilities.routeProfiles` | array | 供实现 `routeProvider` 钩子的插件使用的、最多 3 个 `{ id, label, icon? }` 条目——每个成为规划器路线开关中（驾车/步行旁边）一个可选模式。`id` 为小写 `[a-z][a-z0-9-]`（最多 24 字符），并且正是 `getRoute` 作为 `request.profile` 收到的东西；`label`（≤40 字符）显示给用户。需要 `hook:route-provider` 权限。 |
| `capabilities.mcpTools` | array | 供实现 `mcpToolProvider` 钩子的插件使用的、最多 **8** 个 MCP 工具——每个 `{ name, description, title?, inputSchema?, annotations? }`（`name` 为小写 `^[a-z0-9_]{1,48}$`，唯一；`description` 必填；`inputSchema` 是一个根 `type: "object"` 的 JSON Schema，由一小套被强制执行的关键字构成——不受支持的关键字会让安装失败）。需要 `mcp:tools` 权限。见 [MCP 工具](#mcp-tools)。 |
| `capabilities.provides` | string[] | 本插件通过 `ctx.plugins.call` 向其依赖方暴露的函数名（见 [与其他插件通信](#talking-to-other-plugins)）。 |
| `capabilities.emits` | string[] | 本插件通过 `ctx.events.emit` 向其依赖方发布的事件名。 |
| `requiredAddons` | string[] | 插件要激活就必须**启用**的扩展 id（见 [依赖](#dependencies)）。 |
| `pluginDependencies` | `{ id, version }[]` | 其他必须已安装 + 版本满足才能激活的插件（semver 范围）。 |
| `settings` | array | 设置字段（见下文）。 |

#### Tourism-Team 版本兼容性（`trek`）

`trek` 范围是一份**硬契约**，双向强制执行：

- 当运行中的 Tourism-Team 落在它之外时，**安装**会被拒绝——在每一条路径上：注册表
  安装、显式锁定版本、更新、侧载归档以及 dev-link。一个没有范围（或范围不可满足）的
  清单根本无法安装。
- **激活**会重新检查它，这是安装无法覆盖的那一半：一个合法安装在 3.3 上的插件在升级
  到 4.0 之后仍然留在磁盘上，而如果它声明了 `<4.0.0`，它现在会拒绝启动。它保持已安装
  并被列出、处于关闭状态，并显示原因（`TREK_VERSION_INCOMPATIBLE`；一个完全没有声明
  范围的插件报告 `TREK_VERSION_UNKNOWN`）。
- **一个运营者逃生舱，而且是响亮的。** 该范围是作者自己关于插件在那里不工作的声明，
  因此 UI 中没有按安装覆盖的选项。一个被卡在某个作者尚未更新范围的插件上的运营者，
  可以在服务器上设置 `TREK_PLUGINS_IGNORE_TREK_RANGE=1`：上述每一道关卡于是改为警告
  而不是拒绝（缺失范围也被容忍），「安装最新」取最新已发布版本，每次绕过都会被记录，
  响应携带一个 `trekRangeBypassed` 标记，而管理员会看到一个警告对话框加上该行上一个
  持久的标签。没有任何东西保证插件在那里能工作，而一个版本不匹配的插件在极少数情况
  下可能损坏 Tourism-Team 数据——因此请发布范围升级，而不是告诉你的用户去拨这个开关。
  插件 API 版本门禁（`apiVersion`）永远不会被绕过。

由此引出两个行为。「安装最新」解析为*这个* Tourism-Team 能运行的最新版本，而不是最新
已发布的版本，因此发布一个需要 Tourism-Team 4 的 2.0.0 不会让 3.x 用户陷入困境。而
一次会把一个可工作插件移出兼容范围的**更新**会被拒绝而不是执行。

一个刻意的缺口：一个 `APP_VERSION` 不是 semver 版本的主机——Docker 构建参数默认是字面
量 `dev`——没有任何东西可以与范围比较，因此该检查被跳过，一个无版本的构建会安装任何
东西。插件仍应守护可选的 `ctx.*` 命名空间。

**权限** —— 下面是常用核心子集；**完整的 64 项列表**（所有读/写权限范围、
notify/ai/oauth broker、每个提供方钩子、`mcp:tools`）在
**[[插件权限|Plugin-Permissions]]** 中。未知值会在安装时被拒绝（也会被
`trek-plugin validate` 和注册表 CI 拒绝，它们对照同一份列表检查）。

| 权限 | 授予 |
|---|---|
| `db:own` | `ctx.db` —— 你自己的 SQLite 文件 |
| `db:read:trips` | `ctx.trips.*`（做成员校验，仅限路由处理函数） |
| `db:read:packing` | `ctx.packing.list(tripId)` —— 某次旅行的行李项（做成员校验） |
| `db:read:files` | `ctx.files.list(tripId)` —— 某次旅行的文件，排除回收站（做成员校验） |
| `db:read:costs` | `ctx.costs.getByTrip` / `ctx.costs.listMine`（费用扩展，仅限路由处理函数） |
| `db:write:costs` | `ctx.costs.create/update/delete`（费用扩展 + 操作用户的 `budget_edit`） |
| `db:write:places` | `ctx.places.create/update/delete`（操作用户的 `place_edit`） |
| `db:write:days` | `ctx.days.create/update/delete`（操作用户的 `day_edit`） |
| `db:write:itinerary` | `ctx.itinerary.assign/unassign`（操作用户的 `day_edit`） |
| `db:write:trips` | `ctx.trips.update`（操作用户的 `trip_edit`） |
| `db:write:packing` | `ctx.packing.create/update/delete`（操作用户的 `packing_edit`；私有项保持以所有者为范围） |
| `db:meta` | `ctx.meta.*` —— 你在一次旅行/地点/日程/预订/住宿上的自己的命名空间数据 |
| `db:read:users` | `ctx.users.getById` |
| `events:subscribe` | 通过 `events: [...]` 接收核心活动事件（事件名 + tripId + 一个 { entity, entityId } 提示，外加当插件同时持有该族 `db:read:*` 授权时的一个白名单实体**快照**；永远没有用户） |
| `hook:trip-card-provider` | `hooks.tripCardProvider` —— 仪表盘旅行卡片上的小徽章（`getCards(tripIds, ctx)` → `{ tripId, id, label, value?, icon?, tone?, url? }[]`；`id` 必填——没有它的徽章会被丢弃；主机会对每个字段限界并对每个 tripId 做访问校验） |
| `jobs:run` | 按它们的 cron 计划运行已声明的后台 `jobs`，**以及** `ctx.scheduler` 运行时定时器 → `scheduled` 处理函数（选择性加入；没有用户，因此旅行读取被拒绝） |
| `ws:broadcast:trip` | `ctx.ws.broadcastToTrip` |
| `ws:broadcast:user` | `ctx.ws.broadcastToUser` |
| `http:outbound` 或 `http:outbound:<host>` | 向 `egress[]` 主机发起出站 HTTP |
| `hook:place-detail-provider` | `hooks.placeDetailProvider` —— Tourism-Team 渲染的额外地点行（见 [提供方钩子](#provider-hooks)） |
| `hook:trip-warning-provider` | `hooks.warningProvider` —— 规划器中的校验警告（见 [提供方钩子](#provider-hooks)） |
| `hook:table-contributor` | `hooks.tableContributor` —— 预订、交通、地点、日程、费用、行李、文件和待办事项视图中由主机渲染的列/操作（见 [提供方钩子](#provider-hooks)） |
| `hook:map-marker-provider` | `hooks.mapMarkerProvider` —— 旅行地图上有限数量的标记 |
| `hook:map-layer-provider` | `hooks.mapLayerProvider` —— 旅行地图上有限数量的矢量叠加（路线、走廊、区域） |
| `hook:route-provider` | `hooks.routeProvider` —— 规划器路线开关的路线规划 profile（在 `capabilities.routeProfiles` 中声明） |
| `hook:day-schedule-provider` | `hooks.dayScheduleProvider` —— 日程计划中的时间贡献（充电、缓冲），计入路线页脚总计 |
| `hook:day-tint-provider` | `hooks.dayTintProvider` —— 「计划」侧边栏中日期卡片徽章 / 标题 / 活动列表的颜色（例如某一天属于旅行的哪一段）。每天一份贡献：第一个被授予的提供方获胜 |
| `hook:pdf-section-provider` | `hooks.pdfSectionProvider` —— 追加到旅行 PDF 导出中的章节 |
| `hook:atlas-layer-provider` | `hooks.atlasLayerProvider` —— 足迹地图上按用户的国家着色图层 |
| `hook:journal-entry-provider` | `hooks.journalEntryProvider` —— 日志条目卡片上的额外行 |
| `hook:user-data` | `deleteUserData` / `exportUserData` 处理函数 —— 为一个被删除/发起请求的用户履行 GDPR 抹除（持久、带重试）和数据导出（无用户；仅限自己的 db） |
| `hook:photo-provider` | `hooks.photoProvider` —— 照片的一个照片来源，在 `GET /api/plugin-photos/search` 聚合（见 [提供方钩子](#provider-hooks)） |
| `hook:calendar-source` | `hooks.calendarSource` —— 已登录用户的日历事件，在 `GET /api/plugin-calendar` 聚合（见 [提供方钩子](#provider-hooks)） |
| `mcp:tools` | `hooks.mcpToolProvider` —— 在 Tourism-Team 的 MCP 服务器上发布 MCP 工具，在 `capabilities.mcpTools` 中声明；以发起请求的 MCP 用户身份运行（见 [MCP 工具](#mcp-tools)） |

> **没有 `ws:broadcast:*`**——请显式使用 `ws:broadcast:trip` 和/或
> `ws:broadcast:user`。

**设置字段**（`settings[]`）：

| 键 | 说明 |
|---|---|
| `key` | **必填**标识符；空 key 条目会被丢弃。 |
| `label` | 表单标签。 |
| `input_type` | **snake_case**；例如 `text`（默认）、`password`、`number`、`select`。 |
| `scope` | `instance`（默认）或 `user`。 |
| `required` | boolean。 |
| `secret` | boolean —— 静态加密，只解密进 `ctx.config`。 |
| `placeholder`、`hint` | 表单提示。 |
| `options` | select 输入框用的 `[{ value, label }]`；裸字符串/数字会被接受并强制转换，但一个选项需要一个非空的 `value`。 |
| `oauth` | OAuth 流程用的 `{ initPath, callbackPath }`。 |

**页面导航：** 主机从顶层 `name` 和 `icon` 构建页面插件的导航条目——没有
`capabilities.nav`，因此没有别的东西可设置。`icon` 必须是真实的 lucide 名称：
Tourism-Team 在渲染时解析它，并静默回退到 `Blocks`，这会让拼写错误在本地看不出来，
因此 `validate` 会拒绝它。

完整权限模型见 [[插件权限|Plugin-Permissions]]。

## `trek-plugin` CLI

在终端中**不带任何命令**运行 `npx trek-plugin-sdk`，你会得到一个交互式菜单——create /
dev / status / shot / publish，而 validate、pack、签名和注册表条目命令在
**Advanced…** 下。它会挑选要运行哪个命令，并询问要针对哪个插件目录运行它；那个命令
随后会提示它需要的其他东西。显式传入一个命令可跳过菜单（也为脚本和 CI）。对任何命令
`trek-plugin help <command>`——或 `trek-plugin <command> --help`——都会打印完整一页。

**路径是四个命令**，其他的都是其中某个命令已经做过的步骤（有两个例外，它们用于撤销
或修复：`unrelease` 和 `rotate-key`）：

```bash
trek-plugin create [name] [--type integration|page|widget|trip-page]
trek-plugin dev [dir] [--port 4317]
trek-plugin status [dir]
trek-plugin publish [dir] --repo owner/name --tag vX.Y.Z [--sign]
```

`status` 是你拿不准下一步该做什么时该用的那个。它运行 TREK-Plugins 注册表强制执行的、
**无需网络**就能回答的每一道关卡——几乎所有都是——并把整个旅程打印成按阶段（Manifest、
Code、Docs、Release、Repo）分组的检查清单，附上接下来要运行的那一条命令。它从不以非零
退出：它是用来定位的，不是用来把关的。

```bash
# The gate. The SAME checks as `status`, but it exits 1. This is the form for CI.
trek-plugin validate [dir]

# Build plugin.zip in the installer's exact layout. Prints sha256 + byte size,
# refuses native binaries, enforces the same size limits (25MB/file, 50MB total).
# Ships trek-plugin.json, README.md, LICENSE(.md), package.json + server/ + client/.
# docs/ is intentionally NOT shipped — the store fetches docs/screenshot.png from
# your repo. It refuses a plugin that could not LOAD, but deliberately does not
# enforce the publish gates (an unwritten README, a missing screenshot) — packing is
# how you sideload a plugin to try it locally.
trek-plugin pack [dir] [--out plugin.zip] [--json]

# Boot the dev server, render the plugin in the themed /preview frame, and write a
# 1600x900 docs/screenshot.png. Needs Playwright (not an SDK dependency — it ships a
# browser): npm i -D playwright && npx playwright install chromium
trek-plugin shot [dir] [--port 4317] [--out docs/screenshot.png] [--dark] [--no-serve]

# Ed25519 signing. keygen once; `publish --sign` is the usual way to use the key.
trek-plugin keygen [--key file]
trek-plugin sign [zip] [--key file]

# Move a published plugin to a NEW signing key WITHOUT shipping a version (lost or
# compromised key, planned rotation): fetches your published entry, re-signs every
# pinned version's artifact with the new key (each verified against its sha256 first,
# all-or-nothing), swaps authorPublicKey, and opens a registry PR flagged as a
# rotation. The PR needs a maintainer's `allow-key-change` label, and every admin who
# has the plugin must re-trust the new key. To rotate WHILE shipping a version, use
# `publish --sign --allow-key-change` instead.
trek-plugin rotate-key [dir] [--id plugin-id] [--key file] [--out entry.json] [--draft]

# Emit the ready-to-PR registry entry: commitSha (resolved from the git tag),
# downloadUrl, sha256, size, and the manifest's `trek` range verbatim — plus
# requiredAddons and pluginDependencies, which the registry parity-checks against the
# manifest. --merge prepends a new version onto an existing entry (the update case,
# kept newest-first).
trek-plugin entry --repo owner/name --tag vX.Y.Z [--zip plugin.zip] [--merge entry.json] [--out file]

# The registry checks that genuinely need the network: the tag resolves to the commit
# the entry pins, the released artifact downloads and hashes to the pinned sha256, the
# id is not bound to another GitHub owner, and an update does not drop or rotate a
# signing key you already published under (`--allow-key-change` declares a deliberate
# rotation, turning that refusal into a pass). `publish` runs this for you.
trek-plugin preflight [dir] --repo owner/name --tag vX.Y.Z [--entry file.json] [--all] [--allow-key-change]

# Pack -> cut the GitHub release -> print the entry, without opening the registry PR.
trek-plugin release [dir] --repo owner/name --tag vX.Y.Z [--sign] [--merge entry.json]

# Fork the registry, write registry/plugins/<id>.json, open the PR. Needs `gh`.
trek-plugin submit [dir] --repo owner/name --tag vX.Y.Z [--registry o/n] [--draft]

# Delete a stranded release + remote tag + local tag in one go. Checks the published
# registry index first and REFUSES a version that is actually published (immutable);
# --yes consents when the index can't be reached.
trek-plugin unrelease vX.Y.Z [dir] --repo owner/name [--yes]
```

`publish` 按真正重要的顺序串联最后那几步：**check → pack → release → preflight →
submit**。本地关卡在任何东西被打标签或发布*之前*运行，因为一个 GitHub release 实际
上是不可变的——注册表锁定了它的 sha256——而在 release 切出*之后*的失败会回滚那次运行
所创建的一切（该 release、两个 tag），因此同一个 tag 可以自由地重新运行
（`--keep-release` 选择退出）。见 [[发布插件|Plugin-Publishing]]。

## 注册表与发布

- **没有保留命名空间**——任何唯一的 slug id 都被接受。（一小批 id 如
  `registry`/`install`/`rescan` 被阻止，只是因为它们会与管理员 API 路由冲突。）
- **所有者绑定**仍然阻止除原作者以外的任何人把一个已存在的 id 重新指向另一个仓库。
- **可选的作者签名：** 一个条目可以携带 `authorPublicKey`（稳定，首次安装时以 TOFU
  固定），而每个版本携带一个针对产物字节的 `signature`。未签名的插件仅凭 sha256 即可
  安装；一个曾被签名的插件之后不能变为未签名，而一次密钥*轮换*是 SDK 驱动的一个刻意
  行为——`trek-plugin rotate-key`，或 `publish --sign --allow-key-change`——它仍然需要
  注册表维护者的 `allow-key-change` 标签，加上每个实例上一次显式的管理员重新信任。

完整演练：[[发布插件|Plugin-Publishing]]。概览：[[插件|Plugins]]。
