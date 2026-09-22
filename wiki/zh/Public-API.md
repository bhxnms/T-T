# 公开 API

一个小的、带版本的、只读接口，让其他软件可以读取你的旅行 —— 为位置追踪器、日志工具和家庭自动化之类的集成而构建，这些场景里 Tourism-Team 之外的某样东西想知道你计划了什么。

> **与内部 API 不是一回事。** Tourism-Team 自己的前端要与 `/api/…` 下的几百个端点通信。那些端点响应会话 Cookie、不携带版本号，并且客户端一改它们就跟着改 —— 它们不是契约，任何建立在它们之上的东西都会坏掉。公开 API 是相反的承诺：`/api/v1/` 下的一小组端点，用你自己铸造的密钥认证，除非出现新的版本号，否则形态不会改变。

## 它能做什么

读取旅行。这是刻意为之，也是它的全部：

- 列出你拥有或身为成员的旅行
- 获取一次旅行及其天数、按计划顺序排列的地点、每日备注、预订、住宿和同行旅伴
- 读取心愿单：旅行者想去但尚未与任何旅行绑定的地点
- 读取仪表盘小组件所需的少量总计：旅行数、国家数、城市数、地点数、天数、飞行距离，以及最近一次已进行的旅行

它不能写入任何东西。一个读取你行程的集成不需要有删除某个地点的能力，而一把只能读取的密钥，交到第三方软件手里是完全不同的一件事。

## 获取密钥

1. 打开 **设置 → 集成**
2. 在 **API 密钥** 下，点击 **创建密钥**，并给它起一个你以后认得出的名字（这个名字只对你有意义 ——「Dawarich」、「home assistant」、「laptop script」）
3. **立即复制该密钥。** 它只显示一次。Tourism-Team 只存它的哈希，因此无法再次显示 —— 如果你丢了它，请删除该密钥并新建一个。

密钥形如 `trek_` 后接 48 个字符。你最多可以同时持有十个。

> **API 密钥与 MCP 令牌不可互换。** 它们位于同一个界面，但打开的是不同的门：[MCP 令牌](MCP-Setup) 驱动每一个助手工具，API 密钥则通过 HTTP 读取旅行。种类错误的密钥会被完全像不存在的密钥一样拒绝。请铸造对方软件所要求的那种。

要撤销访问，删除该密钥即可。它立即失效，任何使用它的东西会在下一次请求时得到 401。

## 使用它

把密钥作为 bearer 令牌发送：

```bash
curl -H "Authorization: Bearer trek_your_key_here" \
     https://tt.example.com/api/v1/trips
```

或者，如果你正在配置的软件期望一个以 API 密钥命名的头：

```bash
curl -H "X-API-Key: trek_your_key_here" \
     https://tt.example.com/api/v1/trips
```

两者等价。对方支持哪种就用哪种。

## 端点

### `GET /api/v1/trips`

你能访问的每一次旅行，最新的在前，不含行程详情。

```json
{
  "trips": [
    {
      "id": 12,
      "title": "Tuscany",
      "description": "Wine and hill towns",
      "start_date": "2026-06-14",
      "end_date": "2026-06-22",
      "currency": "EUR",
      "archived": false,
      "updated_at": "2026-06-01 10:00:00"
    }
  ]
}
```

`updated_at` 在旅行**自身**的字段变化时变动 —— 标题、日期、货币、封面。地点、日程或备注被编辑时它**不会**变动。不要用它来决定是否重新拉取；你会错过每一次行程改动。请改为比较载荷。

### `GET /api/v1/trips/{id}`

一次旅行及其内容。如果该旅行不存在*或*不属于你，返回 **404** —— 两者被刻意设计成无法区分，因此该端点不能用来探知哪些行程 id 存在。

用 `?include=` 挑选你需要的部分，以逗号分隔：

| 分区 | 它添加什么 |
|---|---|
| `days` | 行程的骨架：每天一条，含 `date`、`day_number`、`title`、`notes` |
| `places` | 每天的地点，**按计划顺序排列**，含坐标、时间、时长、分类和交通方式 |
| `notes` | 某一天上带时间的自由文本备注 |
| `reservations` | 预订，挂在其起始日上：类型、标题、地点、时间、状态 |
| `accommodations` | 你住哪里，含解析出的日期范围和入住/退房时间 |
| `travellers` | 谁在这次旅行中，按显示名列出 |

有两个分区在旅行层级而不是逐日返回，因为它们本来就属于那里：

| 字段 | 随什么返回 | 它是什么 |
|---|---|---|
| `unplanned_places` | `places` | 已收集但尚未排入日程的地点。在真实实例上，这些通常占到一次旅行地点的**一半**，而且它们携带坐标。酒店不列在这里；它在 `accommodations` 下。 |
| `unscheduled_reservations` | `reservations` | 没有归属日的预订。删除某一天会解除其预订的关联而不是删除它们，因此这些在现实中确实存在。 |

请求 `places`、`notes` 或 `reservations` 会自动带上 `days`，因为那些内容是在日程上报告的。`?include=notes` 返回带备注和空地点列表的日程骨架，而不是一次空旅行。

省略 `include` 会返回全部内容。你没有请求的分区是**缺席**而不是空，因此你的代码可以区分「未请求」和「那里没有东西」。未知的分区名会得到 `400` 而不是被静默忽略 —— 一个笔误不应该悄悄交给你一个缺失所需内容的载荷。

```bash
# only the notes, for a lightweight sync
curl -H "Authorization: Bearer trek_…" \
     "https://tt.example.com/api/v1/trips/12?include=days,notes"
```

```json
{
  "id": 12,
  "title": "Tuscany",
  "start_date": "2026-06-14",
  "days": [
    {
      "date": "2026-06-14",
      "day_number": 1,
      "title": "Arrival",
      "notes": null,
      "places": [
        {
          "name": "Uffizi",
          "address": "Florence",
          "lat": 43.76, "lng": 11.25,
          "time": "14:00", "end_time": null,
          "duration_minutes": 180,
          "category": "Museum",
          "notes": null,
          "transport_mode": "walking"
        }
      ],
      "day_notes": [{ "text": "Bring the tickets", "time": "09:00" }],
      "reservations": [
        { "type": "flight", "title": "LH 1234", "location": "FRA",
          "time": "2026-06-14T08:00", "end_time": null,
          "status": "confirmed", "notes": null }
      ]
    }
  ],
  "accommodations": [
    { "name": "Hotel Alba", "address": null, "lat": null, "lng": null,
      "start_date": "2026-06-14", "end_date": "2026-06-15",
      "check_in": "15:00", "check_out": "11:00", "notes": null }
  ],
  "travellers": [{ "name": "ada", "owner": true }, { "name": "bob", "owner": false }]
}
```

### `GET /api/v1/bucket-list`

调用者想去但未与任何旅行绑定的地点。它有自己独立的端点，因为它挂在用户上，而不是旅行上。

```json
{
  "items": [
    { "name": "Hokkaido", "lat": 43.06, "lng": 141.35,
      "country_code": "JP", "notes": "in winter", "target_date": "2027-02-01" }
  ]
}
```

`target_date` 是一个愿望，不是一次预订。无论是否开启足迹扩展，条目都会返回：扩展管的是 Tourism-Team 是否展示该功能，而不是那些行是否存在，而一个答案会随无关开关变动而改变的端点，是没有人能建立在它之上的。

### `GET /api/v1/stats`

仪表盘用的总计。为 Homepage 的 `customapi` 之类的小组件而构建 —— 它们从一次请求渲染几个数字，自己无法聚合一个列表。

```json
{
  "total_trips": 12,
  "total_countries": 23,
  "total_cities": 41,
  "total_places": 143,
  "total_days": 87,
  "total_distance_km": 84213,
  "last_trip": {
    "title": "Hokkaido in winter",
    "start_date": "2026-02-03",
    "end_date": "2026-02-14",
    "country": "JP",
    "countries": ["JP"]
  }
}
```

这些数字与 Tourism-Team 自己的仪表盘所展示的相同，来自同一数据源 —— 一个小组件无法与它旁边的护照卡片互相矛盾。特别是 `total_countries` 遵循 Tourism-Team 对*已访问*的定义：仅靠航班或火车到达的国家算数，中转不算，而在足迹中手工隐藏的国家仍然隐藏。

`last_trip` 是最近一次**已经开始**的旅行 —— 为明年预订的旅行不算你去过的 —— 当每一次旅行都还没到时为 `null`。`country` 是其地点大多所在的国家，也是 `countries` 的首项，后者为一个跨过边境的旅行列出全部国家。对于一个地点从未做过地理编码的旅行，两者为空或 `null`。

于是 Homepage 小组件无需任何脚本：

```yaml
- Tourism-Team:
    icon: mdi-map-marker-path
    widget:
      type: customapi
      url: https://tt.example.com/api/v1/stats
      headers:
        X-API-Key: trek_your_key_here
      mappings:
        - field: total_trips
          label: Trips
        - field: total_countries
          label: Countries
        - field: total_cities
          label: Cities
        - field: last_trip.country
          label: Last
```

## 给集成方的说明

**按日期关联，不要按 id。** 每一天都携带一个 ISO `date`，住宿携带的是解析出的日期范围而不是内部日程 id。如果你的软件对旅行的理解自成一套，日期是双方唯一能达成一致的东西。Tourism-Team 的内部 id 按设计根本不在载荷里 —— 它们会把你绑死在可以自由改变的存储细节上。

**一次请求，而不是很多次。** 与其为每个分区设单独端点，`?include=` 让你在一次调用中恰好取回所需内容。为四个分区把一次旅行拉取四遍，只会白白烧掉你的配额。

**没有时区。** 时间的存储和返回与旅行者输入时完全一致：`14:00` 就是当地下午两点，无论他们身在何处。如果你要与你自己的时间戳做匹配，旅行的日期才是可靠的关联；时间只是提示，不是 UTC 瞬间。

**限流：每分钟 120 次请求**，按用户而不是按 IP 地址计数。一个自托管集成和它所有者的浏览器常常共享同一个地址，而基于 IP 的限制会让一个饿死另一个。超出时返回 `429`；请退避后重试。

**错误**是带 `error` 字段的 JSON：

| 状态 | 含义 |
|---|---|
| `400` | 行程 id 格式错误，或未知的 `include` 分区 |
| `401` | 密钥缺失、格式错误或未知 —— 种类错误的密钥也会得到这个 |
| `404` | 没有该旅行，或它不属于你 |
| `429` | 超出限流 |

**版本管理。** `/api/v1` 可能新增字段；它不会删掉字段或改变其类型。破坏性变更以 `/api/v2` 发布，两者在过渡期内并行运行。请让你的客户端忽略它不认识的字段。

## 目前还没有的内容

- **写入。** 目前只读。写入访问需要按权限范围强制执行，而这个接口没有实现它，而一把只读取的密钥发出去要安全得多。
- **增量同步。** 没有 `?since=` 筛选，因为 Tourism-Team 目前还无法如实回答它 —— 子记录不携带修改时间戳，所以对 `updated_at` 做筛选会悄然隐藏掉行程已改变的旅行。请拉取列表并做比较。
- **Webhook。** 没有任何推送；请以合理的间隔轮询。

如果你正在构建某个东西而被其中某一项卡住，请开一个讨论 —— 这个接口意在围绕真实集成生长，而不是走在它们前面。

## 另见

- [MCP 概览](MCP-Overview) —— 另一个面向机器的接口，供 AI 助手使用
- [日历订阅](Calendar-Feeds) —— 让日历应用订阅一次旅行
- [管理：MCP 访问](Admin-MCP-Tokens) —— 已签发令牌的实例级视图
