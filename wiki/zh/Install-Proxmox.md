# 安装：Proxmox VE (LXC)

使用 [Proxmox VE Community Scripts](https://community-scripts.org/scripts/trek) 在 Proxmox VE 上以 LXC 容器安装 Tourism-Team。

> 衷心感谢 [community-scripts](https://github.com/community-scripts) 的成员把 Tourism-Team 加入他们的合集，并维护安装与更新脚本。

## 前提条件

- 具有 shell 访问权限的 Proxmox VE
- Proxmox 主机可以访问互联网

## 安装

在 **Proxmox VE Shell** 中运行以下命令：

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/trek.sh)"
```

> **提示：** 运行前请始终在 [community-scripts 的 Tourism-Team 页面](https://community-scripts.org/scripts/trek) 上核实最新命令 —— 脚本 URL 可能在不同发布版之间变化。

脚本会提示你在 **Default** 和 **Advanced** 设置之间选择。

### 默认容器规格

| 资源 | 值 |
|---|---|
| OS | Debian 13 |
| CPU | 2 核 |
| RAM | 2048 MB |
| 存储 | 8 GB |
| 端口 | 3000 |

容器是非特权容器。Tourism-Team 安装在 `/opt/trek`。

## 安装之后

容器启动后，在浏览器中打开：

```
http://<container-ip>:3000
```

首次启动时，Tourism-Team 会自动创建一个管理员账户。凭据会打印到容器日志中 —— 用以下命令查看：

```bash
journalctl -u trek -n 50
```

`ENCRYPTION_KEY` 在设置过程中自动生成并保存到 `/opt/trek/server/.env`。请把该文件纳入你的备份。

## 查看日志

Tourism-Team 在 LXC 内以名为 `trek` 的 systemd 服务运行。要从容器内查看日志：

```bash
# Follow live logs
journalctl -u trek -f

# Show last 100 lines
journalctl -u trek -n 100

# Show logs since last boot
journalctl -u trek -b
```

要从 Proxmox VE 主机访问容器 shell，请在界面中点击该容器并打开 **Console**，或运行：

```bash
pct enter <container-id>
```

## 配置

环境文件位于容器内的 `/opt/trek/server/.env`。编辑它以设置 `ALLOWED_ORIGINS`、`APP_URL` 或 `TZ` 等变量，然后重启服务：

```bash
systemctl restart trek
```

### 绑定到特定网络接口

如果你的 Proxmox 主机有多个网络接口，而你希望 Tourism-Team 只在其中一个上监听，请在 `/opt/trek/server/.env` 中设置 `HOST` 变量：

```
HOST=10.0.0.72   # bind only on this LAN interface
```

> **注意：** `HOST` 只与源码安装和 Proxmox 安装相关。不要在 Docker 或任何容器化部署中使用它。

完整的变量参考见 [环境变量](Environment-Variables)。

## 更新

在 **LXC 容器**内运行以下命令，并在提示时选择 **Update**：

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/trek.sh)"
```

> **提示：** 运行前请始终查看 [community-scripts 的 Tourism-Team 页面](https://community-scripts.org/scripts/trek)，以确认最新命令。

该脚本会停止服务、备份你的数据和上传内容、应用新发布版、恢复备份并重启。无需任何手动步骤。

## 下一步

- [环境变量](Environment-Variables) —— 完整的变量参考
- [反向代理](Reverse-Proxy) —— 把 Tourism-Team 放在 Nginx 或 Caddy 之后
- [更新](Updating) —— 通用更新说明
