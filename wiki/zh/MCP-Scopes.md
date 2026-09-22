# MCP 权限范围

OAuth 权限范围精确控制你的 AI 客户端可以读取或写入 Tourism-Team 中的哪些数据。你在 OAuth 授权页面选择权限范围，或者在预先创建 OAuth 客户端时选定。你可以随时撤销访问：在 **设置 → 集成 → MCP** 中删除该 OAuth 客户端或令牌即可。

![OAuth 授权页面](assets/OAuthConsentDCR.png)

## 全部权限范围

Tourism-Team 定义了 17 个权限组下的 35 项权限范围。

| 权限组 | 权限范围 | 权限 |
|---|---|---|
| **行程** | `trips:read` | 查看行程、天数、每日笔记和成员 |
| | `trips:write` | 创建和更新行程；创建、更新和删除天数、每日笔记和住宿；管理成员；复制行程 |
| | `trips:delete` | 永久删除整个行程（不可撤销） |
| | `trips:share` | 创建、更新和撤销行程的公开分享链接 |
| **地点** | `places:read` | 读取地点、每日分配、标签和分类 |
| | `places:write` | 创建、更新和删除地点、分配和标签 |
| **收藏** | `collections:read` | 读取收藏、其中的地点、评分、标注和成员 |
| | `collections:write` | 创建和编辑收藏，保存、评分、标注和复制地点，以及分享列表 |
| **足迹** | `atlas:read` | 读取已访问国家、地区和心愿单 |
| | `atlas:write` | 标记已访问国家和地区，管理心愿单 |
| **行李** | `packing:read` | 读取行李物品、行李和分类负责人 |
| | `packing:write` | 添加、更新、删除、勾选和重新排列行李物品和行李 |
| **待办事项** | `todos:read` | 读取行程待办事项和分类负责人 |
| | `todos:write` | 创建、更新、勾选、删除和重新排列待办事项 |
| **预算** | `budget:read` | 读取预算条目和费用明细 |
| | `budget:write` | 创建、更新和删除预算条目 |
| **预订** | `reservations:read` | 读取预订和住宿详情 |
| | `reservations:write` | 创建、更新、删除和重新排列预订 |
| **协作** | `collab:read` | 读取协作笔记、投票和消息 |
| | `collab:write` | 创建、更新和删除协作笔记、投票和消息 |
| **通知** | `notifications:read` | 读取应用内通知和未读数量 |
| | `notifications:write` | 将通知标为已读或未读（单条或全部） |
| **假期** | `vacay:read` | 读取假期规划数据、条目和统计 |
| | `vacay:write` | 创建和管理假期条目、节假日和团队计划 |
| **地图服务** | `geo:read` | 搜索地点和公共交通路线，解析地图 URL，以及对坐标做反向地理编码 |
| **天气** | `weather:read` | 获取行程地点和日期的天气预报 |
| **旅程** | `journey:read` | 读取旅程、条目和贡献者列表 |
| | `journey:write` | 创建、更新和删除旅程及其条目 |
| | `journey:share` | 创建、更新和撤销旅程的公开分享链接 |
| **文件** | `files:read` | 列出行程上的文档：名称、大小、上传者、关联的对象 |
| | `files:write` | 重命名和描述文件，把它们关联到预订和地点，加星标和移入回收站 |
| | `files:content` | 读取已上传文档的内容，例如预订 PDF 或票据 |
| **设置** | `settings:read` | 读取单位、时间格式、语言、默认货币和起始页 |
| | `settings:write` | 更改单位、时间格式、语言、默认货币和起始页 |
| **插件** | `plugins:use` | 调用管理员已安装并批准的插件所发布的工具 |

## 权限范围规则

- 某个 `:write` 权限范围隐含同一权限组的 `:read` 访问权（例如 `budget:write` 也授予预算数据的读取权）。
- 任何 `trips:*` 权限范围（`trips:read`、`trips:write`、`trips:delete` 或 `trips:share`）都授予行程的读取权。
- `journey:read` 或 `journey:write` 授予旅程的读取权。仅 `journey:share` **不**授予读取权，它只允许管理公开分享链接。
- `files:content` 是**独立于** `files:read` 的权限范围，也不由 `files:write` 隐含。令牌可以列出行程的文档，却不被允许读取其中的内容。内容读取单个文件上限为 10 MB。
- `settings:write` 永远触及不到已存储的凭据。设置中保存的 API 密钥、令牌和 Webhook URL 会被 REST 路由所用的同一份允许清单拒绝，因此助手可以把你切到华氏度，却不能读取或替换你的 Mapbox 密钥。
- `list_trips` 和 `get_trip_summary` 无论权限范围如何都始终可用 —— 它们是导航类工具。
- `plugins:use` 本身不授予任何数据访问权。它让客户端可以调用管理员已安装并批准的插件所发布的工具，而每个插件都按管理员授予它的权限行事 —— 这可能比令牌上的权限范围走得更远。真正的边界是管理员的 `mcp:tools` 授权，而不是这项权限范围。没有任何客户端预设会替你选中它：客户端必须按名称显式请求。
- 静态令牌和 Web 会话 JWT 拥有等同于全部权限范围的完整访问权，`plugins:use` 也包括在内。
- 受扩展门控的工具（行李清单、待办事项、预算、收藏、足迹、协作、假期、旅程）既需要相应的权限范围，**也**需要管理员启用对应的扩展。待办事项工具依托的是**行李清单**扩展，而不是它自己的扩展。

## 选择合适的权限范围

只授予你需要的部分。以下是一些示例：

| 使用场景 | 最小权限范围 |
|---|---|
| 只读 AI 助手 | 与你的数据相关的全部 `:read` 权限范围 |
| 完整的旅行规划助手 | 除 `:delete` 之外的全部权限范围（使用 Claude.ai 或 Claude Desktop 预设） |
| 仅审查预算 | `trips:read` + `budget:read` |
| 行李清单助手 | `trips:read` + `packing:read` + `packing:write` |
| 旅程撰写 | `trips:read` + `journey:read` + `journey:write` |

**设置 → 集成 → MCP → OAuth 客户端** 中的预设按钮会为常见客户端填上一组合理的权限范围。VS Code 默认使用只读权限范围；Claude.ai 和 Claude Desktop 默认使用除 `:delete` 之外的全部权限范围。

## 相关

- [MCP-Setup](MCP-Setup)
- [MCP-Tools-and-Resources](MCP-Tools-and-Resources)
