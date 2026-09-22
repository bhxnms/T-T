# 参与贡献

感谢你有兴趣为 Tourism-Team 做贡献！以下是提交 pull request 的指引。

## 开始之前

- **先查看仓库讨论** —— 写代码前先查找现有 issue 或讨论，说明改动目标和范围，先确认实现方向。绕过项目 issue/讨论流程的 PR 可能会被关闭
- **查看已有 issue** —— 动手前先找找开放的 issue 或讨论
- **以 `dev` 分支为目标** —— 所有 PR 都必须针对 `dev` 而不是 `main` 发起。例外：只修改 `wiki/` 下文件的 PR 可以针对任意分支
- **一个 PR 只做一件事** —— 让 PR 聚焦于单个改动。不要捆绑无关的修复

## Pull Request 指引

### 代码质量

- 编写干净、可读、与现有风格一致的代码
- 不要不必要的抽象或过度设计
- 不要添加 issue 中未讨论过的功能
- 除非逻辑不是一目了然，否则不要加注释
- 不要为不可能发生的场景添加错误处理

### 我们看重什么

- **它解决了所述问题吗？** —— PR 应当与它所对应的 issue 相符
- **它是最小改动吗？** —— 不要额外重构，不要「顺便改一下」
- **它破坏了什么东西吗？** —— 破坏性变更不可接受
- **代码干净吗？** —— 风格一致，没有调试日志，没有死代码

### 提交信息

使用约定式提交（conventional commits）：
```
fix(component): short description of what was fixed
feat(component): short description of new feature
```

### PR 描述

遵循默认提供的模板（.github/PULL_REQUEST_TEMPLATE.md）。

### 什么会导致你的 PR 被关闭

- 没有先经过项目 issue/讨论流程的 PR
- 增加不必要复杂度的 PR（例如在已有撤销功能时再加一个重做按钮）
- 带有破坏性变更的 PR
- 在无关文件中更改代码风格或格式的 PR
- 无正当理由添加依赖的 PR

## 开发环境搭建

完整的搭建指引见 [[开发环境|Development-environment]]，包括 fork、远程仓库配置、分支约定和可用脚本。

## 技术栈

| 层 | 技术                                                                                |
|---|-------------------------------------------------------------------------------------------|
| 前端 | React 19, TypeScript, Zustand 5, Leaflet, Tailwind CSS 3.4, Vite 8 (Rolldown)             |
| 后端 | NestJS 11 (Express 4 adapter), TypeScript, better-sqlite3, Zod (@trek/shared)             |
| 实时通信 | WebSocket (ws)                                                                            |
| 数据库 | SQLite（WAL 模式）                                                                         |
| 认证 | JWT (HS256), bcrypt, TOTP MFA, OIDC                                                       |
| 地图 | Leaflet + react-leaflet（默认，通过 maplibre-gl-leaflet 使用 OpenFreeMap 矢量底图）, MapLibre GL, Mapbox GL, OSRM, Nominatim |
| 国际化 | 23 种语言，以 EN 为准（语言目录位于 shared/src/i18n/）                                      |

每个翻译键都必须存在于全部 23 个语言目录中 —— `i18n Key Parity` CI 任务会在出现偏差时失败，所以推送前请先运行 `npm run i18n:parity:strict --workspace=shared`。有两个目录名与其承载的语言不一致：巴西葡萄牙语是 `br`，希腊语是 `gr`。
