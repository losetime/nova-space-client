# 星瞰 🛰️

一个现代化的航天信息综合平台，提供卫星数据可视化、航天科普、航天情报等功能。

## 项目简介

星瞰 是一个全栈 Web 应用，旨在为航天爱好者提供一站式的航天信息服务。通过 Cesium 3D 地球可视化技术，用户可以实时查看卫星位置和轨道；同时平台还提供丰富的航天科普内容和行业情报。

## 技术栈

### 前端

- **框架**: Vue 3 + TypeScript
- **构建工具**: Vite
- **UI 框架**: TailwindCSS + DaisyUI + Ant Design Vue
- **状态管理**: Pinia
- **3D 可视化**: Cesium
- **HTTP 客户端**: Axios
- **实时通信**: WebSocket
- **Markdown 渲染**: marked

### 后端

- **框架**: NestJS + TypeScript
- **数据库**: PostgreSQL
- **认证**: JWT + Passport
- **卫星计算**: satellite.js
- **实时通信**: WebSocket (ws)

## 项目结构

```
nova-space/
├── frontend/              # Vue 3 前端
│   ├── src/
│   │   ├── api/           # API 服务层
│   │   ├── components/    # 公共组件
│   │   ├── hooks/         # 组合式函数
│   │   ├── router/        # 路由配置
│   │   ├── stores/        # Pinia 状态管理
│   │   └── views/         # 页面组件
│   └── vite.config.ts
├── backend-nest/          # NestJS 后端
│   └── src/
│       ├── modules/
│       │   ├── auth/      # 认证模块
│       │   ├── user/      # 用户模块
│       │   ├── points/    # 积分模块
│       │   ├── subscription/ # 订阅模块
│       │   ├── satellite/ # 卫星模块
│       │   ├── education/ # 科普模块
│       │   ├── intelligence/ # 情报模块
│       │   ├── feedback/  # 意见反馈模块
│       │   └── notification/ # 通知模块
│       └── main.ts
└── docs/                  # 项目文档
```

## 功能模块

### ✅ 已实现功能

#### 用户系统

- [x] 用户注册 / 登录
- [x] JWT 认证
- [x] 个人信息管理
- [x] 密码修改

#### 卫星数据

- [x] 实时卫星位置推送 (WebSocket)
- [x] Cesium 3D 地球可视化
- [x] 卫星列表展示
- [x] 卫星轨道计算与显示
- [x] 卫星标签显示（点击卫星显示名称和轨道）
- [x] 轨道位置预测（基于TLE计算未来轨道）
- [x] 卫星过境预测（预测卫星经过观测点的时间、方位角、仰角）

#### 空间天气

- [x] 空间天气数据展示（太阳风、X射线通量、地磁指数）
- [x] 空间天气预警列表
- [x] X射线通量图表（ECharts）
- [x] 预警详情弹窗（中文翻译）

#### 航天科普

- [x] 科普文章列表
- [x] 文章详情页
- [x] 文章收藏 / 取消收藏
- [x] 每日问答功能
- [x] 答题积分奖励

#### 航天情报

- [x] 情报列表（支持分类筛选）
- [x] 情报详情页
- [x] 热门情报排行
- [x] 情报收藏 / 取消收藏
- [x] 我的收藏列表

#### 个人中心

- [x] 每日签到
- [x] 积分统计
- [x] 积分历史记录
- [x] 签到天数统计
- [x] 我的收藏

#### 通知系统

- [x] 通知列表展示
- [x] 未读数量显示
- [x] 标记已读 / 全部已读

#### 意见反馈

- [x] 反馈提交（问题/建议/其他）
- [x] 反馈状态跟踪

### 🚧 待实现功能

#### 卫星数据模块

- [ ] 多维度卫星查询（搜索/筛选）
- [ ] 发射任务查询
- [ ] 卫星数据关联分析
- [ ] 数据对比功能

#### 航天科普模块

- [ ] 用户投稿功能
- [ ] 内容分享

#### 航天情报模块

- [ ] 情报推送通知

#### 个人中心模块

- [ ] 成就系统
- [ ] 关注与动态

#### 空间天气模块

- [ ] 预警订阅推送

## 快速开始

### 环境要求

- Node.js >= 18
- PostgreSQL >= 14
- pnpm 或 npm

### 后端启动

```bash
cd backend-nest

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库连接

# 启动开发服务器
pnpm run start:dev
```

### 前端启动

```bash
cd frontend

# 安装依赖
pnpm install

# 启动开发服务器
pnpm run dev
```

### 访问地址

- 前端: http://localhost:5174
- 后端 API: http://localhost:3001/api
- WebSocket: ws://localhost:3001

## API 文档

### 认证相关

| 方法 | 路径               | 描述         |
| ---- | ------------------ | ------------ |
| POST | /api/auth/register | 用户注册     |
| POST | /api/auth/login    | 用户登录     |
| GET  | /api/auth/profile  | 获取当前用户 |

### 用户相关

| 方法 | 路径                   | 描述         |
| ---- | ---------------------- | ------------ |
| GET  | /api/users/me          | 获取用户信息 |
| PUT  | /api/users/me          | 更新用户信息 |
| PUT  | /api/users/me/password | 修改密码     |

### 卫星相关

| 方法 | 路径                              | 描述               |
| ---- | --------------------------------- | ------------------ |
| GET  | /api/satellites                   | 获取卫星列表       |
| GET  | /api/satellites/:noradId          | 获取指定卫星       |
| GET  | /api/satellites/:noradId/orbit    | 获取卫星轨道数据   |
| GET  | /api/satellites/:noradId/predict  | 轨道位置预测       |
| GET  | /api/satellites/:noradId/position | 预测指定时间点位置 |
| GET  | /api/satellites/:noradId/passes   | 卫星过境预测       |

### 空间天气相关

| 方法 | 路径                         | 描述              |
| ---- | ---------------------------- | ----------------- |
| GET  | /api/space-weather/current   | 获取当前空间天气  |
| GET  | /api/space-weather/alerts    | 获取预警列表      |
| GET  | /api/space-weather/xray-flux | 获取X射线通量数据 |

### 科普相关

| 方法 | 路径                                  | 描述              |
| ---- | ------------------------------------- | ----------------- |
| GET  | /api/education/articles               | 获取文章列表      |
| GET  | /api/education/articles/:id           | 获取文章详情      |
| POST | /api/education/articles/:id/collect   | 收藏/取消收藏文章 |
| GET  | /api/education/articles/user/collects | 获取用户收藏文章  |
| GET  | /api/education/quiz/today             | 获取每日问答      |
| POST | /api/education/quiz/answer            | 提交问答答案      |

### 情报相关

| 方法 | 路径                            | 描述          |
| ---- | ------------------------------- | ------------- |
| GET  | /api/intelligence               | 获取情报列表  |
| GET  | /api/intelligence/:id           | 获取情报详情  |
| GET  | /api/intelligence/hot           | 获取热门情报  |
| POST | /api/intelligence/:id/collect   | 收藏/取消收藏 |
| GET  | /api/intelligence/user/collects | 获取用户收藏  |

### 通知相关

| 方法 | 路径                            | 描述         |
| ---- | ------------------------------- | ------------ |
| GET  | /api/notifications              | 获取通知列表 |
| PUT  | /api/notifications/:id/read     | 标记通知已读 |
| PUT  | /api/notifications/read-all     | 全部标记已读 |
| GET  | /api/notifications/unread-count | 获取未读数量 |

### 意见反馈

| 方法 | 路径          | 描述         |
| ---- | ------------- | ------------ |
| POST | /api/feedback | 提交意见反馈 |

### 积分相关

| 方法 | 路径                      | 描述     |
| ---- | ------------------------- | -------- |
| POST | /api/points/daily-checkin | 每日签到 |
| GET  | /api/points/stats         | 积分统计 |
| GET  | /api/points/history       | 积分记录 |
| GET  | /api/points/checkin-days  | 签到天数 |

## 数据库配置

```env
# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=
DB_DATABASE=nova_space

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

## 测试账号

- 用户名: `testuser`
- 密码: `123456`

## 分支说明

- `main` - 主分支，稳定版本
- `feature/theme-style` - Red Noir 主题风格分支

## License

MIT
