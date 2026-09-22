# 内部网络访问

当你配置 Immich 或 Synology Photos 等集成时，Tourism-Team 会发起出站 HTTP 请求。默认情况下，它会阻止向私有和本地 IP 范围的请求，以防止服务端请求伪造（SSRF）攻击。当这些服务托管在你的局域网上时，你需要允许内部网络访问。

## 默认行为

Tourism-Team 有两个 SSRF 防护，都在 `ssrfGuard.ts` 中。适用哪一个取决于调用点，而不是由谁配置了该 URL。

**严格防护**（`safeFetch` / `safeFetchFollow`，构建于 `checkSsrf` 之上）覆盖大部分出站流量 —— Immich、Synology Photos、AirTrail、通知 webhook、ntfy、Unsplash 和地点查询。它会在允许连接之前把主机名解析为 IP 地址，并阻止回环、链路本地和私有范围。只有私有范围会开放，且仅在 `ALLOW_INTERNAL_NETWORK=true` 时。下面两张表描述的就是这个防护。

**宽松防护**（`safeFetchAdminConfigured`，也导出为 `safeFetchLlm`）覆盖那些预期位于你自己网络上的端点：OIDC（discovery、token、userinfo、JWKS）、AI 解析扩展背后的大模型提供商（本地 Ollama 或任何兼容 OpenAI 的端点），以及插件的 OAuth 令牌交换。它刻意允许回环和局域网目标，因此 `localhost` 上的模型服务器或你局域网上的身份提供商**无需** `ALLOW_INTERNAL_NETWORK` 即可工作。它仍会解析每个主机名、重新检查每一个重定向跳，并始终阻止链路本地和云元数据地址（`169.254.0.0/16`、完整的 `fe80::/10`，以及 AWS 和阿里云的元数据地址）。

## 始终阻止（无法覆盖）

在严格防护下，无论任何设置，以下范围都会被阻止：

| 范围 | 说明 |
|---|---|
| `127.0.0.0/8`、`::1` | 回环 |
| `0.0.0.0/8` | 未指定 |
| `169.254.0.0/16`、`fe80::/16` | 链路本地 / 云元数据端点 |
| `::ffff:127.x.x.x`、`::ffff:169.254.x.x` | IPv4 映射的回环和链路本地 |

这里的 IPv6 链路本地规则只匹配 `fe80:` 这个十六位组，比名义上的 `fe80::/10` 前缀（`fe80:`–`febf:`）更窄。实际上这是同一组地址，因为 RFC 4291 的链路本地地址始终是 `fe80::/64`。宽松防护覆盖整个 `/10`。

## 除非 `ALLOW_INTERNAL_NETWORK=true` 否则阻止

| 范围 / 主机名 | 说明 |
|---|---|
| `10.0.0.0/8` | RFC-1918 私有 |
| `172.16.0.0/12` | RFC-1918 私有 |
| `192.168.0.0/16` | RFC-1918 私有 |
| `100.64.0.0/10` | CGNAT / Tailscale 共享地址空间 |
| `fc00::/7` | IPv6 ULA |
| IPv4 映射的 RFC-1918 变体 | 例如 `::ffff:10.x`、`::ffff:192.168.x` |
| `*.local`、`*.internal`、`localhost` 主机名 | mDNS / 内部 DNS 后缀（例如 Docker 服务名、局域网主机）以及字面量 `localhost` |

主机名 `localhost` 也会在主机名阶段被匹配，但它通常解析为回环地址（`127.0.0.1` 或 `::1`），而始终阻止的回环规则会先一步捕获它 —— 因此在严格防护下，无论 `ALLOW_INTERNAL_NETWORK` 如何设置它都会被阻止。在把 `localhost` 映射到别处的主机上，主机名规则仍然适用，除非 `ALLOW_INTERNAL_NETWORK=true`，否则它依旧被阻止。宽松防护直接允许 `localhost`，这正是本地 Ollama 成为 AI 解析受支持默认方案的原因。

当 `ALLOW_INTERNAL_NETWORK=true` 时，`*.local` 和 `*.internal` 主机名会被允许 —— 防护仍会把它们解析为 IP 并执行所有 IP 层面的规则，因此任何解析为回环或链路本地地址的此类主机名无论如何仍会被阻止。

## 何时启用

当通过严格防护访问的服务 —— Immich、Synology Photos、AirTrail 或通知 webhook —— 托管在你的本地网络上，而你需要 Tourism-Team 访问它时，请设置 `ALLOW_INTERNAL_NETWORK=true`。本地或局域网 Ollama、兼容 OpenAI 的端点、你局域网上的 OIDC 提供商，或插件 OAuth，都**不需要**它；那些走宽松防护，本来就能工作。如果只有那些需要内部访问，就保持该标志关闭，因为打开它会同时为每一个走严格防护的集成扩大暴露面。

如何设置环境变量见 [环境变量](Environment-Variables)。

> **管理员：** 在局域网上配置 Immich 或 Synology 之前，先在 [环境变量](Environment-Variables) 中设置 `ALLOW_INTERNAL_NETWORK=true`。

## DNS 重绑定防护

即使设置了 `ALLOW_INTERNAL_NETWORK=true`，Tourism-Team 也会固定 DNS 解析以防止重绑定攻击。当防护检查一个 URL 时，它会解析一次主机名并记录该 IP。出站连接随后通过固定的 dispatcher（经由 undici）直接连接到该 IP，因此主机名无法在检查与实际请求之间重新解析为不同的地址。

## 审计日志

当用户保存一个解析为私有 IP 的 Immich URL 时，Tourism-Team 会在[审计日志](Audit-Log)中记录一条 `immich.private_ip_configured`，包含该 URL 和解析出的 IP 地址。AirTrail 以 `airtrail.private_ip_configured` 做同样的事。Synology Photos 不会发出对应的事件。

## 另见

- [照片来源](Photo-Providers)
- [用户设置](User-Settings)
- [环境变量](Environment-Variables)
- [安全加固](Security-Hardening)
