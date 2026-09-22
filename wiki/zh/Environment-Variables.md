# 环境变量

Tourism-Team 会读取的所有环境变量的完整参考。

## 如何设置变量

- **Docker Compose** —— 使用 `environment:` 块，或与 `docker-compose.yml` 放在一起的 `.env` 文件
- **Docker run** —— 用 `-e VARIABLE=value` 逐个传入变量
- **Helm** —— 在 `values.yaml` 中用 `env:` 传普通值、用 `secretEnv:` 传敏感值。该 chart 只
  透传它声明过的键（`templates/configmap.yaml` 中 26 个，`templates/secret.yaml` 中 5 个），因此  不在其中的变量会被静默丢弃 —— 请把它 patch 到 Deployment 上，或加入 chart
- **Unraid** —— 在容器模板编辑器中设置
- **Proxmox 社区脚本** —— 在 `/opt/trek/server/.env` 中设置

---

## 启动校验

Tourism-Team 会在启动时对这个界面上的几乎所有配置做一次检查。**未设置或留空**的变量会回退到其文档中的默认值；**存在但格式错误**的变量会中止启动，并给出一份汇总报告，列出每一个有问题的取值：

```
Invalid environment configuration:
  - PORT="not-a-port": must be a port number (1-65535)
  - SESSION_DURATION="bogus": must be a duration like "1h", "7d" or "30d"
```

在 Docker 中，这会让容器反复崩溃重启，直到该值被修正或移除。布尔开关接受`true`/`false`、`1`/`0`、`on`/`off`、`yes`/`no`（不区分大小写）—— 其他任何写法都算格式错误。Tourism-Team不认识的变量会原样透传。

`TREK_DB_JOURNAL_MODE` 和 `TREK_DB_SYNCHRONOUS` 是例外：它们会记录一条警告并回退，而不是中止启动，因为 `reset-admin.js` —— 在被锁在实例之外时恢复访问的途径 —— 会读取同样的两个变量，必须保持可用。三个插件上限 `TREK_PLUGIN_AI_PER_DAY`、`TREK_PLUGIN_NOTIFY_PER_DAY` 和`TREK_PLUGIN_AUDIT_MAX_ROWS` 由插件宿主而非启动 schema 读取，因此其中格式错误的值会静默回退到默认值，不产生警告。`NODE_ENV` 和 `TZ` 完全不做校验，所以像`NODE_ENV=staging` 这样的非标准取值仍能启动。

---

## 核心

| 变量 | 说明 | 默认值 |
|---|---|---|
| `PORT` | 服务器端口 | 源码：`3001`，Docker：`3000` |
| `HOST` | HTTP 服务器的绑定地址（如 `127.0.0.1`、`10.0.0.72`）。**仅适用于源码 / Proxmox 安装** —— 不要在 Docker 或任何容器化部署中设置。见下方说明。 | 所有接口 |
| `NODE_ENV` | 运行环境（`production` / `development`） | `production` |
| `ENCRYPTION_KEY` | 静态加密密钥 —— 见下方的解析顺序 | 自动 |
| `TZ` | 日志、提醒和定时任务的时区（如 `Europe/Berlin`） | `UTC` |
| `LOG_LEVEL` | `info` = 简洁的用户操作；`debug` = 详细的调试信息 | `info` |
| `DEFAULT_LANGUAGE` | 登录页面的默认语言 —— 见下方支持的语言代码 | `en` |
| `SESSION_DURATION` | 登录会话在需要重新登录之前保持有效的时长。当登录表单上**未勾选「记住我」**（默认情况）时使用：作用于 `trek_session` JWT 的 `exp` 声明，且 Cookie 以**浏览器会话 Cookie** 的形式下发（无 `maxAge`，浏览器关闭时清除）。接受 `ms` 风格的字符串：`1h`、`12h`、`7d`、`30d`、`90d`。无效值会中止启动 —— 见上方「启动校验」。不影响短期的 MFA 挑战令牌或 MCP OAuth 令牌（它们保留各自的 TTL）。 | `24h` |
| `SESSION_DURATION_REMEMBER` | 用户在登录时**勾选「记住我」**时所使用的会话时长：有效期更长的 JWT `exp` 声明，外加一个 `maxAge` 与之匹配的**持久化** `trek_session` Cookie，因此会话在浏览器重启后依然有效。格式与 `SESSION_DURATION` 同为 `ms` 风格，启动校验也相同。 | `30d` |
| `ALLOWED_ORIGINS` | 用于 CORS 和邮件通知链接的逗号分隔来源列表 | 同源 |
| `ALLOW_INTERNAL_NETWORK` | 允许向私有/RFC-1918 IP 发起出站请求。如果 Immich 或其他集成服务位于你的本地网络，请设为 `true`。回环（`127.x`）和链路本地（`169.254.x`）地址无论如何都会被阻止。 | `false` |
| `APP_URL` | 公开的基础 URL（如 `https://tt.example.com`）。启用 OIDC 时必填 —— 必须与你在 IdP 注册的重定向 URI 一致。也用作邮件通知链接和可订阅日历源 URL（「订阅」对话框交给 Google/Apple/Outlook 的 `webcal://`/`https://` 链接）的基础 URL。 | — |
| `TREK_WIKI_DIR` | 应用内帮助页面（`/help`）读取内容的位置。Tourism-Team 随附本 wiki 并从磁盘提供，因此文档始终与你运行的版本一致。通常不需要设置 —— 这是为非常规目录布局预留的应急出口。如果找不到该目录，「帮助」会退回到从 GitHub 的 `main` 分支拉取仓库的 `wiki/` 文件夹（可能比你运行的版本更新，且需要出站网络访问）。 | 随附的 `wiki/` 目录 |

### `HOST` —— 仅源码与 Proxmox 安装

默认情况下 Tourism-Team 绑定到所有网络接口（`0.0.0.0`），这在容器内是正确行为，因为端口暴露由 Docker在宿主机层面处理。设置 `HOST` 会在 Node.js 层面覆盖绑定地址。

**何时使用：**仅当你在宿主机上直接运行 Tourism-Team（git 源码或[Proxmox 社区脚本](Install-Proxmox)），且需要限制服务器监听的接口时 —— 例如，只在 LAN 接口上暴露 Tourism-Team，而不在面向公网的接口上暴露。

**切勿在 Docker、Docker Compose、Helm 或 Unraid 部署中设置 `HOST`。**请改用 Docker 的`-p <host-ip>:<host-port>:<container-port>` 语法或你的编排工具的端口绑定。

```
# .env — source / Proxmox installs only
HOST=10.0.0.72   # bind only on this LAN interface
PORT=3001
```

设置了 `HOST` 时，启动横幅会包含一行 `Host:`，确认实际绑定的地址。

### `ENCRYPTION_KEY` —— 解析顺序

`server/src/config.ts` 按以下顺序解析加密密钥：

1. **`ENCRYPTION_KEY` 环境变量** —— 显式值，始终优先。会自动持久化到 `data/.encryption_key`。
2. **`data/.encryption_key` 文件** —— 任何至少启动过一次的安装都会有此文件。
3. **`data/.jwt_secret` 文件** —— 为未预先设置密钥就升级的现有安装提供的一次性回退。该值会
   立即持久化到 `data/.encryption_key`，这样之后轮换 JWT 就不会破坏解密。
4. **自动生成** —— 以上都不存在的全新安装；持久化到 `data/.encryption_key`。

建议显式设置 `ENCRYPTION_KEY`，这样你就能独立于数据卷单独备份它。

### `DEFAULT_LANGUAGE` —— 支持的语言代码

你可以把 `DEFAULT_LANGUAGE` 设为 Tourism-Team 随附的 23 种语言中的任意一种。当前支持的代码如下：

| 代码 | 语言 |
|---|---|
| `en` | English |
| `de` | Deutsch |
| `es` | Español |
| `fr` | Français |
| `hu` | Magyar |
| `nl` | Nederlands |
| `br` | Português (Brasil) |
| `cs` | Česky |
| `pl` | Polski |
| `ru` | Русский |
| `zh` | 简体中文 |
| `zh-TW` | 繁體中文 |
| `it` | Italiano |
| `tr` | Türkçe |
| `ar` | العربية |
| `id` | Bahasa Indonesia |
| `ja` | 日本語 |
| `ko` | 한국어 |
| `uk` | Українська |
| `gr` | Ελληνικά |
| `sv` | Svenska |
| `vi` | Tiếng Việt |
| `ca` | Català |

如果设置了不在此列表中的代码，Tourism-Team 会拒绝启动并打印`DEFAULT_LANGUAGE="…": must be one of: …`。不设置该变量则使用英语（`en`）。随着Tourism-Team 加入新翻译，此列表会不断增长。

---

## 出站 HTTP(S) 代理

通过设置下列标准变量，Tourism-Team 可以把受支持的出站 HTTP(S) 请求经由代理转发。出站代理默认关闭。

| 变量 | 说明 | 默认值 |
|---|---|---|
| `HTTP_PROXY` | 出站 HTTP 请求的代理 URL | — |
| `HTTPS_PROXY` | 出站 HTTPS 请求的代理 URL | — |
| `NO_PROXY` | 应绕过代理的逗号分隔主机或域名列表 | — |

> **注意：**代理环境变量仅作用于通过 Node.js 默认 HTTP 调度器发出的请求。由 Tourism-Team
> 的 SSRF 防护处理的请求使用专用调度器，不走环境代理。

> **仅限容器。**除非以 `NODE_USE_ENV_PROXY=1` 启动，否则 Node 会忽略这些变量，官方
> 镜像已为你设置好。在源码或 Proxmox 安装中，以及在 ConfigMap 只透传
> 已知键的 Helm 上，需要同时设置 `NODE_USE_ENV_PROXY=1`，否则不会有任何变化。

> **请设置 `NO_PROXY`。**否则所有请求都会走代理，包括 Tourism-Team 发给自身的请求，例如
> 容器健康检查。`localhost,127.0.0.1` 是合理的最小值；按需加入你自己的主机。

---

## HTTPS / 反向代理

这三个变量在终止 TLS 的反向代理后面协同工作。完整说明见 [反向代理](Reverse-Proxy)。

| 变量 | 说明 | 默认值 |
|---|---|---|
| `FORCE_HTTPS` | 为 `true` 时：把 HTTP 301 重定向到 HTTPS，发送 HSTS（`max-age=31536000`），添加 CSP `upgrade-insecure-requests`，强制 Cookie 的 `secure` 标志。仅在 TLS 代理后面才有用。你的代理必须发送 `X-Forwarded-Proto: https`。 | `false` |
| `HSTS_INCLUDE_SUBDOMAINS` | 为 `true` 时：在 HSTS 头中加入 `includeSubDomains` 指令，把 HTTPS 强制扩展到所有子域。仅在 HSTS 生效时（`FORCE_HTTPS=true` 或 `NODE_ENV=production`）才起作用。如果你在同级子域上以纯 HTTP 运行其他服务，请保持 `false`。 | `false` |
| `TRUST_PROXY` | 受信任的代理跳数。告诉 Express 在 `X-Forwarded-For` 中向前查找多远以找到真实客户端 IP，以及从哪里读取 `X-Forwarded-Proto`。数一数你的跳数：如果 Tourism-Team 前面有两层代理而 `TRUST_PROXY=1`，那么每条审计记录里的 IP 都是内层代理的。`0` 表示不信任任何代理，始终使用套接字地址。`FORCE_HTTPS` 重定向不需要它 —— 该重定向直接读取 `X-Forwarded-Proto` 头；设置它是为了让审计日志中的客户端 IP 正确，并用于 `COOKIE_SECURE` 的自动推导，后者经由 `req.secure` 完成。 | `1`（生产环境） |
| `COOKIE_SECURE` | 控制 `trek_session` Cookie 上的 `secure` 标志。当 `NODE_ENV=production`、`FORCE_HTTPS=true`，或请求本身在最外层经由 TLS 到达（设置了 `TRUST_PROXY` 且 `X-Forwarded-Proto: https`）时，自动推导为 `true`。只有在无 TLS 的 LAN 测试中作为应急手段才设为 `false` —— 不建议在生产环境使用。 | 自动 |

> **警告：**在转发 `X-Forwarded-Proto: https` 的代理后面设置 `FORCE_HTTPS=true` 会导致
> 重定向循环 —— 对 Tourism-Team 来说每个请求都像纯 HTTP，于是被再次 301。请修正代理让它发送该
> 头。设置 `TRUST_PROXY` 无济于事：该重定向自行接受原始的 `X-Forwarded-Proto: https` 头，
> 与 `trust proxy` 的取值无关。（`TRUST_PROXY` 只影响该检查的后半部分 `req.secure`，
> 后者还额外覆盖发送逗号连接 `X-Forwarded-Proto` 的代理链 —— 而且生产环境默认已经
> 信任一跳。）

---

## OIDC / SSO

配置说明见 [OIDC 单点登录](OIDC-SSO)。

| 变量 | 说明 | 默认值 |
|---|---|---|
| `OIDC_ISSUER` | OpenID Connect 提供方 URL（如 `https://auth.example.com`） | — |
| `OIDC_CLIENT_ID` | OIDC 客户端 ID | — |
| `OIDC_CLIENT_SECRET` | OIDC 客户端密钥 | — |
| `OIDC_DISPLAY_NAME` | SSO 登录按钮上显示的标签 | `SSO` |
| `OIDC_ONLY` | 强制仅 SSO 模式：禁用密码登录和注册，覆盖「管理 → 设置」中的开关，无法在运行时更改。在全新实例上，首次 SSO 登录将成为管理员。 | `false` |
| `OIDC_ADMIN_CLAIM` | 为判断管理员角色而检查的 OIDC 声明。仅在设置了 `OIDC_ADMIN_VALUE` 后生效。 | `groups` |
| `OIDC_ADMIN_VALUE` | 授予管理员角色的 OIDC 声明取值（如 `app-trek-admins`） | — |
| `OIDC_SCOPE` | 以空格分隔的 OIDC 权限范围，用于请求授权。**完全替换**默认值 —— 始终要包含 `openid email profile`，再加上任何额外的范围（例如使用 `OIDC_ADMIN_CLAIM` 时加上 `groups`） | `openid email profile` |
| `OIDC_DISCOVERY_URL` | 覆盖自动构建的 OIDC 发现端点。对于路径非标准的提供方（如 Authentik）必填 | — |

---

## WebAuthn / 通行密钥

通行密钥（WebAuthn）登录在管理后台中配置，但两个加密敏感的取值可以通过环境变量固定。环境变量优先于对应的数据库设置。这些取值**只**从服务端配置推导 ——绝不来自请求的 `Host` / `X-Forwarded-Host` 头（与 OIDC 重定向 URI 的处理方式一致）。

| 变量 | 说明 | 默认值 |
|---|---|---|
| `WEBAUTHN_RP_ID` | 依赖方 ID（Relying-Party ID）—— 通行密钥所绑定的可注册域名（如 `tt.example.com`）。覆盖 `webauthn_rp_id` 数据库设置。未设置时，从 `APP_URL` 的主机名推导。裸 IP 字面量（IPv4/IPv6）会被拒绝。如果无法解析，通行密钥将被禁用。 | 由 `APP_URL` 推导 |
| `WEBAUTHN_ORIGINS` | 通行密钥流程允许的来源列表，以逗号分隔（如 `https://tt.example.com`）。覆盖 `webauthn_origins` 数据库设置；结尾的斜杠会被去掉。未设置且 RP ID 不是 `localhost` 时，会从 `APP_URL` 推导出单个来源。在开发环境（RP ID 为 `localhost`）中，会自动加入 `http://localhost:5173` 和 `http://localhost:3001`。 | 由 `APP_URL` 推导 |

---

## 邮件 / SMTP

SMTP 设置可以在管理后台配置，也可以用环境变量覆盖。环境变量优先于数据库中的值。

| 变量 | 说明 | 默认值 |
|---|---|---|
| `SMTP_HOST` | SMTP 服务器主机名（如 `smtp.example.com`） | — |
| `SMTP_PORT` | SMTP 服务器端口。端口 `465` 启用隐式 TLS（`secure: true`）；其他端口使用 STARTTLS 或明文。 | — |
| `SMTP_USER` | SMTP 认证用户名 | — |
| `SMTP_PASS` | SMTP 认证密码 | — |
| `SMTP_FROM` | 出站邮件的发件人地址（如 `Tourism-Team <noreply@example.com>`） | — |
| `SMTP_SKIP_TLS_VERIFY` | 设为 `true` 可禁用 TLS 证书校验。对内部 SMTP 中继的自签名证书有用 —— 不建议在生产环境使用。 | `false` |

要让邮件投递生效，`SMTP_HOST`、`SMTP_PORT` 和 `SMTP_FROM` 都是必填的。`SMTP_USER` 和 `SMTP_PASS`可选（用于无需认证的中继）。

---

## 初始设置

这些变量仅在首次启动、尚不存在任何用户时生效。

| 变量 | 说明 | 默认值 |
|---|---|---|
| `ADMIN_EMAIL` | 首个管理员账户的邮箱 | `admin@tt.local` |
| `ADMIN_PASSWORD` | 首个管理员账户的密码 | 随机 |

两个变量必须同时设置。如果缺少其中任何一个，创建的账户邮箱为 `admin@tt.local`，密码随机生成并打印到服务器日志。一旦存在任何用户，这些变量就不再起作用。

---

## MCP

配置说明见 [MCP 概览](MCP-Overview)。

| 变量 | 说明 | 默认值 |
|---|---|---|
| `MCP_RATE_LIMIT` | 每分钟 MCP API 请求上限，**按用户且按 OAuth 客户端**计数 —— 一个用户从两个 MCP 客户端连接就会获得两份该额度。使用静态 `trek_` 令牌或会话 JWT 发出的请求不带客户端，每个用户共享另一个额外的桶。 | `300` |
| `MCP_MAX_SESSION_PER_USER` | 每个用户的最大并发 MCP 会话数。达到上限时会关闭该用户最久未活动的会话以腾出位置 —— 不会拒绝请求。 | `20` |
| `MCP_SESSION_TTL` | 会话空闲超时（秒，最大 86400） | `3600` |
| `MCP_SSE_KEEPALIVE` | SSE 保活 ping 间隔（秒）—— 让流穿过反向代理保持存活。`0` 禁用 ping；打开的流仍会刷新会话的空闲超时。 | `25` |

---

## API 文档

| 变量 | 说明 | 默认值 |
|---|---|---|
| `TREK_API_DOCS_ENABLED` | 在 `/api/docs` 提供交互式 OpenAPI/Swagger 文档（原始规范位于 `/api/docs-json`）。该规范枚举了包括管理接口在内的每条路由，因此默认关闭。 | `false` |

开启该标志后，`/api/docs` 会列出每个 REST 端点并支持试用；通过 Bearer 按钮用会话 JWT授权（API 在所有地方都接受 `Authorization: Bearer <jwt>`，作为 Cookie 的回退）。用 Zod 校验的请求体会根据同一套 schema 自动生成文档。

---

## 订单导入（KDE Itinerary）

| 变量 | 说明 | 默认值 |
|---|---|---|
| `KITINERARY_EXTRACTOR_PATH` | `kitinerary-extractor` 可执行文件的完整路径。未设置时，Tourism-Team 会依次搜索 `/usr/lib/*/libexec/kf6/kitinerary-extractor` 和 `PATH`。如果你把该可执行文件安装到了非标准位置，请设置此项。 | 自动检测 |

官方 Tourism-Team Docker 镜像会自动随附该可执行文件：在 amd64 和 arm64 上都会通过 apt（Debian trixie）安装 `libkitinerary-bin`，并将其符号链接到 `/usr/local/bin/kitinerary-extractor`，镜像也会通过 `KITINERARY_EXTRACTOR_PATH` 固定该路径。从源码运行 Tourism-Team 时，请安装 `libkitinerary-bin`（Debian trixie /Ubuntu 25.04+）。没有可下载的静态二进制文件；若要运行比发行版打包版本更新的提取器，请自行构建并把`KITINERARY_EXTRACTOR_PATH` 指向它，或使用你自己的 apt 源从官方镜像派生一个镜像。提取器的版本会出现在启动日志和`GET /api/admin/system-info`（仅管理员）中 —— 在报告某个提供方不受支持之前值得先核对，因为缺失厂商脚本和提供方不受支持都会返回空结果。`LOG_LEVEL=debug` 还会把提取器的原始 stderr 一并输出，包括指出失败脚本的 `JS ERROR` 行；该设置在启动时只读取一次，因此需要重启。找到该可执行文件时，`GET /api/health/features` 端点会返回 `{ "bookingImport": true }`。「预订」面板中的「导入」按钮仅在**两个**提取器都不可用时才隐藏 —— 运行 AI 解析扩展的实例即使 `bookingImport: false` 也仍会提供该按钮。

对于 KDE Itinerary 读不了的文档，订单导入还可以回退到 AI 模型。该功能（**AI 解析**扩展）在界面中配置；它唯一读取的环境变量是下方的 `LLM_TIMEOUT_MS`。见 [AI 订单导入](AI-Booking-Import)。

---

## 公共交通（Transitous）

规划器中的公共交通路线由 [Transitous](https://transitous.org/) 提供支持，这是一个免费的社区 MOTIS 服务 —— 无需 API 密钥。功能本身的说明见 [交通：航班、火车、汽车](Transport-Flights-Trains-Cars)。

| 变量 | 说明 | 默认值 |
|---|---|---|
| `TRANSIT_API_URL` | 公共交通路线 API 的基础 URL。Tourism-Team 的服务器会把请求代理到它。如果你希望完全不向第三方发起出站请求，请把它指向你自托管的 [MOTIS](https://github.com/motis-project/motis) 实例。结尾的斜杠会被去掉。 | `https://api.transitous.org` |

保持默认值时，使用公共交通功能会让 Tourism-Team 的**服务器**向 `api.transitous.org` 发出站 HTTPS 请求（按 Transitous 使用政策的要求带上可识别的 User-Agent）。在用户实际搜索行程之前，不会发出任何公共交通请求。

---

## 图片搜索（Unsplash）

Tourism-Team 可以在 [Unsplash](https://unsplash.com/) 中搜索**旅行封面图片**和**地点图片**。默认情况下，服务器**不使用 API 密钥**查询 Unsplash 的公开网页端点，因此大多数安装无需配置。

某些托管环境 —— 常见于 VPS 和机房 IP 段（以及许多 Kubernetes 集群）—— 会被该未认证端点**阻止或限流**，在界面中表现为 **「Unsplash 搜索不可用」**。配置一个免费的 Unsplash Access Key 可让服务器改用 Unsplash 官方的认证 API（`api.unsplash.com`），不受该限制影响。见 [issue #1449](https://github.com/bhxnms/T-T/issues/1449)。

| 变量 | 说明 | 默认值 |
|---|---|---|
| `UNSPLASH_ACCESS_KEY` | 用于向 `https://api.unsplash.com` 认证封面/地点图片搜索的 Unsplash **Access Key**。设置后会优先于在**管理 → 设置**中由管理员配置的任何密钥。未设置时，服务器回退到未认证端点（部分机房/VPS IP 会被其阻止）。可在 [unsplash.com/developers](https://unsplash.com/developers) 免费获取密钥。 | 未认证端点 |

**两种配置方式** —— 任选其一；两者同时存在时环境变量优先：

1. **环境变量**（本页）—— 对整个实例生效，适合已经用环境变量管理配置的 Docker/Helm/Unraid。
2. **管理 → 设置 → API 密钥** —— 把密钥粘贴到 **Unsplash API 密钥**字段。静态加密存储，在未设置环境变量时作为所有用户的回退。如果你不想为了改密钥而重启容器，这是更好的选择。

获取密钥：在 [unsplash.com/developers](https://unsplash.com/developers) 创建免费账户，注册一个新应用，复制其 **Access Key**（不是 Secret Key）。Unsplash 免费版（demo）允许每小时 50 次请求，对封面搜索来说足够。

---

## 存储与路径

存储后端和分类分配在 [[管理：存储|Admin-Storage]]（或仅初始化一次写入的 `storage-config.json`）中配置，而不是通过环境变量。下方的 `TREK_PLACE_PHOTO_DIR` 不受影响。

| 变量 | 说明 | 默认值 |
|---|---|---|
| `TREK_PLACE_PHOTO_DIR` | 缓存 Google 地点照片的存储目录。启动时递归创建。设置它可以把照片存储指向专门的挂载卷。 | `uploads/photos/google` |
| `BACKUP_UPLOAD_LIMIT_MB` | 允许上传的恢复备份归档的**压缩**大小上限（MB）。如果你的备份（包含 `uploads/` 目录）超过默认值，请调高它。非正数或无效值会中止启动。 | `500` |
| `BACKUP_MAX_DECOMPRESSED_MB` | 恢复备份归档的**解压后**大小上限（MB）—— 用于防范 zip 炸弹。与 `BACKUP_UPLOAD_LIMIT_MB` 相互独立，并在两条恢复路径上都会强制执行，因此一个符合上传上限的恢复仍可能被拒绝，提示 `Backup exceeds the maximum decompressed size.`。恢复超大实例时请同时调高两者。 | `5120`（5 GB） |
| `TREK_DB_JOURNAL_MODE` | SQLite [日志模式](https://sqlite.org/pragma.html#pragma_journal_mode)：`DELETE`、`TRUNCATE`、`PERSIST`、`MEMORY`、`WAL` 或 `OFF`。当数据目录位于网络存储上时请设为 `DELETE` —— 见下方。SQLite 不认识的值会记录警告并回退。 | `WAL` |
| `TREK_DB_SYNCHRONOUS` | SQLite [synchronous](https://sqlite.org/pragma.html#pragma_synchronous) 级别：`OFF`、`NORMAL`、`FULL` 或 `EXTRA`。默认值随日志模式而定 —— WAL 下为 `NORMAL`（SQLite 自身在该模式下使用的值），其他情况为 `FULL`，因为回滚日志在 `NORMAL` 级别下断电时可能丢失已提交的事务。 | `NORMAL` / `FULL` |

### 在网络存储上运行数据库

在本地磁盘上 WAL 是合适的模式，也仍是默认值。它通过共享内存文件（`travel.db-shm`）和内存映射来协调读写，而 [SQLite 官方文档](https://sqlite.org/wal.html#noshm)指出，在未正确实现这些原语的文件系统上，这种组合并不安全。实际中这指的是 Azure AppService（Linux），以及从 NAS 或 PaaS 宿主机挂载的 SMB/NFS 卷。如果你的 `data/` 目录属于其中一种，请设置：

```
TREK_DB_JOURNAL_MODE=DELETE
```

日志模式会写入数据库文件头，而不是按连接保存，因此它能跨重启保留，并从下次启动起生效。启动日志会打印实际生效的设置：

```
[DB] journal_mode=DELETE, synchronous=FULL
```

打开同一文件的维护工具 —— `reset-admin.js` 和 `scripts/migrate-encryption.ts` —— 会读取同样的两个变量，因此请用相同的环境运行它们（`docker exec` 进入容器即可自动做到）。否则下一次密钥轮换或管理员重置会悄悄把文件切回 WAL。

---

## 高级 / 调优

| 变量 | 说明 | 默认值 |
|---|---|---|
| `IDEMPOTENCY_TTL_SECONDS` | 已存储的幂等键在垃圾回收之前保留的时长（秒）。离线客户端在重连时会用其 `X-Idempotency-Key` 重放排队的变更，因此该值必须超过预期的最长离线窗口，否则重放可能产生重复。无效值会中止启动。 | `2592000`（30 天） |
| `OVERPASS_URL` | 地图 POI「探索」搜索使用的自定义 [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) 端点，以逗号分隔。设置后会**替换**随附的公共镜像 —— 当公共镜像从你的网络无法访问时（例如 Kubernetes 集群中被防火墙或严格限制的出站访问），把它指向内部或自托管的 Overpass 实例。不是合法 `http(s)` URL 的条目会被忽略。如果你没有自建 Overpass 但公共镜像对 Tourism-Team 限流，请先确认已设置 `APP_URL`（或 `ALLOWED_ORIGINS`）：仅此一项就能让出站的 Overpass/Nominatim 请求带上唯一的 User-Agent，公共镜像对此的限流会宽松得多。 | 随附的公共镜像 |
| `OVERPASS_TIMEOUT_MS` | Overpass POI 请求的每个端点超时（毫秒）。各端点并行竞速，在此窗口内未作答的会被放弃，让更快的镜像胜出。如果你运行的是较慢的自托管 Overpass 实例，请调高它。无效值会中止启动。 | `12000` |
| `LLM_TIMEOUT_MS` | 一次 AI 解析调用在被放弃之前允许持续的时间（毫秒）。对所有提供方统一的上限，同时应用于中止信号和底层 HTTP 客户端。默认值比较宽松，以便较重的解析工作无需改代码即可完成；如果你使用云服务提供方并希望快速失败，可以调低它。无效值会中止启动。 | `900000`（15 分钟） |

---

## 演示模式

演示模式把 Tourism-Team 作为公开的、会自动重置的沙箱运行。不适用于常规部署。

| 变量 | 说明 | 默认值 |
|---|---|---|
| `DEMO_MODE` | 启用演示模式：写入示例数据，每小时重置数据库，暴露演示登录端点，并对演示用户阻止破坏性变更（修改密码、删除账户、上传）。与 `NODE_ENV=production` 组合时会在启动时记录一条安全警告。 | `false` |
| `DEMO_ADMIN_USER` | 预置演示管理员账户的用户名。 | `admin` |
| `DEMO_ADMIN_EMAIL` | 预置演示管理员账户的邮箱。不设置表示「使用预置默认值」，同时让重置程序能识别更早版本用过的地址。 | `admin@tt.local` |
| `DEMO_ADMIN_PASS` | 预置演示管理员的初始密码（写入时以 bcrypt 哈希存储）。 | `admin12345` |

`DEMO_ADMIN_*` 变量仅在 `DEMO_MODE=true` 时生效，且仅在首次写入演示数据的那一刻生效。

---

## 插件

插件系统**默认开启**。运行时和「管理 → 插件」面板开箱即用，但已安装的插件仍需逐个激活 —— 因此除非管理员开启某个具体插件，否则不会有任何第三方代码运行。设置 `TREK_PLUGINS_ENABLED=false` 可关闭整个系统。完整系统见 [插件](Plugins)，隔离模型见 [插件权限](Plugin-Permissions)。

| 变量 | 说明 | 默认值 |
|---|---|---|
| `TREK_PLUGINS_ENABLED` | 插件系统的总开关。除非设为 `false`（也接受 `0`、`off`、`no`，不区分大小写），否则为启用。关闭它是一个终止开关 —— 已安装的插件仍留在磁盘上，但不会运行。 | 已启用 |
| `TREK_PLUGINS_DIR` | 存放已安装插件**代码**的目录。如果使用插件，请把它作为卷持久化。 | `<data>/plugins` |
| `TREK_PLUGINS_DATA_DIR` | 存放每个插件自身**数据**（其私有 SQLite 文件）的目录。与代码树分开保存；同样请把它作为卷持久化。 | `<data>/plugins-data` |
| `TREK_PLUGIN_REGISTRY_URL` | 覆盖「发现」标签页所浏览的插件库索引。把它指向你自己 fork 或镜像的插件库。 | `https://raw.githubusercontent.com/liketrek/TREK-Plugins/main/dist/index.json` |
| `TREK_PLUGIN_MAX_RSS_MB` | 每个插件的内存上限（MB）。超过上限的插件进程会被停止。 | `300` |
| `TREK_PLUGIN_PERMISSIONS` | 设为任何假值（`off`、`false`、`0`、`no` —— 不区分大小写）可**退出**插件子进程的 Node.js 操作系统级权限沙箱（不推荐）。设为真值或保持未设置会开启沙箱；该集合之外的任何取值都会在启动时被拒绝。 | `on` |
| `TREK_PLUGIN_ALLOW_PRIVATE_EGRESS` | 设为 `on` 可让插件声明的出站主机解析到私有/内部地址（例如你 LAN 上的某个服务）。默认情况下，对私有、回环、链路本地和元数据地址的连接会被拒绝。 | 关闭（私有出站被阻止） |
| `TREK_PLUGINS_DEV_LINK` | **仅限开发。**设为任何真值（`1`、`true`、`on`、`yes` —— 不区分大小写）可启用 *dev-link*：从本地构建目录注册插件，并针对运行中实例的数据进行热重载。Dev-link 的代码会绕过安装时的签名/完整性校验，并且（在 `npm run dev` 下）在关闭操作系统权限隔离的情况下运行，因此绝不能让它在生产环境中可达 —— 未设置、留空或显式的假值（`0`、`false`、`off`、`no`）都会保持关闭。数据访问仍完全由能力宿主把关。 | 关闭（已禁用） |
| `TREK_PLUGINS_IGNORE_TREK_RANGE` | 设为任何真值（`1`、`true`、`on`、`yes` —— 不区分大小写）可把插件的 **Tourism-Team 版本门禁**降级为警告。这样，`trek` 范围不包含当前运行版本 —— 或完全未声明范围 —— 的插件也能安装（插件库、手动加载、dev-link）、更新和激活，并且「安装最新版」会取最新发布的版本而不是最新的兼容版本。每次绕过都会记录日志，安装响应带有 `trekRangeBypassed` 标记，管理面板会显示「版本检查已关闭」标签、每次此类安装前后的警告对话框，以及该行上一个常驻的小标记。只有在插件作者尚未针对你的 Tourism-Team 更新版本范围时才使用它：没有任何东西能保证插件可用，而且在极少数情况下，版本不匹配的插件可能损坏 Tourism-Team 数据。插件 API 版本门禁**不会**被解除。未设置、留空或假值会保持门禁严格生效。 | 关闭（门禁强制执行） |
| `TREK_PLUGIN_AI_PER_DAY` | 每个插件对共享 LLM 代理调用（`ai.complete` / `ai.extract`）的**每日**上限。限制单个插件每个 UTC 日能消耗多少管理员的 LLM 额度，与其被授予的权限无关。计数在同一天内跨重启保留；设为 `0` 可完全禁用 AI 代理。设计上较为宽松 —— 只会拦住失控的插件。 | `200` |
| `TREK_PLUGIN_NOTIFY_PER_DAY` | 每个插件对用户通知代理调用（`notify.send`）的**每日**上限，以免单个插件骚扰用户。UTC 日窗口和跨重启安全的计数方式与 `TREK_PLUGIN_AI_PER_DAY` 相同；设为 `0` 可禁用通知代理。 | `100` |
| `TREK_PLUGIN_RPC_PER_SEC` | 插件的宿主 RPC 调用（`ctx.*`）在突发额度用尽后的持续速率限制（**每秒**调用次数）。防止紧循环的插件把单线程宿主耗尽。 | `20` |
| `TREK_PLUGIN_RPC_BURST` | 突发额度 —— 在每秒限制生效之前，插件可以连续发出的宿主 RPC 调用次数。 | `60` |
| `TREK_PLUGIN_RPC_INFLIGHT` | 单个插件同时允许的最大并发宿主→插件 RPC 派发数（并发上限）。 | `16` |
| `TREK_PLUGIN_LOG_PER_SEC` | 插件的日志输出 —— `ctx.log.*`、子进程的 stdout/stderr，以及未知的插件事件主题 —— 在突发额度用尽后的持续速率限制（**每秒**日志行数）。这条路径**不**受上述 RPC 限流器约束，而 `warn`/`error` 行会在宿主线程上同步执行 `plugin_error_log` 的 INSERT + 清理，因此正是这一限制阻止 `while (true) ctx.log.error(...)` 循环把实例拖死。多余的行会被丢弃；日志恢复时，会有一行 `warn` 报告丢弃了多少行，因此运维人员能观察到限流。 | `10` |
| `TREK_PLUGIN_LOG_BURST` | 突发额度 —— 在每秒限制生效之前，插件可以连续输出的日志行数。 | `50` |
| `TREK_PLUGIN_AUDIT_MAX_ROWS` | 每个插件的能力审计日志保留上限（保存在共享的 `data/travel.db` 中）。每个插件保留最新的 N 行并清理更早的行；保留的窗口仍具备防篡改可验证性。设为 `0` 可禁用清理。 | `20000` |

以上全部都是可选的 —— 默认值是安全的。如果想把插件系统完全关闭，请设置 `TREK_PLUGINS_ENABLED=false`。

---

## 相关页面

- [反向代理](Reverse-Proxy) —— HTTPS 代理配置与 `FORCE_HTTPS` / `TRUST_PROXY` / `COOKIE_SECURE` 三件套
- [OIDC 单点登录](OIDC-SSO) —— 完整的 OIDC 配置指南
- [MCP 概览](MCP-Overview) —— MCP 服务器配置与速率限制
- [加密密钥轮换](Encryption-Key-Rotation) —— 在不丢失数据的前提下轮换 `ENCRYPTION_KEY`
