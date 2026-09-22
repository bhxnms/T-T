# 更新

如何在不丢失数据的情况下把 Tourism-Team 更新到更新的版本。

## 更新之前

先备份你的数据。前往 管理后台 → 备份 创建一份手动备份，或把 `./data` 和 `./uploads` 目录复制到安全的位置。详情见 [备份](Backups)。

## 镜像标签

| 标签 | 示例 | 行为 |
|---|---|---|
| `latest` | `mauriceboe/trek:latest` | 始终是所有大版本中最新的发布版 |
| 大版本 | `mauriceboe/trek:4` | 固定到该大版本的最新发布版 |
| 完整版本 | `mauriceboe/trek:4.0.0` | 精确的发布版；永不改变 |

如果你希望每次重新部署都获得更新，请使用 `latest` 或大版本标签。若要明确控制，请使用完整版本标签 —— 通过更改标签来更新，而不是重新拉取。

## Docker Compose（推荐）

**`latest` 或大版本标签：**

```bash
docker compose pull && docker compose up -d
```

这会拉取最新的匹配镜像，并用你现有的卷重建容器。你的数据不受影响。

**固定的完整版本标签：**

编辑 `docker-compose.yml`，更新 `image:` 行中的标签（例如 `4.0.0` → `4.0.1`），然后重新部署：

```bash
docker compose up -d
```

## Docker Run

如果你是用 `docker run` 启动 Tourism-Team 的，请拉取新镜像并替换容器：

```bash
docker pull mauriceboe/trek
docker rm -f trek
docker run -d --name trek -p 3000:3000 \
  -v ./data:/app/data \
  -v ./uploads:/app/uploads \
  -e ENCRYPTION_KEY=<your-key> \
  --restart unless-stopped \
  mauriceboe/trek
```

> **提示：** 不确定你用了哪些卷路径？删除之前先检查：
> ```bash
> docker inspect trek --format '{{json .Mounts}}'
> ```

## Helm (Kubernetes)

> **⚠️ Chart 仓库已迁移：** Helm chart 不再由 `https://mauriceboe.github.io/TREK` 提供（项目从个人仓库迁到了 `liketrek` 组织）。规范的 chart URL 现在是 `https://chart.liketrek.com` —— 它是 GitHub Pages 站点 `https://liketrek.github.io/TREK` 的自定义域名（CNAME），因此即使仓库再次迁移它也能保持稳定。如果你的 `trek` 仓库仍指向旧 URL，请在更新前切换：
>
> ```bash
> helm repo remove trek
> helm repo add trek https://chart.liketrek.com
> ```
>
> 你可以用 `helm repo list` 查看当前配置的是哪个 URL。已有的 release 不受影响 —— 改变的只有仓库 URL。

要更新到最新的 chart 发布版：

```bash
helm repo update
helm upgrade trek trek/trek
```

你现有的值和 PVC（数据、上传）都会保留。若要改为固定确切的 chart 版本，请传入 `--version <x.y.z>`。

完整的安装演练和值参考见 [安装：Helm](Install-Helm)。

## 数据库迁移

Tourism-Team 会在启动时自动运行任何待处理的数据库迁移。拉取新镜像后无需任何手动迁移步骤。

## 加密密钥说明

如果你是从早于专用 `ENCRYPTION_KEY` 的版本升级（即你没有设置 `ENCRYPTION_KEY` 环境变量），Tourism-Team 会在启动时自动回退到 `./data/.jwt_secret`，并立即把它提升为 `./data/.encryption_key`。无需任何手动步骤 —— 该转换在升级后的首次启动时处理。

如果你在任何时候想轮换到新密钥（正常更新并不需要），完整流程见 [加密密钥轮换](Encryption-Key-Rotation)。

## Proxmox VE (LXC)

如果你通过 [Proxmox VE Community Scripts](https://community-scripts.org/scripts/trek) 安装 Tourism-Team，请在 **LXC 容器**内运行以下命令，并在提示时选择 **Update**：

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/trek.sh)"
```

> **提示：** 运行前请始终查看 [community-scripts 的 Tourism-Team 页面](https://community-scripts.org/scripts/trek)，以确认最新命令。

该脚本会停止服务、备份你的数据和上传内容、应用新发布版、恢复备份并重启。无需任何手动步骤。

要验证更新已完成并检查错误：

```bash
# Inside the container (pct enter <id> from the Proxmox shell)
journalctl -u trek -n 50
```

## Portainer

打开 **Stacks** 列表，点击 Tourism-Team 堆栈，然后点击 **Redeploy**。

**`latest` 或大版本标签** —— 确认前先打开 **Re-pull image and redeploy** 开关。Portainer 会拉取最新的匹配镜像并重建容器。

![已勾选 Re-pull image and redeploy 开关，箭头指向该开关和 Update 按钮](assets/portainer-force-pull.png)

**固定的完整版本标签**（例如 `4.0.0`）—— 编辑堆栈，更新 `image:` 行中的标签，然后点击 **Update the stack**。无需重新拉取开关；标签变更会强制进行一次全新拉取。

![编辑堆栈页面，箭头指向 compose 编辑器中的镜像标签](assets/portainer-update-version.png)

![编辑堆栈页面，箭头指向 Update the stack 按钮](assets/portainer-update-stack.png)

完整的安装演练见 [安装：Portainer](Install-Portainer)。

## Unraid

在 Unraid 的 Docker 标签页中，点击 Tourism-Team 容器并选择 **Update**。Unraid 会拉取最新镜像并使用相同的卷重启。

## 下一步

- [备份](Backups) —— 设置自动备份，这样更新前你总有一个恢复点
- [加密密钥轮换](Encryption-Key-Rotation) —— 如果你需要轮换或迁移加密密钥
- [安装：Docker Compose](Install-Docker-Compose) —— 改用 Compose 以便未来更轻松地更新
