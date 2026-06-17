# 分布式定时任务调度平台

一个功能完善的分布式定时任务调度平台，支持多节点部署，提供可视化管理界面。

## ✨ 功能特性

### 🎯 任务调度
- **Cron表达式配置**：支持标准Cron表达式，可预览执行时间
- **一次性执行**：支持设置特定时间点一次性执行任务
- **分布式锁**：基于Redis实现分布式锁，防止多节点重复触发
- **任务状态管理**：支持启用/禁用任务

### 📋 任务类型
- **HTTP回调**：支持GET/POST/PUT/DELETE请求，可配置Headers、Params、Body
- **脚本执行**：支持Node.js、Python、Shell、PowerShell等多种脚本类型

### 🔄 执行与重试
- **自动重试**：任务失败后按配置的重试次数和间隔自动重试
- **执行历史**：记录每次执行的时间、耗时、状态、返回内容
- **分页查询**：支持多条件筛选和分页查询执行历史
- **手动触发**：支持在管理界面手动触发任务立即执行

### 🚨 告警通知
- **失败告警**：任务达到最大重试次数后自动发送告警
- **多渠道支持**：支持钉钉、企业微信、飞书Webhook通知

### 📊 统计分析
- **成功率统计**：实时统计任务执行成功率
- **平均耗时**：分析任务执行平均耗时
- **趋势图表**：展示执行趋势和耗时趋势图
- **多维度统计**：按日维度展示执行数据

### 🖥️ 管理界面
- **仪表盘**：数据概览，8个核心指标卡片
- **任务管理**：任务列表、新增、编辑、删除、启用/禁用
- **执行历史**：完整的执行记录，支持筛选和详情查看
- **响应式设计**：适配不同屏幕尺寸

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                     前端管理界面                          │
│              React + TypeScript + Ant Design            │
└─────────────────────────────┬───────────────────────────┘
                              │
                              │ HTTP API
                              ▼
┌─────────────────────────────────────────────────────────┐
│                    后端服务层                             │
│              Node.js + Express + TypeScript             │
│  ┌──────────┐  ┌───────────┐  ┌────────┐  ┌─────────┐  │
│  │ 任务调度 │  │ 任务执行器 │  │ 重试机制 │  │ 告警服务 │  │
│  └──────────┘  └───────────┘  └────────┘  └─────────┘  │
└─────────────┬───────────────────────┬───────────────────┘
              │                       │
              ▼                       ▼
    ┌──────────────────┐     ┌──────────────────┐
    │   MongoDB        │     │     Redis        │
    │  存储任务和历史   │     │  分布式锁和缓存  │
    └──────────────────┘     └──────────────────┘
```

### 后端技术栈
- **运行时**：Node.js 18+
- **Web框架**：Express.js
- **类型系统**：TypeScript
- **数据库**：MongoDB 6.0+
- **缓存/锁**：Redis 7.0+
- **Cron解析**：cron-parser
- **HTTP客户端**：axios
- **日志**：winston

### 前端技术栈
- **框架**：React 18
- **构建工具**：Vite
- **UI组件**：Ant Design 5.x
- **图表**：ECharts
- **路由**：React Router v6
- **HTTP客户端**：axios
- **日期处理**：dayjs

## 📦 项目结构

```
.
├── client/                     # 前端项目
│   ├── src/
│   │   ├── components/         # 公共组件
│   │   │   ├── Layout.tsx
│   │   │   ├── JobFormModal.tsx
│   │   │   ├── ExecutionDetailModal.tsx
│   │   │   └── StatisticsCharts.tsx
│   │   ├── pages/              # 页面组件
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Jobs.tsx
│   │   │   └── History.tsx
│   │   ├── services/           # API服务
│   │   │   └── api.ts
│   │   ├── types/              # 类型定义
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                     # 后端项目
│   ├── src/
│   │   ├── config/             # 配置
│   │   │   └── index.ts
│   │   ├── controllers/        # API控制器
│   │   │   ├── JobController.ts
│   │   │   ├── ExecutionHistoryController.ts
│   │   │   └── StatisticsController.ts
│   │   ├── db/                 # 数据库连接
│   │   │   ├── mongodb.ts
│   │   │   └── redis.ts
│   │   ├── executor/           # 任务执行器
│   │   │   ├── JobExecutor.ts
│   │   │   ├── HttpExecutor.ts
│   │   │   └── ScriptExecutor.ts
│   │   ├── models/             # 数据模型
│   │   │   ├── Job.ts
│   │   │   └── ExecutionHistory.ts
│   │   ├── routes/             # 路由
│   │   │   └── index.ts
│   │   ├── scheduler/          # 调度引擎
│   │   │   └── JobScheduler.ts
│   │   ├── services/           # 业务服务
│   │   │   ├── JobService.ts
│   │   │   ├── ExecutionHistoryService.ts
│   │   │   ├── StatisticsService.ts
│   │   │   └── AlertService.ts
│   │   ├── types/              # 类型定义
│   │   │   └── index.ts
│   │   ├── utils/              # 工具函数
│   │   │   ├── logger.ts
│   │   │   ├── distributedLock.ts
│   │   │   └── cronUtils.ts
│   │   └── app.ts              # 应用入口
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
├── docker-compose.yml          # Docker编排
└── README.md
```

## 🚀 快速开始

### 环境要求
- Node.js >= 18.0.0
- MongoDB >= 6.0
- Redis >= 7.0
- npm 或 yarn

### 方式一：使用Docker启动依赖服务

```bash
# 启动MongoDB和Redis
docker-compose up -d
```

### 方式二：本地安装依赖服务
确保本地已安装并启动MongoDB（端口27017）和Redis（端口6379）。

### 启动后端服务

```bash
cd server

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 或编译后运行
npm run build
npm start
```

后端服务将在 http://localhost:3001 启动

### 启动前端服务

```bash
cd client

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端服务将在 http://localhost:3000 启动

### 验证服务

1. 访问 http://localhost:3001/api/health 检查后端健康状态
2. 访问 http://localhost:3000 打开管理界面

## 📡 API 接口文档

### 任务管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/jobs` | 获取任务列表（支持分页、筛选） |
| GET | `/api/jobs/:id` | 获取任务详情 |
| POST | `/api/jobs` | 创建任务 |
| PUT | `/api/jobs/:id` | 更新任务 |
| DELETE | `/api/jobs/:id` | 删除任务 |
| POST | `/api/jobs/:id/enable` | 启用任务 |
| POST | `/api/jobs/:id/disable` | 禁用任务 |
| POST | `/api/jobs/:id/trigger` | 手动触发任务 |
| GET | `/api/jobs/validate-cron` | 验证Cron表达式 |
| GET | `/api/jobs/preview-executions` | 预览执行时间 |

### 执行历史

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/execution-history` | 获取执行历史（分页、筛选） |
| GET | `/api/execution-history/:id` | 获取执行详情 |
| DELETE | `/api/execution-history/:id` | 删除执行记录 |
| DELETE | `/api/execution-history` | 清理历史记录（指定天数） |

### 统计数据

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/statistics` | 获取全局统计数据 |
| GET | `/api/statistics/jobs/:jobId` | 获取单个任务统计 |

### 其他

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/health` | 健康检查 |

## 📝 任务配置说明

### Cron表达式格式

```
*    *    *    *    *
┬    ┬    ┬    ┬    ┬
│    │    │    │    │
│    │    │    │    └── 星期 (0 - 7) (0或7是周日)
│    │    │    └─────── 月份 (1 - 12)
│    │    └──────────── 日期 (1 - 31)
│    └───────────────── 小时 (0 - 23)
└────────────────────── 分钟 (0 - 59)
```

常用Cron示例：
- `0 0 * * *` - 每天凌晨0点执行
- `0 12 * * *` - 每天中午12点执行
- `*/5 * * * *` - 每5分钟执行
- `0 9-18 * * 1-5` - 工作日早9点到晚6点每小时执行
- `0 0 1 * *` - 每月1号凌晨执行

### 任务配置示例

#### HTTP回调任务
```json
{
  "name": "数据同步任务",
  "type": "http",
  "scheduleType": "cron",
  "cronExpression": "0 */30 * * *",
  "httpConfig": {
    "url": "https://api.example.com/sync",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer token"
    },
    "body": {
      "source": "db",
      "target": "warehouse"
    },
    "timeout": 30000
  },
  "retryConfig": {
    "maxRetries": 3,
    "retryInterval": 5000
  }
}
```

#### 脚本执行任务
```json
{
  "name": "清理缓存脚本",
  "type": "script",
  "scheduleType": "once",
  "executeAt": "2024-01-01T00:00:00.000Z",
  "scriptConfig": {
    "script": "console.log('清理缓存完成');",
    "interpreter": "node",
    "timeout": 10000
  },
  "retryConfig": {
    "maxRetries": 0,
    "retryInterval": 5000
  }
}
```

## 🔔 告警配置

支持钉钉、企业微信、飞书Webhook告警。在 `server/.env` 中配置：

```env
ALERT_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=xxx
```

系统会自动识别Webhook类型并发送对应格式的告警消息。

## 🔒 分布式部署

本平台支持多节点部署，通过Redis分布式锁确保同一任务只在一个节点执行。

### 部署架构
```
              ┌─────────────┐
              │   Nginx     │
              │  负载均衡   │
              └──────┬──────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │ Node.js │  │ Node.js │  │ Node.js │
   │ 实例1   │  │ 实例2   │  │ 实例3   │
   └────┬────┘  └────┬────┘  └────┬────┘
        │            │            │
        └────────────┼────────────┘
                     │
              ┌──────┴──────┐
              │             │
              ▼             ▼
         ┌─────────┐   ┌─────────┐
         │ MongoDB │   │  Redis  │
         └─────────┘   └─────────┘
```

### 多节点部署注意事项
1. 所有节点连接同一个MongoDB和Redis
2. 每个节点设置不同的 `INSTANCE_ID` 环境变量
3. 建议使用Nginx或其他负载均衡器分发前端请求
4. 后端API可以多节点部署，调度逻辑会自动协调

## ⚙️ 配置说明

### 后端配置 (`server/.env`)

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| PORT | 服务端口 | 3001 |
| MONGODB_URI | MongoDB连接地址 | mongodb://localhost:27017/job_scheduler |
| REDIS_HOST | Redis主机 | localhost |
| REDIS_PORT | Redis端口 | 6379 |
| REDIS_PASSWORD | Redis密码 | - |
| NODE_ENV | 运行环境 | development |
| ALERT_WEBHOOK_URL | 告警Webhook地址 | - |
| SCHEDULE_INTERVAL | 调度扫描间隔(ms) | 1000 |
| LOCK_TTL | 分布式锁过期时间(ms) | 5000 |
| INSTANCE_ID | 实例ID | 自动生成 |

## 🛡️ 安全建议

1. **生产环境配置**
   - 修改默认的MongoDB和Redis密码
   - 配置HTTPS访问
   - 启用API认证（建议添加JWT认证）
   - 限制管理界面的访问IP

2. **脚本执行安全**
   - 限制脚本执行权限
   - 禁止执行危险系统命令
   - 脚本内容进行安全审核
   - 设置合理的执行超时时间

3. **HTTP回调安全**
   - 仅允许访问可信域名
   - 避免在请求中传递敏感信息
   - 验证回调响应内容

## 📊 性能优化

1. **数据库优化**
   - 为常用查询字段添加索引
   - 定期清理历史执行记录
   - 考虑MongoDB分片（大规模部署）

2. **Redis优化**
   - 配置Redis持久化
   - 合理设置锁的TTL
   - 监控Redis内存使用

3. **应用优化**
   - 调整调度扫描间隔
   - 限制并发执行的任务数量
   - 使用PM2等进程管理器

## 🧪 测试

### 后端测试
```bash
cd server
# 运行测试（需先编写测试用例）
npm test
```

### 前端测试
```bash
cd client
# 运行测试（需先编写测试用例）
npm test
```

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

MIT License

## ❓ 常见问题

### Q: 如何修改任务执行时区？
A: 在服务器上设置正确的时区，Cron表达式使用服务器时区执行。

### Q: 任务执行超时怎么办？
A: 可以在任务配置中调整 `timeout` 参数，或在 `.env` 中调整 `LOCK_TTL`。

### Q: 如何扩展支持更多任务类型？
A: 在 `executor/` 目录下添加新的执行器，并在 `JobExecutor.ts` 中注册。

### Q: 任务执行失败但没有收到告警？
A: 检查 `ALERT_WEBHOOK_URL` 配置是否正确，以及网络是否能访问Webhook地址。

## 📞 技术支持

如有问题，请提交 Issue 或发送邮件。
