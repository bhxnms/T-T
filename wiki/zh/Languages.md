# 语言

Tourism-Team 内置 23 种语言的翻译。你可以随时切换语言，无需退出登录。

## 支持的语言

| 代码 | 语言 |
|------|----------|
| `de` | Deutsch |
| `en` | English |
| `es` | Español |
| `fr` | Français |
| `hu` | Magyar |
| `nl` | Nederlands |
| `br` | Português (Brasil) |
| `cs` | Česky |
| `pl` | Polski |
| `ru` | Русский |
| `zh` | 简体中文 |
| `zh-TW` | 繁體中文 |
| `it` | Italiano |
| `tr` | Türkçe |
| `ar` | العربية |
| `id` | Bahasa Indonesia |
| `ja` | 日本語 |
| `ko` | 한국어 |
| `uk` | Українська |
| `gr` | Ελληνικά |
| `sv` | Svenska |
| `vi` | Tiếng Việt |
| `ca` | Català |

## 从右到左（RTL）支持

阿拉伯语（`ar`）使用从右到左的布局。其他所有语言均使用从左到右。

## 语言是如何确定的

Tourism-Team 按以下顺序解析显示语言：

1. **用户偏好** —— 保存在你的账户里的语言（在「设置 → 显示」中设置）。
2. **浏览器语言** —— 浏览器上报的 `navigator.languages`（以及 `navigator.language`）。
3. **服务器默认值** —— 管理员设置的 `DEFAULT_LANGUAGE` 环境变量。
4. **兜底** —— 英文（`en`）。

## 语言选择器的出现位置

- **登录 / 注册页面** —— 在你登录之前。
- **设置 → 显示** —— 在你登录之后。见 [常规设置](Display-Settings)。
- **公开分享页面** —— 旅行分享链接。
- **公开旅程页面** —— 面向公众的旅程视图。

> **管理员：** `DEFAULT_LANGUAGE` 环境变量设定登录页面以及未登录用户看到的兜底语言。见 [环境变量](Environment-Variables)。

## 参见

- [常规设置](Display-Settings)
- [环境变量](Environment-Variables)
- [用户设置](User-Settings)
