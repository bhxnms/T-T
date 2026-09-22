# 安装：Docker

单容器 Docker 运行 —— 适合测试或简单的个人安装。

## 运行命令

```bash
docker run -d \
  --name trek \
  -p 3000:3000 \
  -v ./data:/app/data \
  -v ./uploads:/app/uploads \
  -e ENCRYPTION_KEY=<your-32-byte-hex-key> \
  --restart unless-stopped \
  ghcr.io/bhxnms/tt-planner:latest
```

强烈建议设置 `ENCRYPTION_KEY`，但并非严格要求。如果省略，会在首次启动时自动生成一个密钥并持久化到 `data/.encryption_key`。显式设置它意味着你可以从零重建容器（例如在新主机上），而不会失去对已存储加密数据（API 密钥、SMTP 凭据、OIDC 机密、MFA 密钥）的访问。

用以下命令生成加密密钥：

```bash
openssl rand -hex 32
```

### 常见可选变量

为时区和 CORS/邮件链接支持传入额外的 `-e` 标志：

```bash
  -e TZ=Europe/Berlin \
  -e ALLOWED_ORIGINS=https://tt.example.com \
```

完整列表见 [环境变量](Environment-Variables)。

## 镜像标签

| 标签 | 示例                  | 行为 |
|---|--------------------------|---|
| `latest` | `ghcr.io/bhxnms/tt-planner:latest` | 始终是所有主版本中最新的发布 |
| 主版本 | `ghcr.io/bhxnms/tt-planner:3`      | 固定到该主版本的最新发布 |
| 完整版本 | `ghcr.io/bhxnms/tt-planner:3.4.0`  | 精确的发布；永不改变 |

把运行命令中的 `ghcr.io/bhxnms/tt-planner:latest` 替换为你选择的标签，即可固定到某个主版本或精确的发布。

## 卷参考

| 卷 | 容器路径 | 其中存放的内容 |
|---|---|---|
| `./data` | `/app/data` | `travel.db`（SQLite 数据库）、`logs/trek.log`、`.jwt_secret`、`.encryption_key` |
| `./uploads` | `/app/uploads` | 上传的文件（照片、文档、封面、头像） |

两个卷都必须在容器被替换后存活 —— 它们是你的持久状态。在拉取新镜像之前绝不要删除它们。

### 命名卷

上面的运行命令使用绑定挂载（`./data`、`./uploads`）。你可以改用 Docker 命名卷，它们完全由 Docker 管理，不绑定到主机路径：

```bash
docker run -d \
  --name trek \
  -p 3000:3000 \
  -v trek_data:/app/data \
  -v trek_uploads:/app/uploads \
  -e ENCRYPTION_KEY=<your-32-byte-hex-key> \
  --restart unless-stopped \
  ghcr.io/bhxnms/tt-planner:latest
```

Docker 会在首次运行时自动创建 `trek_data` 和 `trek_uploads`。命名卷用 `docker volume` 命令更易管理，在某些 NAS 或容器管理环境中也工作得更好。

## 健康检查

容器在以下地址暴露健康端点：

```
http://localhost:3000/api/health
```

Docker 会自动轮询它（间隔：30 秒，超时：5 秒，重试：3 次，启动期：15 秒）。你可以手动检查它：

```bash
curl -s http://localhost:3000/api/health
```

## 验证容器正在运行

```bash
docker ps --filter name=trek
docker logs trek
```

## `docker run` 的局限

裸 `docker run` 命令没有内置的机密管理，并且在系统重启后更难复现。生产环境请见 [安装：Docker Compose](Install-Docker-Compose)，它添加了安全加固（`read_only`、`cap_drop`、`cap_add`、`no-new-privileges`、`tmpfs`），并让通过 `.env` 文件管理环境变量变得容易。

## 下一步

- [反向代理](Reverse-Proxy) —— PWA 安装和 `trek_session` Cookie 的 `secure` 标志都需要 HTTPS
- [安装：Docker Compose](Install-Docker-Compose) —— 生产环境推荐
- [环境变量](Environment-Variables) —— 可配置变量的完整列表
- [更新](Updating) —— 如何在不丢失数据的情况下拉取新镜像
