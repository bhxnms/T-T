# 插件权限

插件在 `trek-plugin.json` 中声明它需要的权限。你**在安装之前**就要审查这份
清单 —— 在「发现」下该插件的卡片上 —— 而它只有在你打开开关之后才会运行。由于插件运行在
一个隔离的进程中，**未授予的能力在物理上就不可达**，而不只是不被允许。隔离模型见
[[插件|Plugins]]。

## 权限参考

| 权限 | 授予 | 说明 |
|---|---|---|
| `db:own` | 通过 `ctx.db` 读写插件**自己的** SQLite 文件 —— `db.query`、`db.exec`，**以及 `db.migrate`** | 每个插件在它自己的数据目录下有一个单独的 `plugin.db` —— 绝不是 Tourism-Team 自己的 `travel.db`。`db.migrate` 运行一次带键、幂等的迁移（建 schema/建表，例如 `CREATE TABLE`），每个 id 只运行一次。`ATTACH`/`DETACH`/`VACUUM`/`PRAGMA` 会被拒绝。 |
| `db:read:trips` | 通过 `ctx.trips`（`getById`、`getPlaces`、`getReservations`、`getDays`、`getAccommodations`、`listMine`、`members`）只读旅行数据 | 每次调用都会针对操作用户做**成员校验** —— 插件读不到该用户看不到的旅行。`getDays` 返回每一天及其 `assignments` + `notes_items`；`getReservations` 的行像 REST 列表一样携带 `endpoints` + `day_positions`。`members` 返回成员名单（仅 id + 显示字段）。 |
| `db:read:users` | 通过 `ctx.users.getById` 只读公开个人资料 | 只返回 id、用户名、显示名、头像 —— **绝不**返回密码哈希、令牌或机密。 |
| `db:read:packing` | 通过 `ctx.packing.list(tripId)` 只读某次旅行的行李清单项 | 做成员校验，并限定在操作用户的可见范围内 —— 插件永远看不到另一位成员的私有行李项。 |
| `db:read:files` | 通过 `ctx.files.list(tripId)` 只读某次旅行的文件 | 做成员校验；已放入回收站的文件被排除。 |
| `db:read:files:content` | 通过 `ctx.files.getContent(tripId, fileId)` 读取文件的**字节内容**（base64） | 做成员校验；上限 10MB，已放入回收站的文件被拒绝。这是刻意从 `db:read:files` 中拆出来的 —— 列出元数据永远不会暴露内容。 |
| `db:read:costs` | 通过 `ctx.costs`（`getByTrip`、`listMine`）只读费用（预算项） | 做成员校验；需要启用费用扩展。 |
| `db:read:collab` | 通过 `ctx.collab`（`listNotes`、`listPolls`、`listMessages`）读取某次旅行的协作笔记、投票和聊天 | 做成员校验；需要协作扩展。`listMessages` 返回最新的 100 条（最早的在前），用 `before` 向前翻页。 |
| `db:read:journal` | 通过 `ctx.journal.listMine` 读取操作用户自己的旅行日志 | 以用户为范围（跨其所有旅行）；需要旅程扩展。 |
| `db:read:atlas` | 通过 `ctx.atlas.visited` 读取操作用户已访问的国家 + 地区 | 以用户为范围；需要足迹扩展。 |
| `db:read:vacay` | 通过 `ctx.vacay.mine` 读取操作用户的假期计划 | 以用户为范围；需要假期扩展。 |
| `db:read:daynotes` | 通过 `ctx.daynotes.list(tripId, dayId)` 读取某旅行日程的备注 | 做成员校验（以旅行为范围）。 |
| `db:read:collections` | 通过 `ctx.collections`（`listMine`、`get`）读取操作用户已保存地点的收藏 | 以用户为范围；需要收藏扩展。 |
| `db:read:categories` | 通过 `ctx.categories.list()` 读取全局地点分类列表 | 只读的参考数据；不含租户数据。 |
| `db:read:tags` | 通过 `ctx.tags.list()` 读取操作用户自己的标签 | 以用户为范围（不是以旅行为范围）；拒绝无用户上下文。 |
| `db:read:todos` | 通过 `ctx.todos.list(tripId)` 读取某次旅行的待办事项 | 做成员校验（以旅行为范围）。 |
| `weather:read` | 通过 `ctx.weather.get(lat, lng, date?)` 读取主机缓存的预报 | 对主机缓存的免租户读取；不需要用户。 |
| `rates:read` | 通过 `ctx.rates.get(base)` 读取主机缓存的货币汇率 | 对主机缓存的免租户读取（一个相对于 `base` 的报价 → 汇率映射）；上游失败时返回 `null`。 |
| `db:write:costs` | 通过 `ctx.costs.create` / `update` / `delete` 创建/更新/删除费用 | 旅行访问权 **+** `budget_edit` 权限 **+** 费用扩展。 |
| `db:write:places` | 通过 `ctx.places` 创建/更新/删除地点 | 旅行访问权 **+** `place_edit` 权限。输入会按 Tourism-Team 的 schema 校验；每次写入都被审计。 |
| `db:write:days` | 通过 `ctx.days` 创建/更新/删除日程 | 旅行访问权 **+** `day_edit` 权限。 |
| `db:write:itinerary` | 通过 `ctx.itinerary` 在日程中分配/移除地点 | 旅行访问权 **+** `day_edit` 权限（它属于日程编辑）。 |
| `db:write:trips` | 通过 `ctx.trips.update` 更新旅行详情 | 旅行访问权 **+** `trip_edit`。仅限 schema 可写字段；**归档**另外需要 `trip_archive`，而 **cover_image** 需要 `trip_cover_upload`（与 Web 界面相同的划分）。 |
| `db:create:trips` | 通过 `ctx.trips.create(input)` 创建**归操作用户所有的新旅行** | 操作用户需要应用的 `trip_create` 权利，且必须绑定用户（任务无法创建旅行）。`title` 为必填；输入会按 Tourism-Team 的旅行 schema 校验。它解锁了导入器（Google MyMaps、预订数据转储、日历同步）。 |
| `db:write:reservations` | 通过 `ctx.reservations` 创建/更新/删除预订 | 旅行访问权 **+** `reservation_edit`。与应用的完全对等 —— 住宿、预算同步、预订通知和 `reservation:*` 广播都会像在 Web 界面中一样触发。交通预订接受一个 `endpoints` 数组（from/to/stop 各段带名称 + 坐标）；更新时省略该字段会保留它们，用 `[]` 则全部删除。 |
| `db:write:accommodations` | 通过 `ctx.accommodations` 创建/更新/删除住宿区块（`day_accommodations`） | 旅行访问权 **+** `day_edit`（住宿属于日程服务 —— 与 REST 路径相同的门槛，而*不是* `reservation_edit`）。创建一个住宿会自动创建其配对的酒店预订；删除会级联删除关联的预订/预算行，广播也包含在内。 |
| `db:write:daynotes` | 通过 `ctx.daynotes` 创建/更新/删除每日备注 | 旅行访问权 **+** `day_edit`；广播 `dayNote:*`。 |
| `db:write:packing` | 通过 `ctx.packing` 创建/更新/删除行李项 **+ 行李**（items + `listBags`/`createBag`/`updateBag`/`deleteBag`/`setBagMembers`） | 旅行访问权 **+** `packing_edit`。对行李项复现了 #858 的隐私模型：**私有**项的事件只到达其所有者（+ 接收者），绝不发往整个旅行房间。行李不携带隐私属性。 |
| `db:write:tags` | 通过 `ctx.tags` 创建/编辑/删除操作用户自己的标签 | 以用户为范围；每次写入前都会重新检查归属。 |
| `db:write:atlas` | 通过 `ctx.atlas` 标记/取消标记已访问的国家 + 地区并管理愿望清单 | 所有行都是**操作用户自己的** —— 不以旅行为范围，没有跨租户表面。需要足迹扩展；解锁例如 AirTrail 风格的双向同步。 |
| `db:write:vacay` | 通过 `ctx.vacay` 切换休假日 + 公司假期 | 计划**在主机侧根据操作用户的活动计划**解析 —— 插件永远无法指定另一个计划；`toggleEntry` 只切换操作用户自己的一天。需要假期扩展。 |
| `db:write:journal` | 通过 `ctx.journal` 创建/编辑/删除日志条目、**向它们附加照片**、**以及创建/删除整个日志**（`createEntry`/`updateEntry`/`deleteEntry`/`addEntryPhoto` 以及 `createJourney`/`deleteJourney`） | 条目写入会经过旅程领域服务的 `canEdit`：日志的所有者，或角色为 `editor`/`owner` 的贡献者 —— 角色为 `viewer` 的贡献者会被拒绝。`createJourney` 没有日志级门槛（此时还没有日志）；它总是创建一个**归操作用户所有的新日志**，导入器正是靠它来初始化随后要填充的日志。`deleteJourney` 是**仅限所有者**（`isOwner`），而不是 `canEdit` —— 贡献者即使身为编辑者也不能删除日志。`addEntryPhoto` 接收字节本身，供那些持有导出归档、没有可指向的相册照片的导入器使用：仅限图片、不允许 SVG、解码后 10 MB、存储的文件名由主机决定，且运营者的允许文件类型设置与上传表单完全一致地生效。每次调用都需要绑定的操作用户（无用户的任务会被拒绝）以及旅程扩展。 |
| `db:write:collections` | 通过 `ctx.collections` 创建/编辑收藏、保存地点、复制到旅行 | 服务自身强制执行操作用户的**每收藏角色**（owner/admin/editor）。需要收藏扩展。 |
| `db:write:files` | 通过 `ctx.files`（`create`、`createLink`、`update`、`softDelete`）附加文件 + 管理链接 | 旅行访问权分别 **+** 应用的 `file_upload`/`file_edit`/`file_delete` 权利。内容以 base64 传入（上限 10MB）；扩展名在落盘前会对照中央黑名单校验；链接目标必须位于同一次旅行上。 |
| `db:write:collab` | 通过 `ctx.collab` 发布笔记、投票和聊天消息 | 旅行访问权 **+** `collab_edit`；需要协作扩展。广播与应用相同的 `collab:*` 事件。 |
| `db:write:members` | 通过 `ctx.trips.addMember` / `removeMember` 在旅行中添加/移除用户 | **授予（并撤销）旅行访问权** —— 刻意作为应用 `member_manage` 权利之后的一项独立权限（默认：仅旅行所有者），绝不与风险更低的写入捆绑。操作用户会被记录为邀请人；所有者永远无法被移除。 |
| `db:write:todos` | 通过 `ctx.todos` 创建/编辑/删除某次旅行的待办事项 | 旅行访问权 **+** `packing_edit`（应用对待办事项的门槛也是这一权利）。 |
| `db:meta` | 通过 `ctx.meta` 在旅行/地点/日程/**预订**/**住宿**上存储插件**自己的**私有键值数据 | 按插件命名空间隔离（插件只能看到自己的行）。读取需要旅行**访问权**；**写入**另外需要该实体的编辑权限（`trip_edit`/`place_edit`/`day_edit`；预订用 `reservation_edit`，住宿用 `day_edit`）。这是外部 ID 映射（AirTrail/日历/预订导入同步）的天然归宿，而不必分叉 schema。配额：键 ≤256 字符、值 ≤64 KB、每个实体 ≤100 个键。卸载并删除数据时会被清除。 |
| `ws:broadcast:trip` | 通过 `ctx.ws.broadcastToTrip` 向某个旅行房间推送实时事件 | 事件类型被强制命名空间为 `plugin:<id>:<event>` —— 插件无法伪造核心事件。 |
| `ws:broadcast:user` | 向某个用户的连接推送实时事件 | 相同的命名空间规则。 |
| `notify:send` | 通过 `ctx.notify.send` 发送一条持久化通知（铃铛收件箱 + 邮件/ntfy/webhook 扇出） | 由主机中转：主机负责收件人解析、渠道扇出和按用户的偏好设置。收件人被**强制**为操作用户（`scope:'user'`，`targetId` = 操作用户）或他所属的某次旅行（`scope:'trip'`）；`scope:'admin'` 会被拒绝。插件只提供纯文本的标题/正文（上限 200/1000）+ 一个可选的站内 `link`（必须是相对的 `/…` 路径 —— 防开放重定向）。不能指定任意收件人，不能冒充他人。有预算限制：每个插件每天 100 次发送，按 UTC 午夜重置。 |
| `oauth:client` | 通过 `ctx.oauth.getAccessToken()` 成为第三方服务的 OAuth *客户端* | 由主机代理：主机运行整个流程（authorize→callback→token→refresh），带 **PKCE + state**，并且**持有令牌** —— 客户端密钥 + 刷新令牌永远不会离开主机。提供方配置（`oauth_authorize_url`/`oauth_token_url`/`oauth_scopes` 以及机密 `oauth_client_id`/`oauth_client_secret`）是插件的**管理员拥有的实例设置**；端点必须是 **https**（SSRF 兜底）。每个用户在**设置 → 插件**下连接；令牌按用户隔离并静态加密。插件始终只能拿到针对操作用户的**短时效访问令牌**。 |
| `ai:invoke` | 通过 `ctx.ai.complete` / `ctx.ai.extract` 运行管理员/用户配置的 LLM | 由主机中转：主机持有（加密的）凭据，并在操作用户解析出的提供方下运行该调用 —— 插件永远看不到密钥。未配置提供方时会被拒绝；提示词/文本上限为 20 000 字符。输出是**数据** —— `complete` 返回 `{ text }`，`extract` 按你的 JSON schema 返回 `{ results }` —— 并且绝不会被自动写入，因此提示词注入无法在你自己的受门控调用之外触达写入。有预算限制：每个插件每天 200 次调用，按 UTC 午夜重置。 |
| `events:subscribe` | 通过插件定义上的 `events: [{ on, handler }]` 响应核心活动 | 处理函数拿到**事件名 + tripId + 一个 `{ entity, entityId }` 提示**，另外**当插件同时持有该家族的 `db:read:*` 授权时，还会拿到变更实体的白名单 `snapshot`**（按插件在投递时过滤 —— 没有授权就没有字段）。它以**无用户**身份运行（像一个任务），因此除快照之外什么都读不到。白名单绝不携带用户 ID、私有行李项（#858）或机密；删除/批量/重排事件不携带快照，非实体 ID（例如 userId）永远不会浮现。以短超时即发即弃；`plugin:*` 的再广播永远不会被投递回来。 |
| `jobs:run` | 按各自的 cron 计划运行插件声明的后台 `jobs`，**并**通过 `ctx.scheduler`（`at`/`in`/`every`/`cancel`）运行其运行时定时器 | **需明确选择加入。** 计划任务以**无用户**身份运行（其旅行读取会被拒绝），因此任务只能触及它自己的 `ctx.db` 和已声明的出站。无效的 cron 表达式会被跳过；插件被停用时任务停止。`ctx.scheduler` 任务会被持久化（重启后仍在），每个插件上限 100 个、载荷 8 KB、循环最小间隔 60 秒，并在卸载时移除。 |
| `hook:photo-provider` | 在照片中注册为照片来源 | 实现 `PhotoProvider` 接口。 |
| `hook:calendar-source` | 注册为日历来源 | 实现 `CalendarSource` 接口。 |
| `hook:place-detail-provider` | 通过 `hooks.placeDetailProvider` 提供方钩子为地点贡献额外详情（评论、评分、链接） | 在插件定义的 `hooks` 上（而不是 `ctx` 上）实现 `PlaceDetailProvider` —— 显示在地点详情面板中；也暴露在 `GET /api/place-details/:placeId`。 |
| `hook:trip-warning-provider` | 通过 `hooks.warningProvider` 提供方钩子对旅行发出校验警告 | 在插件定义的 `hooks` 上（而不是 `ctx` 上）实现 `WarningProvider` —— 在规划器中显示为一条非阻断横幅；也暴露在 `GET /api/trip-warnings/:tripId`，并以 `get_trip_warnings` MCP 工具的形式提供给已连接的助手（每个提供方 ≤20 条警告，消息 ≤300 字符）—— 那条路径只需要旅行读取权限范围，不需要 `plugins:use`。 |
| `hook:map-marker-provider` | 通过 `hooks.mapMarkerProvider` 提供方钩子在旅行地图上叠加有边界的**标记** | 在 `hooks` 中实现 `MapMarkerProvider` —— 返回 `{id, lat, lng, label?, popupText?, url?, icon?, tone?}[]`（#587「在地图上显示预订」）。**仅声明式** —— 插件 JS 从不在地图画布上运行。主机会对坐标做范围检查（−90..90 / −180..180）、把文本 String 化并限制长度、把弹窗 URL 列入允许清单（http/https/mailto），并限制每个插件的标记数量（≤200）；失败的提供方会被跳过。暴露在 `GET /api/map-markers/:tripId`。 |
| `hook:map-layer-provider` | 通过 `hooks.mapLayerProvider` 提供方钩子在旅行地图上叠加有边界的**矢量图层**（折线、多边形、米制圆） | 在 `hooks` 中实现 `MapLayerProvider` —— 返回 `{id, name?, features}[]`，其中 feature 为 `{type, points?/center?+radiusM?, tone?, width?, dash?, opacity?, fill?, label?}`。**仅声明式** —— 所有绘制都由主机完成；样式只有色调调色板加上被钳制的数值（宽度 1–8、不透明度 0.05–1、半径 ≤2000 km）和一个虚线枚举，因此图层无法冒充核心 UI。每个插件的预算：≤4 个图层 / ≤150 个 feature / ≤8000 个顶点 / 每个形状 ≤2000 个顶点；无效或超大的形状会整体丢弃（绝不截断）；失败的提供方会被跳过。绘制在 Tourism-Team 自己的路线之下。暴露在 `GET /api/map-layers/:tripId`。 |
| `hook:route-provider` | 通过 `hooks.routeProvider` 提供方钩子提供规划器路线开关可用来规划日程的**路线方案** | 在 `hooks` 中实现 `RouteProvider`，并在 `capabilities.routeProfiles` 中声明方案（最多 3 个；每个为 `{id, label, icon?}`）。Tourism-Team 会针对用户所选的那个确切方案调用 `getRoute({tripId, dayId, profile, waypoints})` —— 这是**定向调用**，不是扇出 —— 超时 20 秒，使插件能通过其声明的出站调用外部求解器。结果（`coordinates`、`distance`、`duration`、`legs`、`viaPoints?`）整体校验（路段数必须等于 `waypoints−1`、≤10000 个顶点、≤40 个途经点）；任何格式错误的内容都会被丢弃，规划器回退到直线。暴露在 `POST /api/plugin-routes/:pluginId/:profileId`（按旅行做成员门控）。 |
| `hook:day-schedule-provider` | 通过 `hooks.dayScheduleProvider` 提供方钩子向日程计划附加**时间贡献** | 在 `hooks` 中实现 `DayScheduleProvider` —— 返回 `{id, dayId, assignmentId?/reservationId?/position?, minutes?, label, tone?}[]`。这些行在桌面端和移动端渲染于其锚点之下（一个地点/预订行，或某天的起点/终点），而 `minutes` 会被**折算进当天的路线页脚总计** —— 这是唯一一个输出会进入所显示时间的钩子，正因如此分钟数被钳制（1–1440），且 `dayId` 会对照该旅行自己的日程校验。每个插件 ≤60 个条目，标签经过净化 + 限长（≤120）；失败的提供方会被跳过。暴露在 `GET /api/day-schedule/:tripId`。 |
| `hook:day-tint-provider` | 通过 `hooks.dayTintProvider` 提供方钩子在日程计划中为**整天**着色 | 在 `hooks` 中实现 `DayTintProvider` —— 返回 `{dayId, tone?, color?, badgeTone?, badgeColor?, headerTone?, headerColor?, activityTone?, activityColor?, label?}[]`，每个你想着色的日程一个条目。一张日程卡片有**三个可分别着色的区域** —— 日号徽章（同时也是移动端的日程胶囊）、标题行，以及展开的活动列表 —— 因此你可以大胆地在徽章上标记某种行程段，同时让密集的活动列表保持素净。`tone` / `color` 是简写，会给每个你没有点名的区域上色；两者都省略时，只有你点名的区域会被着色，其余区域的渲染与你没有安装该插件时完全一致。一个什么都不会被着色的条目 —— 没有点名任何区域，也没有可用的简写 —— 仍然意味着「给这一天着色」，因此三个区域都会回退到 `default` 色调。用调色板色调或你自己的颜色为一个区域上色 —— **仅限 `#rrggbb`**，因为该值最终会进入主机构建的某个 CSS 颜色中；在一个区域内颜色优先于色调，而区域自己的取值优先于简写。**你选择色相，主机选择权重**：主机按主题和区域设置 alpha（密集文本背后的大面积表面会比小徽章得到更淡的色调），并把你的颜色亮度钳制到一个在浅色和深色侧边栏中都可读的区间内，因此任何贡献都无法交给用户一张读不了的日程卡片。被着色的标题在悬停时会加深为自身颜色的更浓混合，而不是失去颜色。`dayId` 会对照该旅行自己的日程校验，`label`（≤60）成为该日程的提示文字，原始数组在 2000 处截断。**一天最多接受一份贡献，并且整体解析**：在同一个提供方的列表中，某天的第一个条目胜出；跨插件时，第一个被授权的提供方胜出 —— 因此一天不会在颜色之间闪烁，落败的插件也无法填充胜出者未着色的区域。与 `hook:day-schedule-provider` 不同，这里没有固定的条目上限；边界就是旅行的日程数量，这正是它能在六个月行程上可用的原因。失败的提供方会被跳过。暴露在 `GET /api/day-tints/:tripId`。 |
| `geolocation:read` | 从插件沙箱化的框架中向主机索取浏览器的实时位置（`window.trek.geolocation`） | 一项**桥接层**权限 —— 它不解锁任何 ctx RPC 方法。沙箱本身永远不获得地理位置 API：宿主页面读取 `navigator.geolocation`（浏览器自己的站点权限提示仍然适用），并通过 postMessage 把纯 `{lat, lng, accuracy, heading, speed, timestamp}` 数据投递到框架中。`get()` 解析出一次定位；`watch(cb)` 持续流式推送更新直到取消订阅，而框架关闭时主机会强制停止 GPS 监视。没有任何内容被发送到服务器 —— 位置只有在插件自己的客户端通过它的某条路由发送时才会到达插件的服务端代码（在该路由的流量中像任何其他调用一样可见）。 |
| `hook:table-contributor` | 通过 `hooks.tableContributor` 提供方钩子向原生规划器视图贡献由主机渲染的**列/操作** | 在 `hooks` 中实现 `TableContributor` —— 返回按 `entityId` 键控的声明式列/操作叶子节点（绝不是标记）。主机会规范化并约束每个字段（长度上限、仅 `http`/`https`/`mailto` 的 URL、枚举化的色调/目标），并把它们渲染在预订、交通、地点、日程、费用、行李、文件和待办事项视图中；一个操作会打开你的沙箱化框架或调用你的某条路由。也暴露在 `GET /api/view-contributions/:view/:tripId`。 |
| `hook:pdf-section-provider` | 通过 `hooks.pdfSectionProvider` 提供方钩子向旅行 PDF 导出追加纯文本**段落** | 在 `hooks` 中实现 `PdfSectionProvider` —— 返回 `{title, paragraphs?, table?}[]`，全部为纯字符串，由导出功能自行转义并排版；任何标记都不会进入文档。主机会限制段落/段落内容/表头/行数（≤5/≤20/≤8/≤50）以及每个字符串的长度，并把表格行裁剪到表头宽度；失败的提供方会被跳过。暴露在 `GET /api/pdf-sections/:tripId`。 |
| `hook:atlas-layer-provider` | 通过 `hooks.atlasLayerProvider` 提供方钩子在足迹世界地图上绘制国家**色调层** | 在 `hooks` 中实现 `AtlasLayerProvider` —— 为**操作用户**返回 `{id, name?, countries: [{code, tone?, label?}]}[]`（该钩子不接受目标参数，因此插件无法索取别人的地图）。代码必须是 ISO-3166 alpha-2（强制大写，其他一律丢弃），色调是枚举白名单，数量受限（≤3 个图层，每个 ≤300 个国家）。**仅声明式** —— 插件 JS 从不在地图画布上运行。暴露在 `GET /api/atlas-layers`。 |
| `hook:journal-entry-provider` | 通过 `hooks.journalEntryProvider` 提供方钩子在日志条目下贡献额外**行** | 在 `hooks` 中实现 `JournalEntryProvider` —— 每个条目返回 `{label, value?, url?}[]`，渲染在条目卡片之下。该条目所属的旅程会针对操作用户做访问校验（所有者/贡献者，与日志详情路由一致），并且必须开启旅程扩展。主机会限制行数（≤12）+ 长度（label 60、value 200）并把 URL 列入允许清单（http/https/mailto）；失败的提供方会被跳过。暴露在 `GET /api/journal-entry-rows/:entryId`。 |
| `hook:trip-card-provider` | 通过 `hooks.tripCardProvider` 提供方钩子向仪表盘的旅行卡片添加小**徽章** | 在 `hooks` 中实现 `TripCardProvider` —— `getCards(tripIds, ctx)` 会以用户仪表盘上当前的所有旅行卡片一次性调用（每张都已针对操作用户做过访问校验），返回 `{tripId, id, label, value?, icon?, tone?, url?}[]`。**仅声明式** —— 插件 JS 从不在仪表盘上运行。主机会把每个字段 String 化 + 限制长度、把色调列入枚举白名单、把 URL 列入允许清单（http/https/mailto）、限制数量（每次旅行 ≤4 个徽章，每个插件总计 ≤240 个），并丢弃任何 `tripId` 不是仪表盘所询问的徽章；失败的提供方会被跳过。暴露在 `GET /api/trip-card-contributions?tripIds=…`。 |
| `hook:notification-channel` | 通过 `hooks.notificationChannel` 提供方钩子注册一个新的**通知渠道**（Gotify、Pushover 等） | 在 `hooks` 中实现 `NotificationChannel` —— `send(msg, config, ctx)` 接收一条 Tourism-Team **已经渲染好**、使用收件人语言的通知（`{event, title, body, url?, tripName?}`），外加该收件人自己已解密的 `scope:'user'` 设置作为 `config`。与其他所有钩子不同，这一个是由**主机为任意收件人发起**的，因此它以**无用户**方式运行：`ctx.settings.get()` 返回 `undefined`，旅行读取被拒绝 —— 收件人的凭据之所以以 `config` 形式到达，正是为了让插件永远不获得*以他们身份*读取任何内容的权利。可选的 `test(config, ctx)` 支撑「发送测试」按钮。用 `capabilities.notificationChannel: { title?, events? }` 声明该渠道；`title` 是偏好设置矩阵中的列名（默认：插件名称），而 `events` 可以**收窄**它携带哪些事件（默认：所有非管理员事件 —— 管理员范围的事件永远不会投递给插件）。失败时请抛出异常：主机会记录并隔离它，因此一个失效的渠道无法阻止其他渠道。 |
| `hook:user-data` | 通过 `deleteUserData` / `exportUserData` 处理函数履行 GDPR **数据主体权利** —— 擦除并导出插件存储的关于某个用户的数据 | 在插件定义上（而不是 `ctx` 上）实现 `deleteUserData({userId}, ctx)` 和/或 `exportUserData({userId}, ctx)`。两者都是**无用户**的（没有操作用户；插件只得知 `userId` 并触及它自己的数据库）。当某个 Tourism-Team 账户被删除时，主机为每个持有该授权的插件排队一次擦除，并**持久地**重试直到插件确认（ACK）—— 即使跨重启也如此 —— 因此 `deleteUserData` 请实现为幂等的。`exportUserData` 返回一个可 JSON 序列化的值，主机为管理员把它汇总到 `GET /api/admin/plugins/user-data/:userId/export`。 |
| `mcp:tools` | 通过 `hooks.mcpToolProvider` 提供方钩子在 Tourism-Team 自己的 MCP 服务器上发布 **MCP 工具** | 在 `capabilities.mcpTools` 中声明工具（≤8 个；名称、必填的描述、可选的 JSON-Schema `inputSchema` + MCP 注解），并在 `hooks` 中实现 `mcpToolProvider` —— `tools: string[]` 加上一个适用于它们全部的 `callTool({name, args}, ctx)`。只有清单声明与 `tools` 数组的**交集**会被宣传（静默进行 —— 请保持两个列表一致），每个都以 `plugin_<id>_<name>` 的形式提供给持有需明确选择加入的 `plugins:use` OAuth 权限范围的助手。`callTool` 以**发起请求的 MCP 用户**身份运行（类似路由；读取做成员校验，超时 15 秒），而该授权本身不解锁任何 `ctx` 方法 —— 工具能做什么由插件的其他授权决定。参数会在插件运行前按声明的 schema 校验；结果受限（64 KiB / 32 个块）且每个字符串都被净化；注解提示会对照插件的授权做钳制（`readOnlyHint` 只能降低，任何 `http:outbound*` 都会强制 `openWorldHint` 为 true）。任何生命周期/授权变化都会关闭现存 MCP 会话，使该表面被重新宣传。这是唯一一个不叫 `hook:*` 的钩子权限。 |
| `http:outbound` / `http:outbound:<host>` | 发出出站网络请求 | **要求**一个非空的 `egress[]` —— 除非清单设置了 `operatorEgress: true`。只有**按主机**的 `http:outbound:<host>` 才会在运行时真正打开某台主机 —— 见下文。 |

## 出站网络 —— `http:outbound` 与 `http:outbound:<host>`

这是唯一一个值得读两遍、有其微妙之处的权限。

有两道相互独立的防护限制插件的网络，而且**两者都由你授予的
`http:outbound:<host>` 权限构建 —— 而不是由 `egress[]` 数组构建**：

- 沙箱化子进程内部的**运行时出站防护**（任何连接到
  不在允许清单上的主机都会被拒绝），以及
- 插件 iframe 的 **CSP `connect-src`**（客户端只能抓取同样的
  那些主机）。

`egress[]` 是一份**单独的声明**：清单校验器会检查它的形状，
但绝不会把它与你授予的 `http:outbound:<host>` 权限做交叉核对。它强制执行的规则很窄：

- 只接受上面列出的那些权限；未知的字符串会导致校验失败。
- 如果声明了**任何** `http:outbound` 权限（裸形式或按主机），`egress[]`
  就必须**非空** —— *除非*清单设置了 `operatorEgress: true`，其主机
  在安装后由管理员提供（见下文）。
- 每个条目必须是裸主机或 `*.suffix` 通配符：裸 `*`、整段 TLD
  的 `*.com` 以及任何携带 scheme 的内容都会被拒绝。

### `operatorEgress` —— 只有运营者才知道的主机

与**自托管**服务（一个 Gotify、一个 ntfy）通信的插件，在发布时无法说出
运营者的主机名。在清单中设置 `"operatorEgress": true` 可让
**管理员**在安装后添加主机（**管理 → 插件 → ⋯ → 允许的主机**）；运行时
把它们并入子进程的允许清单并重新派生插件。

它不是一个逃生通道：

- 只有清单**声明了** `operatorEgress` 的插件才能被赋予主机 —— 因此安装时
  给出的同意仍然限定了什么是可能的。
- 只有**管理员**能添加。终端用户永远无法扩大插件的出站范围，即使
  插件的凭据由他们自己提供。
- 添加的主机校验方式与清单出站项完全相同（不允许裸 `*`、不允许整段 TLD
  通配符、不允许 scheme），并在插件被卸载时丢弃。
- 它需要一个 `http:outbound` 权限 —— 否则清单会拒绝它。
- 它是用空 `egress[]` 声明出站的**唯一**方式（即目标*始终*是自托管的
  插件）。这样的插件会被激活，但在管理员添加主机之前什么也访问不到 ——
  空的允许清单会阻断一切，它绝不意味着「任何主机」。

LAN/环回主机另外需要 `TREK_PLUGIN_ALLOW_PRIVATE_EGRESS=on`，它会为
**每一个**已安装插件放宽私有地址的出站。

由于校验器从不对照已授予的主机交叉核对 `egress[]`：

> [!WARNING]
> **你在 `egress[]` 中列出、却忘了授予为 `http:outbound:<host>` 的主机
> 会在运行时被静默阻断。** 校验通过，安装通过 —— 然后发往该主机的每个
> 请求都会被出站防护和 iframe CSP 拒绝，而没有任何清单错误来提醒你。
> **请把你调用的每一台主机*同时*列为
> `http:outbound:<host>` 权限*和* `egress[]` 条目，并保持两者
> 一致。**

**裸 `http:outbound`**（不带主机）满足「`egress[]` 非空」的规则，但对
任何一道防护都**不贡献任何主机** —— 单靠它在运行时什么都访问不到。只在
与针对你实际调用的那些主机的具体 `http:outbound:<host>` 授权一起使用时才用它。

主机可以是确切名称（`api.example.com`）或 `*.suffix` 通配符
（`*.example.com`，匹配裸域和任何子域）。即使是在允许清单上的主机，
如果它解析到环回/私有/链路本地/元数据地址，也会被拒绝
（SSRF 兜底）。

## 声明它们

```jsonc
{
  "permissions": ["db:own", "db:read:trips", "http:outbound:api.example.com"],
  "egress": ["api.example.com"]     // mirror every http:outbound:<host> here
}
```

## 发布 —— `trek-plugin` CLI

`trek-plugin-sdk` 包附带一个 `trek-plugin` CLI，它替你构建发布
产物和注册表条目，因此你永远不必手工计算 sha256、
大小或 commit sha。用 `npx trek-plugin-sdk <command>` 运行它。完整的提交流程
见 [[发布插件|Plugin-Publishing]]。

| 命令 | 作用 |
|---|---|
| `trek-plugin create [name]` | 脚手架出一个插件。不带名称时它运行一个交互式向导（id、类型、作者、权限）；带名称时它接受 `--type`/`--author`/`--permissions` 标志。 |
| `trek-plugin dev [dir]` | 在本地以真实的请求循环 + 热重载运行插件 —— 不需要完整的 Tourism-Team。注入的 `ctx` 强制执行你已授予的权限，`db:own` 是一个真实的 SQLite 文件，路由在 `/api/<path>` 下提供服务，页面/小组件 UI 在 `/ui`。 |
| `trek-plugin validate [dir]` | 清单 + 布局检查，也是发布的门槛：用与安装相同的规则解析清单，然后运行每一项能在工作树中回答的注册表关卡 —— 任何一项不过就以非零退出。如果缺少 `README.md`、缺少四个必需章节之一、正文太少、仍保留模板占位符、没有解释清单声明的每一个权限，或缺少 `docs/screenshot.png`（商店卡片加载的正是这个文件 —— README 中指向其他任何位置的图片链接都不满足该关卡；`trek-plugin shot` 会写入它，`preflight` 会在所固定的 commit 上重新验证它），它就会**失败**；如果 `server/index.js` 从未构建，它也会失败。只有注册表在意的失败**不会**阻止 `trek-plugin pack`，因此在文档还是半成品时开发循环仍能运转 —— 但它们确实会阻止 `publish`，后者会先运行这些相同的检查，并在打包、打标签或发布任何东西之前拒绝。少数几项检查是*警告*，绝不会让命令失败：目录名 ≠ 插件 id、未加限定的 `trek` 范围、未知的必需扩展、清单文本中的 emoji、未声明的出站主机，以及页面/小组件未使用设计套件。这是注册表 CI 的**子集** —— CI 还会通过网络校验发布 tag/commit、产物的 sha256 和 README。本地通过能预期 CI 通过。 |
| `trek-plugin preflight --repo <o/n> --tag <vX>` | 在本地通过你的已推送 release 联网运行**完整的**注册表 CI 检查（tag→commit、清单一致性、产物 sha256/大小、原生扫描、README 质量关卡）—— 这样你就能在开 PR 之前捕获 CI 失败。 |
| `trek-plugin submit --repo <o/n> --tag <vX>` | 替你发起注册表 PR：fork TREK-Plugins、快进该 fork、从注册表当前 main 分出分支、写入/合并 `registry/plugins/<id>.json`、推送并创建 PR。需要 `gh`。 |
| `trek-plugin publish --repo <o/n> --tag <vX>` | **一条命令完成发布**：本地关卡 → pack → 打 tag + GitHub release → preflight → 发起注册表 PR。在本地关卡通过之前，不会打包、打标签或发布任何东西（`--no-checks` 会跳过它们）。在 release 切出之后的失败会回滚该次运行所创建的 tag 和 release，因此同一个 tag 可以重复使用（`--keep-release` 可选择退出）。加上 `--sign` 可对它签名；`--sign --allow-key-change` 会在发布的同时轮换你的签名密钥。需要 `git` + `gh`。 |
| `trek-plugin unrelease <vX> --repo <o/n>` | 删除搁浅的 GitHub release + 远端 tag + 本地 tag。拒绝注册表中已发布的版本（其产物不可变）；当注册表索引无法检查时，`--yes` 表示同意。 |
| `trek-plugin keygen` / `sign` / `rotate-key` | `keygen` 创建一个 Ed25519 签名密钥；`sign`（或 `entry`/`release`/`submit` 上的 `--sign`）对产物签名并填入 `authorPublicKey` + `signature`，使 Tourism-Team 固定你的身份（TOFU）。`rotate-key` 把已发布的插件迁移到一把**新**密钥上而不必发布新版本：它用新密钥重新签署每一个已固定的产物并发起一个轮换 PR（维护者必须给它打上 `allow-key-change` 标签；每位管理员都必须重新信任）。`publish --sign --allow-key-change` 会在发布的同时完成轮换。 |
| `trek-plugin pack [dir] [--out plugin.zip] [--json]` | 先校验，然后按安装器确切布局构建 `plugin.zip`（根目录有 `trek-plugin.json`、`README.md`、`LICENSE`、`package.json`；`server/` 和 `client/` 递归包含）并打印其 **sha256 + 字节大小**。跳过 `node_modules`、`.git`、`.ts` 和 `.map` 文件，并**拒绝原生二进制文件**（`.node`、`binding.gyp`、`prebuilds/`）和超大归档，与安装器一致。**`docs/` 有意不打包** —— 商店从仓库中的 `docs/screenshot.png` 获取你的截图。 |
| `trek-plugin entry --repo <owner/name> --tag <vX.Y.Z> [--zip plugin.zip] [--merge entry.json] [--out file]` | 生成可直接开 PR 的注册表条目：`commitSha`（从 tag 解析）、`downloadUrl`、`sha256` + `size`（来自打包好的 zip），以及清单的 **`trek` 范围原样** —— 条目唯一的兼容性字段。`--merge` 会为一次更新把该版本前插到现有的 `registry/plugins/<id>.json` 上，保持版本最新的在前（注册表 CI 会强制该排序）。 |
| `trek-plugin release [dir] --repo <owner/name> --tag <vX.Y.Z>` | 一步到位：`pack` → `gh release create`（上传 zip）→ 打印注册表 `entry`。需要已认证的 `gh` CLI。 |

### 注册表策略

- **没有保留命名空间。** 任何唯一的小写 slug id 都被接受（3–40
  字符，`[a-z][a-z0-9-]*`）。唯一被拒绝的 id 是 `registry`、`install` 和
  `rescan`，因为它们会与管理员 API 路由冲突。
- **所有者绑定仍然有效。** 一个 id 在首次注册时就绑定到其 GitHub 所有者，
  因此没有人能把已存在的插件 id 重新指向另一个仓库。
- **可选的作者签名。** 注册表条目可以携带一个 `authorPublicKey`
  （跨版本稳定）和每版本一个 `signature`。Tourism-Team 会离线验证它
  并以首次使用即信任的方式固定该密钥。签名是选择性加入 —— 未签名的条目
  仅凭 `sha256` 即可安装 —— 但一旦某个插件已以签名形式发布，它
  未签名的更新就会被拒绝，而密钥变更只有在作为一次刻意的、
  维护者批准的轮换（`rotate-key` / `--allow-key-change`）时才会被接受，且每位
  管理员都必须重新信任。见 [[发布插件|Plugin-Publishing]]。

## 不是权限 —— 设置页面操作

插件可以向它自己的设置表单贡献按钮（清单中的 `actions` —— 一个
「测试连接」、一个「立即同步」）。这些**不需要任何权限**：操作是插件
自己的代码，并且**为点击它的那个用户**运行，因此 `ctx.settings.get()` 返回
该用户的值，而任何旅行读取都会针对他们做成员校验 —— 与
路由处理函数相同的门槛。该操作*所做的*任何事情（一次出站调用、一次旅行写入）仍然需要
该能力自身的权限。主机会拒绝清单未声明的任何操作键。

一个 `scope: "instance"` 的操作渲染在 **管理 → 插件 → ⋯ → 实例设置** 中，
它是**由管理员呈现但不具有管理员特权**：它像其他任何操作一样以点击的管理员自己的用户身份运行，
因此 `ctx.settings.get()` 返回*他们的*值，而旅行读取会针对他们
做成员校验 —— 不在某次旅行上的管理员仍然无法通过插件按钮
读取它。作用域由每个
按钮提交到的路由固定，因此用户作用域的键永远无法从管理员路由触发，实例作用域的键也
无法从用户的设置页面触发。见 [[插件开发#settings-page-actions|Plugin-Development]]。

## 不是权限 —— 插件间调用与事件

调用另一个插件（`ctx.plugins.call`）和交换事件
（`ctx.events.emit` / `subscriptions`）**不受**权限门控。它们的授权
是**依赖声明**：插件只有在把另一个插件列为已满足的 `pluginDependency` 时，
才能调用它或订阅它，并且只能使用那个插件在 `capabilities.provides` / `capabilities.emits`
中公开声明的函数/事件名。
调用由主机中转运行，携带调用方的操作用户（因此旅行读取保持
成员校验），并被记录在能力审计日志中。见
[[插件开发|Plugin-Development#talking-to-other-plugins]] 和
[[插件开发|Plugin-Development#dependencies]]。

## 哪些不在覆盖范围内

隔离限定的是*什么* —— 插件能触及什么 —— 而不是它在某个授权范围内的意图。
一个你允许读取旅行数据**并且**访问 `api.example.com` 的插件，可以把
那些旅行数据发送到那里。因此在安装前请审查权限和出站主机 ——
只授予你信任插件对你的数据所做的事情。优先选择
**已审核**的插件和你信任的作者。要构建一个插件，见 [[插件开发|Plugin-Development]]。
