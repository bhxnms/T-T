# OIDC / 单点登录


## OIDC 能给你什么

OpenID Connect（OIDC）让用户使用现有的身份提供方登录 —— Google、Authentik、Keycloak，或任何 OIDC 兼容的 IdP —— 而不是本地的邮箱/密码。首次 SSO 登录时，会自动使用提供方给出的邮箱创建一个 Tourism-Team 账户。

## 用户流程

1. 在登录页点击 **「使用 SSO 登录」**。
2. 你会被重定向到你的身份提供方的登录页。
3. 完成认证并授予同意。
4. 提供方会重定向回 Tourism-Team，地址为 `GET /api/auth/oidc/callback`。如果这是你的首次登录，会自动创建一个账户（受注册设置约束）。
5. 服务器签发一个短时一次性代码，并把你的浏览器重定向到 `/login?oidc_code=<code>`。前端立即在 `GET /api/auth/oidc/exchange?code=<code>` 用该代码换取会话。
6. 你的 `trek_session` Cookie 被设置，你落到仪表盘上。

**记住我。** 登录页上的记住我开关会作为登录 URL 上的查询标志带入 SSO：`GET /api/auth/oidc/login?remember=1`（或 `remember=0`），当已存在邀请令牌时以 `&` 追加。只接受 `0` 和 `1`；任何其他值 —— 以及从注册标签页启动 SSO（那里不显示该开关）—— 都会被当作该参数不存在。该选择保存在服务器端登录状态中，能经受提供方的往返和一次性代码交换，并同时决定会话生命周期和 Cookie 生命周期：

| `remember` | 会话生命周期 | `trek_session` Cookie |
|---|---|---|
| `1` | `SESSION_DURATION_REMEMBER`（默认 `30d`） | 持久，`maxAge` 与之匹配 |
| `0` | `SESSION_DURATION`（默认 `24h`） | 浏览器会话 Cookie，浏览器关闭时清除 |
| 省略 | `SESSION_DURATION`（默认 `24h`） | 持久，`maxAge` 与之匹配 |

如果 SSO 会话在浏览器关闭时就失效，说明登录链接发送的是 `remember=0`。

## 前提条件

在启动服务器前设置以下环境变量：

| 变量 | 必需 | 说明 |
|---|---|---|
| `APP_URL` | 是 | 你的 Tourism-Team 实例的基础 URL（例如 `https://tt.example.com`）。用于构建重定向 URI。**仅能通过环境变量设置 —— 无法在管理后台配置。** 如果它未设置（或不是可解析的 URL，这种情况下它会被忽略），Tourism-Team 会回退到第一个 `ALLOWED_ORIGINS` 条目，而只有当那一个也缺失或无法解析时才回退到 `http://localhost:{PORT}` —— 这会产生一个你的 IdP 会拒绝的重定向 URI。不带 scheme 的 `ALLOWED_ORIGINS=tt.example.com` 无法解析，因此它最终也会落到 localhost。 |
| `OIDC_ISSUER` | 是 | 你的身份提供方的 Issuer URL。生产环境必须使用 HTTPS。 |
| `OIDC_CLIENT_ID` | 是 | 在你的 IdP 上注册的 OAuth 2.0 客户端 ID。 |
| `OIDC_CLIENT_SECRET` | 是 | OAuth 2.0 客户端密钥。 |

向你的身份提供方注册以下**重定向 URI**：

```
<APP_URL>/api/auth/oidc/callback
```

例如：`https://tt.example.com/api/auth/oidc/callback`

## 可选环境变量

| 变量 | 说明 |
|---|---|
| `OIDC_DISPLAY_NAME` | SSO 按钮上显示的标签。默认为 `SSO`。 |
| `OIDC_ONLY` | 设为 `true` 可禁用本地密码登录和密码注册。SSO 登录和 SSO 注册仍由它们各自的开关管控。这是一个仅能通过环境变量设置的设置，无法在运行时通过管理后台切换。 |
| `OIDC_ADMIN_CLAIM` | 用于管理员角色映射而检查的 OIDC claim。默认为 `groups`。claim 值可以是数组或普通字符串。**仅能通过环境变量设置 —— 无法在管理后台配置。** |
| `OIDC_ADMIN_VALUE` | 必须出现在 `OIDC_ADMIN_CLAIM` 中才能授予管理员角色的值。如果未设置，基于 claim 的角色映射被禁用。设置后，每次登录都会重新评估该角色。**仅能通过环境变量设置 —— 无法在管理后台配置。** |
| `OIDC_SCOPE` | 覆盖发送给提供方的默认权限范围列表。默认为 `openid email profile`。请确保始终包含 `openid` 和 `email`。**仅能通过环境变量设置 —— 无法在管理后台配置。** |
| `OIDC_DISCOVERY_URL` | OIDC 发现文档的完整 URL。用于发现路径非标准的提供方（例如 Authentik 租户）。如果未设置，会在 `<OIDC_ISSUER>/.well-known/openid-configuration` 尝试发现。发现文档会缓存 1 小时。 |

## 通过 SSO 注册新用户

当一次 SSO 登录按 OIDC subject（`sub`）匹配到现有的 Tourism-Team 账户时，会直接使用该账户。当它仅按**邮箱**匹配时，只有当提供方为其断言了 `email_verified` 时，OIDC 身份才会被链接到该账户；如果该 claim 缺失或为 false，登录会以 `email_not_verified` 错误被拒绝，因此未验证的地址永远无法接管一个本地账户。请确保你的 IdP 在 userinfo 响应中包含 `email_verified` —— 它是 `email` 权限范围的一部分。如果不存在匹配的账户，Tourism-Team 会尝试创建一个。结果取决于以下几点：

- **史上第一个用户**：始终创建为管理员，无需邀请。
- **开放 SSO 注册已启用**（管理后台开关 `oidc_registration`）：账户被创建为普通用户。
- **登录 URL 中存在邀请令牌**：无论注册开关如何，账户都会被创建。在发起 SSO 登录时以 `?invite=<token>` 传递该令牌（例如 `GET /api/auth/oidc/login?invite=<token>`）。
- **SSO 注册已禁用且没有邀请**：登录以 `registration_disabled` 错误被拒绝。

## 管理后台（运行时配置）

OIDC 也可以不通过环境变量，而是在 **管理 → 设置** 的 **单点登录（OIDC）** 卡片中配置。以下字段可在运行时设置：

| 字段 | 对应的环境变量 |
|---|---|
| Issuer URL | `OIDC_ISSUER` |
| Client ID | `OIDC_CLIENT_ID` |
| Client Secret | `OIDC_CLIENT_SECRET` |
| 显示名称 | `OIDC_DISPLAY_NAME` |
| Discovery URL | `OIDC_DISCOVERY_URL` |

当两者都存在时，环境变量优先于数据库设置。

以下变量**仅能通过环境变量设置**，在管理后台没有对应项：`OIDC_ONLY`、`OIDC_SCOPE`、`OIDC_ADMIN_CLAIM`、`OIDC_ADMIN_VALUE`。

`OIDC_ONLY` 环境变量始终覆盖面板中的登录方式开关。要在没有 `OIDC_ONLY` 的情况下于运行时禁用密码登录，请改用 管理 → 设置 中的 **password_login** 和 **password_registration** 开关。

> **注意：** 管理后台会阻止你同时禁用所有登录方式。至少必须保留一种方式（密码或 SSO）处于活动状态。同样，在密码登录被禁用时，你无法从管理后台移除 OIDC 配置。

---

**另见：** [登录与注册](Login-and-Registration) · [环境变量](Environment-Variables)
