# Cloudflare 隧道

> **完全小白？** 请看下方的 [零基础配置](#零基础配置) —— 那是从注册账号开始、每一步都写明「要拿到什么信息」和「要额外运行什么进程」的傻瓜式教程，照着做即可。本页上面的部分是给已经熟悉反向代理的人看的参考说明，看不懂可以先跳过。

本页是通过 Cloudflare 隧道把实例发布到互联网的分步操作指南。关于周边代理的上下文 —— WebSocket 升级、请求体大小限制、MCP 请求头透传 —— 见 [反向代理](Reverse-Proxy)。

> **简要版：** 你需要一个 Cloudflare 账户、一个挂在该账户下的域名，以及一个 Cloudflare API
> 令牌。你只需多运行一个容器。你不需要开放端口、获取证书或编辑
> 配置文件。

## 隧道实际做了什么

`cloudflared` 运行在你的机器上，并*向外*拨号连接到 Cloudflare 的边缘节点。随后 Cloudflare 从边缘节点提供你的主机名服务，并通过那条已建立的连接把请求转发回来。

开始之前，有两点值得理解：

- **你的网络上没有暴露任何东西。** 没有入站端口，因此没有什么可被扫描。
- **必须有一个进程在运行。** Tourism-Team 有意 **不** 运行它。该容器以只读方式挂载其文件系统并丢弃了自身的能力，因此它无法承载第二个长期运行的二进制文件。连接器是位于应用旁边的独立容器（或服务）。

## 开始之前

你需要：

1. 一个 **Cloudflare 账户**，并且你的域名已作为区域添加（该域名的名称服务器必须指向 Cloudflare）。
2. 一个具有以下权限的 **API 令牌**：
   - **账户 → Cloudflare Tunnel → 编辑**
   - **区域 → DNS → 编辑**

   在 *My Profile → API Tokens → Create Token → Custom token* 下创建它。这些权限名称可以在令牌构建器中搜索到。
3. 你的 **账户 ID** —— 可在 Cloudflare 控制台 URL 中看到：
   `dash.cloudflare.com/<account-id>/…`
4. 大约五分钟。

> **需要写入权限。** 该面板会创建隧道、写入其入站规则并让 DNS 指向它。只读令牌会通过连接
> 测试，然后在创建步骤失败。

## 第 1 步 —— 配置面板

1. 以管理员身份登录并打开 **管理 → 配置 → Cloudflare 隧道**。
2. 该功能 **默认关闭**。勾选 **启用 Cloudflare 隧道配置**。
   关闭不只是外观上的：关闭期间不会存储任何东西、不会应用任何东西，而且如果你已经运行着自己的隧道，它会照常工作不受影响。
3. 填写：
   - **账户 ID** —— 来自控制台 URL 的 32 位字符 id。
   - **API 令牌** —— 上面提到的令牌。它加密存储，之后只会以
     `••••••••` 的形式回显。
   - **隧道名称** —— 任意标签，例如 `tt-planner`。它是隧道在 Cloudflare 控制台中的显示方式，而不是主机名。
   - **公开域名** —— 你将使用的地址，例如 `tt.example.com`。它必须位于该账户下的某个区域内。
   - **服务端口** —— 随附的 Docker 镜像保持 `3000`。它是连接器在 Docker 网络内访问应用所用的端口。
4. 点击 **保存**。

面板会列出仍缺少哪些字段，因此填写了一半的表单会告诉你它还在等什么，而不是静默失败。

## 第 2 步 —— 测试凭据

点击 **测试连接**。

- **成功** 会显示账户名称以及该账户中已有隧道的列表，因此在创建任何东西之前就能发现隧道名称里的笔误。
- **令牌被拒绝** 会显示 Cloudflare 自己的消息（通常是 `Invalid API Token`）。
- **令牌缺少账户权限** 会如实报告 —— 令牌有效，只是无法管理隧道，消息中会指出需要添加的权限。

该测试不保存任何东西，也不创建任何东西。

## 第 3 步 —— 创建隧道

点击 **创建隧道**。面板会在一个操作中：

1. 创建隧道（或复用同名的现有隧道 —— 运行两次是安全的）。
2. 写入隧道的入站规则，使公开域名路由到 `http://app:3000`。
3. 创建把你的域名指向该隧道的 DNS 记录。
4. 显示 **连接器令牌**。

**请立即复制连接器令牌。** 它只显示一次，Tourism-Team 不保留副本 —— 应用从不运行连接器，因此之后也用不到它。如果你弄丢了，点击 **重新创建隧道** 获取一个新的。

由于隧道是以 *远程管理* 方式创建的，因此任何地方都没有 `config.yml` 和凭据文件：路由规则存放在 Cloudflare 的配置中，由面板为你写入。这正是该流程不需要 `cloudflared tunnel create`、也不需要交互式登录的全部原因。

## 第 4 步 —— 运行连接器

面板会渲染出要粘贴的确切片段。对于 Compose 部署，在你的现有 `app` 服务旁添加第二个服务：

```yaml
services:
  app:
    # ... your existing app service, unchanged ...

  tunnel:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on:
      - app
```

把你复制的令牌放进 `CLOUDFLARE_TUNNEL_TOKEN`，然后执行 `docker compose up -d`。

不使用 Compose？等效的单条命令是：

```bash
cloudflared tunnel --no-autoupdate run --token <your-connector-token>
```

这也是 systemd 单元或宿主机安装的全部设置 —— 没有配置文件需要编写。

> **让它指向 `app`，而不是 `localhost`。** 在 Compose 网络中，连接器通过服务名在容器端口上访问
> 应用。面板已经把正确的目标写入了 Cloudflare 的配置；只有当你手工重建这套设置时这一点才
> 重要。

## 第 5 步 —— 告诉应用它自己的地址

有两个值位于你的 `.env` 文件中，而不在数据库里，因此面板无法替你设置：

```env
APP_URL=https://tt.example.com
TRUST_PROXY=1
```

这两个值在 `docker-compose.yml` 里都是写死的注释行，所以还必须在那里取消注释 —— 只写进 `.env` 容器是收不到的。具体改法见[零基础配置第 9 步](#第-9-步-告诉应用它自己的网址)。

- **`APP_URL`** 是应用认为自己被提供服务的地址。它用于密码重置邮件、日历源 URL、OIDC 重定向 URI 和 HTTPS 重定向目标。如果它错了，那些链接会指向无法工作的地方 —— 应用本身看起来没问题，这正是它容易被忽略的原因。
- **`TRUST_PROXY`** 是应用前面的代理层数。直接接 Cloudflare 是 `1`。如果你在 Cloudflare 和应用之间还运行着自己的 nginx 或 Caddy，则为 `2`。

更改任意一项后请**重建**应用容器（`docker compose up -d`，而不是 `restart` —— 需要让容器重新读取 `environment:` 中的值）。

## 验证是否工作

1. 在浏览器中打开 `https://<your-hostname>`。锁形图标应当是有效的 —— 那是 Cloudflare 的证书，你这边无需任何设置。
2. 登录。如果登录看起来成功了却又把你弹回登录页，通常是 `TRUST_PROXY` 不对：会话 Cookie 在没有所需 `Secure` 标志的情况下被签发。
3. 打开一趟旅行并观察地图。瓦片和 websocket 更新能证明该隧道承载的不只是纯 HTML。

## 之后更改域名

在面板中编辑域名并保存。随后面板会把该隧道显示为 **未创建**，因为已存在的隧道不再与表单所述一致。再次点击 **创建隧道** 以使其一致。

这是有意为之：静默留下一条过期的路由规则会产生一个能解析但提供错误内容的主机名。

## 关闭它

取消勾选 **启用 Cloudflare 隧道配置**。不会删除任何东西 —— 凭据和域名都会被保留，重新启用会精确恢复之前的状态。只要连接器容器还在运行，你的隧道就会继续工作，因为连接器从一开始就不由应用管理。

如果你想让隧道彻底消失：

1. 停止并移除 `tunnel` 服务。
2. 在 Cloudflare 控制台中删除该隧道及其 DNS 记录。
3. 可选：清除面板中存储的凭据。

## 疑难排查

| 症状 | 可能原因 |
|---|---|
| 测试时出现 `Invalid API Token` | 令牌错误、已被撤销，或缺少上面两项权限。 |
| `No zone in this account owns that hostname` | 该域名未添加到这个 Cloudflare 账户，或者你输入了一个你并不拥有的域名下的主机名。 |
| 连接器已启动，但主机名返回 502 | 连接器无法访问应用。检查隧道入站规则中的服务名和端口。 |
| 登录成功但会话无法保持 | `TRUST_PROXY` 不对，或 `APP_URL` 与你正在访问的主机名不匹配。 |
| 邮件中包含 `localhost` 链接 | `APP_URL` 未设置。 |
| 对面板的更改毫无效果 | 该功能已关闭；面板只在启用时应用设置。 |

## 零基础配置

这一节是给完全没用过 Cloudflare、也没配过反向代理的人写的。每一步都写明：**你要在哪个网站做什么**、**要拿到什么信息**、**要额外运行什么进程**。照着顺序做就行，不需要理解原理。

上面那些章节是参考手册，看不懂可以跳过，需要时再回来查。

### 你要准备的东西

| 东西 | 大概成本 | 从哪来 | 后面用在哪 |
|---|---|---|---|
| 一个域名 | 约 ¥50–100/年 | 任何域名注册商 | 别人访问你实例的网址 |
| Cloudflare 账号 | 免费 | dash.cloudflare.com 注册 | 托管域名、创建隧道 |
| 账户 ID | 免费 | Cloudflare 控制台网址里 | 填进 TT 面板 |
| API 令牌 | 免费 | Cloudflare 控制台里创建 | 填进 TT 面板 |
| 连接器令牌 | 免费 | TT 面板创建隧道后生成 | 填进 docker-compose |

**关于域名：** Cloudflare 本身不送域名，你得先有一个。任何一个注册商买的都行（阿里云、腾讯云、Namecheap、Cloudflare 自己的 Registrar 都可以）。**最便宜的路子**是直接在 Cloudflare 的 Registrar 买，它会自动帮你接好，可以跳过第 2 步。

> **只想先试试、暂时不想买域名？** Cloudflare 还有一种「快速隧道」，不需要账号和域名，会给你一个随机的 `xxx.trycloudflare.com` 网址。但它每次重启都会换网址，而且**本面板不支持这种方式**（面板必须要有域名和账户 ID）。想走这条路请看 [反向代理](Reverse-Proxy) 里的自管 cloudflared 部分。

### 第 1 步 —— 注册 Cloudflare 账号

1. 打开 `dash.cloudflare.com`，点 **Sign up**，填邮箱和密码，去邮箱点验证链接。
2. 注册完登录进去，会看到一个要求你「添加站点」的界面 —— 先不用管，往下做第 2 步。

**这一步要拿到什么：** 一个能登录的 Cloudflare 账号。没有别的。

### 第 2 步 —— 把你的域名接入 Cloudflare

> 如果你的域名就是在 Cloudflare 买的，**跳过这一步**，直接去第 3 步。

1. 在 Cloudflare 控制台点 **Add a site**（添加站点），输入你的域名，例如 `example.com`（**不要**带 `https://`，也**不要**带 `www`）。
2. 选 **Free** 套餐（免费版够用，点最下面那个 Continue）。
3. Cloudflare 会显示两个**名称服务器**地址，长得像这样：
   ```
   aria.ns.cloudflare.com
   bob.ns.cloudflare.com
   ```
4. **复制这两个地址**，去你买域名的那个网站（阿里云/腾讯云/Namecheap 等），找到「DNS 修改」或「Nameservers」设置，把原来的名称服务器**替换**成 Cloudflare 给的这两个。
5. 回到 Cloudflare 点 **Done, check nameservers**。生效通常要几分钟到几小时（最慢 24 小时）。等 Cloudflare 发邮件说域名已激活，再继续。

**这一步要拿到什么：** 域名状态变成 **Active**（激活）。在控制台首页能看到。

**这一步要额外运行什么进程：** 没有，纯网页操作。

### 第 3 步 —— 取得账户 ID

1. 在 Cloudflare 控制台，点左侧任意一个域名进入它的管理页。
2. 看一眼浏览器**地址栏**，格式是这样的：

   ```
   https://dash.cloudflare.com/1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p/example.com
   ```

   把它拆成三段看，你要的只是中间那段：

   | 部分 | 是什么 |
   |---|---|
   | `https://dash.cloudflare.com/` | 固定前缀，永远长这样 |
   | `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p` | **这一段（32 位字符）就是账户 ID** |
   | `/example.com` | 你打开的那个域名，**不是**账户 ID 的一部分 |

3. 把中间那串 **32 位字符**复制下来存好。

**这一步要拿到什么：** 账户 ID（32 位字母数字，例如 `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p`）。

> 找不到？控制台右上角可以切换账户，也可以直接访问 `dash.cloudflare.com` 后看地址栏，账户 ID 就在域名前面那一段。

**这一步要额外运行什么进程：** 没有。

### 第 4 步 —— 创建 API 令牌

这是最容易出错的一步，请按下面逐字做，**权限一定要给对**。

1. 点 Cloudflare 控制台**右上角的头像** → **My Profile**（我的个人资料）。
2. 左侧选 **API Tokens**（API 令牌）→ 点 **Create Token**（创建令牌）。
3. 往下拉到 **Custom token**（自定义令牌），点它右边的 **Get started**。
4. 在 **Token name**（令牌名称）随便填，例如 `tt-tunnel`。
5. 在 **Permissions**（权限）区域，**添加两行**（点 `+ Add more` 可以加第二行）：

   | 第一栏 | 第二栏 | 第三栏 |
   |---|---|---|
   | Account（账户） | Cloudflare Tunnel | Edit（编辑） |
   | Zone（区域） | DNS | Edit（编辑） |

6. **Account Resources**（账户资源）选你的账户；**Zone Resources**（区域资源）选 `All zones`（所有区域）或指定你的域名。
7. 点 **Continue to summary** → **Create Token**。
8. 页面会显示一串令牌，**立刻复制**（它只显示一次）。长得像：
   ```
   AbCdEf1234567890_thisIsYourApiTokenXyZ...
   ```

**这一步要拿到什么：** API 令牌（一长串字符）。

> **⚠️ 常见错误：** 只给「读取」权限。这个面板需要**创建**隧道和**写入** DNS，所以两处都必须是 **Edit（编辑）**。只读令牌会在测试时通过、然后在创建隧道时失败。

**这一步要额外运行什么进程：** 没有。

### 第 5 步 —— 在 TT 面板里填写

1. 用**管理员账号**登录你的 Tourism-Team。
2. 左侧进 **管理**（Admin）→ **配置**分组 → **Cloudflare 隧道**。
3. 打开 **启用 Cloudflare 隧道配置** 这个开关（**默认是关的**，不开的话下面填了也不保存）。
4. 填入：

   | 界面上的字段 | 填什么 |
   |---|---|
   | **账户 ID** | 第 3 步拿到的那 32 位字符 |
   | **API 令牌** | 第 4 步复制的那串令牌 |
   | **隧道名称** | 随便起个名，例如 `tt-planner`。这只是个标签，**不是网址** |
   | **公开域名** | 你要用的网址，例如 `tt.example.com`。必须属于你第 2 步接入的域名 |
   | **服务端口** | **保持 `3000` 不要改**（除非你改过 Docker 配置） |

5. 点 **保存**。

**这一步要拿到什么：** 界面显示「隧道设置已保存」。如果上方提示「仍缺少：xxx」，说明还有字段没填。

**这一步要额外运行什么进程：** 没有。

### 第 6 步 —— 测试连接

点 **测试连接** 按钮。

- ✅ **成功**：会显示你的账户名，以及账户里已有的隧道列表。这时候顺便确认一下你的「隧道名称」没有跟已有的重名。
- ❌ **`Invalid API Token`**：令牌复制错了、被撤销了，或者权限没给对。回第 4 步重做一个。
- ❌ **提示缺少账户权限**：令牌本身有效，但少了「账户 → Cloudflare Tunnel → 编辑」。回第 4 步补上。

**测试不会保存、也不会创建任何东西**，可以放心反复点。

**这一步要拿到什么：** 一个绿色的成功提示。

### 第 7 步 —— 创建隧道，复制连接器令牌

1. 点 **创建隧道**。面板会自动帮你做完这些事（你不用去 Cloudflare 点任何东西）：
   - 创建隧道（同名的话会复用，重复点也安全）
   - 写好路由规则，让公开域名指向 `http://app:3000`
   - 创建好 DNS 记录
2. 完成后面板会显示 **连接器令牌**。

**⚠️ 这一步要拿到什么：** **连接器令牌** —— 请**立刻复制**！它只显示一次，TT 不保存副本。弄丢了就点 **重新创建隧道** 生成新的。

它长得像一串很长的乱码，例如：
```
eyJhIjoiMWFiYzM0...（非常长，一直到结尾）
```

> **注意区分两个令牌：** 第 4 步那个是给 TT 用的（用来操作 Cloudflare）；这一步这个是给 `cloudflared` 连接器用的（用来连接隧道）。两个不一样，别搞混。

### 第 8 步 —— 运行连接器（这是唯一需要额外运行的进程）

前面说过，**TT 自己不会运行连接器**。你必须额外跑一个 `cloudflared` 容器。这是整个流程里唯一需要你动手跑进程的地方。

**如果你用 docker-compose 部署（推荐）：**

1. 打开你的 `docker-compose.yml`。文件**末尾已经预留好**了这段，只是被 `#` 注释掉了：
   ```yaml
   #  tunnel:
   #    image: cloudflare/cloudflared:latest
   #    container_name: tt-planner-tunnel
   #    restart: unless-stopped
   #    command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
   #    depends_on:
   #      - app
   ```
2. 把 `tunnel:` 到 `- app` 这几行的行首 `#` **全部删掉**（取消注释）。
3. 打开同目录下的 `.env` 文件，加上一行（令牌换成第 7 步复制的）：
   ```env
   CLOUDFLARE_TUNNEL_TOKEN=粘贴你的连接器令牌
   ```
4. 运行：
   ```bash
   docker compose up -d
   ```
5. 检查连接器是否正常：
   ```bash
   docker compose logs tunnel
   ```
   看到类似 `Registered tunnel connection` 的字样就说明连上了。

**如果你不是用 compose（直接装 cloudflared）：**

在宿主机上安装 `cloudflared`，然后直接运行一条命令（不需要任何配置文件）：

```bash
cloudflared tunnel --no-autoupdate run --token 粘贴你的连接器令牌
```

想让它开机自启，把它做成 systemd 服务即可 —— 同样**不需要写 config.yml**。

**这一步要额外运行什么进程：** 一个 `cloudflared` 容器（或进程）。**就这一个。**

### 第 9 步 —— 告诉应用它自己的网址

还差两个设置。它们**不在数据库里**（所以面板没法替你填），要改的是你**部署目录**下的两个文件。

**文件在哪：** 就是你当初放 `docker-compose.yml` 的那个目录（通常是 `cd` 进去执行 `docker compose up -d` 的地方，比如 `/opt/tt-planner/` 或 `~/tt-planner/`）。`.env` 文件跟 `docker-compose.yml` **并排放在同一层**：

```
你的部署目录/
├── docker-compose.yml     ← 第 8 步取消注释 tunnel 服务的地方
├── .env                   ← 本步要改的地方（如果没有就自己新建一个）
├── data/                  ← 数据库（自动生成）
└── uploads/               ← 上传的文件（自动生成）
```

> 不确定自己在哪个目录？在服务器上执行 `docker inspect tt-planner --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'`，它会直接打印出部署目录。`.env` 就在那里。

**要改两个文件，两步都要做**（这是最容易漏的地方）：

**① 在 `.env` 里加上这两行：**

```env
APP_URL=https://tt.example.com
TRUST_PROXY=1
```

**② 再打开 `docker-compose.yml`，在 `app` 服务的 `environment:` 段里，把这两行前面的 `#` 删掉：**

```yaml
    environment:
      # ... 上面还有其他配置 ...
#      - TRUST_PROXY=1
#      - APP_URL=https://planner.example.com
```

变成：

```yaml
    environment:
      # ... 上面还有其他配置 ...
      - TRUST_PROXY=${TRUST_PROXY:-1}
      - APP_URL=${APP_URL:-}
```

> **为什么必须改两处？** 因为 `docker-compose.yml` 里的 `APP_URL` 和 `TRUST_PROXY` 是**写死的注释行**，并没有像 `CLOUDFLARE_TUNNEL_TOKEN` 那样写成 `${APP_URL}` 去引用 `.env`。所以**只填 `.env` 是不生效的** —— 容器根本收不到这个值。把注释行改成上面这种 `${...}` 写法，`.env` 里的值才会传进容器。（这是 [安装：Docker Compose](Install-Docker-Compose#environment-variables) 里说明的通用规则。）

两个值分别是什么：

- **`APP_URL`** 换成你第 5 步填的那个公开域名，**要带 `https://`**。它决定密码重置邮件、日历订阅链接、SSO 跳转里出现的网址。填错了的话，**应用本身看起来一切正常**，但邮件里的链接会指向打不开的地方 —— 所以特别容易漏。
- **`TRUST_PROXY`** 填 `1`（直接接 Cloudflare）。如果你在 Cloudflare 和自己之间还架了 nginx/Caddy，才填 `2`。

改完**重启应用容器**（在同一个部署目录下执行）：

```bash
docker compose up -d
```

> 这里用 `up -d` 而不是 `restart`：改了 `environment:` 之后需要**重建容器**才能让新变量生效，单纯 `restart` 会继续用旧的配置。

**这一步要拿到什么：** `.env` 里加两行 + `docker-compose.yml` 取消两行注释，然后重建容器。

> 不确定是否生效？执行 `docker compose exec app printenv APP_URL TRUST_PROXY`，能打印出你设的值就说明传进去了。

### 第 10 步 —— 验证

1. 浏览器打开 `https://你的公开域名`。地址栏应显示**小锁图标**（HTTPS 有效）—— 证书是 Cloudflare 提供的，你什么都不用配。
2. 登录。**如果登录后又被弹回登录页**，几乎都是 `TRUST_PROXY` 填错了，回第 9 步检查。
3. 随便打开一趟旅行，看看地图能不能加载。地图瓦片和实时协作能正常显示，说明隧道传输的不只是纯文字页面，配置完整。

### 全部步骤速查表

| 步骤 | 在哪做 | 要拿到什么 | 要跑进程吗 |
|---|---|---|---|
| 1 | dash.cloudflare.com | Cloudflare 账号 | 否 |
| 2 | Cloudflare + 域名商 | 域名状态 Active | 否 |
| 3 | Cloudflare 控制台地址栏 | 账户 ID（32 位） | 否 |
| 4 | Cloudflare → My Profile → API Tokens | API 令牌（2 项 Edit 权限） | 否 |
| 5 | TT → 管理 → 配置 → Cloudflare 隧道 | 保存成功 | 否 |
| 6 | 同上，点「测试连接」 | 绿色成功提示 | 否 |
| 7 | 同上，点「创建隧道」 | **连接器令牌**（只显示一次） | 否 |
| 8 | 你的服务器 | 连接器运行起来 | **是，1 个 cloudflared 容器** |
| 9 | 部署目录下的 `.env` + `docker-compose.yml` | `APP_URL` + `TRUST_PROXY` | 重建 app 容器 |
| 10 | 浏览器 | 小锁 + 能正常登录 | 否 |

### 零基础常见卡点

| 现象 | 原因 | 怎么办 |
|---|---|---|
| 第 4 步创建令牌时找不到权限名 | 令牌类型选错了 | 必须选 **Custom token**，不要用模板 |
| 测试连接报 `Invalid API Token` | 令牌复制时少了字符，或权限给成了 Read | 重新创建令牌，两处都选 **Edit** |
| 保存后没反应 | 「启用」开关没打开 | 回第 5 步打开开关再保存 |
| 测试提示「没有区域拥有该域名」 | 域名没接入这个账户，或域名拼错 | 回第 2 步确认域名是 Active |
| 面板显示「未创建」但我明明创建过 | 你改过公开域名 | 这是正常的，改域名后需重新点「创建隧道」 |
| 连接器起来了但网址报 502 | 连接器连不上应用 | 检查 `docker compose logs tunnel`；确认服务端口是 `3000` |
| 登录成功但会话留不住 | `TRUST_PROXY` 不对 | 直接接 Cloudflare 填 `1` |
| 邮件里链接是 `localhost` | `APP_URL` 没设 | 回第 9 步设置并重启 |
| 找不到「Cloudflare 隧道」这个菜单 | 当前实例处于「托管模式」 | 托管实例由服务商管理，此功能不显示 |

## 相关

- [反向代理](Reverse-Proxy) —— 自行管理的 cloudflared、nginx 和 Caddy，以及 WebSocket、大文件上传和 MCP 的三项硬性要求
- [环境变量](Environment-Variables) —— `APP_URL`、`TRUST_PROXY`、`COOKIE_SECURE`
- [安全加固](Security-Hardening) —— 暴露实例之前需要检查什么
- [疑难排查](Troubleshooting) —— Cloudflare WAF 拦截 MCP 客户端
