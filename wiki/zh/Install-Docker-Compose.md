# 安装：Docker Compose

使用 Docker Compose 并启用安全加固的生产级部署。

## Compose 文件

见 https://github.com/bhxnms/T-T/blob/main/docker-compose.yml

## 安全加固说明

该 compose 文件默认启用了若干加固选项：

| 设置 | 作用 |
|---|---|
| `read_only: true` | 以只读方式挂载容器文件系统；只有两个挂载的卷（`/app/data`、`/app/uploads`）和 `/tmp` 可写 |
| `security_opt: no-new-privileges:true` | 阻止进程通过 setuid/setgid 可执行文件获得额外的 Linux 权限 |
| `cap_drop: [ALL]` | 从容器中丢弃所有 Linux 能力 |
| `cap_add: [CHOWN, SETUID, SETGID]` | 只加回入口脚本把权限降为 `node` 用户所需的能力 |
| `tmpfs: /tmp:noexec,nosuid,size=128m` | 挂载一个 128 MB 的内存 `/tmp`；因为容器根目录是只读的，所以这是必需的 |

> **注意（snap 版 Docker）：**如果你通过 `snap` 安装 Docker（配置位于 `/var/snap/docker/...`），`no-new-privileges:true` 会导致容器无法启动，报 `exec /usr/bin/dumb-init: operation not permitted`。这是 [snap/AppArmor 的限制](https://bugs.launchpad.net/snapd/+bug/1908448)，不是 Tourism-Team 的问题 —— 请改为从[官方 apt 仓库](https://docs.docker.com/engine/install/ubuntu/)安装 Docker，或移除 `no-new-privileges`。见[疑难排查](Troubleshooting#container-wont-start-exec-usrbindumb-init-operation-not-permitted)。

## 卷

| 宿主机路径 | 容器路径 | 内容 |
|---|---|---|
| `./data` | `/app/data` | SQLite 数据库、日志、`.jwt_secret`、`.encryption_key` |
| `./uploads` | `/app/uploads` | 上传的文件（照片、文档、封面、头像） |

### 命名卷

上面的 compose 文件使用绑定挂载（`./data`、`./uploads`）。你可以改用 Docker 命名卷，它们完全由 Docker 管理，不绑定到特定的宿主机路径。所有选项见 [Docker Compose 卷参考](https://docs.docker.com/reference/compose-file/volumes/)。

```yaml
services:
  app:
    # ... (rest of service config unchanged)
    volumes:
      - trek_data:/app/data
      - trek_uploads:/app/uploads

volumes:
  trek_data:
  trek_uploads:
```

Docker 会在首次 `docker compose up` 时自动创建这些卷。用 `docker volume ls` 和 `docker volume inspect` 管理它们。

## 环境变量

该 compose 文件没有 `env_file:` 键，因此放在 `docker-compose.yml` 旁边的 `.env` 只用于 `${VAR}` 插值 —— 只有当 `environment:` 块中有某行引用它时，值才会到达容器。有四个条目是这样接线的：

```bash
# .env
ENCRYPTION_KEY=<output of: openssl rand -hex 32>
TZ=Europe/Berlin
LOG_LEVEL=info
ALLOWED_ORIGINS=https://tt.example.com
```

被注释掉的 `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` 行同样会被插值，因此取消注释就足以从 `.env` 中取到它们的值。

其他所有变量 —— `APP_URL`、OIDC 那一块、`FORCE_HTTPS`、`TRUST_PROXY`、`ADMIN_EMAIL`/`ADMIN_PASSWORD`、MCP 限制 —— 都以注释形式的字面量提供。请在 `docker-compose.yml` 中取消该行的注释并把值写在那里；只在 `.env` 中设置它没有效果。

`APP_URL` 通常不需要。Tourism-Team 按 `APP_URL` → `ALLOWED_ORIGINS` 的第一项 → `http://localhost:<PORT>` 的顺序解析其公开基础 URL，因此上面的 `ALLOWED_ORIGINS` 值已经为 OIDC 重定向 URI、通行密钥来源校验和邮件通知中的链接提供了正确的来源。只有当公开基础 URL 必须与第一个允许的来源不同时，才取消 `APP_URL` 的注释。

每个变量的完整说明见[环境变量](Environment-Variables)。

## 镜像标签

有三种标签策略可用：

| 标签 | 示例 | 行为 |
|---|---|---|
| `latest` | `ghcr.io/bhxnms/tt-planner:latest` | 始终是所有大版本中最新的发布版 |
| 大版本 | `ghcr.io/bhxnms/tt-planner:4` | 固定到该大版本的最新发布版 |
| 完整版本 | `ghcr.io/bhxnms/tt-planner:4.0.0` | 精确的发布版；永不改变 |

上面的 compose 文件使用 `latest`。要固定版本，请修改 `image:` 行：

```yaml
image: ghcr.io/bhxnms/tt-planner:4        # track major version 4
image: ghcr.io/bhxnms/tt-planner:4.0.0   # pin to exact release
```

## 启动 Tourism-Team

```bash
docker compose up -d
```

查看日志：

```bash
docker compose logs -f
```

## HTTPS 与反向代理

该 compose 文件面向的是由反向代理（nginx、Caddy、Traefik）在 Tourism-Team 前面终止 TLS 的部署。要启用 HTTPS 重定向和安全 Cookie，请取消 `FORCE_HTTPS=true` 和 `TRUST_PROXY=1` 的注释。

完整的代理配置示例见[反向代理](Reverse-Proxy)。

## 下一步

- [环境变量](Environment-Variables) —— 完整的变量参考
- [反向代理](Reverse-Proxy) —— HTTPS 配置
- [更新](Updating) —— 如何拉取新镜像
