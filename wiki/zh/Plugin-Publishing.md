# 发布插件

插件通过一个静态注册表分发 —— 即
[TREK-Plugins](https://github.com/bhxnms/T-T-Plugins) GitHub 仓库。这里
没有上传服务器，也没有账号：你把代码托管在自己的公开 GitHub 仓库里，
把构建好的 `plugin.zip` 作为发布附件上传，再用一个 pull request 把它登记进去。

`trek-plugin` CLI（随 `trek-plugin-sdk` 包一起提供）承担了几乎所有
机械性工作 —— 你很少需要手写哈希、大小、commit 或 JSON 字段。

## 简要版 —— 一条命令

先在本地把插件调到绿灯（`trek-plugin status` 会告诉你还差什么），把它提交
并推送到它的公开 GitHub 仓库，然后：

```bash
npx trek-plugin-sdk publish --repo you/trek-plugin-flight-tracker --tag v1.0.0
```

`publish` 会跑完整个发布流程，分五步，按 **这个顺序**：

1. **check** —— 所有能在本地检查的注册表关卡
2. **pack** —— 构建 `plugin.zip`
3. **release** —— 打 git tag、推送，并创建附有产物的 GitHub release
4. **preflight** —— 需要 tag 和 release 已经存在的那些关卡
5. **submit** —— 向注册表发起 PR

顺序就是关键所在。GitHub release 实际上是不可变的：注册表会锁定它的
sha256，所以覆盖字节会破坏所有已经安装该版本的人的校验和。因此本地关卡
**最先** 运行 —— 如果某个失败，就不会打包、打标签、推送或发布任何东西，
你可以修好它并对同一个版本重新运行。

而当 **后续** 某一步失败时 —— release 已经创建之后出现 preflight 或 PR 问题
—— `publish` 会精确回滚那一次运行所创建的东西：GitHub release、推送的
tag 和本地 tag，因此在你修好问题之后，同一个 tag 可以自由地再次使用。
任何在本次运行之前就已存在的东西都不会被触碰，`--keep-release` 可以
选择退出（此时错误信息会打印手动清理命令）。早先失败运行留下的 tag ——
一个没有 release 且不再指向 `HEAD` 的 tag —— 会被识别为残留物并
**移动到你当前的 commit**，而不是悄无声息地发布那个过时的版本。而对于你
已经陷入的搁浅状态，`trek-plugin unrelease <vX.Y.Z> --repo you/repo` 会
一次性删除该 release、远端 tag 和本地 tag —— 在检查已发布的注册表索引
并 **拒绝、且不提供覆盖选项地拒绝触碰一个实际已发布的版本** 之后（它的
产物是不可变的；请发布一个新版本）。

它会在最后打印 PR URL。在终端里它会 **提议对 release 签名**（如果你
还没有密钥，还会创建密钥）；脚本和 CI 永远不会被询问，它们传入 `--sign`。
`--no-checks` 跳过第 1 步，`--no-preflight` 跳过第 4 步 —— 这些是用于
重新运行的逃生舱，首次发布时绝不该用。它需要 `git` 和一个已认证的 `gh`。

下面那些单独的步骤仍然保留，供你想手工执行某一步时使用 —— `release`
（pack → GitHub release → entry）、`preflight` 和 `submit`（发起 PR）——
或者用 `entry --out registry/plugins/<id>.json` 写出文件并自己发起 PR。

## 1. 托管并构建你的插件

把你的插件放在一个 **公开的 GitHub 仓库** 里（约定：`trek-plugin-<id>`）。
`create-trek-plugin` 会搭出目录结构：

```bash
npx trek-plugin-sdk create flight-tracker --type widget   # integration | page | widget | trip-page
```

一个可发布的插件在仓库根目录有：

- `trek-plugin.json` —— 清单（见 [[插件开发|Plugin-Development]]）
- `package.json` —— CommonJS 标记（`"type": "commonjs"`），最多把 SDK 列为 devDependency
- `server/index.js` —— 构建后的服务端入口（必需）
- `client/` —— 构建后的前端（仅 `page`/`widget`/`trip-page` 插件需要）
- `README.md` —— 已填写完整，带一张真实的截图（质量关卡很严格 —— 见下文）
- `docs/screenshot.png` —— 商店卡片图片，需提交到仓库

`create` 给你的东西能运行也能打包，但它 **不能** 通过 `validate`：README
还是模板，也没有截图。这两样是只有你能写的东西。

## 2. 在本地调到绿灯

```bash
npx trek-plugin-sdk status         # where am I? what's left? — never fails
npx trek-plugin-sdk validate .     # the same checks, but it exits non-zero
```

`status` 和 `validate` 在两个不同深度上运行 **同一套注册表关卡**。
`status` 把它们按阶段（Manifest、Code、Docs、Release、Repo）分组打印成
检查清单，并指出下一步要运行的那一条命令；它用于定位，因此永不失败。
`validate` 才是关卡 —— 同样的检查，带退出码 —— 是供脚本和 CI 使用的形式。

它们一起能在 **离线** 状态下捕获注册表拒绝的几乎所有问题：

- 一个不是真实 lucide 名称的 `icon`（Tourism-Team 会静默回退到 `Blocks`，
  所以拼写错误在本地看不出来 —— 但 CI 会拒绝）
- README 缺少四个必需章节中的任何一个、仍带有脚手架占位符，或实际正文
  不足 **400 个字符**
- 缺少 `docs/screenshot.png` —— 注册表会在锁定的 commit 上获取 **正是这个
  路径**（商店卡片加载的就是它），所以 README 里指向任何其他图片名的链接
  都不算数；文件必须在那里
- 你的清单声明了某个权限，但 README 从未解释
- `name`、`description` 或 `author` 超出注册表的长度限制，或名称把拉丁字母
  与西里尔/希腊同形字符混在一起（同形异义字欺骗）
- `egress[]` 中的某个主机没有与之匹配的 `http:outbound:<host>` 权限 ——
  Tourism-Team 只用这些权限来构建网络白名单和 iframe CSP，从不读取
  `egress[]`，所以这样的主机在运行时是静默不可达的
- 一个 Tourism-Team 不认识的权限 —— SDK 和注册表 CI 都对照主机所执行的
  同一份 64 项列表来检查，因此拼错的权限会在这里失败，而不是在每个实例
  安装时失败（注册表里的那份是手动重新生成的快照，所以一个全新的
  Tourism-Team 权限可能会短暂地让注册表 CI 失败，即使 `validate` 接受它
  —— 那是快照滞后，不是拼写错误）

只有 **六个** 关卡真正需要网络，因为它们都无法从你的工作树中回答：该 tag
是否解析到条目所锁定的 commit、该 commit 处的清单是否与条目一致、该
commit 处的 README 是否仍然通过质量关卡、发布的产物能否下载并哈希到锁定
的 sha256（且能对你的密钥验证通过）、你的插件 id 是否没有绑定到另一个
GitHub 所有者，以及一次更新是否没有丢弃或轮换你已经在其下发布过的签名
密钥。它们在 `preflight` 中运行 —— 即 `publish` 的第 4 步。

### 抓取截图

```bash
npm i -D playwright && npx playwright install chromium   # once — not an SDK dependency
npx trek-plugin-sdk shot                                 # --dark for the dark theme
```

`shot` 启动开发服务器，在与 Tourism-Team 所用的同一个主题框架中渲染你的
插件，并写出 1600×900 的 `docs/screenshot.png`。`integration` 插件没有可
渲染的界面，所以 `shot` 帮不上忙 —— 改为对你的插件所改变的那部分
Tourism-Team 界面截图。

提交这张截图。注册表会在 **锁定的 commit 上** 解析它，因此一张只存在于你
工作树中的图片会导致 CI 失败，即便 `status` 是绿灯。

## 3. 打包

```bash
npx trek-plugin-sdk pack .                 # writes ./plugin.zip
npx trek-plugin-sdk pack . --out dist.zip  # custom output path
npx trek-plugin-sdk pack . --json          # machine-readable result
```

`pack` 按安装器的精确布局构建 `plugin.zip`，并打印你否则需要手工计算的
**sha256** 和 **大小**。它拒绝打包一个无法 *加载* 的插件 —— 清单损坏、
缺少 `server/index.js`、原生二进制文件 —— 但它刻意 **不** 强制执行发布
关卡（未写的 README、缺失的截图），因为打包也是你把插件侧载进本地
Tourism-Team 试用它的方式，而文档只需要在你发布时才到位。`validate` 才是
把关那些的东西。它只打包运行时需要的内容 —— `trek-plugin.json`、
`README.md`、`LICENSE`、`package.json`，以及 `server/` 和 `client/` 目录树
—— 并丢弃 `node_modules`、`.git`、source map 和 `.ts` 源文件。它 **拒绝
原生二进制文件**（`.node`、`binding.gyp`、`prebuilds/`），并执行与安装器
相同的体积限制（单文件 25 MB、总计 50 MB、4000 个条目）。

> **`docs/` 有意不打包。** 商店会在锁定的 commit 上直接从仓库获取你的
> `docs/screenshot.png`，所以把它保留在 GitHub 上但排除在 zip 之外 ——
> `pack` 会为你处理这件事。

`pack` 产出的 `plugin.zip` 也是用于 **侧载** 的产物：把它交给实例管理员
（或拖到 **管理 → 插件** 上）即可完全绕过注册表安装 —— 没有 PR、没有
审核、没有 SHA-256/签名锁定。侧载的插件会被如此标记并且永远不会自动
更新，所以下面的注册表 PR 仍然是你希望可被发现且可更新的任何东西的
正规途径。见 [[插件概览|Plugins]]。

## 4. 创建 GitHub release

打 tag `vX.Y.Z`，其中 `X.Y.Z` **等于** 你清单里的 `version`，并把打包好的
`plugin.zip` 作为发布附件上传：

```bash
gh release create v1.0.0 plugin.zip --repo you/trek-plugin-flight-tracker
```

优先使用上传的 `plugin.zip` 附件 —— 它就是你打包的那些确切字节，注册表
锁定的是它们的哈希。不要依赖 GitHub 自动生成的源码归档；它们不是安装器
布局，字节也不稳定。

## 5. 生成注册表条目

```bash
npx trek-plugin-sdk entry \
  --repo you/trek-plugin-flight-tracker \
  --tag v1.0.0 \
  --out registry/plugins/flight-tracker.json
```

`entry` 读取你的清单和 `plugin.zip` 并生成完整条目 ——
推导出 `commitSha`（来自 `git rev-parse <tag>^{commit}`）、`downloadUrl`、
`sha256`、`size`、`apiVersion`，以及 **`trek`** —— 即你清单中的范围，
原样照搬。该范围是条目唯一的兼容性字段：Tourism-Team 正是用它来把守安装
和激活。（较早的 `minTrekVersion`/`maxTrekVersion` 已 **弃用** 且不再生成
—— 前者只是重述了该范围的下界，后者是 *包含式* 的，因此根本无法表达
`<4.0.0`。在 `trek` 存在之前发布的条目可能仍带有它们。）`entry` 拒绝为
一个没有可用 `trek` 范围的清单构建条目，因为 Tourism-Team 会拒绝安装它。
参数：`--zip`（默认 `plugin.zip`）、`--commit <sha>` 用于覆盖 commit 解析、
`--asset` 用于指定名字不同的发布附件、`--merge` 用于更新（见下文），
`--out` 用于写出文件。

### 一次搞定：`release`

```bash
npx trek-plugin-sdk release . --repo you/trek-plugin-flight-tracker --tag v1.0.0
```

`release` 一次完成 **pack → `gh release create` → entry**，并把条目打印到
stdout。它接受 `--out`、`--notes`、`--commit` 和 `--merge`。（它需要已认证
的 `gh` CLI。）

## 6. Preflight —— 需要 release 已存在的那些检查

在你发起 PR 之前，针对你已推送的 release 运行注册表其余的 CI 检查，这样
你就能在不经一轮审核往返的情况下捕获 CI 会拒绝的问题：

```bash
npx trek-plugin-sdk preflight --repo you/trek-plugin-flight-tracker --tag v1.0.0
```

`preflight` 会运行 `validate` 运行的一切，外加那六个真正需要网络的关卡：
tag 解析到锁定的 `commitSha`；该 commit 处的 **清单** 与条目一致；该 commit
处的 **README** 通过质量关卡；发布的产物可以下载、哈希到锁定的 **sha256**、
不携带 **原生二进制文件**，并且能对你的密钥验证通过；你的插件 id 没有绑定
到另一个 GitHub 所有者；以及一次更新没有丢弃或轮换你已经在其下发布过的
签名密钥（`--allow-key-change` 声明这是一次有意的轮换 —— 见「轮换你的
签名密钥」）。

*在该 commit 上* 重新评定清单和 README 与本地那一遍并不重复：一个写了
README 却忘记提交的作者，有着绿灯的工作树和红灯的 tag，而 CI 评定的正是
tag。`--entry <file.json>` 检查一份手写的条目，`--all` 检查每个版本而不只是
最新的那个。绿灯的 preflight 预示着绿灯的 CI。

## 7. 发起注册表 PR

快速路径 —— `submit` 为你完成整套 fork/分支/提交/PR 流程：

```bash
npx trek-plugin-sdk submit --repo you/trek-plugin-flight-tracker --tag v1.0.0
```

它会 fork [TREK-Plugins](https://github.com/bhxnms/T-T-Plugins)（仅一次）、
**从注册表快进你的 fork**（已分叉的 fork 会发出警告并给出用于重置的
`gh repo sync --force` 命令，随后 submit 继续）、从注册表当前的 `main` 分出新
分支、写入（更新时则是合并进）`registry/plugins/<id>.json`、推送，并创建 PR
—— 打印它的 URL。加上 `--draft` 创建草稿 PR，`--registry <owner/name>` 指定
镜像。（需要已认证的 `gh`。）

**改用手工：** fork 注册表，把你生成的文件添加为
`registry/plugins/<id>.json`，并向 `main` 发起 PR。**只** 添加那个文件 ——
`dist/` 在合并时生成，CI 会拒绝手动编辑它。

条目遵循 [`schema/plugin-entry.schema.json`](https://github.com/bhxnms/T-T-Plugins/blob/main/schema/plugin-entry.schema.json)；
[`schema/example-entry.json`](https://github.com/bhxnms/T-T-Plugins/blob/main/schema/example-entry.json)
是标准形态。`size` 是 **必填** 的（常见的遗漏项），`commitSha`、
`downloadUrl`、`sha256`、`trek`、`apiVersion`，以及每个版本上的
`nativeModules: false` 也都是 —— 所有这些 `trek-plugin entry` 都会为你
填好。CI 会拒绝 `trek` 与 `commitSha` 处清单不一致的条目（以及对于仍带有
`minTrekVersion` 的旧式条目，其下界与该范围不一致的条目）。

## CI 强制执行什么

CI 会对每一个被改动的 `registry/plugins/*.json` 运行
`scripts/validate-entry.mjs` 和 `scripts/check-readme.mjs`。下文几乎每条规则
都是你的 `trek-plugin.json` 和 `README.md` 的纯函数，因此
`trek-plugin validate` 在你打任何 tag 之前就能离线检查它 —— 你绝不该从 CI
那里才第一次知道这些。

**条目**（`validate-entry.mjs`）：schema 有效 · `id` 与文件名及 slug 模式
`^[a-z][a-z0-9-]{2,39}$` 匹配，且不是保留 id `registry`/`install`/`rescan`
（它们与管理 API 路由段冲突 —— CI 和安装加载器都会拒绝它们）· 你的 `id`
在首次注册时绑定到你的 GitHub 所有者，因此之后没人能重新指向它（所有者
变更需要维护者覆盖）· 同形异义字/混合文字名称检查 · `versions[]` 按最新在
前排序 · release tag 存在
且解析到 `commitSha` · 该 commit 处的清单一致性（`id`、`version`、
`type`、`apiVersion` 必须一致，且 `nativeModules` 不得为 `true`）· 声明的
每个权限都在 Tourism-Team 的已知权限列表上（或是一个有效的
`http:outbound:<host>`）· **下载产物的 SHA-256 与锁定值匹配**，且其大小在
范围内 · 归档中 **没有原生二进制文件** · 声明了 `http:outbound` 时
`egress[]` 存在（且没有裸 `*`）。

**README**（`check-readme.mjs`，在锁定的 commit 上获取）：必须存在于仓库
根目录，包含 **What it does / Screenshots / Permissions / Setup** 章节，
并且 **`docs/screenshot.png` 在该 commit 上必须解析为一张真实图片** ——
该关卡获取的正是这个路径，因为商店卡片加载的就是它；README 链接到其他
图片名不满足要求。README 还必须有真实正文（剥离标题/代码/图片/表格后
**≥ 400 个字符**）、不含遗留的脚手架占位符，并且 **解释你的清单声明的
每一个权限**（每个权限字符串都必须出现在 README 中）。

## 来源与完整性

- `commitSha` 锁定维护者所审核的确切源码（git tag 是可移动的）。
- `sha256` 锁定 Tourism-Team 将要运行的确切产物字节（发布附件是可变的）。

Tourism-Team 会用 `sha256` 校验下载的字节，并在不匹配时拒绝安装。条目上的
`reviewedAt` 日期意味着某位维护者看过那个确切的 commit —— 它 **不是** 一项
持续有效的保证。`reviewedAt` 和 `boundOwner` 由 CI 在合并时维护；不要自己
设置它们。

## 为你的 release 签名（可选，推荐）

`sha256` 证明字节是 *注册表* 所担保的那些。作者签名则进一步证明这些字节
是由 **你** 签名的，这样即使注册表被攻陷，也无法以你的名义发布攻击者的
代码。条目 schema 允许两个可选字段 —— 条目上的 `authorPublicKey` 和每个
版本上的 `signature`。Tourism-Team 离线验证签名（minisign / Ed25519，无需
外部服务），并在首次安装时锁定你的密钥（首次使用即信任）：之后用不同
密钥签名的 release 会被拒绝，直到管理员重新信任它。

**省事的方式 —— 让 SDK 来做**（无依赖的 Ed25519，不需要 minisign）。
在终端里，`publish` 会 **提议签名**：它解释其中的取舍，如果你没有密钥则
提议创建，然后签名。你完全不必知道 `keygen` 或 `--sign` 的存在。脚本和 CI
永远不会被询问 —— 它们传入 `--sign`：

```bash
npx trek-plugin-sdk publish --repo you/repo --tag v1.2.0 --sign
```

`--sign` 会对确切的产物字节签名，并为你填好 `authorPublicKey`（条目）和
`signature`（版本）。如果该插件此前已以签名方式发布，`publish` 会在第 1 步
**拒绝一次未签名的发布** —— 并且自 SDK 1.7.0 起，如果一个发布的签名密钥
*身份* 与已发布的 `authorPublicKey` 不同，也会被拒绝 —— 在打包、打标签或
发布任何东西之前就拒绝，因为 GitHub release 不可变，到第 4 步才发现这点
会白白烧掉那个 tag。**请备份 `~/.trek-plugin/signing.key`** —— 丢失它意味着
一次完整的密钥轮换（见下文），会让每一个安装都陷于搁浅，直到其管理员
重新信任你。

**如果你更偏好手工用 minisign：**

```bash
minisign -G            # writes minisign.key (keep secret) + minisign.pub
```

把 `minisign.pub` 中的 base64 载荷行作为 `authorPublicKey` 放进你的条目
（跨版本稳定），然后每次发布：

```bash
minisign -Sm plugin.zip   # writes plugin.zip.minisig
```

把 `plugin.zip.minisig` 中的 base64 行作为 `signature` 加进该版本，
放在它的 `sha256` 旁边：

```jsonc
{
  "id": "flight-tracker",
  "authorPublicKey": "RWQ…base64 minisign public key…",
  "versions": [{
    "version": "1.2.0",
    "sha256": "3b2a…",
    "signature": "RUR…base64 .minisig payload…"
  }]
}
```

签名是 **可选启用** 的，而且是一扇你可以 **很晚** 才走过的单向门。没有
`authorPublicKey`/`signature` 的条目仅凭 `sha256` 就能安装；**未签名 →
之后签名不会破坏任何人的东西**，因为在一个签名版本安装之前没有任何东西
被锁定 —— 在 v1.4.0 添加密钥是一个真实可行的选择，而不是无法挽回的事。
一旦你的密钥出现在条目中，注册表确实要求每个版本都已签名，而 SDK 会
为你处理：你的第一次签名更新会 **回溯签署较旧的版本**（每个被锁定的
产物都会被下载、对其 `sha256` 验证，并用同一把密钥签名 —— 字节不匹配
会被拒绝，因为那个产物已不再与其锁定值相符）。你永远无法做的是回头：
一旦某个插件已以签名方式发布，一个 *未签名* 的更新会在所有已安装它的
实例上被拒绝（`SIGNATURE_MISSING`），而一次密钥 *轮换* 需要注册表维护者
覆盖（`allow-key-change`）外加每个实例上的管理员重新信任 —— 见下一节。
所以你想什么时候签名都行 —— 但要备份密钥。

### 轮换你的签名密钥

轮换 —— 密钥丢失、机器被攻陷、有计划的卫生措施 —— 是唯一有受认可路径的
签名变更，而且自 SDK 1.7.0 起 SDK 驱动了它产物那一半的全部工作。两种流程，
一条规则：被轮换的条目必须用新密钥 **重新签署每一个** 版本，因为
Tourism-Team 无论安装哪个版本，都是对照条目中那唯一一个 `authorPublicKey`
来验证的。

**不发布新版本：**

```bash
npx trek-plugin-sdk rotate-key            # from the plugin dir; --id <plugin-id> from elsewhere
# --key <file> for a key not at ~/.trek-plugin/signing.key
# --out entry.json writes the rotated entry for a hand-made PR instead of opening one
```

它会获取你已发布的注册表条目、下载每一个被锁定的产物、逐个对照其锁定的
`sha256` 验证、用新密钥重新签署全部（全有或全无 —— 一个无法获取或被篡改
的产物会中止整个轮换）、替换 `authorPublicKey`，并创建标题标明为轮换的
注册表 PR。（如果密钥只是 *丢失* 了，先跑 `keygen` —— 默认路径又空出来了。
仍在磁盘上的 *被攻陷* 密钥需要为新密钥指定 `--key`；`keygen` 会拒绝覆盖。）

**作为一次发布的一部分：**

```bash
npx trek-plugin-sdk publish --repo you/repo --tag v1.3.0 --sign --allow-key-change
```

第 1 步接受新密钥，更新会合并到你现有的条目上，较旧的版本在新密钥下被
重新签署，且 PR 标题带上「(key rotation)」。同样的 `--allow-key-change`
参数也存在于 `entry`/`preflight`/`submit`/`release` 上，供手工组装的流程
使用。

无论哪种方式，SDK 只能完成产物那一半。PR 正文会把其余部分明说出来，而
没有哪一步只是走形式：

1. **注册表维护者** 必须打上 `allow-key-change` 标签 —— CI 会拒绝在没有它
   的情况下更改 `authorPublicKey`，且作者无法自行添加该标签；
2. **每一位已安装该插件的管理员** 都会看到
   `SIGNATURE_KEY_CHANGED`（带两个密钥指纹，以便与你带外核对新密钥），
   并且必须重新信任新密钥，他们的实例才会收到下一次更新。

没有 `--allow-key-change`，不一致的密钥在任何地方仍会被拒绝 —— 这是有意
的，因为这件事的 *意外* 版本（从第二台机器发布，而它新生成的密钥并非你
原先发布时所用的那把）想要的是恢复原密钥，而不是轮换。

## 更新

在清单中提升 `version`、提交，然后用新的 tag 再次运行 `publish` —— 它会
检测到已有条目并把新版本前置（最新在前）。手工方式：重新 `pack`、创建新的
`vX.Y.Z` release，然后用 `--merge` 把新版本并入你现有的条目：

```bash
npx trek-plugin-sdk entry --repo you/trek-plugin-flight-tracker --tag v1.1.0 \
  --merge registry/plugins/flight-tracker.json \
  --out registry/plugins/flight-tracker.json
```

`--merge` 会前置新版本（保持数组最新在前）并保留条目其余部分。对更新后的
文件发起 PR。各实例会在下一次轮询注册表时看到更新；应用它始终是一项显式
的管理员操作，而如果新版本请求 **更多** 权限，管理员必须重新批准 —— 见
[[插件权限|Plugin-Permissions]]。
