# 疑难排查

## 首次登录修改密码时提示 "Access token required"

**原因：** 会话 cookie 设置了 `Secure` 标志，意味着浏览器只会在 HTTPS 上发送它。通过纯 HTTP 访问 Tourism-Team（例如 `http://192.168.1.x:3000`）时，浏览器会静默丢弃该 cookie，服务器看不到会话——于是返回 "Access token required"。

**解决方法：** 选择以下方案之一：

**方案 1 —— 使用 HTTPS。** 通过带有效 SSL 证书的 HTTPS 访问 Tourism-Team。

**方案 2 —— 关闭 Secure 标志。** 在你的 Docker 环境中设置 `COOKIE_SECURE=false`，允许会话 cookie 通过纯 HTTP 发送：

```yaml
environment:
  - COOKIE_SECURE=false
```

> **注意：** 方案 2 只推荐用于不使用 HTTPS 的内部 / 家庭实验室部署。不要在可公开访问的实例上使用。见 [环境变量](Environment-Variables)。

---

## 安装后无法登录 / ADMIN_EMAIL 和 ADMIN_PASSWORD 似乎被忽略

**原因：** 初始管理员账户 **只在首次启动、数据库还没有任何用户时** 创建。由此引出三件事，每一件都会让人困惑：

- `ADMIN_EMAIL` / `ADMIN_PASSWORD` **只在第一次运行时** 生效。如果你第一次启动时 *没有* 设置它们，管理员会用一个 **随机** 密码创建（**不是** `changeme`）——之后再添加这些变量也没有效果，因为用户已经存在。服务器现在会记录一条提醒，说明它忽略了这些变量。
- 首次运行时的随机密码只会打印到日志中 **一次**，在一个标题为 `Tourism-Team — First Run: Admin Account Created` 的框里。如果你事后再读日志，很容易错过。
- 拉取「全新镜像」**不会** 重置任何东西——你的 `./data` 卷里仍是旧的数据库，因此首次运行设置不会再次执行。

**解决方法——按情况选择：**

**读取首次运行的凭据**（只在空数据库的第一次启动时存在）：

```bash
docker compose logs | grep -A6 "First Run"
```

用其中显示的内容登录；系统会要求你设置新密码。

**在不丢失数据的前提下重置管理员**（已被锁定、已有安装）：

```bash
docker exec -it trek node server/reset-admin.js
```

这会重置（或创建）`admin@tt.local` 并打印一个生成的密码。可用 `-e RESET_ADMIN_EMAIL=you@example.com -e RESET_ADMIN_PASSWORD=yourpass` 覆盖。首次登录时会要求你修改它。

**用自己选定的凭据重新开始**（全新安装、没有需要保留的数据）：

```bash
docker compose down
rm -rf ./data        # deletes ALL Tourism-Team data — only on a throwaway/fresh install
docker compose up -d
```

在设置了 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD` 的情况下，管理员会正好以这些凭据创建。

> **注意（Windows/macOS 上的 Docker Desktop）：** SQLite 的 WAL 模式在以 Windows/macOS 文件系统为后端的绑定挂载上不可靠，可能导致静默写入失败。`/app/data` 优先使用 Docker **命名卷**，而不是宿主机绑定挂载。见 [安装：Docker Compose](Install-Docker-Compose#named-volumes)。

---

## WebSocket 无法连接 / 实时同步失效

**原因：** 你的反向代理没有在 `/ws` 路径上转发 WebSocket 升级头。

**解决方法：** 在代理配置中为 `/ws` 位置添加以下内容：

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

没有这些头，WebSocket 握手就会失败，实时同步也无法工作。完整的 nginx 和 Caddy 配置见 [反向代理](Reverse-Proxy)。Caddy 会自动处理 WebSocket 升级。

---

## HTTPS 重定向循环

**原因：** 设置了 `FORCE_HTTPS=true`，但你的反向代理没有转发 `X-Forwarded-Proto: https` 头，于是每个请求看起来都是纯 HTTP 并被无限重定向。

**解决方法：** 确保你的代理把 `X-Forwarded-Proto` 头传给 Tourism-Team。同时设置 `TRUST_PROXY=1`，让 Express 使用转发的 IP 做限流和审计日志：

```yaml
environment:
  - FORCE_HTTPS=true
  - TRUST_PROXY=1
```

> **注意：** `/api/health` 端点始终豁免于 HTTPS 重定向，以便 Docker 健康检查可以继续通过纯 HTTP 工作。

如果你是直接通过 `http://<host>:3000` 访问 Tourism-Team、没有代理，请完全移除 `FORCE_HTTPS`。见 [环境变量](Environment-Variables)。

---

## 加密设置丢失 / 迁移后 API 密钥失效

**原因：** `ENCRYPTION_KEY` 被更改或丢失。所有 API 密钥、SMTP 密码、OIDC 客户端密钥和 MFA TOTP 密钥都用这个密钥静态加密。没有原始密钥，解密就会失败。

**解决方法：** 见 [加密密钥轮换](Encryption-Key-Rotation)，其中有用新密钥重新加密数据的迁移脚本。如果原始密钥已经完全丢失，加密的值就无法恢复，必须在管理后台重新输入。

> **注意：** 如果你从旧版本升级且未设置 `ENCRYPTION_KEY`，服务器启动时会按以下顺序解析：(1) `ENCRYPTION_KEY` 环境变量，(2) `data/.encryption_key` 文件，(3) 为旧版本升级一次性回退到 `data/.jwt_secret`——该值会立即写入 `data/.encryption_key`，因此之后的 JWT 轮换不会破坏解密，(4) 为全新安装自动生成新密钥。检查 `data/.encryption_key` 可查看当前使用的密钥。

---

## 被锁在 MFA 之外 / 身份验证器丢失

**解决方法：** 如果你仍能访问自己的账户，使用 MFA 设置期间生成的 10 个备用代码之一完成登录。登录后前往 **设置 → 账户** 停用或重新配置 MFA。

如果你已经没有备用代码且无法登录，管理员可以替你清除 MFA：`DELETE /api/admin/users/<id>/mfa`（需要管理员会话）。它会清除 `mfa_enabled`、`mfa_secret` 和 `mfa_backup_codes`——与自助停用所清除的同样三列——并作为 `admin.user_mfa_reset` 写入审计日志。

该端点拒绝重置调用者自己的账户（*"Use Settings to change your own two-factor setup"*），因此管理员无法用它解锁自己。如果被锁定的账户是唯一的管理员，请用一个 **新的** `RESET_ADMIN_EMAIL` 运行 `reset-admin.js` 来创建第二个管理员账户——对于已存在的邮箱，该脚本只重置密码和角色，不会动 MFA，所以你仍会碰到 TOTP 提示——然后以该账户登录并清除第一个账户的 MFA。手工改数据库是最后手段，而不是唯一途径。

没有对应的按钮：管理后台界面没有按用户重置 MFA 的功能（用户弹窗只提供 **重置通行密钥**）——它只控制全局的「要求双因素身份验证（2FA）」策略。见 [管理：用户与邀请](Admin-Users-and-Invites)。

---

## 演示用户无法编辑或创建

**原因：** 实例正以 `DEMO_MODE=true` 运行。按照设计，演示账户的所有写操作都被阻止。

**解决方法：** 这是公共演示部署的预期行为。如果你是自托管并想要完整访问权限，请移除 `DEMO_MODE` 变量（或将其设为 `false`）。见 [演示模式](Demo-Mode)。

---

## 备份恢复失败并提示 "file too large"

**原因：** 你的反向代理有默认的请求体大小限制（常见为 1 MB 或 10 MB），小于备份 ZIP。备份归档包含整个上传目录，可能很大。

**解决方法：** 提高代理配置中的请求体大小限制。Tourism-Team 自身对上传（压缩）归档的上限默认是 500 MB。对于 nginx：

```nginx
client_max_body_size 500m;
```

把它加到 `location /` 块（或具体的备份路由）中。见 [反向代理](Reverse-Proxy) 和 [备份](Backups)。

如果归档确实比这还大，也要提高 Tourism-Team 自身的上限。有两个，且彼此独立：一个针对压缩上传，一个针对归档的 **解压后** 总大小（zip 炸弹防护）。通过了上传限制的归档仍可能在解压过程中被拒绝，提示 `Backup exceeds the maximum decompressed size.`

```yaml
environment:
  - BACKUP_UPLOAD_LIMIT_MB=2000       # compressed upload cap (default: 500)
  - BACKUP_MAX_DECOMPRESSED_MB=20480  # decompressed cap (default: 5120, i.e. 5 GB)
```

让代理的 `client_max_body_size` 保持大于等于 `BACKUP_UPLOAD_LIMIT_MB`。任一变量的值非正数或无效都会中止启动。

---

## 启动时提示 "Cannot find module"

**可能原因：** 有一个卷挂载在 `/app`，把镜像内随附的应用代码（`node_modules` 和 `dist`）遮住了。只挂载数据和上传目录——`-v ./data:/app/data -v ./uploads:/app/uploads`——绝不要挂载 `/app` 本身。当前的镜像会在 Node 启动前检测到这一点，并打印 `FATAL: Tourism-Team application files are missing from the image.`，而不是那个光秃秃的模块错误。

**解决方法：** 列出你的挂载并移除任何指向 `/app` 的项：

```bash
docker inspect <container> --format '{{json .Mounts}}'
```

只保留 `./data:/app/data` 和 `./uploads:/app/uploads`，然后重建容器。切换时这两个目录中的数据会保留。

> **注意：** `data`/`uploads` 目录不可写是一种 *不同* 的故障——它们会以权限错误（`EACCES`）中止，而不是 `Cannot find module`。Tourism-Team 会在启动时创建它需要的子目录（`data/logs`、`data/backups`、`data/tmp`、`uploads/files`、`uploads/covers`、`uploads/avatars`、`uploads/photos`、`uploads/journey`、`uploads/places`）。容器的 `chown` 步骤（以 root 运行，之后降权到 `node`）通常会纠正归属，但如果你的宿主机文件系统是只读的或权限被锁得很紧，请手动授予写权限：
>
> ```bash
> sudo chown -R 1000:1000 ./data ./uploads
> ```

---

## 容器无法启动："exec /usr/bin/dumb-init: operation not permitted"

**症状：** 容器循环重启，日志里只有：

```
trek  | exec /usr/bin/dumb-init: operation not permitted
trek exited with code 255 (restarting)
```

**原因：** 你运行的是 **通过 snap 安装的 Docker**（其配置位于 `/var/snap/docker/...` 下）*并且* compose 文件中设置了 `security_opt: [no-new-privileges:true]`。snap 打包的 `dockerd` 运行在自己的 AppArmor 配置文件下，而 AppArmor 拒绝为 snap 守护进程执行 `no_new_privs` 权限转换。容器的第一次 `execve` 就被以 `EPERM` 拒绝，因此它永远无法启动。在崩溃后立刻从内核日志确认：

```bash
sudo dmesg -T | grep -iE 'apparmor|denied'
# apparmor="DENIED" operation="exec" ... info="no new privs"
```

这会影响 **任何** 镜像，不只是 Tourism-Team，并且是已知的 snap 限制（[snapd bug #1908448](https://bugs.launchpad.net/snapd/+bug/1908448)）。在容器上设置 `apparmor=unconfined` **没有** 帮助——那只是替换了 *容器自身* 的配置文件，而拒绝来自 *守护进程*（snap）的隔离，容器级选项触及不到。

**解决方法：** 从官方 apt 仓库安装 Docker，而不是用 snap。只要数据位于宿主机绑定挂载（`./data`、`./uploads`）中，数据就是安全的：

```bash
sudo snap remove docker
curl -fsSL https://get.docker.com | sudo sh   # or follow docs.docker.com/engine/install/ubuntu
docker compose up -d
```

> **注意：** 如果你必须留在 snap 上，唯一的变通方法是从 `security_opt` 中移除 `no-new-privileges`。其余的加固（`read_only`、`cap_drop: ALL` 配最小化的 `cap_add`、`noexec,nosuid` tmpfs）仍照常工作，承担了大部分作用。见 [安全加固](Security-Hardening)。

---

## 重启后加密密钥被重新生成——已存储的机密失效

**原因：** 每次启动时，Tourism-Team 按以下顺序解析其加密密钥：(1) `ENCRYPTION_KEY` 环境变量，(2) `data/.encryption_key` 文件，(3) 旧版的 `data/.jwt_secret` 回退，(4) 自动生成新密钥。如果环境变量和 `data/` 卷都没有持久化——例如在没有卷挂载的情况下重建了容器——就会生成一个新的随机密钥，所有已存储的机密（SMTP 密码、OIDC 客户端密钥、API 密钥、MFA TOTP 种子）都会变得不可恢复。

**解决方法：** 确保 `./data:/app/data` 以持久卷的方式挂载，让 `data/.encryption_key` 在重启后仍然存在。另一种做法是显式固定密钥：

```yaml
environment:
  - ENCRYPTION_KEY=<your-key>
```

关于如何获取或轮换密钥，见 [加密密钥轮换](Encryption-Key-Rotation)。

---

## OIDC 登录返回 "APP_URL is not configured"

**原因：** 启用 OIDC 时，Tourism-Team 需要知道自己的公开 URL 才能构建重定向 URI。它按 (1) `APP_URL` 环境变量，(2) `ALLOWED_ORIGINS` 中的第一项，(3) 最后手段 `http://localhost:<PORT>` 的顺序解析。第 (3) 步总会产生一个值，因此标题中的那条消息其实是一个永远不会触发的守卫。在 `APP_URL` 和 `ALLOWED_ORIGINS` 都未设置时，你实际得到的是重定向 URI `http://localhost:<PORT>/api/auth/oidc/callback`——提供商以未注册的 `redirect_uri` 为由拒绝它。

**解决方法：** 把 `APP_URL` 设置为你的实例的公开 URL：

```yaml
environment:
  - APP_URL=https://tt.example.com
```

---

## OIDC 登录因 issuer 不匹配而失败

**原因：** Tourism-Team 会校验提供商发现文档中的 `issuer` 字段与配置的 `OIDC_ISSUER` 是否匹配。比较前会从两侧去掉末尾的斜杠，因此 `https://auth.example.com` 和 `https://auth.example.com/` 在这里是同一个值——差异在别处：提供商额外加的 realm 路径、在提供商公布公开主机名的地方配置了内部主机名，或者 `http://` 与 `https://` 之别。

**解决方法：** 检查你的提供商公布的精确 issuer 值并与之匹配：

```bash
curl -s https://<your-oidc-issuer>/.well-known/openid-configuration | jq .issuer
```

把 `OIDC_ISSUER` 设为那个精确的字符串。

> **注意：** 只有在未设置自定义发现 URL 时，这种不匹配才是致命的。配置了 `OIDC_DISCOVERY_URL` 时——这也是接入 Authentik realm 路径的常见方式——Tourism-Team 把发现文档中的 issuer 视为权威，记录 `[OIDC] Discovery doc issuer … differs from configured OIDC_ISSUER …` 并继续。

---

## 提供商位于私有/内部网络时 OIDC 登录失败

**原因：** 不是 SSRF 守卫，尽管看起来像。所有四个 OIDC 调用——discovery、token、userinfo、JWKS——都走管理员配置的抓取路径，该路径特意 **允许** 回环和私有/局域网目标：`192.168.x` 或 `10.x` 上的 Keycloak 或 Authentik 是受支持的部署方式，不需要额外变量。`ALLOW_INTERNAL_NETWORK` 属于针对 *用户* 提供的 URL 的守卫，与 OIDC 毫无关系。该路径唯一拒绝的地址是链路本地和云元数据地址（`169.254.0.0/16`、`fe80::/10`），它们会以 `Requests to link-local / cloud-metadata addresses are not allowed` 失败。

**解决方法：** 去找内部提供商真正失败的原因。发现请求失败会回答 `500 { "error": "OIDC login failed" }`，并把真正的消息记录为 `[OIDC] Login error: …`，所以从那里开始：

```bash
docker logs <container> 2>&1 | grep "OIDC"
```

- **容器无法访问 issuer。** 从容器内部测试，而不是从你的桌面——容器有自己的 DNS 和自己的网络：`docker exec <container> wget -qO- https://<issuer>/.well-known/openid-configuration`。日志中的 `Could not resolve hostname` 就是这种情况。
- **issuer 不是 HTTPS。** 在生产环境中，Tourism-Team 会在发出任何请求之前就以 `400 { "error": "OIDC issuer must use HTTPS in production" }` 直接拒绝纯 HTTP 的 issuer。
- **提供商的证书不被容器信任。** 内部 Keycloak 上的自签名证书会让 TLS 握手失败；请从容器信任的 CA 签发。

---

## "Send test email" 失败且没有其他信息

**原因：** 较早的版本吞掉了 SMTP 错误。容器日志里什么都没写，toast 退化为一句光秃秃的 *Test email failed*。端口被阻断会让情况更糟：nodemailer 最多等待两分钟建立连接，而浏览器八秒后放弃，于是最终的错误已无人可报。两者都已修复。现在每个 SMTP 阶段都有时间上限，按钮也会说明原因。

**解决方法：** 再次点击 **发送测试邮件** 并阅读 toast。同样的诊断，加上 SMTP 错误码，都在日志中：

```bash
docker logs <container> 2>&1 | grep -E "SMTP test email (sent|failed)|SMTP test not attempted"
```

| 消息内容 | 需要更改什么 |
|-----------------------|----------------|
| `rejected the credentials` (`code=EAUTH`) | SMTP 用户名或密码错误。启用两步验证的邮箱通常需要应用专用密码，而不是账户密码。 |
| `refused the connection` | 该端口上没有服务在监听，或被防火墙关闭。 |
| `did not answer in time` | 端口被过滤，或者 465 和 587 弄反了：Tourism-Team 以隐式 TLS 拨号 465，其他端口都用明文模式加 STARTTLS。 |
| `could not be resolved` | 容器的 DNS 无法解析该主机。用 `docker exec <container> nc -zv <SMTP_HOST> <SMTP_PORT>` 测试。 |
| `TLS certificate ... was not accepted` | 对于自带证书的内部中继，打开 **Skip TLS certificate check**（或 `SMTP_SKIP_TLS_VERIFY=true`）。 |
| `rejected the envelope` | 发件地址通常必须属于通过认证的邮箱。 |
| `SMTP not configured: ...` | 所指的字段为空，或端口不是数字。主机、端口和发件地址都是必填的。 |

> **注意：** 已保存的 SMTP 密码显示为占位符，而不是实际值。保持该字段不动即保留它，输入内容则替换它。

---

## 密码重置邮件未送达 / SMTP 无提示

**原因：** SMTP 失败会被记录，但不会作为错误呈现给最终用户——「重置邮件已发送」这条消息无论如何都会出现。常见原因：`SMTP_HOST` 或 `SMTP_PORT` 错误、凭据无效、防火墙阻断 SMTP 端口的出站流量，或 SMTP 服务器使用自签名证书。

**解决方法：**

1. 检查服务器日志中是否有发送失败。密码重置路径和通用通知路径记录的行不同，所以两条都要匹配：
   ```bash
   docker logs <container> 2>&1 | grep -E "Password reset email failed|Email send failed"
   ```
   如果两者都不匹配，检查邮件到底有没有发出去——Tourism-Team 需要主机、端口 **和** 发件地址（`SMTP_HOST` / `SMTP_PORT` / `SMTP_FROM`，或 **管理 → 通知** 下的同样三个字段）。缺少其中任何一个，它就会完全跳过 SMTP，并记录 `Password reset link issued (no SMTP)` 加上 `===== PASSWORD RESET LINK =====` 区块，而不是任何错误：
   ```bash
   docker logs <container> 2>&1 | grep "no SMTP"
   ```
2. 如果错误提到 TLS 或证书，设置 `SMTP_SKIP_TLS_VERIFY=true`。
3. 核对端口：STARTTLS 用 `587`，隐式 TLS 用 `465`，纯 SMTP 用 `25`。
4. 从容器中测试连通性：
   ```bash
   docker exec <container> nc -zv <SMTP_HOST> <SMTP_PORT>
   ```

> **注意：** 如果完全没有配置 SMTP，Tourism-Team 会把重置链接直接打印到服务器日志中（`===== PASSWORD RESET LINK =====`）。这对初始设置或没有邮件服务的自托管安装很有用。

---

## CORS 错误——浏览器中 API 请求被阻止

**原因：** 如果设置了 `ALLOWED_ORIGINS`，则只有这些来源被允许。来自其他来源的任何请求都会被拒绝，并在浏览器控制台中显示 CORS 错误。

**解决方法：** 把你的来源加入逗号分隔的列表：

```yaml
environment:
  - ALLOWED_ORIGINS=https://tt.example.com,https://other.example.com
```

如果未设置 `ALLOWED_ORIGINS`，默认是 **仅同源**——跨源的浏览器请求会被拒绝——因为所有随产品发布的部署方式（Dockerfile、`docker-compose.yml`、Helm chart）都以 `NODE_ENV=production` 运行。允许任意来源是开发环境的默认值，只在非生产环境生效。见 [环境变量](Environment-Variables)。

---

## WebSocket 连接后立即关闭（代码 4001 / 4403）

**原因：** `/ws` 端点要求客户端在连接前立即生成一个临时令牌。如果令牌缺失、过期，或用户的会话状态发生变化，服务器会以特定代码关闭连接：

| 代码 | 原因 |
|------|--------|
| `4001` | 没有令牌、令牌过期/无效，或用户不存在——需要重新登录 |
| `4403` | 全局要求 MFA，但该用户尚未启用 |

**解决方法：**

- 代码 `4001`：退出登录后重新登录。如果仍然如此，检查你的反向代理是否从 WebSocket 升级请求中剥离了 `token` 查询参数。
- 代码 `4403`：用户必须在 **设置 → 账户** 中启用 MFA，或者管理员可以在 **管理 → 设置** 中关闭全局 MFA 要求。

---

## 剪贴板功能不工作（复制链接、分享等）

**原因：** 浏览器的 Clipboard API（`navigator.clipboard`）只在 [安全上下文](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts) 中可用，因此在非 localhost 地址的纯 HTTP 下它是 undefined。

Tourism-Team 在最要紧的地方做了规避。旅行 **成员** 对话框中的分享链接和邀请链接按钮、旅程分享链接，以及日历订阅 URL 会回退到隐藏的 textarea 加上已废弃的 `document.execCommand('copy')`，后者不受安全上下文限制——**这些在纯 HTTP 下仍能工作**，桌面端和移动端都一样。

其余的复制按钮直接调用 `navigator.clipboard`，没有回退：

- **设置 → 集成 (MCP)** —— MCP 端点 URL、JSON 客户端配置、新建的 MCP 令牌，以及 OAuth 客户端 ID、客户端密钥和轮换后的密钥。这些会失败且没有任何提示，因为点击处理器在任何 toast 显示之前就抛出了异常。
- **设置 → 账户** —— 两步验证备用代码。这一个会显示一个通用错误 toast。用旁边的 **下载** 按钮作为变通；它不需要安全上下文。
- **管理后台 → 用户与邀请** —— 注册邀请链接，创建时（「创建并复制」）和已有邀请上的复制按钮都是如此。

**解决方法：** 对于这些按钮，任选其一：

- 通过带有效 SSL 证书的 HTTPS 访问 Tourism-Team。
- 直接从 `http://localhost:<port>` 访问 Tourism-Team——浏览器把 `localhost` 视为 Clipboard API 的安全上下文。

如果都不行，请选中字段中显示的值手动复制；这些按钮中的每一个都紧挨着它所复制的文本。

---

## 地点照片不加载 / 地点缩略图显示默认地图图钉（已配置 Google Maps API 密钥）

**原因：** 设置了 Google Maps API 密钥时，Tourism-Team 会在服务器端从 Google Places API 获取照片引用和图像字节。如果服务器端调用被拒绝或没有返回照片，`/place-photo/:id` 端点会回答 `200 { "photoUrl": null }`，地点就回退到默认的地图图钉缩略图。其背后的图像代理 `/place-photo/:id/bytes` 在没有缓存内容时回答 `204 No Content`——两个端点都不返回 404，因此一趟全是无照片地点的旅行不会在反向代理或 IPS 中触发 404 速率限制。最常见的原因是：

1. **API 密钥上的 HTTP 来源限制。** Google Cloud Console 允许把密钥限制到特定的 HTTP 来源。因为 Tourism-Team 是从服务器（而非浏览器）调用 Google，只有当设置了 `APP_URL` 时它才发送 `Referer` 头——该头的值就是 `APP_URL`。如果没有设置 `APP_URL`，Tourism-Team 完全不发送 `Referer` 头，而受来源限制的密钥会像拒绝错误的来源一样拒绝没有来源的请求。

2. **密钥限制类型错误。** 按 **HTTP 来源** 限制的 API 密钥是为浏览器端 JavaScript 设计的。对于自托管的服务器应用，请改用 **IP 地址** 限制——添加你 Tourism-Team 服务器的公网 IP，就无需配置 `APP_URL`。

3. **未启用 Places API (New)。** 该密钥必须在 Google Cloud Console 的「APIs & Services → Enabled APIs」下启用 **Places API (New)**。只启用旧版 Places API 是不够的。

4. **未设置结算。** Google 要求项目关联结算账户，即使在免费额度内也是如此。没有它，照片和详情请求会返回 `REQUEST_DENIED`。

**针对 HTTP 来源限制的解决方法：**

把 `APP_URL` 设置为你的实例的公开 URL，并把该 URL（或其带通配符的域名，例如 `https://tt.example.com/*`）加入 GCP 的允许来源：

```yaml
environment:
  - APP_URL=https://tt.example.com
```

**针对限制类型错误的解决方法：**

在 Google Cloud Console 中把该密钥的「Application restrictions」从 **HTTP 来源** 切换为 **IP 地址**，并添加你服务器的公网 IP。无需改动 `APP_URL`。

**验证问题：**

用你的密钥运行以下 curl 命令，检查 Google 是否返回照片引用：

```bash
curl "https://places.googleapis.com/v1/places/<PLACE_ID>" \
  -H "X-Goog-Api-Key: YOUR_API_KEY" \
  -H "X-Goog-FieldMask: photos"
```

如果响应是 `{}` 或 `{"error": {...}}`，说明密钥或其限制在阻止请求。如果返回了 `photos` 数组，说明密钥有效，问题在别处。

---

## MCP OAuth 流程无法启动 / "Connect" 会重定向但认证从未开始

**原因：** Tourism-Team 从它解析出的公开基础 URL 公布其 OAuth 2.1 issuer 和授权端点（`APP_URL`，否则 `ALLOWED_ORIGINS` 的第一项，否则 `http://localhost:<PORT>`；解析出的值只在是 `https://` 或 `localhost`/`127.0.0.1` 时才被保留）。如果该解析结果落到 `http://localhost:<PORT>`，外部客户端（Claude.ai、Claude Desktop）就无法访问授权端点，OAuth 握手永远不会完成。

**解决方法：** 把 `APP_URL` 设置为你的实例的公开 URL：

```yaml
environment:
  - APP_URL=https://tt.example.com
```

添加变量后重启容器。设置完成后，在 MCP 客户端中点击 **连接** 应会重定向到你的 Tourism-Team 实例并正常完成 OAuth 流程。

> **注意：** 任何 MCP OAuth 集成都要设置 `APP_URL`。Tourism-Team **只解析一次** 其公开基础 URL，顺序为：(1) `APP_URL`，(2) `ALLOWED_ORIGINS` 的第一项，(3) 最后手段 `http://localhost:<PORT>`——只有当值未设置或不是有效 URL 时才跳过某一步。然后对获胜者做 MCP 检查：只有 `https://` URL 或 `localhost` / `127.0.0.1` 主机被保留；其他任何值都会被替换为 `http://localhost:<PORT>`，而外部 MCP 客户端无法访问它。因为只检查最终的获胜者，一个有效但为纯 HTTP 的 `APP_URL`（例如 `http://tt.internal.lan`）**不会** 被 `ALLOWED_ORIGINS` 中的某个 `https://` 条目拯救——它最终仍然落在 localhost 上。

---

## MCP 集成："Too many requests"

**原因：** 每位用户默认限制为每分钟 300 个 MCP 请求。超过限制会返回 `429` 响应。

**解决方法：** 通过环境变量提高限制：

```yaml
environment:
  - MCP_RATE_LIMIT=600          # requests per minute per user (default: 300)
  - MCP_MAX_SESSION_PER_USER=50 # concurrent sessions per user (default: 20)
```

会话上限不再拒绝请求：达到上限时，服务器会关闭该用户最近最少活动的会话，为新会话腾出空间。如果你竟然会碰到上限，见下一条——通常的原因是会话创建的速度快于被复用的速度，而不是真的有并行客户端。

---

## MCP：每次工具调用都创建新会话 / 会话不断堆积

**症状：** 服务器日志为 *每一次* 工具调用都显示一行 `Session <uuid> created`，`Active sessions` 稳步攀升。无论打开了多少会话，空闲清扫都报告 `cleaned 0`。在较旧的版本上，计数达到 `MCP_MAX_SESSION_PER_USER` 后连接就会断开，只有重启才能恢复。

**原因：** 客户端从未收到——或无法读取——`Mcp-Session-Id` 响应头，因此无法在下次调用时把它发回来。于是每个请求看起来都是全新连接，服务器就为它开一个新会话。`cleaned 0` 的清扫是转移注意力的假线索：清扫在 *不活动* 一小时后（`MCP_SESSION_TTL`）使会话过期，因此相隔几秒创建的会话离过期还远得很。

该响应头丢失有两个原因：

1. **Tourism-Team 3.3.0 及更早版本** 不发送 `Access-Control-Expose-Headers: Mcp-Session-Id`。没有它，基于浏览器的客户端——Claude.ai、Claude Desktop 连接器、MCP Inspector——会被浏览器禁止读取会话 id，无论代理如何配置。**解决方法：升级** —— 改代理没有帮助。
2. **反向代理剥离了该响应头。** Nginx 和 Caddy 默认会转发它，因此只有当你有一个 `proxy_hide_header` 指令或 `/mcp` 前面有响应头允许列表时才会发生。见 [反向代理](Reverse-Proxy)。

**如何区分是哪种：** 在运行代理的机器上请求一个会话，然后看响应头。

```bash
curl -i -X POST https://tt.example.com/mcp \
  -H "Authorization: Bearer <your-token>" \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'
```

健康的响应 **同时** 含有：

```
mcp-session-id: 412d245d-1daa-4dfc-b453-eaf266673696
access-control-expose-headers: Mcp-Session-Id,MCP-Protocol-Version,WWW-Authenticate
```

如果缺少 `mcp-session-id`，说明代理把它剥离了。如果缺少 `access-control-expose-headers`，说明你用的是受影响的版本——升级。

在当前版本上，服务器还会对每个无会话请求发出警告，这是同一个信号：

```
[MCP] POST without mcp-session-id for user 1 — starting a new session. If this
repeats on every tool call, the Mcp-Session-Id response header is not reaching
the client (check that your reverse proxy forwards it).
```

---

## MCP 请求被 Cloudflare WAF 阻止（Bot Fight Mode）

**原因：** 当 Tourism-Team 通过 Cloudflare 代理时，**Bot Fight Mode** 和 **Super Bot Fight Mode** 会把服务器到服务器的请求归类为机器人，并在 WAF 层面阻止它们——在请求到达 Tourism-Team 之前。它们的出口节点 IP 在 Cloudflare 的威胁情报中信誉分较低，且 User-Agent 符合 Cloudflare 的自动化流量启发式规则。Tourism-Team 自身从未收到该请求，因此 Tourism-Team 的日志里什么都没有；从 Tourism-Team 的角度看，这次阻止是静默的。

这会影响 **ChatGPT** 和 **Google 账号关联（Gemini、Assistant）**。Claude.ai 不受影响。

注意 Bot Fight Mode **不** 认可 IP 允许列表，因此把提供商公布的 IP 段加入 Cloudflare IP Access 规则没有帮助；下面的两个修复方案你需要其一。

症状：
- ChatGPT 在 OAuth 完成后立即显示连接错误或超时。
- 用 Google 账号关联时症状不同，也更令人困惑：浏览器部分成功（你批准同意屏幕并被重定向回来），然后关联失败。Google 从自己的服务器交换授权码，而被阻止的正是那次调用。在 Tourism-Team 的日志中你会看到 `POST /api/oauth/authorize` 回答 `200`，然后 **完全没有** `POST /oauth/token`。
- Cloudflare 的 Security → Events 日志显示对 `/mcp` 或 `/oauth/token` 的阻止请求，动作为 `block`，来源为 `bfm`（Bot Fight Mode）或 `managed_rule`。

**修复方案 1：关闭 Bot Fight Mode（免费套餐和付费套餐）**

在你这台 zone 的 Cloudflare 仪表盘中：**Security → Bots → Bot Fight Mode → Off**（或 Super Bot Fight Mode → Off）。

这是 **免费套餐** 上唯一可用的方案。它会为整个 zone 关闭机器人阻止——Cloudflare 原本会阻止的所有探测机器人、抓取器和爬虫都将到达你的服务器。只有在别无选择时才使用。

**修复方案 2：针对 MCP 路径的 WAF 跳过规则（仅付费套餐）**

> WAF 自定义规则需要 **付费 Cloudflare 套餐**（Pro 或更高）。免费套餐上没有此选项。

创建一条 WAF 跳过规则，只对 MCP 和 OAuth 路径绕过机器人管理，站点其余部分仍保持防护：

1. 前往 **Security → WAF → Custom rules** 并点击 **Create rule**。
2. 输入以下表达式（把 `tt.example.com` 替换为你的域名）：

   ```
   (http.host eq "tt.example.com") and (
     http.request.uri.path eq "/mcp" or
     http.request.uri.path starts_with "/oauth/" or
     http.request.uri.path starts_with "/.well-known/"
   )
   ```

   这覆盖了 ChatGPT 的服务器在发现、OAuth 和 MCP 调用期间会访问的所有路径：

   | 路径 | 用途 |
   |---|---|
   | `/mcp` | MCP 端点（GET、POST、DELETE） |
   | `/oauth/authorize` | OAuth 授权处理器 |
   | `/oauth/register` | 动态客户端注册 |
   | `/oauth/token` | 令牌签发 |
   | `/oauth/userinfo` | 用户信息（用于域名认领） |
   | `/oauth/revoke` | 令牌撤销 |
   | `/.well-known/oauth-authorization-server` | RFC 8414 AS 元数据 |
   | `/.well-known/oauth-protected-resource` | RFC 9728 扁平资源元数据 |
   | `/.well-known/openid-configuration` | OIDC discovery |

3. 把动作设为 **Skip**，并在跳过选项中勾选 **Bot Fight Mode**（和/或 **Super Bot Fight Mode**）。
4. 保存并部署。

这样 MCP 和 OAuth 流量可以通过，同时所有其他路径仍保持 Cloudflare 机器人防护生效。
