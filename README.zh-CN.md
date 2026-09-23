<div align="center">

# ⚠️ AI 编写项目 / AI-WRITTEN PROJECT

<big><strong>本项目全程由 AI 编写，可能存在反人类操作。使用前请自行验证，并做好数据备份。</strong></big><br>
<strong>This project was written entirely by AI and may contain unintuitive or hostile-to-human workflows. Verify everything and keep backups.</strong>

</div>

<p align="center"><strong>特别鸣谢：DeepSeek · GLM · GPT · A/</strong></p>

<p align="center">
  <strong>简体中文</strong> · <a href="README.md">English</a>
</p>

# TT Travel Planner

一个支持自托管、实时协作、交互式地图和 AI 功能的旅行规划平台。你可以按天规划行程、管理费用和预订、记录旅行日志，并通过 Atlas 探索和记录去过的地方。

[![License](https://img.shields.io/badge/license-AGPL_v3-6B7280?style=flat-square)](LICENSE)
![Version](https://img.shields.io/badge/version-0.7.2-blue?style=flat-square)

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
- 中国 34 个省级地区及 89 个地标
- 地标签到和地点签到
- 收藏夹、假期日历和行程记录

### 🤖 AI 与扩展

- 基于 OpenAI/Anthropic 的预订解析
- MCP 集成，可连接 Claude Desktop
- 基于 IFRAME 的插件系统

---

## 🆕 v0.7.2 更新

**如果你下载了 0.7.1 的 Windows 免安装包，这一版修好了它 —— 请重新下载。**
包能正常启动、`/api/health` 也有响应，但打开任何页面都是 404。这不是你的机器
或解压方式的问题。

### 修复

- **Windows 免安装包不提供任何页面（0.7.1 回归）。** 服务端只在
  `NODE_ENV=production` 时才提供构建好的前端，而启动器刻意不设置它 —— 因为
  production 会同时开启 `Secure` 会话 cookie 和 HSTS，而这两者会破坏纯 HTTP 的
  `http://localhost` 安装：浏览器会静默丢弃 cookie，于是登录**看起来**成功了，
  却立刻被弹回登录页。同一个开关在回答两个不同的问题。现在改为判断「是否真的
  存在构建好的前端」—— 这才是它本来要问的问题 —— 而 cookie 与 HSTS 的行为
  完全不变。开发检出（没有构建产物）仍照旧使用 Vite 开发服务器。
- **桌面版安装的 OIDC 回调跳转到了错误地址。** 同一个根因、同样是一行的形态：
  回调地址也是用 `NODE_ENV` 拼出来的，因此在免安装包上用 SSO 登录会被送到用户
  机器上并不存在的 5173 端口 Vite 开发服务器。这个缺陷在「所有页面都 404」的
  状态下无法触达，所以此前没有被单独报告。

### 本版还包括

- 覆盖服务开关与桌面版 cookie 行为的回归测试，避免日后有人靠悄悄打开生产环境
  安全设置来「修好」页面，却把纯 HTTP 下的登录弄坏。

---

## 0.7.1（详情）

### Windows 免安装包

Tourism-Team 现在可以在 Windows 上运行，无需 Docker，也无需安装 Node：从 [Releases 页面](https://github.com/bhxnms/T-T/releases) 下载 zip，解压后双击启动器即可。运行时和全部依赖都已随包提供，不做系统级安装，删掉文件夹就等于彻底卸载。完整说明见 [安装：Windows（免安装版）](https://github.com/bhxnms/T-T/wiki/Install-Windows)。

启动器会在应用启动**之前**选好端口，因为 Windows 上 3000/3001 经常被其他程序占用（其他开发服务器、Hyper-V 的动态端口保留区）。首选端口被占用时会自动顺延到下一个可用端口、明确告知并记住选择 —— 因此端口冲突不会变成报错页面，浏览器书签也不会失效。控制台窗口会特意保持开启：首次运行会在此打印生成的管理员密码，而那是它唯一出现的地方。

### Cloudflare 隧道不再假定 Docker

面板的连接器设置此前写死为容器布局，导致在任何其他安装方式上都是错的 —— 而且错得很隐蔽：连接器正常启动、域名正常解析，但每个请求都返回 **502**，看起来像隧道坏了而不是设置填错了。

共三处调整。入站目标原为 `http://app:<端口>`，但 `app` 是 compose 服务名，只在该网络内可解析；现在它是可配置的**服务主机**，默认 `app` 因此未改动过的 Docker 部署行为完全不变，而 Windows 免安装包和裸机部署填 `localhost`。默认端口原为写死的 3000，只对镜像成立；现在默认取进程**实际监听的端口** —— 服务端是唯一知道答案的组件。连接器指令也按实际运行方式渲染：Docker 内给 compose sidecar，Docker 外给二进制命令。

面板还会显示解析后的目标地址，因为主机填错和端口填错的表现完全相同且无声。

### 修复

- **Windows 上从源码构建**会以 `spawnSync tsc ENOENT` 失败：构建脚本按名字调用 `tsc`，而 Windows 只提供 `tsc.cmd` 外壳，`execFileSync` 不会去查它。现已改为按路径解析编译器，一条命令在各平台通用。

---

## 0.7.0（详情）

### 中文文档，以及语言切换

应用内帮助 Wiki 现在提供完整的**简体中文**版本——102 个页面连同对应截图——Wiki 顶部的切换器可在中英文之间切换，且不影响应用自身的语言设置。选择会按浏览器记住，也可以通过链接分享（`?lang=zh`）。缺失的页面会回退到英文，而不是显示空白文档。

好读的 Wiki 也要好翻：切换页面时左侧目录会保持原有滚动位置；跨页小节链接（如 `Atlas#打卡点`）现在会滚动到所指小节，而不是停在目标页顶部；插件页面也明确注明插件系统沿用 TREK，TT 不对其提供保证。

### Cloudflare 隧道：在管理面板里完成配置

此前把实例发布到公网，需要照着文档手动编辑 cloudflared 配置。现在 **管理 → Cloudflare 隧道** 接管了 Cloudflare 那一半工作：填入 API 令牌并测试后，面板会创建隧道、写入入站规则、把 DNS 指向你的域名，并给出要运行的连接器命令。该功能**默认关闭**，关闭期间不存储任何内容，因此已经自行运行隧道、nginx 或 Caddy 的运维者完全不受影响。

连接器仍然有意保持为独立进程——应用容器以只读方式运行且丢弃了自身能力，无法承载第二个长期运行的二进制文件。`docker-compose.yml` 中预留了被注释的 `tunnel:` 服务供填入令牌。Wiki 也新增了一份从零开始的教程，面向从未配置过隧道的用户，逐步说明每步要获得什么、需要运行什么。

### 足迹：打卡点，以及正确的中国地图

- **打卡点**已有文档且可直达：地图上的预设地标，加上你自己旅行中的地点，在足迹侧栏统一计数。给行程地点打卡时，还会把它所在的国家和地区一并标记为去过——记录“我来过这里”不再需要另外去点一次国家。
- **争议地区归入中国。** 足迹此前把若干有争议的几何图形绘制为独立要素。现在 Demchok、藏南边界、西沙与尖阁/钓鱼岛以及中印边界，都是通过**几何相减**对照内置覆盖数据归入中国，而不是按名称匹配，因此结果不取决于数据集中边界的拼写方式。
- **拖动地图时省份重新可高亮。** 视图移到其他国家后，省级图层此前不再响应——因为对中国省份的请求被“中国已在屏幕内”这个条件挡住了。台湾的地区现在也会归一化到 CN 键，使省份名称查找能够匹配。

### 路线可在高德 App 中打开，且数据正确

- 在手机上导出某天的路线时，现在会交给已安装的**高德 App**（Android 用 `amapuri://`，iOS 用 `iosamap://`），若短时间无响应则回退到网页链接。App 形式会带上**全部**途经点；网页形式此前只接受一个。
- 高德的网页导出现已改用带索引的 `ditu.amap.com/dir` 形式，能保留所有站点、转换为 GCJ-02，并且不再截断含逗号的名称。
- 客户端的 GCJ-02 转换缺少标准正弦项。由于它能往返一致，测试一直是通过的，但对照高德自身服务偏差达 170–330 米。现在与服务端实现一致，误差在 1 米以内。

### 其他修复

- **密码策略错误已本地化。** 服务端在返回英文句子的同时返回机器可读的错误码（`tooShort`、`tooCommon` 等），因此注册、重置、强制改密、两个设置界面和管理员用户编辑界面都会以用户的语言显示提示。
- **首次部署凭据移到登录页。** 它们原本出现在登录**之后**一个不可关闭的弹窗里，既进不去（关闭和确定按钮都不渲染），也没有意义——登录表单才是唯一需要它们的地方，而该弹窗只能显示已被替换过的旧密码。凭据也不再写入浏览器的配置缓存。
- **移动端顶栏新增“帮助”入口**，与设置、管理并列，手机上也能进入 Wiki。
- **Wiki 与演示模式文案**不再把上游项目的品牌词汇泄漏到面向用户的文字和文档中。

---

## v0.6.2（详情）

### 高德分享链接现在能正确解析

两个解析缺陷，均已用真实分享文本复现：

- 分享链接会紧贴前面的中文粘贴（`…14层1401https://surl.amap.com/…`），中间没有任何分隔。原解析按空白切分后，又“从第一个中文字符起全部删除”，把 URL 一起删掉了，因此整条消息解析为空。现在改为直接在文本中搜索链接，遇到不能构成 URL 的字符即停止。
- 位置口令消息末尾带着被破坏的 `\:高德地图:// a@amap.com`，`new URL()` 会把它解析为 host 为 `amap.com`、用户名为 `a` 的合法地址。它因此被当成有效链接，服务端据此抓取高德首页，并返回页面上恰好出现的某个无关地点——一个看起来完全可信的错误地址。现在带凭据的 URL 一律拒绝，服务端不再抓取任何页面正文查找编号，位置口令会被识别并明确说明无法解析，而不是拿数字去搜索。

### 分享链接无需 Web 服务 Key 也能用

高德分享链接跳转后的页面会把坐标直接放在链接里（`?p=<编号>,<纬度>,<经度>,<名称>,<地址>`），因此在完全未配置高德 Key 的实例上也能通过分享链接添加地点。坐标是 GCJ-02，会转换成应用存储使用的 WGS-84 坐标系。

### 可发现性与导航

- 地点搜索框下方现在会提示可以粘贴高德分享链接。该导入没有独立按钮——它跟随搜索按钮触发——此前界面上没有任何提示，实际上等于不可发现。
- 地点详情卡片的导航菜单新增 **AMap（高德地图）** 入口，与 Google Maps、Waze、Apple Maps 并列。

### 修复

- 21 个非英文语言缺失 0.6.0 新增的 `system_notice.bootstrap_password` 文案，由 i18n parity 检查发现。

---

## v0.6.1（详情）

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
IMAGE_TAG=0.7.2
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
docker pull ghcr.io/bhxnms/tt-planner:0.7.2
docker run -d --name tt-planner --restart unless-stopped \
  -p 3000:3000 \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/uploads:/app/uploads" \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  -e ADMIN_EMAIL=admin@example.com \
  -e ADMIN_PASSWORD='replace-with-a-strong-password' \
  ghcr.io/bhxnms/tt-planner:0.7.2
```

请备份 `ENCRYPTION_KEY`，容器重建时必须继续使用相同的值。

### Windows（免安装版，无需 Docker）

针对单台 Windows 电脑另有免安装包：解压后双击启动器即可，无需 Docker，也无需预先安装 Node —— 运行时已内嵌。端口冲突在启动前处理（启动器自动顺延到下一个可用端口并明确告知），因为 Windows 上 3000/3001 经常被其他软件占用。

> 该版本不支持从邮件/PDF 导入订单：它依赖一个仅以 Linux 二进制形式提供的 KDE 组件。其余功能均正常。

从 [Releases](https://github.com/bhxnms/T-T/releases) 下载文件名以 `-win-x64.zip` 结尾的包，完整说明（防火墙提示、升级步骤等）见 [安装：Windows（免安装版）](https://github.com/bhxnms/T-T/wiki/Install-Windows)。

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
