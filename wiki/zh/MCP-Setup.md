# MCP 配置

本页说明如何把 AI 助手连接到你的 Tourism-Team 实例。Tourism-Team 支持三种认证方式：带浏览器同意的 OAuth 2.1（推荐用于交互式客户端）、无需浏览器登录的机器客户端（推荐用于 AI 代理和脚本），以及静态 API 令牌（已弃用）。

![MCP 配置](assets/MCPConfig.png)

> **Cloudflare 用户：** 如果你的 Tourism-Team 实例经由 Cloudflare 代理，Bot Fight Mode 和 Super Bot Fight Mode 会阻止来自 ChatGPT 的 MCP 请求。Claude.ai 不受影响。修复方法见 [疑难排查 → MCP 请求被 Cloudflare WAF 阻止](Troubleshooting#mcp-requests-blocked-by-cloudflare-waf-bot-fight-mode)。

## 方式 A：OAuth 2.1（推荐）

OAuth 2.1 是首选的连接方式。你在同意步骤中授予具体的权限范围，此后无需任何令牌管理 —— Tourism-Team 签发短期访问令牌并自动轮换刷新令牌。

### Claude.ai

Claude.ai（网页版）支持原生 MCP 连接 —— 无需 JSON 配置文件：

1. 在 Tourism-Team 中前往 **设置 → 集成 → MCP → OAuth 2.1 客户端**，点击 **新建客户端**。
2. 选择 **Claude.ai** 预设。它会填入重定向 URI（`https://claude.ai/api/mcp/auth_callback`）和一组默认权限范围。
3. 给客户端起个名字，按需调整权限范围，然后保存。复制客户端 ID 和客户端密钥（`trekcs_` 前缀）—— 密钥只显示一次。
4. 在 Claude.ai 中打开 MCP 设置，用你的 Tourism-Team URL（`https://<your-tt-instance>/mcp`）添加一个新服务器。Claude.ai 会打开你的浏览器来完成 OAuth 同意流程。

### Claude Desktop

Claude Desktop 支持原生 MCP 连接 —— 无需 JSON 配置文件：

1. 在 Tourism-Team 中前往 **设置 → 集成 → MCP → OAuth 2.1 客户端**，点击 **新建客户端**。
2. 选择 **Claude Desktop** 预设。它会填入重定向 URI 和一组默认权限范围。
3. 给客户端起个名字，按需调整权限范围，然后保存。复制客户端 ID 和客户端密钥 —— 密钥只显示一次。
4. 在 Claude Desktop 中打开 设置 → MCP，用你的 Tourism-Team URL（`https://<your-tt-instance>/mcp`）添加一个新服务器。Claude Desktop 会打开你的浏览器来完成 OAuth 同意流程。

### Cursor、VS Code、Windsurf 与 Zed

支持 `mcp-remote` 的客户端可以通过以下两种方式之一连接。

**方式一 —— 动态注册（无需预先创建客户端）：**

```json
{
  "mcpServers": {
    "trek": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://<your-tt-instance>/mcp"
      ]
    }
  }
}
```

客户端启动时，它会拉取 Tourism-Team 的 OAuth 发现文档（`/.well-known/oauth-authorization-server`），自动注册自己，并打开你的浏览器进入 Tourism-Team 同意页面。你在此处选择权限范围。

**方式二 —— 预先创建的 OAuth 客户端：**

在 Tourism-Team 中用合适的预设创建一个客户端（Cursor、VS Code、Windsurf 或 Zed —— 它们都以 `http://localhost` 作为重定向 URI），然后通过 `--static-oauth-client-info` 传入凭据：

```json
{
  "mcpServers": {
    "trek": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://<your-tt-instance>/mcp",
        "--static-oauth-client-info",
        "{\"client_id\": \"<your_client_id>\", \"client_secret\": \"<your_client_secret>\"}"
      ]
    }
  }
}
```

> 在 Windows 上，`npx` 可能需要完整路径，例如 `C:\PROGRA~1\nodejs\npx.cmd`。

> **要求：** 服务器上必须设置 `APP_URL`，OAuth 发现才能工作。

### 预先创建的 OAuth 客户端

**设置 → 集成 → MCP → OAuth 2.1 客户端** 让你在连接之前创建具名的 OAuth 客户端。这会为你带来：

- 一份事先定义好的、固定的具名权限范围列表
- 一个客户端密钥（`trekcs_` 前缀，只显示一次），用于机密客户端模式
- Claude.ai、Claude Desktop、Cursor、VS Code、Windsurf 和 Zed 的预设按钮，会填入正确的重定向 URI 和一组合理的默认权限范围

每位用户最多可以有 **10 个 OAuth 客户端**。

## 方式 B：机器客户端 —— 无需浏览器登录（用于 AI 代理和脚本）

当你的 AI 代理或自动化脚本需要在没有任何浏览器交互的情况下静默认证时，请使用这种方式。客户端不走 OAuth 同意流程，而是直接用 `client_id` 和 `client_secret` 交换访问令牌（[RFC 6749 §4.4 —— 客户端凭据授予](https://datatracker.ietf.org/doc/html/rfc6749#section-4.4)）。

**它为什么存在：** 基于浏览器的 OAuth 流程对无人值守运行的代理来说很别扭。过去，两个会话共用一个刷新令牌会被读作重放，从而撤销整条链并弹出登录窗口；Tourism-Team 现在允许刚轮换过的令牌有一个短暂的宽限期，因此并发刷新不再会终止会话。机器客户端则仍然完全绕开这个问题 —— 没有刷新令牌，也完全没有轮换。

**它如何工作：** 令牌以它所有者的身份行事（即创建该客户端的用户），范围限定在创建时选定的权限上。Tourism-Team 的所有权限检查仍然适用 —— AI 代理只能访问你能访问的内容，并进一步收窄到所选权限范围。

### 创建机器客户端

1. 前往 **设置 → 集成 → MCP → OAuth 2.1 客户端**，点击 **新建客户端**。
2. 勾选 **机器客户端（无需浏览器登录）**。重定向 URI 字段会消失 —— 机器客户端不需要它。
3. 给它起个名字，选择权限范围，然后点击 **注册客户端**。
4. 复制显示出的 `client_id` 和 `client_secret` —— 密钥只显示一次。

### 令牌管理如何工作

你的 AI 客户端使用 `client_id` 和 `client_secret` 直接从 Tourism-Team 请求令牌（`POST /oauth/token`，带 `grant_type=client_credentials`）。令牌有效期为 1 小时。过期时，客户端会静默请求一个新的 —— 没有浏览器窗口、没有用户操作、没有同意页面。这完全由客户端处理。

### 谁应该使用这种方式

机器客户端是为**能够自行调用令牌端点并以编程方式处理续期的 AI 代理框架和自定义 MCP 客户端实现**而设计的。Tourism-Team 在其 OAuth 发现文档（`/.well-known/oauth-authorization-server`）中宣传 `client_credentials`，因此任何合规的客户端都可以自动发现并使用它。

> **`mcp-remote` 用户：** `mcp-remote` 只实现基于浏览器的 `authorization_code` 流程 —— 它不支持 `client_credentials`。如果你使用 `mcp-remote`，请坚持方式 A 并使用适合你客户端的预设。机器客户端选项不适用。

## 方式 C：静态 API 令牌（已弃用）

> **已弃用：** 静态令牌将在未来的 Tourism-Team 版本中停止工作。请迁移到 OAuth 2.1 或机器客户端。

静态令牌授予对所有工具和资源的完整访问权，没有权限范围限制。静态令牌会话只会收到一次弃用警告，而不是每次调用都警告：该通知搭载在该会话中第一次 `list_trips` 或 `get_trip_summary` 的结果里 —— 也就是 AI 客户端通常最先使用的旅行发现工具 —— 由客户端呈现给你。工具自身的载荷仍会一同返回，该会话中此后每次调用都返回普通结果。该通知也是服务器在连接初始化时发送的会话说明的一部分。

1. 前往 **设置 → 集成 → MCP**，打开 **API 令牌** 子标签页，点击 **创建新令牌**。
2. 给令牌起个名字并立即复制 —— 它只显示一次。令牌以 `trek_` 开头。
3. 在你的客户端配置中把令牌作为头传入：

```json
{
  "mcpServers": {
    "trek": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://<your-tt-instance>/mcp",
        "--header",
        "Authorization: Bearer trek_your_token_here"
      ]
    }
  }
}
```

每位用户最多可以创建 **10 个静态令牌**。

## 认证对照

| 方式 | 授予类型 | 令牌前缀 | 访问级别 | 过期 |
|---|---|---|---|---|
| OAuth 2.1 —— 浏览器同意 | `authorization_code` | `trekoa_` | 受权限范围限制（按同意） | 1 小时；通过 30 天滚动刷新令牌（`trekrf_`）自动刷新 |
| 机器客户端 —— 无浏览器 | `client_credentials` | `trekoa_` | 受权限范围限制（按客户端），以所有者身份行事 | 1 小时；静默重新请求，没有刷新令牌 |
| OAuth 客户端密钥 | — | `trekcs_` | 用于在令牌端点认证客户端 | 不过期（通过界面撤销） |
| 静态 API 令牌 | — | `trek_` | 完整访问权 | 不过期 —— **已弃用** |

## 相关

- [MCP 概览](MCP-Overview)
- [MCP 权限范围](MCP-Scopes)
- [管理：MCP 访问](Admin-MCP-Tokens)
- [环境变量](Environment-Variables)
- [反向代理](Reverse-Proxy) —— 代理必须把 `Mcp-Session-Id` 透传，否则每次工具调用都会打开一个新会话
- [疑难排查](Troubleshooting) —— OAuth 流程未启动、会话不断堆积、Cloudflare WAF 阻断
