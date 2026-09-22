# 反向代理

强烈建议在生产环境中把 Tourism-Team 放在终止 TLS 的反向代理后面。

## HTTPS 对 Tourism-Team 为什么重要

- **PWA 安装**需要 HTTPS —— 浏览器在纯 HTTP 上会阻止「添加到主屏幕」。
- **会话 Cookie** —— `trek_session` Cookie 在生产环境中标记为 `secure`，因此不会通过 HTTP 发送。
- **OIDC / SSO** —— 身份提供方要求重定向 URI 使用 HTTPS。
- **MCP** —— MCP API 的 OAuth 2.1 认证要求 HTTPS。

## 三项硬性要求

无论你使用哪种代理，它都必须满足三个约束：

1. **在 `/ws` 上支持 WebSocket 升级** —— Tourism-Team 使用 WebSocket 进行实时同步。设置 `proxy_read_timeout 86400`（Nginx），或依赖 Caddy 的自动升级处理。
2. **请求体大小 ≥ 500 MB** —— 备份恢复 ZIP 可能包含整个 uploads 目录。设置 `client_max_body_size 500m`（Nginx）；Caddy 自身不施加请求体限制，因此它本来就能通过 —— 只需把你已有的任何 `request_body { max_size … }` 块保持在 `500mb` 或以上。
3. **在 `/mcp` 上透传 `Mcp-Session-Id` 头** —— 如果你使用 MCP 的话。见下文。

## Nginx

```nginx
server {
    listen 80;
    server_name tt.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tt.yourdomain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        # Documents are capped at 50 MB and photos/covers at 20 MB, but video
        # uploads go up to 500 MB — both journey gallery clips and videos in a
        # trip's file manager. Backup restore ZIPs can include the full uploads
        # directory and may exceed even that (see BACKUP_UPLOAD_LIMIT_MB, default
        # 500) — raise this value if uploads or restores fail.
        client_max_body_size 500m;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Needed for backup restore uploads — can exceed the Nginx default of 1 MB.
        client_max_body_size 500m;
    }
}
```

关键行：
- `proxy_read_timeout 86400` —— 保持 WebSocket 连接存活（86400 秒 = 24 小时）。
- `client_max_body_size 500m` —— 允许大型备份恢复上传；两个 location 中都要设置。
- `X-Forwarded-Proto $scheme` —— 告诉 Tourism-Team 原始请求是否为 HTTPS；`FORCE_HTTPS` 重定向和 Cookie 安全性要正常工作都必需它。

## Caddy

Caddy 会自动处理 WebSocket 升级：

```
tt.yourdomain.com {
    reverse_proxy localhost:3000
}
```

Caddy 默认不施加请求体限制，因此大型备份恢复本来就能通过上面的配置。只有在你希望刻意限制上传时才添加 `request_body` —— 并且把上限保持在 500 MB 或以上。它是一个块，而不是单行指令：

```
tt.yourdomain.com {
    request_body {
        max_size 500mb
    }
    reverse_proxy localhost:3000
}
```

## Cloudflare 隧道

Cloudflare Tunnel 无需你自己开放端口或获取证书，就能到达你的实例：`cloudflared` 向外拨号到 Cloudflare 的边缘，公开主机名由那里提供服务。

有两种搭建方式，它们彼此独立 —— 哪种合适就用哪种。

### 方案 A：自己运行 cloudflared（推荐）

这是常规路径，除了下面的代理变量之外不需要 Tourism-Team 提供任何东西。把连接器添加为第二个 Compose 服务：

```yaml
services:
  app:
    # ... your existing app service, unchanged ...
    ports: []          # optional: with a tunnel you no longer need to publish 3000

  tunnel:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on:
      - app
```

从 Zero Trust → Networks → Tunnels → 你的隧道 → *Install connector* 获取 `CLOUDFLARE_TUNNEL_TOKEN`。把该隧道的公开主机名指向 `http://app:3000`（服务名和容器端口，而不是 `localhost`）。

然后在 **app** 服务上设置：

```yaml
environment:
  - APP_URL=https://tt.example.com     # your tunnel hostname
  - TRUST_PROXY=1                      # Cloudflare is the only hop
```

本页开头的**三项硬性要求**对隧道同样适用：在 `/ws` 上的 WebSocket 升级、至少 500 MB 的请求体，以及 `Mcp-Session-Id` 原样透传。Cloudflare 的默认值已经允许这三点；只有在你添加了 WAF 规则时才需要改动它们。

> **Bot Fight Mode / WAF：** 如果你在该域上启用 Bot Fight Mode，它会挑战 MCP 端点和 API 客户端。为你以编程方式连接的路径添加一条 WAF 例外（或绕过规则）。见
> [疑难排查](Troubleshooting)。

### 方案 B：让管理后台替你做

**管理 → Cloudflare Tunnel** 是给那些不想手工拼装上述内容的运维人员准备的。它存储一个 Cloudflare API 令牌，然后 —— 一键 —— 创建隧道、写入其入口规则，并把主机名的 DNS 指向它。你把它交回的连接器令牌复制到 sidecar 中，整个设置就完成了。

它需要你提供：

1. 一个具有 *Account → Cloudflare Tunnel → Edit* 和 *Zone → DNS → Edit* 权限的 Cloudflare **API 令牌**，以及你的 **Account ID**（两者都在该标签页上）。
2. 你想要的**主机名**和一个**隧道名称**（任意你喜欢的标签）。
3. 创建隧道之后：它显示的**连接器令牌**。立刻复制 —— 它只显示一次，应用不会保留副本。

然后运行面板渲染出的 sidecar：

```yaml
tunnel:
  image: cloudflare/cloudflared:latest
  restart: unless-stopped
  command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
  depends_on:
    - app
```

关于它有两点需要知道：

- **它默认关闭，关闭期间什么都不做。** 不存储任何东西，不应用任何东西，你自己既有的设置照旧工作。只有在你需要这份帮助时才打开它。
- **它不运行连接器。** 随附的容器以只读方式挂载其文件系统并丢弃其能力，因此 `cloudflared` 作为独立进程运行 —— 上面的 sidecar、一个 systemd 单元，或一个宿主机服务。面板的工作在创建隧道并把令牌交给你之后就结束了。

由于隧道是以*远程托管*方式创建的，因此没有 `config.yml`，也没有凭据文件：入口规则存放在 Cloudflare 的配置中，那正是面板写入的地方。之后更改主机名意味着在该标签页上编辑它并重新创建隧道 —— 面板不会悄悄留下一条过时的规则。

该面板仅限管理员使用，并且在托管（hosted）实例上不提供，因为隧道面向整个安装，属于运营它的人。

更改 `APP_URL` 或 `TRUST_PROXY` 之后，重启应用容器 —— 这些是在启动时从环境读取的，面板无法替你更改它们。

## 代理后面的 MCP

如果你不使用 MCP 扩展，可以跳过本节。

MCP 是基于会话的。在第一个请求上，服务器会在响应头中回复一个 `Mcp-Session-Id`，客户端在随后的每次调用中把该值作为请求头发回。**两个方向都必须能穿过代理。** 如果响应头被剥掉，客户端就永远不知道自己的会话 id，于是每一次工具调用看起来都像是一个全新连接 —— 服务器每次都开一个新会话，会话不断堆积，一旦用户触及 `MCP_MAX_SESSION_PER_USER`，最旧的会话就会被驱逐以给每个新会话腾位。连接仍然可用，但它在不断翻腾会话而不是复用一个，并且你会在每次工具调用时看到这条警告：

```
[MCP] POST without mcp-session-id for user 1 — starting a new session. If this
repeats on every tool call, the Mcp-Session-Id response header is not reaching
the client (check that your reverse proxy forwards it).
```

Nginx 和 Caddy 默认都会双向转发自定义头，因此**上面的标准配置本来就能用**。只有在你刻意限制了头时才需要采取行动：

- 不要把 `/mcp` 列在 `proxy_hide_header` 指令下，也不要让它经过一个省略了 `Mcp-Session-Id` 的响应头允许清单。
- 如果你的代理重写或小写化了头，那没问题 —— HTTP 头名称不区分大小写，Tourism-Team 和 MCP 客户端都如此对待它们。
- 面向浏览器的 `Access-Control-Expose-Headers: Mcp-Session-Id` 响应头，才让基于浏览器的客户端（Claude.ai、Claude Desktop 连接器、MCP Inspector）能够*读取*会话 id。Tourism-Team 会自动发送它 —— 不要在代理中剥掉或覆盖它。

Tourism-Team 3.3.0 及更早版本完全不发送 `Access-Control-Expose-Headers`，无论代理配置如何都会导致上述症状。如果你用的是更早的版本并且每次工具调用都看到新会话，请升级 —— 任何代理改动都修不好它。

### 流式响应

`/mcp` 端点用 Server-Sent Events 作答。如果你的代理缓冲响应，工具结果会延迟到缓冲区刷新才送达。Nginx 默认会缓冲，因此要为该路径禁用它：

```nginx
location /mcp {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;      # SSE — deliver tool results as they stream
    proxy_read_timeout 3600s; # long-lived streams between tool calls
}
```

Tourism-Team 每 25 秒发送一条 SSE 保活注释（`MCP_SSE_KEEPALIVE`），正是为了让空闲超时较短的代理 —— nginx 默认 60 秒 —— 不会在工具调用之间断开空闲的流。如果你的代理超时比这更紧，请调低该间隔。

## HTTPS 环境变量

有五个变量控制 Tourism-Team 在代理后面的行为。它们作为一组协同工作：

| 变量 | 用途 | 默认值 |
|---|---|---|
| `FORCE_HTTPS` | 为 `true` 时：把 HTTP 301 重定向到 HTTPS（`/api/health` 除外），发送 HSTS（`max-age=31536000`），添加 CSP `upgrade-insecure-requests`，强制 Cookie 的 `secure` 标志 | `false` |
| `HSTS_INCLUDE_SUBDOMAINS` | 为 `true` 时：在 HSTS 头中加入 `includeSubDomains` 指令，把 HTTPS 强制扩展到所有子域。仅在 HSTS 生效时才起作用。如果你在同级子域上以纯 HTTP 运行其他服务，请保持 `false`。 | `false` |
| `TRUST_PROXY` | 受信任的代理跳数。让 Express 能从 `X-Forwarded-For` 读取真实客户端 IP。生产环境中即使未显式配置也会自动设为 `1`。 | `1`（生产环境），关闭（开发环境） |
| `COOKIE_SECURE` | 控制 `trek_session` 上的 `secure` 标志。当 `NODE_ENV=production`、`FORCE_HTTPS=true`，或请求本身经由 TLS 到达时，自动推导为 `true` —— 一旦你的代理发送 `X-Forwarded-Proto: https` 且 `TRUST_PROXY` 已配置，Express 就会设置 `req.secure`。显式设为 `false` 可允许 Cookie 通过纯 HTTP（例如无 TLS 的 LAN 测试）。 | 自动 |
| `ALLOWED_ORIGINS` | 允许的 CORS 来源的逗号分隔列表（例如 `https://tt.example.com`）。生产环境中未设置此项时，所有跨来源请求都会被封锁。开发环境中未设置此项时，允许所有来源。 | 生产环境封锁，开发环境开放 |

> **关于 HSTS 的说明：** 只要 `FORCE_HTTPS=true` **或** `NODE_ENV=production`，就会发出 `max-age=31536000` 头，而 `NODE_ENV=production` 在 Docker 镜像、compose 文件和 Helm chart 中都是默认值 —— 因此标准安装在 `FORCE_HTTPS` 未设置时也会发送 HSTS。浏览器在纯 HTTP 响应上会忽略该头，因此一个你只用 HTTP 访问的实例不受影响。不过一旦浏览器通过 HTTPS 看到过它，就会在一年内拒绝以纯 HTTP 访问该主机名，所以不要指望对一个已经用 HTTPS 服务过的主机名回退到 `http://`。

> **关于 `FORCE_HTTPS` 与代理头的说明：** HTTPS 重定向直接从传入的头中读取 `X-Forwarded-Proto` —— 它不依赖 Express 的 `trust proxy` 设置。如果你设置了 `FORCE_HTTPS=true` 并且你的反向代理正确发送 `X-Forwarded-Proto: https`，那么无论 `TRUST_PROXY` 如何，重定向都会生效。不过你仍然需要设置 `TRUST_PROXY`，以便 Express 从 `X-Forwarded-For` 解析出正确的客户端 IP。

如果你在 `http://<host>:3000` 上不经代理直接访问 Tourism-Team，请不要设置 `FORCE_HTTPS`，也不要设置 `TRUST_PROXY`。

这些变量以及其他所有变量的完整文档见 [环境变量](Environment-Variables)。

## 下一步

- [环境变量](Environment-Variables) —— 完整的变量参考，含 OIDC
- [安装：Docker Compose](Install-Docker-Compose) —— 带代理就绪环境变量的生产 compose 文件
