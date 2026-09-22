# 常见问题

## 我需要 Google Maps API 密钥吗？

不需要。没有配置 Google Maps 密钥时，Tourism-Team 会自动回退到 OpenStreetMap（Nominatim）进行地点搜索 —— 不需要 API 密钥或账号。如果你想要更丰富的地点数据（照片、评分、营业时间），管理员可以选择在 **管理后台 → 设置** 中添加 Google Maps 密钥 —— 见 [管理后台概览](Admin-Panel-Overview)。在那里保存的密钥对每个成员全实例生效；界面里没有按用户填写的字段。

## 我可以离线使用 Tourism-Team 吗？

可以。Tourism-Team 是一个渐进式 Web 应用。首次访问之后，Service Worker（由 Workbox 驱动）会缓存地图瓦片（Carto、OpenStreetMap、Mapbox GL 和 OpenFreeMap）、已上传的封面和头像，以及应用的每个页面。此后再访问时，已缓存的内容无需网络连接即可使用。行程数据不来自该缓存：它按用户存储在 IndexedDB 中，并通过 Tourism-Team 自己的离线层读回，写入操作会排队，并在你重新联网后重放。安装说明见 [离线模式与 PWA](Offline-Mode-and-PWA)。

> **注意：** API 响应**永远不会**存入 Service Worker 缓存。Workbox 按 URL 作为条目的键，无法根据会话 Cookie 区分它们，所以缓存 API 响应意味着共享设备上某个账户的数据可能被提供给下一个用户。

## 我可以创建多少个 MCP 令牌？

每个用户最多可以创建 **10 个静态 API 令牌**。静态令牌已被弃用 —— 尽可能迁移到 OAuth 2.1。

对于 OAuth 2.1，每个用户最多可以注册 **10 个 OAuth 客户端**。并发 MCP 会话的默认上限是**每用户 20 个**（可通过 `MCP_MAX_SESSION_PER_USER` 配置）。见 [MCP 配置](MCP-Setup)。

> **管理员：** 必须先管理后台 > 扩展中启用 MCP，任何用户才能访问它。

## 我的数据存储在哪里？

| 类型 | 路径 |
|------|------|
| 数据库 | `./data/travel.db`（SQLite） |
| 上传文件 | `./uploads/` |
| 日志 | `./data/logs/trek.log`（自动轮转） |
| 备份 | `./data/backups/` |

在 Docker 中运行时，请把 `./data` 和 `./uploads` 挂载为卷，这样你的数据才能在容器更新后留存。见 [安装：Docker Compose](Install-Docker-Compose)。

## 我该如何更新 Tourism-Team？

拉取新镜像并重新创建容器。你的数据位于已挂载的卷中，更新过程绝不会修改它。具体命令见 [更新](Updating)。

## 我可以限制谁可以注册吗？

可以。管理员可以关闭开放注册，这样新账户只能通过邀请链接创建。见 [管理：用户与邀请](Admin-Users-and-Invites)。

## Tourism-Team 支持单点登录吗？

支持，通过 OpenID Connect（OIDC）。兼容的提供商包括 Google、Authentik、Keycloak，以及任何符合标准 OIDC 的 IdP。设置 `OIDC_ONLY=true` 可完全关闭密码登录。见 [OIDC 单点登录](OIDC-SSO)。

## Tourism-Team 可以直接打开我的旅行而不是仪表盘吗？

可以。在设置 → 常规 → **启动** 中，把启动页面设为**进行中的旅行**，并选择它应该打开哪个标签页 —— 比如你旅行时主要在记费用，就选费用。之后打开 Tourism-Team（包括已安装的 PWA 或主屏快捷方式）会一步直达那里，而不是三步。

如果你更愿意自己搭建快捷方式，或者让某个包装应用指向它，任何行程 URL 都可以直接指定标签页：`/trips/42?tab=finanzplan`。标签页 id 的完整列表见 [常规设置](Display-Settings)。
