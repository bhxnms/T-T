# 安全加固

一份面向生产环境 Tourism-Team 部署的检查清单。所有条目都引用 Tourism-Team 真实的配置选项。

## 加密与机密

- [ ] 设置一个强 `ENCRYPTION_KEY`（用 `openssl rand -hex 32` 生成）。见 [加密密钥轮换](Encryption-Key-Rotation)。
- [ ] 把 `ENCRYPTION_KEY` 与数据库备份 ZIP 分开备份 —— 丢失它会让所有已存储的 API 密钥和机密变得无法读取。已存储的机密使用由该密钥派生的 AES-256-GCM 加密。
- [ ] 如果 `ENCRYPTION_KEY` 可能已泄露，请轮换它。见 [加密密钥轮换](Encryption-Key-Rotation)。

## HTTPS 与网络

- [ ] 让 Tourism-Team 运行在终止 TLS 的反向代理后面（nginx、Caddy、Traefik）。见 [反向代理](Reverse-Proxy)。
- [ ] 设置 `TRUST_PROXY=1`，以便在审计日志中正确捕获客户端 IP。在 `NODE_ENV=production` 下它自动默认为 `1`，但如果你使用非标准的代理跳数，请显式设置它。
- [ ] 设置 `FORCE_HTTPS=true`，把 HTTP 301 重定向到 HTTPS，并在 CSP 中加入 `upgrade-insecure-requests`。你的代理必须发送 `X-Forwarded-Proto: https`（或在同一连接上终止 TLS），否则该重定向会在每个请求上触发并进入循环。
- [ ] 要知道 HSTS（`max-age=31536000`）并不依赖 `FORCE_HTTPS`：只要 `FORCE_HTTPS=true` **或** `NODE_ENV=production`（Docker 镜像默认如此）就会发送它 —— 因此一个位于 Traefik、Caddy 或 Cloudflare 隧道之后的实例，即使完全没有设置 `FORCE_HTTPS` 也会通告 HSTS。设置 `HSTS_INCLUDE_SUBDOMAINS=true` 可加上 `includeSubDomains`；它默认关闭，这样安装在裸域上的实例就不会把 HTTPS 强制加到你可能仍以纯 HTTP 提供服务的同级子域上。
- [ ] 保持 `ALLOW_INTERNAL_NETWORK=false`，除非受严格防护的集成 —— Immich、Synology Photos、AirTrail、通知 webhook 或 ntfy —— 就在你的局域网中。见 [内网访问](Internal-Network-Access)。注意：回环（`127.x`、`::1`）和链路本地（`169.254.x`）地址无论此设置如何都会被阻止。

## 认证

- [ ] 为你的管理员账户启用两步验证。见 [两步验证](Two-Factor-Authentication)。
- [ ] 如果你的使用场景要求，可为所有用户强制 MFA：管理后台 → 设置 → **要求双因素身份验证（2FA）**。注意：你必须先保护好自己的管理员账户，可以用 TOTP 或已注册的通行密钥 —— 否则服务器会拒绝该开关。通行密钥对其他所有人也能满足该策略，因此没有人会被强制只能用 TOTP。
- [ ] 如果你掌控着谁可以访问该实例，请关闭开放注册。见 [管理：用户与邀请](Admin-Users-and-Invites)。
- [ ] 如果有会话可能已泄露，请轮换 JWT 签名密钥：管理后台 → 设置 → 危险区 → **轮换**（`POST /api/admin/rotate-jwt-secret`）。这会立即使所有活动会话失效，包括你自己的。

## 会话安全

Tourism-Team 把会话以 JWT 形式存放在 httpOnly 的 `trek_session` Cookie 中（SameSite=Lax）。一次正常登录在 `SESSION_DURATION`（默认 24 小时）后过期，并依托一个浏览器会话 Cookie，浏览器关闭时就会丢弃它；勾选 **记住我** 会下发一个持久 Cookie，其生命周期和 JWT 过期时间为 `SESSION_DURATION_REMEMBER`（默认 30 天）—— 如果 30 天的窗口对你的威胁模型来说太宽，请缩短它。`secure` 标志在 `NODE_ENV=production`、`FORCE_HTTPS=true`，或 Express 看到请求经由 TLS 到达（`X-Forwarded-Proto: https`）时自动设置 —— 最后一种需要 `trust proxy` 处于活动状态，这在生产环境中是自动的，否则就意味着你要自己设置 `TRUST_PROXY`。MCP 和 API 客户端还可以通过 `Authorization: Bearer` 头提交令牌。

- [ ] 确保 `FORCE_HTTPS=true`（或 `NODE_ENV=production`），使 `trek_session` Cookie 携带 `secure` 标志，绝不会以纯 HTTP 发送。
- [ ] 只有在无 TLS 的局域网测试中，才把 `COOKIE_SECURE=false` 当作临时应急手段 —— 不要在生产环境使用。

## 密码策略

Tourism-Team 对所有注册和密码修改强制实施最低密码策略：

- 最少 8 个字符
- 必须包含大写字母、小写字母、数字和特殊字符
- 常用密码和完全重复的字符串会被拒绝
- 密码使用 bcrypt 哈希（开销因子 12）

无需任何配置；该策略始终生效。

## 限流

内置的内存限流保护认证端点：

| 端点 | 限制 | 窗口 |
|---|---|---|
| 登录 / 注册 / 邀请 | 10 次尝试 | 15 分钟 |
| MFA 验证登录 / 启用 | 5 次尝试 | 15 分钟 |
| 修改密码 | 5 次尝试 | 15 分钟 |
| 创建 MCP 令牌 | 5 次尝试 | 15 分钟 |

这些限制按来源 IP 计算。如果 Tourism-Team 位于反向代理之后，请设置 `TRUST_PROXY`，以使用真实客户端 IP 而不是代理的 IP。

## 内容安全策略

Helmet 对所有响应应用严格的 CSP。关键指令：

- `default-src 'self'`
- `script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'`（没有 `unsafe-inline`；浏览器内的 HEIC 转换器需要 `'unsafe-eval'`，它通过 `new Function()` 初始化）
- `object-src 'self'`（使同源文件预览可以通过 `<object>`/`<embed>` 嵌入 PDF）
- `frame-src 'self'`（用于 `/plugin-frame/*` 上的沙箱化插件框架，它们在自己的 CSP 下以不透明源运行）
- `frameAncestors 'self'`（防止来自外部框架的点击劫持）
- `upgrade-insecure-requests`（`FORCE_HTTPS=true` 时自动添加）

## 插件运行时加固

已安装的插件运行的是**不受信任的第三方代码**。Tourism-Team 通过多个相互独立的层来隔离插件，使一个恶意或有缺陷的插件既无法读取 Tourism-Team 的数据，也无法让实例宕机。这里没有任何东西需要配置 —— 全部默认开启 —— 但下面这些应急出口可以用于调优。

- [ ] 保持插件系统的默认设置不动。它**默认开启**，但已安装的插件仍然必须**逐个激活**，因此在管理员打开某个具体插件之前，不会有任何第三方代码运行。设置 `TREK_PLUGINS_ENABLED=false`（接受 `false`/`0`/`off`/`no`）可关闭整个系统 —— 已安装的插件仍留在磁盘上，处于停用状态，运行时处于空闲。
- [ ] 保持**操作系统权限隔离**启用（默认）。在生产环境中，每个插件都在一个隔离的子进程中运行，该进程以 Node 的 `--permission` 模型启动：文件系统**写入**、`child_process`、工作线程和原生插件被直接拒绝，读取范围仅限于插件自己的代码 —— 因此插件无法读取 `trek.db` 或机密文件，也无法调用 shell。子进程的环境会被清理（没有 `JWT_SECRET`，没有数据库凭据）。设置 `TREK_PLUGIN_PERMISSIONS=off` 会关闭这道隔离（隔离随之回退为仅崩溃隔离）并记录一条醒目的警告 —— 只在你完全信任的机器上这样做。
- [ ] 依赖**私有出站阻断**（SSRF 兜底）。即使一个插件声明了出站主机，它也无法访问解析为回环、私有、链路本地、ULA、运营商级 NAT、云元数据（`169.254.169.254`）、组播或保留地址的目标 —— 该防护会重新检查解析后的 IP，因此插件无法借道转向内部服务，也无法通过 DNS 重绑定指向它们。这独立于 `ALLOW_INTERNAL_NETWORK`（后者管的是通过严格防护访问的核心集成 —— Immich、Synology Photos、AirTrail、通知 webhook 和 ntfy —— 而不是插件出站）。唯一的应急出口是 `TREK_PLUGIN_ALLOW_PRIVATE_EGRESS=on`，用于必须访问你局域网中某项服务（一个 Gotify、一个 ntfy、一个 Ollama）的插件。它是实例范围而非按插件的，而且它完全解除该阻断而不是收窄它：一个已声明的主机随后可以解析到任何地址，包括 `169.254.169.254` 这个元数据 IP，而 unix 套接字或命名管道连接（`docker.sock`、本地数据库套接字）无需声明即可使用，因为操作系统隔离并不过问套接字连接。除非某个具体插件确实需要局域网目标，否则不要设置它。
- [ ] 监督器会限制每个插件的**常驻内存**（默认 300 MB，`TREK_PLUGIN_MAX_RSS_MB`）—— 在主机侧从操作系统测量，绝不采信插件自己的报告 —— 并会终止越过上限或停止发送心跳的插件；屡次违犯者会被自动停用。每一次 `ctx.*` 能力调用在分发边界处也受到**限流**（一个令牌桶：约 60 次调用的突发、每秒 20 次调用持续、16 个并发；`TREK_PLUGIN_RPC_BURST` / `TREK_PLUGIN_RPC_PER_SEC` / `TREK_PLUGIN_RPC_INFLIGHT`），因此一个陷入紧密循环的插件会被节流，而不是让实例僵死。
- [ ] 如果你授予插件宽泛的数据访问权，请审查**能力审计**。插件进行的每一次经主机中转的核心数据读取和广播，都会在 RPC 边界处按真实的操作用户（而不是插件提供的值）记录进一份按插件划分、哈希链式、防篡改的日志。管理员可以看到按插件划分的记录；每位用户都可以看到「插件以我的名义做了什么？」。保留量按插件设上限（默认 20 000 行，`TREK_PLUGIN_AUDIT_MAX_ROWS`）。

> 面向开发者的 **dev-link** 功能（`TREK_PLUGINS_DEV_LINK=1`）会加载未签名的本地代码，并且在 `npm run dev` 下运行时操作系统隔离是关闭的 —— 在任何不是你能掌控的一次性开发机的实例上都要保持关闭。见 [插件](Plugins) 与 [插件权限](Plugin-Permissions)。
>
> 同样，请保持 `TREK_PLUGINS_IGNORE_TREK_RANGE` 未设置。它把插件的 Tourism-Team 版本门禁变成警告，使一个作者尚未更新其 `trek` 范围的插件也能被安装和激活 —— 管理面板会在每一步发出警告，但一个运行在从未测试过的 Tourism-Team 上的插件可能行为异常，并且在极少数情况下可能损坏数据。只为你确实需要的某个具体插件设置它，并在作者发布了一个承认你的 Tourism-Team 的版本后移除它。

## 备份

- [ ] 启用自动备份，并设置合适的保留窗口。见 [备份](Backups)。
- [ ] 把备份存放到异地 —— 将备份 ZIP 复制到 Tourism-Team 主机之外的另一个位置。

## 监控

- [ ] 定期审查审计日志，查找意外的登录或管理员更改。见 [审计日志](Audit-Log)。
- [ ] 定期检查 Tourism-Team 更新。见 [管理：GitHub 发布](Admin-GitHub-Releases) 与 [更新](Updating)。

## 另见

- [加密密钥轮换](Encryption-Key-Rotation)
- [反向代理](Reverse-Proxy)
- [内网访问](Internal-Network-Access)
- [两步验证](Two-Factor-Authentication)
- [管理：权限](Admin-Permissions)
- [管理：用户与邀请](Admin-Users-and-Invites)
- [备份](Backups)
- [审计日志](Audit-Log)
- [管理：GitHub 发布](Admin-GitHub-Releases)
- [更新](Updating)
- [环境变量](Environment-Variables)
