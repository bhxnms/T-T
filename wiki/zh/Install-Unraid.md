# 安装：Unraid

通过 Community Applications 或直接导入模板，在 Unraid 上安装 Tourism-Team。


## 前提条件

必须在 Unraid 中启用 Docker（**Settings → Docker → Enable Docker: Yes**）。

## 通过 Community Applications 安装

1. 打开 Unraid 中的 **Apps** 标签页。
2. 搜索 **Tourism-Team**。
3. 在 Tourism-Team 结果上点击 **Install**。

如果该应用没有出现，你可以直接从模板 URL 安装。在 **Docker → Add Container** 中粘贴模板 URL：

```
https://raw.githubusercontent.com/bhxnms/T-T/main/unraid-template.xml
```

## 模板字段

Unraid 模板在容器界面中提供以下字段：

### 端口与路径

| 字段 | 容器路径 | 默认宿主机值 |
|---|---|---|
| Web UI Port | `3000/tcp` | `3000` |
| Data | `/app/data` | `/mnt/user/appdata/trek/data` |
| Uploads | `/app/uploads` | `/mnt/user/appdata/trek/uploads` |

### 核心变量（始终可见）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `ENCRYPTION_KEY` | *（空）* | 首次安装时设置。在 Unraid 终端中用 `openssl rand -hex 32` 生成。 |
| `TZ` | `UTC` | 日志、提醒和定时任务使用的时区（例如 `Europe/Berlin`） |
| `ALLOWED_ORIGINS` | *（空）* | 用于 CORS 和邮件通知链接的逗号分隔来源列表，例如 `https://tt.example.com` |
| `APP_URL` | *（空）* | 公开基础 URL；启用 OIDC 时必需（必须与向你的 IdP 注册的重定向 URI 一致） |
| `ADMIN_EMAIL` | `admin@tt.local` | 首个管理员账户的邮箱（仅首次启动时生效；一旦存在任何用户便不再起作用）。由模板预填 —— 必须与 `ADMIN_PASSWORD` 一同设置，否则两者都会被忽略。 |
| `ADMIN_PASSWORD` | *（空）* | 首个管理员账户的密码（仅首次启动时生效）。必须与 `ADMIN_EMAIL` 一同设置。两者中任何一个缺失，Tourism-Team 都会以邮箱 `admin@tt.local` 创建该账户，并把随机生成的密码打印到容器日志中。 |

### 高级变量

其他变量（`PORT`、`NODE_ENV`、`LOG_LEVEL`、`TREK_WIKI_DIR`、`DEFAULT_LANGUAGE`、`FORCE_HTTPS`、`HSTS_INCLUDE_SUBDOMAINS`、`TRUST_PROXY`、`COOKIE_SECURE`、`ALLOW_INTERNAL_NETWORK`、`SESSION_DURATION`、`SESSION_DURATION_REMEMBER`、全部 OIDC 变量、`MCP_RATE_LIMIT`、`MCP_MAX_SESSION_PER_USER`、`DEMO_MODE`、`UNSPLASH_ACCESS_KEY`）可在模板编辑器中的 **Advanced View** 下找到。

## 设置加密密钥

在 Unraid 终端（**Tools → Terminal**）中生成密钥：

```bash
openssl rand -hex 32
```

在首次启动容器之前，把输出复制到 `ENCRYPTION_KEY` 字段中。如果跳过这一步，Tourism-Team 会自动生成一个密钥并保存到 `data/.encryption_key` —— 你的数据仍受保护，但你应该把该文件纳入备份。

## 安装之后

容器启动后，在浏览器中打开：

```
http://<unraid-ip>:<port>
```

首次启动时，Tourism-Team 会自动创建一个管理员账户。凭据会打印到容器日志中 —— 在 Unraid 界面中查看 **Docker → trek → Log**。如果你同时设置了 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD`，就会使用这些值；否则邮箱为 `admin@tt.local`，并生成一个随机密码。

## 下一步

- [环境变量](Environment-Variables) —— 完整的变量参考
- [更新](Updating) —— 如何在 Unraid 上拉取新镜像
