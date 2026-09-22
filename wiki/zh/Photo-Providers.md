# 照片来源

Tourism-Team 可以浏览你在 Immich 或 Synology Photos 上的个人照片库，并把选中的照片附到旅行上。Tourism-Team 从不复制原始文件 —— 它只存储一个引用（来源名称 + 资源 ID），并通过自己的服务器代理所有图片流，因此你的来源凭据永远不会发送到浏览器。

> **管理员：**在 **管理 → 扩展** 中启用至少一个照片来源（Immich 或 Synology Photos）—— 照片来源开关作为 **旅程** 扩展下的子项出现。来源一旦开启，它的设置卡片就会出现在每位用户的 **设置 → 集成** 中。如果你的来源运行在本地或私有网络上，服务器必须配置为允许内网访问。见 [管理：扩展](Admin-Addons) 与 [内网访问](Internal-Network-Access)。

---

## 支持的来源

| 来源 | 内部 ID |
|----------|-------------|
| Immich | `immich` |
| Synology Photos | `synologyphotos` |

两个来源可以同时启用。

---

## 配置来源

前往 **设置 → 集成**。每个已启用的来源在那里都有自己的设置卡片，标题就是来源的名称 —— **Immich** 和/或 **Synology Photos**。


### Immich

| 字段 | 必填 | 备注 |
|-------|----------|-------|
| 服务器 URL | 是 | 你的 Immich 实例的完整 URL，例如 `https://immich.example.com` |
| API 密钥 | 是 | 加密存储；保存后永不返回给浏览器 |
| 上传时把旅程照片镜像到 Immich | 否 | 复选框；启用后，你在 Tourism-Team 中上传的照片也会推送到你的 Immich 库 |

输入你的 Immich 实例的完整 URL 和一个 Immich API 密钥。API 密钥在 Tourism-Team 服务器上加密存储，保存后永不返回给浏览器。

#### 必需的 API 密钥权限

在 Immich 中生成 API 密钥时（**账户设置 → API 密钥**），只授予 Tourism-Team 实际使用的权限范围：

| 权限 | Tourism-Team 为什么需要它 |
|------------|-------------------|
| `user.read` | 验证 API 密钥并识别所连接的账户 |
| `timeline.read` | 按日期浏览照片 |
| `asset.read` | 读取照片元数据和搜索结果 |
| `asset.view` | 加载缩略图和预览图 |
| `album.read` | 列出自己的与共享的相册及其内容 |
| `asset.download` | 下载资源 |
| `asset.upload` | *仅在你启用「上传时把旅程照片镜像到 Immich」时需要* —— 把 Tourism-Team 的上传推回你的库 |

Tourism-Team 从不修改或删除 Immich 中的任何内容，因此不需要任何 `update`、`delete` 或管理员权限范围。

### Synology Photos

| 字段 | 必填 | 备注 |
|-------|----------|-------|
| 服务器 URL | 是 | 包含 Photos 应用路径的完整 URL，例如 `https://your-nas:5001/photo` |
| 用户名 | 是 | Synology 账户用户名 |
| 密码 | 是 | 加密存储；留空表示保留现有密码 |
| MFA 验证码（如已启用） | 否 | 两步验证的一次性密码；仅在首次连接或重新认证时需要 |
| 跳过 SSL 证书验证 | 否 | 复选框；对自签名证书禁用 TLS 证书校验 |

#### 必需的 DSM 账户权限

Synology Photos 不使用 API 密钥 —— Tourism-Team 用一个普通的 DSM 用户账户登录。为把影响范围降到最小，请为 Tourism-Team 创建一个**专用的低权限 DSM 用户**，而不要复用你的管理员账户：

- 一个标准（非管理员）DSM 用户账户就够了。
- 该账户必须有权访问 **Synology Photos** 套件（DSM → **控制面板 → 用户与群组 → [用户] → 应用程序**，允许 Synology Photos）。
- 该账户必须能登录 DSM（未被禁用、未被 IP 封锁）。
- 能通过网络访问 DSM（通常是端口 `5000` HTTP / `5001` HTTPS，或你的反向代理主机）。
- 支持两步验证 —— 在首次连接时输入 OTP；Tourism-Team 会存储得到的设备令牌，因此后续保存不会再提示你输入。
- 只读访问就足够 —— Tourism-Team 只会列出相册、列出条目、执行搜索和获取缩略图。它从不写入、上传或删除。

---

## 测试连接

每个来源分区都有一个 **测试连接** 按钮。点击它会把当前字段值发送到服务器，并尝试与来源进行认证。绿色的「已连接」徽标表示成功；失败时会显示来自来源的任何错误消息。

对 Synology 而言，测试成功会存储一个会话令牌，因此后续保存不再需要 OTP 验证码（只要 URL 和用户名保持不变）。

---

## 多个来源

你可以同时配置 Immich 和 Synology。加载旅行照片时，Tourism-Team 会向所有已启用的来源查询照片。

---

## 设置之后

来源连接好后，你就可以浏览照片并把它们附到旅行上。设置之后如何管理文件见 [文档与文件](Documents-and-Files)。

---

## 另见

- [管理：扩展](Admin-Addons)
- [内网访问](Internal-Network-Access)
