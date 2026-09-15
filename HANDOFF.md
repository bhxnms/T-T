# TT Travel Planner - 项目接手文档

**文档日期**: 2026-09-16  
**项目版本**: v0.2.1  
**当前分支**: main  
**仓库地址**: https://github.com/bhxnms/T-T.git

---

## 📋 项目概述

TT Travel Planner 是一个自托管的旅行规划平台，基于原 TREK 项目深度定制开发。项目采用 React 19 + Node.js + SQLite 技术栈，支持实时协作、离线优先、地图可视化等核心功能。

### 技术栈
- **前端**: React 19, Vite, Zustand, Tailwind CSS, Leaflet/Mapbox GL
- **后端**: Node.js, Express, NestJS, TypeORM, SQLite
- **部署**: Docker, docker-compose
- **CI/CD**: GitHub Actions

---

## 🚧 当前状态与待解决问题

### ⚠️ 紧急问题 - GitHub Actions Security Scan 失败

**错误位置**: `.github/workflows/security.yml` - Docker Scout 步骤

**错误信息**:
```
Error: Unable to resolve action `aquasecurity/trivy-action@0.28.0`, 
unable to find version `0.28.0`
```

**问题原因**: 
GitHub Actions 工作流引用的 `aquasecurity/trivy-action` 版本 `0.28.0` 不存在或已被移除。

**解决方案**:
1. 检查 `aquasecurity/trivy-action` 的最新稳定版本
2. 更新 `.github/workflows/security.yml` 中的版本号
3. 或者考虑完全移除 trivy-action，仅使用 Docker Scout

**相关文件**:
- `.github/workflows/security.yml`
- 可能还需要检查其他工作流文件是否有类似问题

---

## 🎯 最近完成的工作 (v0.2.1)

### 1. Atlas 地标系统
**实现时间**: 2026-09-15 至 2026-09-16

**核心功能**:
- 34个中国省级行政区数据
- 200+ 代表性地标数据
- 20种地标分类图标系统
- 地标打卡功能（localStorage持久化）
- 地标淡入动画效果

**关键文件**:
```
client/src/data/chinaProvinces.ts          # 省份和地标数据
client/src/utils/landmarkIcons.ts          # 图标系统
client/src/utils/landmarkStorage.ts        # 打卡存储
client/src/pages/atlas/LandmarkPopup.tsx   # 地标弹窗
client/src/pages/atlas/useAtlas.ts         # Atlas 核心逻辑
```

**实现细节**:
- 地标标记使用 `L.divIcon` 渲染为彩色圆点
- 已打卡地标有白色光晕效果
- 缩放时地标淡出，稳定后淡入（防止抖动）
- 地标数据存储格式: `{ landmarkId: timestamp }`

### 2. 图标系统差异化
**实现时间**: 2026-09-15

**目标**: 与原 TREK 项目视觉区分

**实现方式**:
- 创建独立的图标配置系统
- 图标描边从 2.0 增加到 2.5
- 5种图标尺寸类别：activity, inline, action, decorative, toggle

**关键文件**:
```
client/src/components/Activities/iconConfig.ts
client/src/components/Activities/*.tsx (所有组件已更新)
```

### 3. 地理定位功能
**实现时间**: 2026-09-15

**功能**:
- 首次访问 Atlas 页面请求用户位置权限
- 自动判断用户是否在中国境内（纬度18-54°, 经度73-135°）
- 中国境内用户: 以用户位置为中心, zoom=5
- 中国境外用户: 以北京为中心, zoom=4
- 位置缓存到 localStorage

**关键文件**:
```
client/src/utils/geolocation.ts
client/src/pages/atlas/useAtlas.ts (集成代码)
```

### 4. README 重写
**实现时间**: 2026-09-16

**变更**:
- 移除所有原作者（TREK项目）信息
- 更新为 TT 项目独立介绍
- 添加 v0.2.1 更新日志
- 更新版本徽章

---

## ⚠️ 已知问题

### 1. 地标功能未生效（用户反馈）

**症状**:
用户测试时反馈以下功能未生效：
1. 省份名称仍显示英文（预期在中国区域内只显示中文）
2. 点击地标仍弹出省份信息（预期弹出地标详情）

**可能原因**:
1. **缓存问题**: 浏览器缓存了旧版本的 JavaScript
2. **构建问题**: Vite 构建可能未包含最新代码
3. **代码逻辑问题**: 
   - 地标图层可能被省份图层遮挡
   - 事件监听器注册顺序问题
   - z-index 层级问题

**调试步骤**:
```bash
# 1. 清理缓存并重新构建
cd /home/administrator/T-T-test/client
rm -rf dist node_modules/.vite
npm run build

# 2. 启动开发服务器测试
npm run dev

# 3. 在浏览器中:
# - 打开开发者工具 (F12)
# - 访问 /atlas 页面
# - 查看 Console 是否有错误
# - 检查 Network 标签页，确认加载的是新版本 JS
# - 在 Console 中运行: localStorage.getItem('trek_visited_landmarks')
```

**需要检查的代码位置**:
```typescript
// client/src/pages/atlas/useAtlas.ts

// 1. 确认地标图层的 z-index 是否高于省份图层
const landmarkMarker = L.marker([landmark.lat, landmark.lng], {
  icon: landmarkIcon,
  // 可能需要添加 zIndexOffset
  zIndexOffset: 1000  // 确保地标在省份之上
})

// 2. 确认事件监听器注册
landmarkMarker.on('click', (e) => {
  L.DomEvent.stopPropagation(e)  // 阻止事件冒泡
  setSelectedLandmark(landmarkData)
})

// 3. 确认省份中文显示逻辑
// 查找 country tooltip/popup 渲染位置
// 应该根据地理位置判断语言
```

### 2. 省份中文名称显示

**当前状态**: 已创建 `chinaProvinceLabels.ts` 但可能未正确集成

**文件位置**: `client/src/utils/chinaProvinceLabels.ts`

**集成检查点**:
1. 确认 `useAtlas.ts` 中是否导入并使用了此文件
2. 确认地图 tooltip 渲染逻辑是否调用了中文名称函数
3. 确认地理边界判断逻辑是否正确

---

## 🔧 项目结构

### 核心目录
```
T-T-test/
├── client/                    # React 前端
│   ├── src/
│   │   ├── components/        # React 组件
│   │   │   ├── Activities/    # 活动组件 (新增)
│   │   │   ├── Map/          # 地图组件
│   │   │   └── ...
│   │   ├── data/             # 静态数据
│   │   │   └── chinaProvinces.ts  # 省份地标数据 (新增)
│   │   ├── pages/            # 页面组件
│   │   │   └── atlas/        # Atlas 相关 (新增)
│   │   ├── utils/            # 工具函数
│   │   │   ├── geolocation.ts      # 定位工具 (新增)
│   │   │   ├── landmarkIcons.ts    # 地标图标 (新增)
│   │   │   └── landmarkStorage.ts  # 地标存储 (新增)
│   │   └── ...
│   └── package.json
├── server/                   # Node.js 后端
│   └── src/
├── shared/                   # 共享类型和工具
├── .github/                  # GitHub Actions
│   └── workflows/
│       └── security.yml      # ⚠️ 当前失败
├── docker-compose.yml
├── Dockerfile
└── README.md                 # 已更新

```

### 关键配置文件
```
client/CLAUDE.md              # 客户端开发指南
server/CLAUDE.md              # (可能不存在)
CLAUDE.md                     # 已删除 (v0.2.1)
package.json                  # Monorepo 根配置
```

---

## 🚀 开发命令

### 本地开发
```bash
# 安装依赖
npm install

# 启动开发服务器 (前端+后端)
npm run dev

# 仅启动前端
cd client && npm run dev

# 仅启动后端
cd server && npm run dev

# 类型检查
npm run typecheck

# 代码检查
npm run lint

# 运行测试
npm test
```

### 构建与部署
```bash
# 构建前端
cd client && npm run build

# 构建后端
cd server && npm run build

# Docker 构建
docker build -t tt-planner:0.2.1 .

# Docker Compose 启动
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### Git 工作流
```bash
# 当前在 main 分支
git status

# 创建新功能分支
git checkout -b feature/your-feature

# 提交代码
git add .
git commit -m "feat: your feature description

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"

# 推送
git push origin feature/your-feature

# 合并到 main
git checkout main
git merge feature/your-feature --no-ff
git push origin main
```

---

## 📝 待办事项清单

### 🔴 高优先级
- [ ] **修复 GitHub Actions security.yml** - 更新 trivy-action 版本或移除
- [ ] **调试地标显示问题** - 地标点击未触发弹窗
- [ ] **调试中文名称显示** - 省份名称仍显示英文
- [ ] **测试地理定位功能** - 确认权限请求流程

### 🟡 中优先级
- [ ] 实现省份到城市级别的细分显示
- [ ] 实现城市级别的访问标记
- [ ] 实现地标心愿单功能
- [ ] 优化地标图标在移动端的显示
- [ ] 添加地标搜索功能

### 🟢 低优先级
- [ ] 优化地标数据加载性能
- [ ] 添加地标分类筛选器
- [ ] 实现地标路线规划
- [ ] 添加地标照片上传功能
- [ ] 多语言支持扩展

---

## 🐛 调试技巧

### 前端调试
```javascript
// 在浏览器 Console 中检查地标存储
localStorage.getItem('trek_visited_landmarks')

// 检查地标图层是否存在
// 在 useAtlas.ts 中添加:
console.log('Landmark layer created:', landmarkLayerRef.current)
console.log('Map zoom level:', map.getZoom())

// 检查点击事件
landmarkMarker.on('click', (e) => {
  console.log('Landmark clicked:', landmark.name)
  console.log('Event:', e)
})
```

### 后端调试
```bash
# 查看后端日志
cd server && npm run dev

# 检查数据库
sqlite3 data/trek.db
.tables
.schema trips
.exit
```

### Docker 调试
```bash
# 进入容器
docker-compose exec app sh

# 查看日志
docker-compose logs app

# 检查文件
docker-compose exec app ls -la /app
```

---

## 📚 重要参考资料

### 外部依赖文档
- [Leaflet 文档](https://leafletjs.com/reference.html)
- [React 19 文档](https://react.dev/)
- [Zustand 文档](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [Tailwind CSS](https://tailwindcss.com/docs)

### 项目特定资源
- 原项目 README (已移除，可查看 Git 历史)
- `client/CLAUDE.md` - 客户端开发规范
- `client/src/pages/PATTERN.md` - 页面组件模式

### Git 历史关键提交
```bash
# 查看最近的重要提交
git log --oneline --graph -20

# 查看 v0.2.1 的完整变更
git show f0e8036c

# 查看地标系统的引入
git log --grep="landmark"

# 查看 README 变更历史
git log -- README.md
```

---

## 💡 代码约定

### 命名规范
- 组件文件: `PascalCase.tsx`
- 工具函数文件: `camelCase.ts`
- 类型定义: `PascalCase` (interface/type)
- 常量: `UPPER_SNAKE_CASE`
- 函数: `camelCase`

### 组件结构
```typescript
// 推荐的组件结构
export default function ComponentName() {
  // 1. Hooks
  const { t } = useTranslation()
  const [state, setState] = useState()
  
  // 2. 派生状态
  const derived = useMemo(() => ...)
  
  // 3. 事件处理
  const handleClick = () => { ... }
  
  // 4. Effects
  useEffect(() => { ... }, [])
  
  // 5. 渲染
  return <div>...</div>
}
```

### 提交信息规范
```
<type>(<scope>): <subject>

<body>

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

类型:
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式
- `refactor`: 重构
- `test`: 测试
- `chore`: 构建/工具

---

## 🔐 敏感信息

### 环境变量
项目使用 `.env` 文件管理环境变量，关键变量包括：
- `ENCRYPTION_KEY`: 数据加密密钥
- `ADMIN_EMAIL`: 初始管理员邮箱
- `ADMIN_PASSWORD`: 初始管理员密码

**⚠️ 注意**: 绝不提交 `.env` 文件到 Git

### API 密钥
地图功能需要以下 API 密钥：
- Mapbox Token
- 高德地图 API Key (如使用)
- CARTO API Key (如使用)

配置位置: 用户设置 > 地图设置

---

## 📞 联系与交接

### 项目背景
- 基于开源项目 TREK 深度定制
- 所有原作者信息已移除
- 项目独立维护和发展

### 最后已知状态
- **最后工作日期**: 2026-09-16
- **最后工作内容**: 修复 GitHub Actions, 推送 v0.2.1 到 main 分支
- **Git 提交**: f0e8036c
- **工作分支**: main

### 下一步建议
1. 立即修复 GitHub Actions security scan 问题
2. 本地测试地标功能，收集详细的调试日志
3. 如地标功能确实未生效，逐个检查上述"已知问题"部分的检查点
4. 考虑添加更多的调试日志到 `useAtlas.ts`

---

**文档结束**

如有任何问题，请参考项目代码和 Git 历史记录获取更多上下文。
