# 术语表（中英对照）

本表是中文 wiki 的翻译基准。**每一项都以应用界面里实际出现的中文为准**，来源见「依据」列的 i18n 键名——用户在产品里看到的就是这些字，译文若另起炉灶会让人对不上号。

改动本表前，请先在 `shared/src/i18n/zh/` 里核实对应键的实际取值：

```bash
grep -h "'atlas\." shared/src/i18n/zh/atlas.ts
```

术语定下来之后，各页正文的写法见 [参与贡献](Contributing) 与 [应用内帮助](In-App-Help)。

## 核心功能名

| 英文 | 中文 | 依据 |
|---|---|---|
| Atlas | 足迹 | `atlas.subtitle`「你的全球旅行足迹」、`admin.addons.catalog.atlas.name`「足迹」、`oauth.scope.group.atlas`「足迹」 |
| Journey | 旅程 | `journey.title`「旅程」、`journey.subtitle`「实时记录你的旅行」 |
| Collections | 收藏 | `collections.title`「收藏」、`admin.addons.catalog.collections.name`「收藏」 |
| Memories | 照片 | `memories.title`「照片」 |
| Vacay | 假期 | `vacay.subtitle`「规划和管理假期」 |
| Budget / Costs | 预算 / 费用 | 见下方说明 |
| Packing List | 行李清单 | `packing.title`「行李清单」（行程标签页用短形式「行李」，`shared.tabPacking`） |
| Day Plan | 日程计划 | `planner.dayPlan`「日程计划」 |
| Trip | 旅行 | `nav.trip`「旅行」、`nav.myTrips`「我的旅行」 |
| Place | 地点 | `planner.places`「地点」 |
| Bookings / Reservations | 预订 | `planner.bookings`、`planner.reservations` 均为「预订」 |
| Documents | 文档 | `planner.documents`「文档」 |
| Files | 文件 | `files.title`、`inspector.files` 均为「文件」 |
| Check-in | 打卡 | `atlas.checkinTotal`「打卡」、`atlas.checkinTab`「打卡点」 |
| Landmark | 地标 | `atlas.checkinLandmarks`「地标」 |
| Settlement | 结算 | `budget.settlement`「结算」 |
| Optimize (route) | 优化 | `planner.optimize`「优化」 |

## 协作与通知

| 英文 | 中文 | 依据 |
|---|---|---|
| Chat | 聊天 | `collab.tabs.chat` |
| Notes | 笔记 | `collab.tabs.notes` |
| Polls | 投票 | `collab.tabs.polls` |
| What's Next | 接下来 | `collab.whatsNext.title` |
| Trip invite | 旅行邀请 | `notif.trip_invite.title` |
| Todo | 待办事项 | `notif.todo_due.title`「待办事项即将到期」、`todo.detail.title`「任务」 |

## 管理后台

| 英文 | 中文 | 依据 |
|---|---|---|
| Admin | 管理 | `nav.admin`「管理」 |
| Administrator | 管理员 | `nav.administrator` |
| Permissions | 权限设置 | `perm.title`「权限设置」 |
| Invite link | 邀请链接 | `admin.invite.title`「邀请链接」 |
| Audit | 审计 | `admin.tabs.audit`「审计」 |
| Backup | 备份 | `admin.tabs.backup`「备份」 |
| Plugins | 插件 | `admin.tabs.plugins`「插件」 |
| Addons | 扩展 | `admin.tabs.addons`、`admin.addons.title` 均为「扩展」 |
| Passkey | 通行密钥 | `admin.passkey.title`「通行密钥登录」 |
| Notifications | 通知 | `admin.notifications.title`「通知」 |
| Offline | 离线 | `settings.tabs.offline`「离线」 |

## 通用界面词

| 英文 | 中文 | 依据 |
|---|---|---|
| Settings | 设置 | `nav.settings` |
| Help | 帮助 | `nav.help` |
| Share | 分享 | `nav.share` |
| Import | 导入 | `collections.importTitle`「从行程导入」 |
| Export | 导出 | `budget.exportCsv`「导出 CSV」 |
| Environment variable | 环境变量 | `admin.envOverrideHint` 等 |

## 保留英文不译

以下词在任何语境下都保持原文，因为它们是产品名、协议名或技术标识，翻译后反而无法检索：

- **Tourism-Team**、**TT** — 产品名
- **TREK** — 上游开源项目名；仅在明确指代上游项目时出现
- **Docker**、**Docker Compose**、**Portainer**、**Helm**、**Kubernetes**、**Proxmox**、**Unraid**、**Cloudflare**、**OIDC**、**SSO**、**MFA**、**TOTP**、**WebAuthn**、**PWA**、**MCP**、**OAuth**、**API**、**SQLite**、**AMap**、**Leaflet**、**MapLibre**、**Mapbox**、**Google Maps**、**Nominatim**、**Immich**、**Synology**、**WebDAV**、**SMTP**、**ICS**、**GPX**、**KML**、**PDF**、**CSV**、**JSON**、**YAML**、**Node.js**、**npm**、**React**、**NestJS**、**Vite**、**Vitest**、**Playwright**
- 代码块、命令行、文件路径、环境变量名、配置键、URL、API 端点、函数名、插件 ID

## 需要说明的取舍

### Collections 是「收藏」，里面的条目才叫「列表」

这一组最容易译错，务必分清：

- **Collections（收藏）**：功能名与页面标题。`collections.title`「收藏」、`admin.addons.catalog.collections.name`「收藏」、副标题 `collections.subtitle`「你保存的地点，按列表整理」
- **list（列表）**：收藏**内部**的具名分组。`collections.saveNToList`「将 {count} 个保存到列表」、`collections.noOwnLists`「你还没有列表」、`collections.moveToList`「移动到列表」

所以 wiki 里写「打开**收藏**，把地点存进某个**列表**」，不要写成「打开列表」。

### Packing List 是「行李清单」

`packing.title`「行李清单」。行程标签页用短形式「行李」（`shared.tabPacking`）。注意**扩展目录里这个模块叫「列表」**（`admin.addons.catalog.packing.name`），是全站唯一的例外用法——wiki 正文一律写「行李清单」，只在需要对照管理后台截图时提一句。

### Budget 与 Costs：预算 / 费用

应用里两个词都用，但语境不同，翻译时必须跟着走：

- **预算（Budget）**：模块名与规划视角。`budget.title`「预算」、`budget.emptyTitle`「尚未创建预算」、`admin.addons.catalog.budget.name`「费用」（目录里叫费用，是既有文案的不一致）
- **费用（Costs）**：行程内的标签页与具体支出。`shared.tabBudget`「费用」、`costs.youOwe`「你欠款」、`planner.totalCost`「总费用」

规则：讲**功能模块与规划**时用「预算」；讲**行程里那个标签页和具体花费**时用「费用」。中文 wiki 的「费用」页对应英文的 Budget-Tracking。

### Addons 与 Plugins：扩展 / 插件

两者是独立的管理后台标签页，机制也不同，**不要混用**：

- **Addons（扩展）**：随产品发布的功能模块，管理员在「管理 → 扩展」里开关，如费用、行李清单、足迹。副标题是「启用或禁用功能以自定义你的 TREK 体验。」
- **Plugins（插件）**：用户从插件目录安装的第三方扩展，在「管理 → 插件」里管理

依据：`admin.tabs.addons`「扩展」、`admin.tabs.plugins`「插件」。注意 `admin.plugins.dep.addonDisabledToast` 的文案把 addons 称作「插件模块」，属既有文案的不一致，**wiki 不跟随**。

### 行程标签页的短形式

行程内的标签用短形式，与功能页标题不同，截图里会看到：

| 标签 | 中文 | 依据 |
|---|---|---|
| Plan | 计划 | `shared.tabPlan` |
| Bookings | 预订 | `shared.tabBookings` |
| Packing | 行李 | `shared.tabPacking` |
| Budget | 费用 | `shared.tabBudget` |
| Chat | 聊天 | `shared.tabChat` |

## 截图中的界面文案

中文 wiki 的截图取自 `app_language=zh` 下的真实界面，因此图中文字会与上表一致。截图里的演示数据（行程名、成员名、地点名）同样使用中文，见 `client/e2e/screenshots/seed.ts`。
