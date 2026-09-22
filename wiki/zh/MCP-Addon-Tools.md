# MCP 扩展工具与资源

本页介绍需要在你的 Tourism-Team 实例上启用特定扩展才能使用的 MCP 工具与资源。其余部分（行程、地点、日程规划、住宿、交通、预订、标签、地图和通知 —— 外加需要费用扩展、但已在对应页面记录的预算工具）见 [MCP 工具与资源](MCP-Tools-and-Resources)。

---

## 受扩展门控的工具

### 行李清单 _（需要行李清单扩展）_

需要 `packing:read` 或 `packing:write` 权限范围。

| 工具 | 说明 |
|---|---|
| `create_packing_item` | 向行李清单添加一个物品，可指定分类。 |
| `update_packing_item` | 重命名物品或更改其分类。 |
| `toggle_packing_item` | 勾选或取消勾选一个行李物品。 |
| `delete_packing_item` | 移除一个行李物品。 |
| `reorder_packing_items` | 设置一次行程内行李物品的显示顺序。 |
| `bulk_import_packing` | 从一份列表一次导入多个行李物品（可带数量）。 |
| `list_packing_templates` | 列出可复用的行李清单模板（id、名称、物品数量），以便套用其中一个。 |
| `apply_packing_template` | 把保存的行李清单模板套用到一次行程。 |
| `save_packing_template` | 把当前行李清单保存为可复用模板。模板是全局的，因此仅限管理员 —— 非管理员会收到 `Admin access required`。 |
| `delete_packing_template` | 删除一个可复用的行李清单模板。同样也是全局的，因此仅限管理员。 |
| `list_packing_bags` | 列出一次行程的所有行李。 |
| `create_packing_bag` | 创建一个新行李（例如「Carry-on」「Checked bag」）。 |
| `update_packing_bag` | 重命名或更改行李的颜色。 |
| `delete_packing_bag` | 删除一个行李（其中的物品会被取消分配，而不是被删除）。 |
| `set_bag_members` | 把行程成员分配到某个行李。 |
| `get_packing_category_assignees` | 获取每个行李分类被分配了哪些行程成员。 |
| `set_packing_category_assignees` | 把行程成员分配到某个行李分类。 |

### 待办事项 _（需要行李清单扩展）_

需要 `todos:read` 或 `todos:write` 权限范围。

| 工具 | 说明 |
|---|---|
| `list_todos` | 列出一次行程的所有待办事项，按位置排序。 |
| `create_todo` | 创建一条待办事项，可带名称、分类、截止日期、描述、负责人和优先级。 |
| `update_todo` | 更新一条已有的待办事项。传入 `null` 可清空可为空的字段。 |
| `toggle_todo` | 把一条待办事项标为完成或未完成。 |
| `delete_todo` | 删除一条待办事项。 |
| `reorder_todos` | 通过提供一份新的有序 ID 列表来重新排列待办事项。 |
| `get_todo_category_assignees` | 获取一次行程中每个待办分类所配置的默认负责人。 |
| `set_todo_category_assignees` | 设置某个待办分类的默认负责人。传入空数组可清空。 |

### 足迹 _（需要足迹扩展）_

需要 `atlas:read` 或 `atlas:write` 权限范围。

| 工具 | 说明 |
|---|---|
| `mark_country_visited` | 使用国家的 ISO 3166-1 alpha-2 代码（例如 `"FR"`、`"JP"`）把该国标为已访问。 |
| `unmark_country_visited` | 从已访问列表中移除一个国家。 |
| `get_atlas_stats` | 获取足迹统计 —— 已访问国家数、地区数和大洲分布。 |
| `list_visited_regions` | 列出当前用户所有手动标记为已访问的国家内地区。 |
| `mark_region_visited` | 把某个国家内地区标为已访问（例如 `"US-CA"`）。 |
| `unmark_region_visited` | 从已访问列表中移除一个地区。 |
| `get_country_atlas_places` | 获取用户足迹中为某个国家保存的地点。 |
| `create_bucket_list_item` | 向你的个人心愿单添加一个目的地，可带坐标、国家代码和目标日期。相同目的地与相同目标日期会被视为重复而拒绝。 |
| `update_bucket_list_item` | 更新一条心愿单条目（名称、备注、坐标、目标日期）。 |
| `delete_bucket_list_item` | 从心愿单中移除一条条目。 |

### 协作 _（需要协作扩展）_

需要 `collab:read` 或 `collab:write` 权限范围。

仅有扩展还不够。协作有四个子功能，管理员可以在 管理 → 扩展 中独立开关 —— 笔记、投票、聊天和接下来，默认全部开启 —— 其中三个会门控 MCP 条目。只有当工具或资源自身的子功能在扩展之上也被启用时，它才会被注册，因此关闭某个子功能会让它的条目从工具列表中消失，而不是返回错误。「接下来」没有自己的 MCP 工具或资源，所以在这里切换它不会带来任何变化。

| 子功能 | 它门控的工具 | 它门控的资源 |
|---|---|---|
| 笔记 | `create_collab_note`、`update_collab_note`、`delete_collab_note` | `trek://trips/{tripId}/collab-notes` |
| 投票 | `list_collab_polls`、`create_collab_poll`、`vote_collab_poll`、`close_collab_poll`、`delete_collab_poll` | `trek://trips/{tripId}/collab/polls` |
| 聊天 | `list_collab_messages`、`send_collab_message`、`delete_collab_message`、`react_collab_message` | `trek://trips/{tripId}/collab/messages` |

| 工具 | 说明 |
|---|---|
| `create_collab_note` | 创建一条对所有行程成员可见的共享笔记。支持标题、内容、分类和颜色。 |
| `update_collab_note` | 编辑协作笔记的内容、分类、颜色或置顶状态。 |
| `delete_collab_note` | 删除一条协作笔记。 |
| `list_collab_polls` | 列出一次行程的所有投票。 |
| `create_collab_poll` | 创建一个投票，可带问题、选项、可选的多选和截止时间。 |
| `vote_collab_poll` | 对某个投票选项投票（若已投过则取消投票）。 |
| `close_collab_poll` | 关闭一个投票，使其不再接受投票。 |
| `delete_collab_poll` | 删除一个投票及其全部投票记录。 |
| `list_collab_messages` | 列出一次行程的聊天消息（最近 100 条，支持通过 `before` 分页）。 |
| `send_collab_message` | 向行程的协作频道发送一条聊天消息，可选用回复串接。 |
| `delete_collab_message` | 删除一条聊天消息（仅限自己的消息）。 |
| `react_collab_message` | 在一条聊天消息上切换某个表情回应。 |

### 收藏 _（需要收藏扩展）_

需要 `collections:read` 或 `collections:write` 权限范围。

| 工具 | 说明 |
|---|---|
| `list_collections` | 列出用户拥有或已接受分享的已保存地点收藏，以及任何待处理的收到邀请。 |
| `get_collection` | 获取单个收藏及其成员、标注和全部已保存地点，包括平均评分和每位成员的投票。 |
| `available_collection_users` | 列出仍可被邀请加入收藏的用户（不含当前成员和访客）。 |
| `create_collection` | 创建一个归该用户所有的已保存地点收藏。 |
| `update_collection` | 更新收藏的名称、描述、颜色、图标、封面、链接或排序。仅限所有者/管理员。 |
| `delete_collection` | 永久删除一个收藏及其全部已保存地点。仅限所有者，且不可撤销。 |
| `reorder_collections` | 重新排列用户的收藏 —— 按所需顺序传入每一个收藏 id。 |
| `save_place_to_collection` | 从原始载荷把地点保存进收藏。当已存在相似地点时，返回重复标记而不保存，除非 `force` 为 true。 |
| `save_trip_places_to_collection` | 把一个或多个已有的行程地点复制进收藏。重复项会被跳过，除非 `force` 为 true。 |
| `update_collection_place` | 更新已保存地点的名称、地址、坐标、描述、备注、状态、分类、链接、标签、标注、图片，或把它移动到另一个收藏。 |
| `set_collection_place_status` | 设置已保存地点的状态：`idea`、`want` 或 `visited`。 |
| `rate_collection_place` | 设置或清除当前用户对某个已保存地点的 1–5 星评分。每位成员独立评分；传入 `null` 可移除投票。 |
| `delete_collection_place` | 从其收藏中移除一个已保存地点。需要对该列表的删除权限。 |
| `copy_collection_places_to_trip` | 把一个或多个已保存地点复制进一次行程，评分一并带入。需要目标行程的编辑权限。 |
| `create_collection_label` | 为单个收藏创建自定义标注（名称加可选十六进制颜色），用于分组和筛选地点。 |
| `update_collection_label` | 重命名或重新着色收藏标注，或更改其排序。 |
| `delete_collection_label` | 删除一个收藏标注；地点上的相关分配会被清除。 |
| `assign_collection_labels` | 为一组已保存地点添加标注，或用 `remove=true` 移除标注。 |
| `invite_to_collection` | 邀请用户以 `viewer`、`editor` 或 `admin`（默认 `editor`）身份协作某个收藏。仅限所有者。 |
| `set_collection_member_role` | 更改已接受成员的角色。仅限所有者。 |
| `remove_collection_member` | 从共享收藏中移除一位已接受的成员。仅限所有者。 |
| `cancel_collection_invite` | 取消你为某个收藏发出的待处理邀请。仅限所有者。 |
| `accept_collection_invite` | 接受加入共享收藏的待处理邀请。 |
| `decline_collection_invite` | 拒绝加入共享收藏的待处理邀请。 |
| `leave_collection` | 离开你作为成员加入的共享收藏。所有者无法离开 —— 请改为删除该列表。 |

### 假期 _（需要假期扩展）_

需要 `vacay:read` 或 `vacay:write` 权限范围。

| 工具 | 说明 |
|---|---|
| `get_vacay_plan` | 获取当前用户处于活动状态的假期计划。 |
| `update_vacay_plan` | 更新假期计划设置（周末屏蔽、节假日、结转）。 |
| `set_vacay_color` | 设置当前用户在假期计划日历中的颜色。 |
| `get_available_vacay_users` | 列出可被邀请加入当前假期计划的用户。 |
| `send_vacay_invite` | 按用户 ID 邀请某位用户加入假期计划。 |
| `accept_vacay_invite` | 接受加入另一位用户假期计划的待处理邀请。 |
| `decline_vacay_invite` | 拒绝一份待处理的假期计划邀请。 |
| `cancel_vacay_invite` | 取消一份已发出的邀请（仅限所有者）。 |
| `dissolve_vacay_plan` | 解散共享计划 —— 所有成员回到各自的个人计划。 |
| `list_vacay_years` | 列出当前假期计划中跟踪的日历年。 |
| `add_vacay_year` | 向假期计划添加一个日历年。 |
| `delete_vacay_year` | 从假期计划中移除一个日历年。 |
| `get_vacay_entries` | 获取活动计划及特定年份的全部假期日条目。 |
| `toggle_vacay_entry` | 为当前用户把某一天切换为假期日或取消。 |
| `toggle_company_holiday` | 把某个日期切换为整个计划的公司假日。 |
| `get_vacay_stats` | 获取特定年份的假期统计（已用天数、剩余、结转）。 |
| `update_vacay_stats` | 更新特定用户和年份的假期天数额度。 |
| `add_holiday_calendar` | 向假期计划添加一个公共节假日日历（按地区代码）。 |
| `update_holiday_calendar` | 更新某个节假日日历的标签或颜色。 |
| `delete_holiday_calendar` | 从假期计划中移除一个节假日日历。 |
| `list_holiday_countries` | 列出可用于公共节假日日历的国家。 |
| `list_holidays` | 列出某个国家和年份的公共节假日。 |
| `list_vacay_shares` | 列出只读日历分享 —— 你把日历分享给了谁，以及哪些日历分享给了你。 |
| `share_vacay_calendar` | 把当前用户的假期日历分享给另一位用户（仅查看，不合并）。 |
| `unshare_vacay_calendar` | 移除一份只读日历分享 —— 撤销你分享出去的，或移除分享给你的日历。 |
| `get_shared_vacay_calendars` | 获取某个年份分享给当前用户的只读日历（每位分享者的条目和公司假日）。 |

### 旅程 _（需要旅程扩展）_

需要 `journey:read` 或 `journey:write` 权限范围。

| 工具 | 说明 |
|---|---|
| `list_journeys` | 列出当前用户拥有或参与贡献的全部旅程。 |
| `get_journey` | 获取一个旅程的完整快照 —— 元数据、条目、贡献者和关联的行程。 |
| `create_journey` | 创建一个新旅程，可带标题、可选副标题和初始的行程 ID 列表。 |
| `update_journey` | 更新旅程的标题、副标题或状态。 |
| `delete_journey` | 删除一个旅程。 |
| `add_journey_trip` | 把一次已有行程关联到一个旅程。 |
| `remove_journey_trip` | 从旅程中移除一次行程。 |
| `list_journey_entries` | 列出旅程中的所有条目（日期、文字、心情、关联行程）。 |
| `create_journey_entry` | 添加一条条目，可带日期（必填）、可选标题、故事正文、一天中的时段、地点名称、心情和排序。 |
| `update_journey_entry` | 编辑旅程条目的标题、故事、日期、一天中的时段或心情。 |
| `delete_journey_entry` | 从旅程中移除一条条目。 |
| `reorder_journey_entries` | 通过提供新的有序条目 ID 列表来重新排列条目。 |
| `list_journey_contributors` | 列出旅程的贡献者（所有者和编辑者/查看者）。 |
| `add_journey_contributor` | 以 `editor` 或 `viewer` 角色邀请用户加入旅程。 |
| `update_journey_contributor_role` | 在 `editor` 和 `viewer` 之间更改贡献者的角色。 |
| `remove_journey_contributor` | 从旅程中移除一位贡献者。 |
| `update_journey_preferences` | 更新旅程的显示偏好。 |
| `get_journey_suggestions` | 根据最近的行程历史，获取可加入旅程的推荐行程。 |
| `list_journey_available_trips` | 列出当前用户可用于关联到旅程的全部行程。 |
| `get_journey_share_link` | 获取旅程当前的公开分享链接。需要 `journey:share`。 |
| `create_journey_share_link` | 创建或更新旅程的公开分享链接。需要 `journey:share`。 |
| `delete_journey_share_link` | 撤销旅程的公开分享链接。需要 `journey:share`。 |

---

## 受扩展门控的资源

资源通过 `trek://` URI 提供只读访问。以下资源需要启用对应的扩展。

| URI | 扩展 | 所需权限范围 | 说明 |
|---|---|---|---|
| `trek://trips/{tripId}/budget` | 费用 | `budget:read` | 预算与费用条目 |
| `trek://trips/{tripId}/budget/per-person` | 费用 | `budget:read` | 按人合计与分摊明细 |
| `trek://trips/{tripId}/budget/settlement` | 费用 | `budget:read` | 用于结清谁欠谁的建议转账 |
| `trek://trips/{tripId}/packing` | 行李清单 | `packing:read` | 行李清单 |
| `trek://trips/{tripId}/packing/bags` | 行李清单 | `packing:read` | 行李及其分配的成员 |
| `trek://trips/{tripId}/todos` | 行李清单 | `todos:read` | 按位置排序的待办事项 |
| `trek://trips/{tripId}/collab-notes` | 协作 | `collab:read` | 共享的协作笔记 |
| `trek://bucket-list` | 足迹 | `atlas:read` | 你的个人旅行心愿单 |
| `trek://visited-countries` | 足迹 | `atlas:read` | 在足迹中标记为已访问的国家 |
| `trek://atlas/stats` | 足迹 | `atlas:read` | 已访问国家数和大洲分布 |
| `trek://atlas/regions` | 足迹 | `atlas:read` | 手动标记为已访问的国家内地区 |
| `trek://trips/{tripId}/collab/polls` | 协作 | `collab:read` | 一次行程的所有投票及每个选项的票数 |
| `trek://trips/{tripId}/collab/messages` | 协作 | `collab:read` | 一次行程最近的 100 条聊天消息 |
| `trek://vacay/plan` | 假期 | `vacay:read` | 你活动假期计划的完整快照（成员、年份、配置） |
| `trek://vacay/entries/{year}` | 假期 | `vacay:read` | 活动计划及特定年份的全部假期日条目 |
| `trek://vacay/holidays/{year}` | 假期 | `vacay:read` | 计划所配置地区和年份的公共节假日 |
| `trek://journeys` | 旅程 | `journey:read` | 当前用户拥有或参与贡献的全部旅程 |
| `trek://journeys/{journeyId}` | 旅程 | `journey:read` | 单个旅程及其条目、贡献者和关联行程 |
| `trek://journeys/{journeyId}/entries` | 旅程 | `journey:read` | 旅程中的所有条目（日期、文字、心情、关联行程） |
| `trek://journeys/{journeyId}/contributors` | 旅程 | `journey:read` | 旅程的贡献者（所有者和协作者） |

---

## 相关

- [MCP 工具与资源](MCP-Tools-and-Resources)
- [MCP 权限范围](MCP-Scopes)
- [MCP 提示词](MCP-Prompts)
- [MCP 设置](MCP-Setup)
