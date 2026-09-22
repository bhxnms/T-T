# 安装：Portainer

使用 Stack（Docker Compose）在 Portainer 上安装 Tourism-Team。

## 前提条件

Portainer 必须已安装并连接到你的 Docker 环境。请使用 **Stacks** —— 它支持 Docker Compose，并提供完整的 compose 语法，包括环境变量、卷和重启策略。

## 创建 Stack

![Stacks 页面，箭头指向 Stacks 菜单项和 Add stack 按钮](assets/portainer-add-stack.png)

1. 在 Portainer 中，前往 **Stacks → Add stack**。
2. 给这个 stack 起个名字（例如 `trek`）。
3. 选择 **Web editor**，粘贴来自 [docker-compose.yml](https://github.com/bhxnms/T-T/blob/main/docker-compose.yml) 的 compose 文件。

![Web editor 中已粘贴 docker-compose 内容](assets/portainer-stack-save.png)

4. 填写页面底部的环境变量。

![环境变量分区，已填写键/值字段](assets/portainer-environment-variable.png)

5. 点击 **Deploy the stack**。

![Deploy the stack 按钮被高亮](assets/portainer-deploy-stack.png)

## Compose 内容

见 https://github.com/bhxnms/T-T/blob/main/docker-compose.yml

至少要在 stack 编辑器的 **Environment variables** 分区中设置 `ENCRYPTION_KEY`、`TZ` 和 `ALLOWED_ORIGINS`。Portainer 的 stack 变量只会被替换到 compose 文件中的 `${...}` 占位符里，它们不会被注入容器；而随附的 compose 文件恰好插值四个：`ENCRYPTION_KEY`、`TZ`、`LOG_LEVEL` 和 `ALLOWED_ORIGINS`。

其他所有变量都以注释形式随附，因此在这里设置它没有任何作用。要使用某个变量 —— 例如 `APP_URL`，OIDC 需要它，邮件通知链接也由它构建 —— 请在 **Web editor** 中取消它那一行的注释并直接在那里填值，或者把它改成 `- APP_URL=${APP_URL:-}`，以便让 stack 变量被采用。

用以下命令生成加密密钥：

```bash
openssl rand -hex 32
```

## 镜像标签

有三种标签策略可用：

| 标签 | 示例 | 行为 |
|---|---|---|
| `latest` | `mauriceboe/trek:latest` | 始终是所有大版本中最新的发布版 |
| 大版本号 | `mauriceboe/trek:4` | 固定到该大版本的最新发布版 |
| 完整版本号 | `mauriceboe/trek:4.0.0` | 精确的发布版；永不改变 |

如果你希望重新部署时自动更新，请使用 `latest` 或大版本标签（例如 `4`）。如果你希望对运行哪个发布版有明确控制，请使用完整版本标签（例如 `4.0.0`）。

## 更新

如何更新取决于你选择的标签：

**`latest` 或大版本标签** —— 在 Portainer 中打开该 stack，点击 **Redeploy**，打开 **Re-pull image and redeploy** 开关，然后确认。Portainer 会拉取最新的匹配镜像并重建容器。

![Re-pull image and redeploy 开关已勾选，箭头指向该开关和 Update 按钮](assets/portainer-force-pull.png)

**固定完整版本标签** —— 编辑该 stack，在 `image:` 行中修改标签（例如 `4.0.0` → `4.0.1`），然后点击 **Update the stack**。无需切换重新拉取开关 —— 标签变更会强制一次全新拉取。

![编辑 stack 页面，箭头指向 compose 编辑器中的镜像标签](assets/portainer-update-version.png)

![编辑 stack 页面，箭头指向 Update the stack 按钮](assets/portainer-update-stack.png)

> 任何更新之前都要备份数据。前往 **管理后台 → 备份**，或复制你的 `./data` 和 `./uploads` 目录。见 [备份](Backups)。

## 卷

| Stack 相对路径 | 容器路径 | 内容 |
|---|---|---|
| `./data` | `/app/data` | SQLite 数据库、日志、加密密钥 |
| `./uploads` | `/app/uploads` | 上传的文件（照片、文档、封面、头像） |

Portainer 会相对于该 stack 的工作目录解析 `./`。部署后在 **Stack details** 下确认这些路径。

### 具名卷

你可以用 Docker 具名卷代替绑定挂载。具名卷完全由 Docker 管理，不绑定到宿主机路径 —— 对于工作目录可能变化的 Portainer 来说很合适。所有选项见 [Docker Compose volumes 参考](https://docs.docker.com/reference/compose-file/volumes/)。

替换服务中的 `volumes:` 块，并添加一个顶层声明：

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

Portainer 会在侧栏的 **Volumes** 下列出具名卷，你可以在那里检查或备份它们。

## 下一步

- [环境变量](Environment-Variables) —— 完整的变量参考
- [反向代理](Reverse-Proxy) —— HTTPS 配置
- [更新](Updating) —— 所有安装方式下的更新策略
