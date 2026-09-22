# 开发者环境搭建指南

> 在做任何事之前，请先阅读 [[Contributing]] 指南。

## 前提条件

- Node.js 22+
- npm
- Git
- 一个 GitHub 账户

---

## 1. Fork 并克隆仓库

前往 [Tourism-Team 仓库](https://github.com/bhxnms/T-T) 并点击 **Fork** 创建你自己的副本。

然后把你的 fork 克隆到本地：

```bash
# Clone your fork, checking out the dev branch
git clone -b dev git@github.com:your-username/Tourism-Team.git
cd Tourism-Team
```

---

## 2. 配置 Git 远程仓库

把原始仓库添加为 `upstream`，以便拉取后续更新：

```bash
git remote add upstream git@github.com:bhxnms/T-T.git
```

现在你应该有两个远程仓库：

| 远程仓库     | URL                                          | 用途                        |
|------------|----------------------------------------------|--------------------------------|
| `origin`   | `git@github.com:your-username/Tourism-Team.git`      | 你的 fork —— 在这里推送改动  |
| `upstream` | `git@github.com:bhxnms/T-T.git`         | 主仓库 —— 从这里拉取更新 |

---

## 3. 保持你的 fork 最新

开始任何工作之前，确保你本地的 `dev` 分支与 upstream 同步：

```bash
git fetch upstream
git rebase upstream/dev  # or: git merge upstream/dev
```

---

## 4. 创建功能分支

在专用分支上工作能让你的改动保持隔离，也让 PR 更容易审查：

```bash
# Create a new branch off of dev
git checkout -b fix/my-changes origin/dev
```

分支命名约定：
- `feat/short-description` 用于新功能
- `fix/short-description` 用于缺陷修复
- `chore/short-description` 用于维护任务

---

## 5. 安装依赖

本仓库是一个 npm workspace monorepo，包含三个 workspace —— `shared`、`server` 和 `client`。在根目录执行一条命令即可安装全部三个：

```bash
npm ci
```

`plugin-sdk/` **不是**根 workspace：它有自己的锁文件和独立的 npm 发布流程，因此根目录的 `npm ci` 永远不会触及它。如果你在开发 SDK，请在该目录下安装并运行它的命令：

```bash
cd plugin-sdk && npm ci
```

---

## 6. 可选：KItinerary（订单导入）

订单确认导入功能使用 [KDE KItinerary](https://apps.kde.org/itinerary/) 解析旅行文档。服务器没有它也能运行，但导入端点会不可用。

### Linux

```bash
sudo apt-get install -y libkitinerary-bin
```

### 环境变量

把它们加入你本地的 `.env`（或在启动服务器前导出）：

```bash
# Prevent Qt from probing for a display in headless/server environments
QT_QPA_PLATFORM=offscreen

# KDE cache directory (avoids writing to $HOME)
XDG_CACHE_HOME=/tmp/kf6-cache

# Optional: only needed when the binary is not found on its own
# KITINERARY_EXTRACTOR_PATH=/usr/lib/x86_64-linux-gnu/libexec/kf6/kitinerary-extractor
```

`KITINERARY_EXTRACTOR_PATH` 是可选的。不设置时，服务器会先查找 Debian/Ubuntu 的位置 `/usr/lib/<triplet>/libexec/kf6/kitinerary-extractor`，然后在 `PATH` 中查找 `kitinerary-extractor` —— 其中之一正是 `libkitinerary-bin` 提供给你的。仅当该二进制文件最终落在两处查找都到不了的地方时才设置它，并确保该路径存在：一个无法解析的值会记录一条警告并停止查找，而不是回退，这会让导入功能被关闭。Docker 镜像把它设为 `/usr/local/bin/kitinerary-extractor`，这是镜像构建时创建的符号链接；该路径在普通的 apt 安装中并不存在。

---

## 7. 可用脚本

### 根目录（`/`）

这些命令会一次性在所有 workspace 上运行，是推荐的工作方式：

| 命令              | 说明                                                         |
|----------------------|---------------------------------------------------------------------|
| `npm run dev`        | 先构建 shared，然后通过 `concurrently` 一起启动 shared（监听）、server 和 client |
| `npm run build`      | 按 shared → server → client 的顺序构建                            |
| `npm test`           | 在 shared、server 和 client 中运行测试                            |
| `npm run test:cov`   | 为 shared、server、client 和 plugin-sdk 运行覆盖率             |
| `npm run test:e2e`   | 运行端到端测试（server）                                      |
| `npm run lint`       | 对 shared、server 和 client 做 lint                                    |
| `npm run format`     | 格式化 shared、server 和 client                                  |
| `npm run format:check` | 检查所有 workspace 的格式                           |

### Shared（`/shared`）

`@trek/shared` 包是客户端与服务器之间共享代码的唯一事实来源。它持有**定义 API 契约的 Zod schema**（请求/响应结构、通用基础类型、分页）以及 **i18n 翻译层**（各语言的键与类型）。两个 workspace 都从它导入，因此 schema 和翻译的改动会从一处传播到两端。

> **提示：** 在这个包中运行 `npm run i18n:parity`（或 `i18n:parity:strict`）来验证每种语言都暴露了相同的翻译键 —— CI 的一致性门禁运行的是严格变体。

| 命令                     | 说明                          |
|-----------------------------|--------------------------------------|
| `npm run build`             | 编译 shared 包（tsdown）      |
| `npm run build:watch`       | 以监听模式编译                |
| `npm test`                  | 运行测试                            |
| `npm run test:watch`        | 以监听模式运行测试                |
| `npm run typecheck`         | 只做类型检查，不产出            |
| `npm run i18n:parity`       | 检查语言键的一致性              |
| `npm run i18n:parity:strict`| 严格的语言键一致性（CI 门禁）   |
| `npm run lint`              | 对源码做 lint                          |
| `npm run format`            | 格式化源码                        |
| `npm run format:check`   | 检查格式                  |

### Server（`/server`）

> **提示：** `tests/` 位于构建用的 `tsconfig.json` 之外，因此 `npm run typecheck` 会跳过它 —— `npm run typecheck:tests` 是唯一能发现测试调用点损坏的步骤。CI 两者都运行。

| 命令                      | 说明                              |
|------------------------------|------------------------------------------|
| `npm start`                  | 启动服务器（生产）            |
| `npm run dev`                | 以监听模式启动服务器           |
| `npm run build`              | 编译 server                           |
| `npm run typecheck`          | 只做类型检查，不产出              |
| `npm run typecheck:tests`    | 也检查 `tests/` 的类型（CI 门禁）        |
| `npm test`                   | 运行所有测试                            |
| `npm run test:unit`          | 只运行单元测试                      |
| `npm run test:integration`   | 运行集成测试                    |
| `npm run test:ws`            | 运行 WebSocket 测试                      |
| `npm run test:e2e`           | 运行端到端测试                     |
| `npm run test:watch`         | 以监听模式运行测试                  |
| `npm run test:coverage`      | 运行测试并生成覆盖率报告           |
| `npm run lint`               | 对源码做 lint                              |
| `npm run lint:check`         | 检查所有内容，不带 `--fix`（CI 门禁）    |
| `npm run check:plugin-facts` | 校验生成的插件事实（CI 门禁）  |
| `npm run format`             | 格式化源码                            |

### Client（`/client`）

| 命令                    | 说明                                          |
|----------------------------|------------------------------------------------------|
| `npm run dev`              | 启动 Vite 开发服务器                            |
| `npm run build`            | 构建生产版本（先运行图标生成）    |
| `npm run preview`          | 在本地预览生产构建                                 |
| `npm run typecheck`        | 只做类型检查，不产出（CI 门禁）                   |
| `npm test`                 | 运行所有测试                                        |
| `npm run test:unit`        | 只运行单元测试                                  |
| `npm run test:integration` | 运行集成测试                                |
| `npm run test:watch`       | 以监听模式运行测试                              |
| `npm run test:coverage`    | 运行测试并生成覆盖率报告                       |
| `npm run lint`             | 对源码做 lint                                          |
| `npm run lint:check`       | 与 `npm run lint` 相同的命令 —— CI 使用的名字    |
| `npm run lint:pages`       | 强制 Page 模式（CI 门禁）                   |
| `npm run theme:lint`       | 标记绕过外观 token 的样式     |
| `npm run format`           | 格式化源码                                        |

---

## 8. 提交并推送你的改动

```bash
git add .
git commit -m "fix: describe your change"

# Push to your fork's dev branch
git push origin fix/my-changes

# Or if working directly on dev
git push origin dev
```

然后从你的 fork 向 `bhxnms/T-T` 的 `dev` 分支发起一个 Pull Request。如果你的 PR 只修改 `wiki/` 下的文件，则不受分支限制的约束，可以以任意分支为目标。

---

## 提示

- 始终从最新的 `dev` 拉出分支 —— 开始新工作前运行 `git fetch upstream && git rebase upstream/dev`。
- 推送前运行测试：仓库根目录的 `npm test` 会运行所有 workspace。但这本身并不是完整的 CI 门禁 —— 还要在 `server/` 中运行 `npm run typecheck && npm run typecheck:tests && npm run lint:check && npm run check:plugin-facts`，在 `client/` 中运行 `npm run typecheck && npm run lint:check && npm run lint:pages`，如果你改动了翻译，还要在根目录运行 `npm run i18n:parity:strict --workspace=shared`。
- 遵循 [[Contributing]] 指南中描述的提交信息约定。
