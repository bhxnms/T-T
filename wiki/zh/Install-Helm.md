# 安装：Helm

使用官方 Helm chart 在 Kubernetes 上部署 Tourism-Team。

## 添加 Chart 仓库

```bash
helm repo add trek https://chart.liketrek.com
helm repo update
```

> **注意：** `chart.liketrek.com` 是 GitHub Pages 站点 `https://liketrek.github.io/TREK` 的自定义域名（CNAME）—— 两者服务同一个 chart 仓库。使用自定义域名能让你的配置即使 GitHub 仓库再次迁移也继续工作。

> **⚠️ 仓库已迁移：** 该 chart 不再在 `https://mauriceboe.github.io/TREK` 提供服务（项目已从个人仓库迁到 `liketrek` 组织）。如果你从旧 URL 添加过该仓库，请切换到新 URL：
>
> ```bash
> helm repo remove trek
> helm repo add trek https://chart.liketrek.com
> helm repo update
> ```
>
> 现有 release 继续工作 —— 只有仓库 URL 改变；未来的 `helm repo update` / `helm upgrade` 运行需要新 URL。（`https://liketrek.github.io/TREK` 也可用 —— 它会重定向到 `chart.liketrek.com`。）

## 基本安装

```bash
helm install trek trek/trek
```

这会以默认值部署 Tourism-Team：端口 3000 上的 `ClusterIP` 服务、用于数据和上传的 1 Gi PVC，以及无 ingress。

## 加密密钥

`ENCRYPTION_KEY` 对静态存储的机密（API 密钥、MFA、SMTP、OIDC）加密。有三种处理方式：

**选项 1 —— 让 chart 生成一个随机密钥（推荐用于新安装）：**

```bash
helm install trek trek/trek --set generateEncryptionKey=true
```

chart 会在安装时生成一个 32 字符的字母数字密钥，并在升级时保留它。注意这不同于 `openssl rand -hex 32` 产生的 64 字符十六进制密钥 —— 两种格式都被服务器接受。

**选项 2 —— 设置一个显式密钥：**

```bash
helm install trek trek/trek \
  --set secretEnv.ENCRYPTION_KEY=$(openssl rand -hex 32)
```

**选项 3 —— 使用现有的 Kubernetes Secret：**

```bash
kubectl create secret generic trek-secrets \
  --from-literal=ENCRYPTION_KEY=$(openssl rand -hex 32)

helm install trek trek/trek \
  --set existingSecret=trek-secrets
```

如果 `existingSecret` 使用的密钥名称与 `ENCRYPTION_KEY` 不同，请用 `--set existingSecretKey=MY_KEY_NAME` 指定它。

> **注意：** 如果 `generateEncryptionKey` 和 `existingSecret` 都被设置，`existingSecret` 优先。一次只应启用一种方式。

> **注意：** 如果 `ENCRYPTION_KEY` 留空，服务器会自动解析它：现有安装回退到 `data/.jwt_secret`（升级后加密数据仍可读）；全新安装会自动生成一个密钥并持久化到数据 PVC。

> **注意：** `JWT_SECRET` 完全由服务器管理 —— 首次启动时自动生成并持久化到数据 PVC。它可以通过管理后台轮换（设置 → 危险区 → 轮换 JWT 密钥）。不需要也不支持对它做任何 Helm 配置。

## 管理员账户

`ADMIN_EMAIL` 和 `ADMIN_PASSWORD` 通过 `secretEnv` 设置。它们仅在尚无用户存在的首次启动时使用。**两者必须一起设置** —— 如果缺少任何一个，服务器会忽略这两个值，改为以邮箱 `admin@tt.local` 和一个随机密码创建管理员账户，该密码会打印到服务器日志中。

```bash
helm install trek trek/trek \
  --set secretEnv.ADMIN_EMAIL=admin@example.com \
  --set secretEnv.ADMIN_PASSWORD=<your-secure-password>
```

> **注意：** 当 `OIDC_ONLY=true` 与 `OIDC_ISSUER` 和 `OIDC_CLIENT_ID` 一起配置时，首次启动不会创建本地管理员账户。取而代之的是，第一个通过 SSO 登录的用户会自动成为管理员。

## 关键 `values.yaml` 设置

### 镜像

```yaml
image:
  repository: mauriceboe/trek
  # tag: latest        # defaults to the chart's appVersion
  pullPolicy: IfNotPresent

# Optional: pull secrets for private registries
imagePullSecrets: []
  # - name: my-registry-secret
```

### 服务

```yaml
service:
  type: ClusterIP   # change to LoadBalancer or NodePort to expose externally
  port: 3000
```

### 普通环境变量（`env`）

```yaml
env:
  NODE_ENV: production
  PORT: 3000
  # TZ: "Europe/Berlin"          # timezone for logs, reminders, cron jobs
  # LOG_LEVEL: "info"            # "info" = concise, "debug" = verbose
  # TREK_WIKI_DIR: "/app/wiki"   # where /help reads its docs from; leave unset (the image ships them)
  # DEFAULT_LANGUAGE: "en"       # fallback language on login page; supported: de, en, es, fr, hu, nl, br, cs, pl, ru, zh, zh-TW, it, tr, ar, id, ja, ko, uk, gr, sv, vi, ca
  # ALLOWED_ORIGINS: "https://tt.example.com"
  # APP_URL: "https://tt.example.com"
  # FORCE_HTTPS: "false"         # enable HTTPS redirect + HSTS; requires TRUST_PROXY
  # TRUST_PROXY: "1"             # proxy hops for X-Forwarded-For/Proto; defaults to 1 in production
  # COOKIE_SECURE: "true"        # auto-derived; set "false" only for local HTTP testing
  # ALLOW_INTERNAL_NETWORK: "false"  # set "true" if Immich or other services are on a private network
  # DEMO_MODE: "false"           # enable demo mode (hourly data resets)
  # MCP_RATE_LIMIT: "300"        # max MCP requests per user per minute
  # OIDC_ISSUER: "https://auth.example.com"
  # OIDC_CLIENT_ID: "trek"
  # OIDC_DISPLAY_NAME: "SSO"
  # OIDC_ONLY: "false"           # force SSO-only mode; disables password login
  # OIDC_ADMIN_CLAIM: ""         # OIDC claim used to identify admin users
  # OIDC_ADMIN_VALUE: ""         # value of that claim that grants admin role
  # OIDC_SCOPE: "openid email profile groups"
  # OIDC_DISCOVERY_URL: ""       # override for providers with non-standard discovery paths (e.g. Authentik)
```

### 敏感变量（`secretEnv`）

它们存储在 Kubernetes Secret 中，并作为环境变量注入：

```yaml
secretEnv:
  ENCRYPTION_KEY: ""        # recommended: openssl rand -hex 32
  ADMIN_EMAIL: ""           # initial admin email (first boot only)
  ADMIN_PASSWORD: ""        # initial admin password (first boot only)
  OIDC_CLIENT_SECRET: ""    # set if using OIDC
  UNSPLASH_ACCESS_KEY: ""   # optional; free key from unsplash.com/developers
```

或者，使用 `generateEncryptionKey: true` 让 chart 生成并管理加密密钥，或把 `existingSecret` / `existingSecretKey` 指向一个现有的 Kubernetes Secret。

> **注意：** 没有 `UNSPLASH_ACCESS_KEY` 时，服务器会查询 Unsplash 的未认证端点，许多数据中心和 VPS 的 IP 段 —— 包括大量 Kubernetes 集群 —— 在其中被封锁或限流。旅行封面和地点图片搜索随后会以 **「Unsplash 搜索不可用」** 失败。一个免费的 Access Key 会让服务器改用 Unsplash 的认证 API（`api.unsplash.com`），它不受该封锁影响。该密钥也可以在 **管理 → 设置 → API 密钥** 中设置；此处这个值优先于那个。见 [环境变量](Environment-Variables#image-search-unsplash)。

### 持久化存储

```yaml
persistence:
  enabled: true
  data:
    size: 1Gi     # SQLite database, logs, secrets
  uploads:
    size: 1Gi     # uploaded files — increase if you expect large media uploads
```

### 资源限制

```yaml
resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

### Ingress

```yaml
ingress:
  enabled: true
  className: "nginx"   # your ingress class
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "86400"  # required for WebSockets
    nginx.ingress.kubernetes.io/proxy-body-size: "500m"       # required for backup restore
  hosts:
    - host: tt.example.com
      paths:
        - /
  tls:
    - secretName: trek-tls
      hosts:
        - tt.example.com
```

> **重要：** Tourism-Team 在 `/ws` 上使用 WebSocket。你的 ingress 控制器必须支持 WebSocket 升级。请把 `proxy-read-timeout` 设为至少 `86400`，把 `proxy-body-size` 设为至少 `500m`，以便恢复备份。

> **注意：** 让 `env.ALLOWED_ORIGINS` 与 `ingress.hosts` 保持同步 —— chart 不会自动同步它们。

> **注意：** 使用带 TLS 终止的 ingress 时，请设置 `env.FORCE_HTTPS: "true"` 和 `env.TRUST_PROXY: "1"` 以启用 HTTPS 重定向、HSTS 和安全 Cookie。

## 升级

```bash
helm repo update
helm upgrade trek trek/trek
```

## 完整值参考

所有可用值见 [`charts/README.md`](https://github.com/bhxnms/T-T/blob/main/charts/README.md)。

## 下一步

- [环境变量](Environment-Variables) —— 完整变量参考
- [反向代理](Reverse-Proxy) —— 非 Kubernetes 部署的代理配置
