# MCP 概览

Tourism-Team 内置了一个 [Model Context Protocol](https://modelcontextprotocol.io/)（MCP）服务器。MCP 是一个开放标准，让 AI 助手可以通过结构化 API 读取和修改外部服务中的数据。当你的 Tourism-Team 实例上启用了 MCP 扩展时，Claude.ai、Claude Desktop、Cursor、VS Code 等 AI 客户端就可以直接连接到你的旅行。

## 你能做什么

连接之后，AI 助手可以在一次对话中处理你的 Tourism-Team 数据：

- 创建和更新旅行、日程和行程
- 搜索真实世界的地点并把它们加入你的旅行
- 构建和管理行李清单与待办事项
- 跨旅行成员跟踪预算和支出
- 创建预订、交通订单和住宿
- 向其他旅行成员发送协作消息和笔记
- 在足迹中把国家和地区标记为已访问
- 在假期中登记休假天数
- 跨多次旅行撰写旅程条目

通过 MCP 所做的改动会实时广播给所有已连接的客户端 —— 与在网页界面中所做的改动完全一样。

## 认证方式

| 使用场景 | 方式 |
|---|---|
| 交互式客户端（Claude.ai、Cursor、VS Code……） | 带浏览器同意的 OAuth 2.1 —— 你在同意页面批准权限范围后，Tourism-Team 签发令牌 |
| 无人值守运行的 AI 代理或脚本 | 机器客户端（client_credentials）—— 直接用 `client_id` + `client_secret` 获取令牌，从不打开浏览器 |
| 旧有配置 | 静态 API 令牌 —— 已弃用，完整访问权，无权限范围 |

每种方式的分步说明见 [MCP 配置](MCP-Setup)。

## 要求

- **已启用 MCP 扩展** —— 管理员必须先在管理后台启用 MCP 扩展（`mcp`），`/mcp` 端点才会可用，MCP 区域才会出现在用户设置中。
- **已设置 `APP_URL`** —— 把 `APP_URL` 环境变量设为你的 Tourism-Team 实例的公开 URL，以便 OAuth 发现通告正确的签发者和端点。如果它未设置或不是有效 URL，Tourism-Team 会回退到 `ALLOWED_ORIGINS` 的第一项，然后回退到 `http://localhost:{PORT}`。只有 `https://` 源或 `localhost` / `127.0.0.1` 会被接受为签发者 —— 其他任何值都会被替换为 `http://localhost:{PORT}`，而远程 OAuth 客户端无法访问它。

## 限流与会话限制

| 设置 | 默认值 | 环境变量 |
|---|---|---|
| 每用户每分钟请求数 | 300 | `MCP_RATE_LIMIT` |
| 每用户最大并发会话数 | 20 | `MCP_MAX_SESSION_PER_USER` |
| 会话空闲超时（秒） | 3600 | `MCP_SESSION_TTL` |
| SSE 保活间隔（秒，0 = 关闭） | 25 | `MCP_SSE_KEEPALIVE` |

限流按「用户–客户端」对跟踪，因此每个 OAuth 客户端都有自己的独立窗口。会话默认在 1 小时无活动后过期（`MCP_SESSION_TTL`）；打开的 SSE 流算作活动。服务器还会每 25 秒发送一次 SSE 注释 ping，使带空闲超时的反向代理（例如 nginx 默认的 60 秒）不会在工具调用之间掐断数据流。

达到 `MCP_MAX_SESSION_PER_USER` 并不会拒绝请求：服务器会关闭该用户最近最少活动的会话，为新会话腾出位置。这可以避免一个无法保持住自己会话 id 的客户端把自己锁在服务器之外。

> **反向代理：** MCP 会话依赖 `Mcp-Session-Id` 头双向传递。一个剥离它的代理会让每次工具调用都打开一个新会话，而不是复用一个。Nginx 和 Caddy 默认会透传它 —— 如果你自定义了头部处理，见 [反向代理](Reverse-Proxy)。

> **Kubernetes / 多副本：** MCP 会话按实例保存在内存中。在多于一个副本时，你需要粘性会话（或单个副本），否则客户端会间歇性地看到 `404 Session not found`。

## 端点

```
https://<your-tt-instance>/mcp
```

如果未启用 MCP 扩展，该端点返回 `403`。如果认证失败，它返回 `401`。

> **管理员：** 在 [管理：扩展](Admin-Addons) 中启用 MCP 扩展。为 OAuth 发现设置 `APP_URL`。从 [管理：MCP 访问](Admin-MCP-Tokens) 撤销令牌并管理 OAuth 客户端。用 `MCP_RATE_LIMIT` 和 `MCP_MAX_SESSION_PER_USER` 调整限流与会话限制 —— 见 [环境变量](Environment-Variables)。

## 下一步

1. [MCP 配置](MCP-Setup) —— 连接你的 AI 客户端
2. [MCP 权限范围](MCP-Scopes) —— 选择合适的权限
3. [MCP 工具与资源](MCP-Tools-and-Resources) —— 浏览可用的工具
