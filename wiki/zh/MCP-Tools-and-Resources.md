# MCP 工具与资源

Tourism-Team 暴露**工具**（读写操作）和**资源**（只读的 `trek://` URI）。工具按会话注册，取决于 OAuth 权限范围和已启用的扩展。

关于受扩展门控的工具（行李清单、待办事项、足迹、协作、收藏、假期、旅程）及其资源，见 [MCP 扩展工具](MCP-Addon-Tools)。

## 工具

### 行程摘要

| 工具 | 说明 |
|---|---|
| `get_trip_summary` | 一次调用即可获得某个旅行的完整反规范化快照 —— 元数据、成员、带分配和备注的各天、住宿、预算、行李、预订、协作笔记和待办事项。在做出改动之前用它作为上下文加载器。 |

### 复合工具

复合工具把多步工作流收拢为单个原子事务。如果第二步失败，第一步会被回滚。

> 仅在地点或条目尚不存在时使用复合工具。对于已存在的记录，请直接调用各个单独的工具。

| 工具 | 包装的工具 | 说明 |
|---|---|---|
| `create_and_assign_place` | `create_place` + `assign_place_to_day` | 创建一个地点并把它分配到某天。返回 `{ place, assignment }`。需要 `places:write`。 |
| `create_place_accommodation` | `create_place` + `create_accommodation` | 创建一个地点并把它预订为住宿。返回 `{ place, accommodation }`。需要 `trips:write`。 |
| `create_budget_item_with_members` | `create_budget_item` + `set_budget_item_members` | 创建一个预算条目并设置分摊成员。如果省略 `userIds`，行为等同于 `create_budget_item`。返回 `{ item }`。需要 `budget:write`。 |

### 旅行

需要 `trips:read` 或 `trips:write` 权限范围。

| 工具 | 说明 |
|---|---|
| `list_trips` | 列出你拥有的或你是成员的所有旅行。支持 `include_archived` 标志。 |
| `create_trip` | 用标题、日期和货币创建一个旅行。天数会根据日期范围自动生成。 |
| `update_trip` | 更新旅行的标题、描述、日期或货币。 |
| `delete_trip` | 删除一个旅行。仅限所有者。需要 `trips:delete`。 |
| `list_trip_members` | 列出某个旅行的所有者和全部协作者。 |
| `add_trip_member` | 通过用户名或邮箱把用户加入旅行。仅限所有者。 |
| `remove_trip_member` | 从旅行中移除一位协作者。仅限所有者。 |
| `create_trip_guest` | 添加一位没有 Tourism-Team 账户的同行者。可被分配到预算分摊、行李和每日参与者中；从不登录，也从不发邮件。仅限所有者。 |
| `rename_trip_guest` | 重命名旅行中的某位访客。仅限所有者。 |
| `delete_trip_guest` | 删除一位访客并重新分摊其参与过的费用。仅限所有者。 |
| `copy_trip` | 复制一个旅行（天数、地点、行程、行李、预算、预订）。行李条目会重置为未勾选。 |
| `export_trip_ics` | 把旅行行程和预订导出为 iCalendar（`.ics`）文本。 |
| `get_share_link` | 获取某个旅行当前的公开分享链接及其权限标志。需要 `trips:share`。 |
| `create_share_link` | 用可配置的可见性标志创建或更新公开分享链接。需要 `trips:share`。 |
| `delete_share_link` | 撤销某个旅行的公开分享链接。需要 `trips:share`。 |

### 地点

需要 `places:read` 或 `places:write` 权限范围。

| 工具 | 说明 |
|---|---|
| `list_places` | 列出旅行中的地点，可选地按分配状态、分类、标签或搜索词过滤。 |
| `create_place` | 添加一个地点，含名称、坐标、地址、分类、备注、网站、电话，以及可选的 `google_place_id` / `osm_id`。 |
| `update_place` | 更新既有地点的任意字段，包括交通方式、时间和价格。 |
| `rate_place` | 设置或清除你自己对某个地点的 1–5 星评分。每位旅行成员独立评分，地点显示平均值。传入 `null` 可清除投票。 |
| `bulk_update_places` | 一次更新多个地点，在单次调用中把相同的字段值（例如分类、价格、交通方式）应用到列出的每个地点。 |
| `delete_place` | 从旅行中移除一个地点。同时移除所有每日分配。 |
| `bulk_delete_places` | 按 ID 删除多个地点。会移除所有每日分配。无法撤销。 |
| `import_places_from_url` | 从公开分享的 Google Maps 或 Naver Maps 列表 URL 导入所有地点。 |
| `list_categories` | 列出所有可用的地点分类，含 id、名称、图标和颜色。 |
| `search_place` | 按名称或地址搜索地点。返回 `osm_id` 和 `google_place_id`，可用于 `create_place`。 |

### 日程规划

需要 `trips:read` 或 `trips:write` 权限范围。

| 工具 | 说明 |
|---|---|
| `update_day` | 设置或清除某天的标题。 |
| `create_day` | 为旅行新增一天，可选地带日期和备注。 |
| `delete_day` | 从旅行中删除某天。 |
| `set_day_default_transport_mode` | 设置全天默认的出行方式。各段的模式仍会覆盖它。传入 `null` 可清除。 |
| `assign_place_to_day` | 把地点固定到行程中的某一天。需要 `places:write`。 |
| `unassign_place` | 从某天移除一个地点分配。需要 `places:write`。 |
| `reorder_day_assignments` | 按顺序提供分配 ID，以调整某天内地点的顺序。需要 `places:write`。 |
| `update_assignment_time` | 设置某个地点分配的起止时间（例如 `"09:00"` – `"11:30"`）。传入 `null` 可清除。需要 `places:write`。 |
| `move_assignment` | 把一个地点分配移到另一天。需要 `places:write`。 |
| `set_leg_transport_mode` | 设置某个地点分配对应路线段的出行方式。`direction` 为 `"outgoing"`（默认）时针对离开该停靠点的段，`"incoming"` 时针对到达的段。传入 `null` 可继承当天默认值。需要 `places:write`。 |
| `get_assignment_participants` | 获取参与某个特定地点分配的用户。需要 `places:read` 或 `places:write`。 |
| `set_assignment_participants` | 设置某个地点分配的参与者（替换当前列表）。需要 `places:write`。 |

### 日程备注

需要 `trips:read` 或 `trips:write` 权限范围。

| 工具 | 说明 |
|---|---|
| `create_day_note` | 为某一天添加备注，可选地带时间标签和 emoji 图标。 |
| `update_day_note` | 编辑某条每日备注的文本、时间或图标。 |
| `delete_day_note` | 从某天移除一条备注。 |

### 住宿

需要 `trips:read` 或 `trips:write` 权限范围。

| 工具 | 说明 |
|---|---|
| `create_accommodation` | 添加一条住宿（酒店、Airbnb 等），关联到一个地点和一段入住/退房日期范围。 |
| `update_accommodation` | 更新既有住宿的字段，包括日期、时间、确认号和备注。 |
| `delete_accommodation` | 从旅行中删除一条住宿记录。 |

### 交通

需要 `reservations:write` 权限范围。

| 工具 | 说明 |
|---|---|
| `create_transport` | 创建一条交通预订，类型可以是交通表单提供的九种之一（`flight`、`train`、`bus`、`car`、`taxi`、`bicycle`、`cruise`、`ferry`、`transport_other`），可选地带多停靠点端点、出发/到达时间和确认详情。定班公共交通请改用 `create_transit_journey`。 |
| `update_transport` | 更新一条既有的交通预订。传入 `endpoints[]` 可替换所有停靠点。 |
| `delete_transport` | 从旅行中删除一条交通预订。 |

### 自动化公共交通

公共交通搜索由 Transitous 提供，并使用既有的 `geo:read` 和 `reservations:write` 权限范围。

| 工具 | 所需权限范围 | 说明 |
|---|---|---|
| `search_transit_stops` | `geo:read` | 搜索真实的公共交通站点和车站，可选地以坐标为中心偏移。 |
| `search_transit_routes` | `geo:read` | 搜索两个坐标之间的定班路线，支持时间、方式和换乘过滤。还会返回 `dropped`，即未通过校验、因而未出现在结果中的提供方行程数量。 |
| `create_transit_journey` | `reservations:write` | 把选中的路线保存为旅行某天上一等的自动化公共交通行程。 |

### 预订

需要 `reservations:read` 或 `reservations:write` 权限范围。

| 工具 | 说明 |
|---|---|
| `create_reservation` | 创建一条待确认的预订：酒店、餐厅、活动、游览、体验及其他类型。携带预订链接（`url`）和一个结束时间。 |
| `update_reservation` | 更新任意字段，包括状态（`pending` / `confirmed` / `cancelled`）。 |
| `delete_reservation` | 删除一条预订，如适用也删除其关联的住宿记录。 |
| `reorder_reservations` | 调整某天内预订的顺序。 |
| `set_reservation_travelers` | 从旅行名册（成员和访客）中设置谁在这条预订上出行。会替换列表；空数组表示清除。不在该旅行上的 id 会通过 `ignored_user_ids` 返回，而不是被挂上。 |
| `link_hotel_accommodation` | 设置或更新某条酒店预订的入住/退房日关联和地点。 |

### 预算

需要 `budget:read` 或 `budget:write` 权限范围。必须启用预算扩展。

| 工具 | 说明 |
|---|---|
| `create_budget_item` | 添加一笔支出，含名称、分类和价格。 |
| `update_budget_item` | 更新一笔支出的详情、分摊方式（按人/按天）或备注。 |
| `delete_budget_item` | 移除一个预算条目。 |
| `set_budget_item_members` | 设置哪些成员分摊某个预算条目（替换当前列表）。 |
| `toggle_budget_member_paid` | 把某位成员标记为已支付其份额，或取消该标记。 |
| `get_settlement_summary` | 每位成员的净余额，以及用于结清共享支出的建议付款，均以旅行的基础货币表示。在记录一笔结算之前调用它。 |
| `list_settlements` | 列出某个旅行已记录的结清付款 —— 谁付给谁、多少、何时。 |
| `create_settlement` | 记录一笔结清付款：某位成员以旅行的基础货币向另一位支付了给定金额。 |
| `update_settlement` | 更新一笔已记录的结清付款（付款人、收款人和金额）。 |
| `delete_settlement` | 删除一笔已记录的结清付款。这是 `create_settlement` 的撤销操作，会恢复受影响的余额。 |

### 标签

需要 `places:read` 或 `places:write` 权限范围。

| 工具 | 说明 |
|---|---|
| `list_tags` | 列出属于当前用户的所有标签。 |
| `create_tag` | 创建一个新标签（用户级的地点标签），可选地带十六进制颜色。 |
| `update_tag` | 更新既有标签的名称或颜色。 |
| `delete_tag` | 删除一个标签（会把它从所有已挂载的地点移除）。 |

### 地图与天气

| 工具 | 所需权限范围 | 说明 |
|---|---|---|
| `get_place_details` | `geo:read` | 通过地点的 Google Place ID 获取其详细信息（营业时间、照片、评分）。 |
| `reverse_geocode` | `geo:read` | 获取给定坐标对应的可读地址。 |
| `resolve_maps_url` | `geo:read` | 把 Google Maps 分享 URL 解析为坐标和地点名称。 |
| `search_airports` | `geo:read` | 按名称、城市或 IATA 代码搜索机场。返回 IATA 代码、名称、城市、国家和时区。 |
| `get_airport` | `geo:read` | 按 IATA 代码查找机场（例如 `"ZRH"`、`"CDG"`）。 |
| `get_weather` | `weather:read` | 获取某地点某日期的天气预报。 |
| `get_detailed_weather` | `weather:read` | 获取某地点某日期的逐小时/详细天气预报。 |

### 通知

需要 `notifications:read` 或 `notifications:write` 权限范围。

| 工具 | 说明 |
|---|---|
| `list_notifications` | 列出应用内通知，支持分页和可选的未读过滤。 |
| `get_unread_notification_count` | 获取未读通知数量。 |
| `mark_notification_read` | 把一条通知标为已读。 |
| `mark_notification_unread` | 把一条通知标为未读。 |
| `mark_all_notifications_read` | 把所有通知标为已读。 |

### 文件

需要 `files:read` 或 `files:write`。读取文档内部的内容需要 `files:content`，这是一个**独立的**权限范围，且不由 `files:write` 隐含。

| 工具 | 说明 |
|---|---|
| `list_trip_files` | 列出某个旅行的文档：名称、类型、大小、上传者、描述、关联对象、加星标和回收站状态。传入 `trash` 可改为列出回收站。 |
| `read_trip_file` | 读取一个文档的内容。文本以文本返回，其他内容以 base64 返回，并用 `encoding` 字段说明是哪种。超过 10 MB 的文件会被拒绝；请使用应用中的下载链接。 |
| `update_trip_file` | 设置文件的描述，以及它所属的预订或地点。传入 null 可解除关联。 |
| `link_trip_file` | 把一个文件再关联到一条预订、地点或每日分配。 |
| `unlink_trip_file` | 移除一个关联。文件仍然保留。 |
| `list_trip_file_links` | 列出某个文件关联到的所有内容。 |

### 设置

需要 `settings:read` 或 `settings:write`。

| 工具 | 说明 |
|---|---|
| `get_display_settings` | 读取用户的单位、时间格式、语言、默认货币和起始页。在渲染温度、距离或时钟时间之前先读它。 |
| `update_display_settings` | 修改上述偏好中的一项或多项。仅限显示偏好：无论传入什么，API 密钥、地图令牌和 LLM 设置都会被拒绝。 |

### 日历订阅源

需要 `trips:share`，与管理公开分享链接的权限范围相同。

| 工具 | 说明 |
|---|---|
| `get_trip_calendar_feed` | 读取某个旅行的可订阅订阅源 URL，以及它是否已开启。 |
| `enable_trip_calendar_feed` | 打开该旅行的订阅源并生成其令牌。 |
| `rotate_trip_calendar_feed` | 签发一个新令牌。该旅行所有既有订阅都会失效。 |
| `disable_trip_calendar_feed` | 关闭它并撤销令牌。 |
| `get_all_trips_calendar_feed` | 对承载用户可见的所有旅行的那个订阅源，作用相同。 |
| `enable_all_trips_calendar_feed` | |
| `rotate_all_trips_calendar_feed` | |
| `disable_all_trips_calendar_feed` | |

### 邀请链接

需要 `trips:share`。这是授予**成员身份**的链接，而不是 `create_share_link` 创建的那个只读公开查看链接。

| 工具 | 说明 |
|---|---|
| `get_trip_invite_link` | 读取当前的邀请链接及其过期时间。 |
| `create_trip_invite_link` | 生成一个邀请链接，可选地带过期时间。轮换会替换旧链接，旧链接随即失效。 |
| `delete_trip_invite_link` | 撤销它。 |

接受邀请刻意不设工具：加入别人的旅行是人的行为。

### 导入

| 工具 | 说明 |
|---|---|
| `list_airtrail_flights` | 列出可从已连接的 AirTrail 账户导入的航班。需要 AirTrail 扩展。 |
| `import_airtrail_flights` | 把选中的航班作为交通预订导入到某个旅行中。 |

### 照片

需要 `journey:read`，若要附加则需要 `journey:write`。需要已配置的 Immich 或 Synology Photos 来源。

| 工具 | 说明 |
|---|---|
| `search_provider_photos` | 搜索已连接的照片库。 |
| `list_provider_albums` | 列出它的相册。 |
| `list_provider_album_photos` | 列出某个相册中的照片。 |

照片字节永远不会被返回：那些是供应用渲染的图片 URL。

### 帮助与实例

| 工具 | 说明 |
|---|---|
| `list_help_topics` | 列出随附的帮助页面。无需猜测即可回答「在 Tourism-Team 里怎么做 X？」 |
| `get_help_page` | 读取一个帮助页面。 |
| `list_addons` | 这个实例启用了哪些扩展和协作功能。当你预期的某个工具不在列表中时值得调用：一个被关闭的扩展移除其工具的方式，与缺少某项权限范围完全一样。 |
| `get_trip_warnings` | 插件针对某个旅行发出的警告。插件发出警告是在告诉用户有问题，因此在审查行程之前值得一读。 |

---

## 资源

资源通过 `trek://` URI 提供只读访问。在做改动之前读取它们以了解当前状态。

### 核心资源

| URI | 所需权限范围 | 说明 |
|---|---|---|
| `trek://trips` | `trips:*` | 你拥有的或你是成员的所有旅行 |
| `trek://trips/{tripId}` | `trips:*` | 单个旅行，含元数据和成员数量 |
| `trek://trips/{tripId}/days` | `trips:read` | 某个旅行的各天及其已分配的地点 |
| `trek://trips/{tripId}/places` | `places:read` | 某个旅行中的所有地点。支持 `?assignment=all\|unassigned\|assigned` |
| `trek://trips/{tripId}/reservations` | `reservations:read` | 航班、酒店、餐厅及其他预订 |
| `trek://trips/{tripId}/days/{dayId}/notes` | `trips:read` | 某一天的备注 |
| `trek://trips/{tripId}/accommodations` | `trips:read` | 酒店和民宿，含入住/退房详情 |
| `trek://trips/{tripId}/members` | `trips:*` | 所有者和协作者 |
| `trek://categories` | （任意） | 可用的地点分类（id、名称、图标、颜色） |
| `trek://notifications/in-app` | `notifications:read` | 你的应用内通知（最近 50 条，最新在前） |

关于受扩展门控的资源（预算、行李清单、待办事项、协作、足迹、假期、旅程），见 [MCP 扩展工具](MCP-Addon-Tools)。

---

## 相关

- [MCP 扩展工具](MCP-Addon-Tools)
- [MCP 权限范围](MCP-Scopes)
- [MCP 提示词](MCP-Prompts)
- [MCP 设置](MCP-Setup)
