<div align="center">

# ⚠️ AI 编写项目 / AI-WRITTEN PROJECT

<big><strong>本项目全程由 AI 编写，可能存在反人类操作。使用前请自行验证，并做好数据备份。</strong></big><br>
<strong>This project was written entirely by AI and may contain unintuitive or hostile-to-human workflows. Verify everything and keep backups.</strong>

</div>

<p align="center">
  <strong>简体中文</strong> · <a href="README.md">English</a>
</p>

# TT Travel Planner

一个支持自托管、实时协作、交互式地图和 AI 功能的旅行规划平台。你可以按天规划行程、管理费用和预订、记录旅行日志，并通过 Atlas 探索和记录去过的地方。

[![License](https://img.shields.io/badge/license-AGPL_v3-6B7280?style=flat-square)](LICENSE)
![Version](https://img.shields.io/badge/version-0.6.1-blue?style=flat-square)

---

## ✨ 核心功能

### 🗺️ 行程规划与地图

- **交互式地图**：支持 Mapbox、MapLibre、高德地图，提供聚类和路线展示
- **活动管理**：支持拖拽排程、时间规划和双视图
- **高德地图集成**：适合中国旅行的地点搜索和导航
- **地点搜索**：集成 Google Places、OpenStreetMap 和高德地图
- **智能路线**：自动排序、多种交通方式和导航应用跳转
- **天气预报**：16 天预报和历史天气
- **导入导出**：支持 Google Maps 列表、GPX、KML、KMZ 和 ICS

### 🗓️ 活动与日程

- **统一时间线**：在同一视图管理地点和预订
- **拖拽排程**：在一天内或不同天之间调整活动
- **时间安排**：设置开始时间和持续时间
- **双视图模式**：经典日程视图和现代活动视图
- **实时同步**：多设备即时同步修改

### 🧳 预订与费用

- 支持航班、火车、酒店、活动等 16+ 种预订类型
- 从邮件、PDF 和 PKPass 中提取预订信息
- 多旅行者、确认码、状态管理
- 自定义份额、多人付款和结算建议
- 多币种费用及固定汇率
- 行李清单模板、待办事项和提醒

### 👥 实时协作

- WebSocket 实时更新
- 细粒度行程权限
- 用户名、邮箱和邀请链接邀请成员
- 只读公开分享页面
- 群聊、共享笔记、投票和活动协调

### 📔 旅行日志与足迹

- Journey Studio：照片、视频、心情和天气记录
- Atlas 互动地图：追踪访问过的国家和地区
- 中国 34 个省级地区及 200+ 地标
- 地标签到和地点签到
- 收藏夹、假期日历和行程记录

### 🤖 AI 与扩展

- 基于 OpenAI/Anthropic 的预订解析
- MCP 集成，可连接 Claude Desktop
- 基于 IFRAME 的插件系统

---

## 🆕 v0.6.1 更新

### 测试套件修复

- `MapViewAMap.test.tsx` 有四个用例失败：其 store mock 忽略 selector，每次都返回一个新建的对象，导致组件读取的高德 Key 在每次渲染时都是新值。这会让地图生命周期 effect 反复重建，`ready` 始终无法稳定，标记也就永远画不出来。现在 mock 会正确响应 selector，六个用例全部通过，每个约 60 毫秒，而不再是 3 秒超时。
- 移动端 Atlas 中断言“不存在任何开关”的用例，改为针对它真正要验证的“计划国家开关”。预设地标开关是刻意始终渲染的，原来的宽泛查询本身就不正确。
- places e2e 测试自行手写建表语句，缺少新增的 `amap_id` 列，导致该套件中所有地点写入都返回 500。
- 两处断言按 POI 接口现在接收的 provider 参数更新（`mapsApi.pois` / `MapsService.pois`）。

### 0.6.0 已有功能

- 通过高德搜索添加的地点会获取该 POI 的图片并作为缩略图，由服务端下载后存入现有照片代理缓存。
- 地点搜索框支持高德分享链接与 App 的“分享”文本。
- `amap_js_api_key` 现已纳入加密密钥轮换。

---

## v0.6.0（详情）

### 高德地点自动带上图片

- 通过高德搜索添加的地点会记住其 POI 编号，服务端据此获取该 POI 自身的图片并作为地点缩略图。确实没有图片的 POI 保持无缩略图，不会填充占位图。
- 图片由服务端下载后存入现有的照片代理缓存，与 Google、Wikimedia 的处理方式一致；不使用外链热链接，因此高德 CDN 的防盗链或链接过期都不会让缩略图日后变空白。
- 取图过程与保存分离：地点立即返回，缩略图随后通过 websocket 推送；且绝不会覆盖地点已有的图片。

### 支持从高德分享链接导入地点

- 地点搜索框现在可以直接接受高德链接：`www.amap.com/place/…`、`ditu.amap.com/place/…`，以及 `surl.amap.com` / `uri.amap.com` 短链，或裸 POI 编号。
- 高德 App 的“分享”整段文本可直接粘贴：程序会从句子中提取链接，因为剪贴板里实际就是这样的文本。
- 解析通过高德 POI 编号调用 `/v5/place/detail`，因此名称、地址和坐标都来自该 POI 本身，而不是反查地理编码的推测结果。每一次跳转都重新经过 SSRF 校验。

### 修复

- `amap_js_api_key` 在数据库中加密存储，但此前遗漏于密钥轮换脚本；一旦轮换加密密钥，所有用户的高德浏览器 Key 都会静默失效。现已纳入轮换范围。

### 0.5.4 已有改进

- 高德地点搜索改用符合文档的 v5 请求契约（`page_size` / `page_num` / `show_fields`，有坐标时使用 `place/around`）。
- 高德搜索结果包含照片、评分、营业时间、电话和分类详情。
- 高德拥有独立、加密、按用户隔离的 Web JS API Key 设置。

### 0.5.3 已有改进

- 移动端 Atlas 新增与桌面端一致的“一键隐藏预设打卡点”开关。
- 启用高德地点搜索时，“在地图上探索地点”会从高德查找附近餐厅、酒店及分类地点。
- 首次部署的管理员会收到一次性初始凭据通知，并且必须修改预设密码后才能继续使用。

---

## v0.5.4（详情）

### 修复高德地点搜索

- 此前调用高德 v5 POI 接口时误用了 v3 的参数名（`offset`、`page`、`extensions`），并读取 v3 的响应路径（`biz_ext`）。高德对这类请求返回 `status: 0`，搜索随后回退到 OpenStreetMap，而 OSM 在国内网络通常不可达，因此用户只能看到“地点搜索失败”。
- 现已改为符合 v5 文档的调用方式：分页使用 `page_size` / `page_num`，详情字段使用 `show_fields=business,photos`；只要存在坐标就改用 `place/around`（`place/text` 不接受 `location` 和 `radius`）；详情字段从 `poi.business` 读取。
- 高德搜索结果只展示评分本身。高德不返回评价数量，代码中不会用人均价格冒充评价数。
- 新增 14 个回归测试，覆盖 v5 参数名、接口选择、字段路径和 GCJ-02 → WGS-84 坐标转换。

### 构建可靠性

- Docker 构建增加一小时超时上限，并在所有构建阶段启用 npm 下载重试。此前模拟 arm64 构建曾卡住近六小时才被取消，且重试参数只覆盖了部分构建阶段。

### 0.5.3 已有改进

- 移动端 Atlas 新增与桌面端一致的“一键隐藏预设打卡点”开关。
- 启用高德地点搜索时，“在地图上探索地点”会从高德查找附近餐厅、酒店及分类地点。
- 首次部署的管理员会收到一次性初始凭据通知，并且必须修改预设密码后才能继续使用。
- “报告错误”和“功能建议”现在指向 TT GitHub 页面。

### 0.5.2 已有改进

- 高德搜索结果包含照片、评分、营业时间、电话和分类详情。
- 高德拥有独立、加密、按用户隔离的 Web JS API Key 设置。
- 天气 API 说明改为“TT沿用TREK天气API”。

---

## 🚀 从仓库部署

### 使用 GHCR 预构建镜像（推荐）

项目发布了支持 `linux/amd64` 和 `linux/arm64` 的多架构镜像：

```text
ghcr.io/bhxnms/tt-planner
```

在新机器上执行：

```bash
git clone https://github.com/bhxnms/T-T.git
cd T-T
cp .env.example .env
# 编辑 .env，设置 ENCRYPTION_KEY、ADMIN_EMAIL 和 ADMIN_PASSWORD
mkdir -p data uploads
docker compose pull
docker compose up -d
```

默认访问：

```text
http://localhost:3000
```

生产环境建议在 `.env` 中固定版本：

```env
IMAGE_TAG=0.6.1
```

`latest` 表示最新稳定版本。若 GHCR 包是私有的，先登录：

```bash
echo "$CR_PAT" | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
```

### 从源代码构建

如果需要验证未发布代码，可以在仓库目录执行：

```bash
docker compose up -d --build
```

不要把 volume 挂载到 `/app`，只持久化：

- `./data:/app/data`：数据库、加密密钥和日志
- `./uploads:/app/uploads`：照片和文件

停止或更新：

```bash
docker compose down
# 预构建镜像
docker compose pull && docker compose up -d
# 源码构建
git pull && docker compose up -d --build
```

首次管理员账号只在数据库没有用户时生效，`ADMIN_EMAIL` 和 `ADMIN_PASSWORD` 必须同时设置。如果都留空，系统会创建 `admin@tt.local` 并在日志中打印随机密码。

### 不使用 Compose 的 Docker 命令

```bash
git clone https://github.com/bhxnms/T-T.git
cd T-T
mkdir -p data uploads
docker pull ghcr.io/bhxnms/tt-planner:0.6.1
docker run -d --name tt-planner --restart unless-stopped \
  -p 3000:3000 \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/uploads:/app/uploads" \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  -e ADMIN_EMAIL=admin@example.com \
  -e ADMIN_PASSWORD='replace-with-a-strong-password' \
  ghcr.io/bhxnms/tt-planner:0.6.1
```

请备份 `ENCRYPTION_KEY`，容器重建时必须继续使用相同的值。

---

## ⚙️ 环境变量

| 变量                             | 用途                                            |
| -------------------------------- | ----------------------------------------------- |
| `HOST_PORT`                      | Compose 映射到宿主机的端口，容器端口固定为 3000 |
| `IMAGE_TAG`                      | 使用的 GHCR 镜像标签                            |
| `ENCRYPTION_KEY`                 | 加密 API key、MFA、SMTP 和 OIDC 等敏感信息      |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 空数据库的首个管理员账号                        |
| `TZ`                             | 日志、提醒和任务时区，默认 `UTC`                |
| `LOG_LEVEL`                      | `info` 或 `debug`                               |
| `ALLOWED_ORIGINS`                | CORS 允许的来源列表                             |
| `APP_URL` / `OIDC_*`             | 可选的 OpenID Connect 配置                      |

设置 `OIDC_ONLY=true` 后会关闭密码登录，首个 SSO 用户成为管理员，本地管理员变量不再使用。

---

## 🛠️ 从源码开发

前置条件：Node.js 24+、npm 11+。SQLite 是默认本地数据库，生产环境推荐 Docker。

```bash
git clone https://github.com/bhxnms/T-T.git
cd T-T
npm install
npm run build --workspace=shared
cp server/.env.example server/.env
npm run dev --workspace=server
# 另开终端
npm run dev --workspace=client
```

构建和测试：

```bash
npm run build
npm test
npm run e2e --workspace=client
```

---

## 📂 项目结构

```text
T-T/
├── client/              # React 前端
├── server/              # Node.js 后端
├── shared/              # 共享类型和工具
├── wiki/                # 应用内帮助文档
├── Dockerfile           # 多阶段生产镜像
└── docker-compose.yml   # 生产部署配置
```

---

## 🗺️ 地图提供商

支持 Mapbox GL、MapLibre GL、高德地图和 OpenStreetMap。

## 🔒 安全与隐私

- 自托管，数据保存在自己的服务器
- AGPL v3 开源许可
- 细粒度权限控制
- 可选的公开分享

## 📝 许可证

本项目使用 GNU Affero General Public License v3（AGPL-3.0），详见 [LICENSE](LICENSE)。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request。请注意顶部的 AI 编写提示：所有行为和部署步骤都应在目标环境中自行验证。

---

**为旅行者打造 ❤️**
