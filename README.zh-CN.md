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
![Version](https://img.shields.io/badge/version-0.5.1-blue?style=flat-square)

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

## 🆕 v0.5.1 更新

- Atlas 地标标记和签到功能改进
- 桌面端和移动端均可对地点进行签到
- Photon 作为 Nominatim 的备用地点搜索服务
- 移除上游 TREK 更新检查
- 桌面端和移动端行程加载界面更新
- 国际化 key parity 恢复，测试套件保持绿色

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
IMAGE_TAG=0.5.1
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
docker pull ghcr.io/bhxnms/tt-planner:0.5.1
docker run -d --name tt-planner --restart unless-stopped \
  -p 3000:3000 \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/uploads:/app/uploads" \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  -e ADMIN_EMAIL=admin@example.com \
  -e ADMIN_PASSWORD='replace-with-a-strong-password' \
  ghcr.io/bhxnms/tt-planner:0.5.1
```

请备份 `ENCRYPTION_KEY`，容器重建时必须继续使用相同的值。

---

## ⚙️ 环境变量

| 变量 | 用途 |
|---|---|
| `HOST_PORT` | Compose 映射到宿主机的端口，容器端口固定为 3000 |
| `IMAGE_TAG` | 使用的 GHCR 镜像标签 |
| `ENCRYPTION_KEY` | 加密 API key、MFA、SMTP 和 OIDC 等敏感信息 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 空数据库的首个管理员账号 |
| `TZ` | 日志、提醒和任务时区，默认 `UTC` |
| `LOG_LEVEL` | `info` 或 `debug` |
| `ALLOWED_ORIGINS` | CORS 允许的来源列表 |
| `APP_URL` / `OIDC_*` | 可选的 OpenID Connect 配置 |

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
