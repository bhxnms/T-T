# 加密密钥轮换

## 加密密钥保护什么

Tourism-Team 使用 AES-256-GCM 对静态的敏感设置加密。以下值在数据库中以加密形式存储：

- Google Maps API 密钥（实例级，在 `app_settings` 中；按用户的列仍作为回退被读取）
- Unsplash 访问密钥（实例级，在 `app_settings` 中；按用户的列仍作为回退被读取）
- Mapbox 访问令牌（按用户）
- OpenWeather API 密钥（按用户）
- Immich API 密钥（按用户）
- AirTrail API 密钥（按用户）
- Synology Photos 密码、会话 ID 和设备 ID（按用户）
- 按用户的 webhook URL、ntfy 通知令牌和 LLM 提供方 API 密钥（在 `settings` 表中）
- OIDC 客户端密钥（全局，在 `app_settings` 中）
- SMTP 密码（全局，在 `app_settings` 中）
- 管理员 webhook URL 和管理员 ntfy 令牌（全局，在 `app_settings` 中）
- 所有用户的 MFA（TOTP）密钥
- Synology 共享链接照片的照片口令（在 `trek_photos` 中）
- 共享旅行相册链接的口令（在 `trip_album_links` 中）
- S3 存储后端的机密访问密钥（在 `app_settings['storage.backends']` 中；见 [管理：存储](Admin-Storage)）
- 插件 OAuth 访问令牌和刷新令牌，以及插件清单标记为 `secret` 的每个插件设置字段（实例范围在 `plugins.config` 中，用户范围在 `plugin_user_config.config` 中）

加密使用 SHA-256 从 `ENCRYPTION_KEY` 派生密钥（按机密类型带一个域后缀），因此原始的 `ENCRYPTION_KEY` 值绝不会存储在数据库中。

## 密钥解析顺序

启动时，Tourism-Team 按以下顺序解析加密密钥：

1. **`ENCRYPTION_KEY` 环境变量** —— 显式指定，始终优先。设置后，该值也会被写入 `./data/.encryption_key`，这样如果该环境变量之后被移除，它也能在容器重启后保留。
2. **`./data/.encryption_key` 文件** —— 任何至少启动过一次的安装都会有。
3. **`./data/.jwt_secret` 文件** —— 对早于专用加密密钥的较旧安装的一次性回退。该值会立即持久化到 `./data/.encryption_key`，因此未来的 JWT 轮换不会破坏解密。
4. **自动生成** —— 以上都没有的全新安装。会生成一个随机的 32 字节十六进制密钥并写入 `./data/.encryption_key`。

## 如果密钥丢失会怎样

所有加密设置（API 密钥、SMTP 密码、OIDC 密钥、MFA 密钥、通知令牌等）都会变得无法读取 —— Tourism-Team 无法解密它们。在密钥被恢复或替换后，必须手动重新输入它们。未加密的数据（旅行、地点、用户等）不受影响。

## 备份密钥

除非你在环境中设置 `ENCRYPTION_KEY`，否则你的备份 ZIP **确实**包含加密密钥：`./data/.encryption_key` 会被打包进每个归档 —— 无论手动还是自动 —— 作为根级的 `.encryption_key` 条目，因此恢复到另一套安装上仍能解密已存储的机密。这让该 ZIP 与密钥本身同样敏感 —— 请相应地存储和传输它。

在通过环境提供密钥的安装上，该文件不是事实来源，因此没有任何备份会携带它。请把它保存在别处 —— 例如密码管理器或机密管理器中。见 [备份](Backups)。

要找到你当前的密钥：检查 `ENCRYPTION_KEY` 环境变量，或读取 `./data/.encryption_key`。

## 轮换密钥

使用 `scripts/migrate-encryption.ts` 重新加密所有已存储的机密，无需停机或手动重新输入。

**Docker：**

```bash
docker exec -it -w /app/server trek node --import tsx scripts/migrate-encryption.ts
```

**主机（在 `server/` 目录下运行）：**

```bash
node --import tsx scripts/migrate-encryption.ts
```

该脚本会：

1. 以交互方式提示输入旧密钥和新密钥（密钥绝不会回显到终端或写入 shell 历史）。
2. 在做出任何更改前请求确认。
3. 在修改任何内容之前创建数据库的带时间戳备份（例如 `travel.db.backup-1713484800000`）。
4. 重新加密所有表中已存储的所有机密：
   - `app_settings`：`oidc_client_secret`、`smtp_pass`、`admin_webhook_url`、`admin_ntfy_token`、`maps_api_key`、`unsplash_api_key`
   - `app_settings['storage.backends']`：每个 S3 存储后端的 `secretAccessKey`
   - `users`（按用户）：`maps_api_key`、`unsplash_api_key`、`openweather_api_key`、`immich_api_key`、`synology_password`、`synology_sid`、`synology_did`、`airtrail_api_key`、`mfa_secret`
   - `settings`（按用户）：`webhook_url`、`ntfy_token`、`mapbox_access_token`、`llm_api_key`
   - `plugin_oauth_tokens`：`access_token`、`refresh_token`（按插件和用户）
   - `plugins.config` 和 `plugin_user_config.config`：插件清单标记为 `secret` 的每个设置字段，按插件和范围从 `plugin_settings_fields` 解析
   - `trip_album_links`：`passphrase`
   - `trek_photos`：`passphrase`
5. 报告已迁移、已迁移过、已跳过（为空）和出错值的计数。

成功迁移后：

1. 把你的环境中的 `ENCRYPTION_KEY` 更新为新值。
2. 重启 Tourism-Team。

如果任何机密无法迁移，脚本会以非零状态退出，并保留原始数据库备份。

## 从非常旧的版本升级

旧的安装可能曾使用 `./data/.jwt_secret` 作为加密来源（在引入专用 `ENCRYPTION_KEY` 之前）。上述密钥解析链会在启动时自动处理这一点 —— JWT 密钥被读取，立即写入 `./data/.encryption_key`，此后 JWT 轮换就是安全的，不会破坏解密。

## 另见

- [备份](Backups)
- [安全加固](Security-Hardening)
- [环境变量](Environment-Variables)
- [用户设置](User-Settings)
