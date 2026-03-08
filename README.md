# 山东农业大学综合教务系统（WeSDAU）

面向手机优先的第三方教务系统网站，适配 `https://jw.sdau.edu.cn`。  
当前版本已支持：登录、个人信息、课表、课程成绩、等级考试成绩、空教室、培养方案、远程更新日志。

## 1. 项目定位

这个项目不是静态模板，而是一个可直接对接山农教务系统的 Next.js 全栈应用：

1. 前端只请求本项目 API，不直接请求教务站。
2. 后端负责教务登录、会话托管、数据抓取与解析。
3. 默认移动端优先，同时对电脑端做了单独布局优化。

## 2. 已实现功能

### 2.1 登录与会话

1. 学号 + 密码登录。
2. 服务端保存短期会话（HttpOnly Cookie），不保存明文密码。
3. 退出登录立即清理本地会话。
4. 内置 UI 测试账号：
   - 账号：`admin`
   - 密码：`admin`

### 2.2 课表页（个人信息及课程表）

1. 顶部展示姓名/学号、班级、专业、学院。
2. 支持按周切换（第 N 周）。
3. 当天课表优先展示。
4. 周课表弹窗（可总览周一到周日）。
5. 课程卡片按课程名稳定配色，同名课程同色。
6. 支持点击课程查看详情。
7. 顶部按钮区已优化：
   - 右上角：`刷新`、`退出`
   - 功能行：`周课表`、`培养方案`、`更新日志`

### 2.3 课程成绩

1. 按学期查询（范围：`2022-2023-1` 到 `2029-2030-2`）。
2. 展示课程代码、课程名、学分、总成绩、绩点。
3. 成绩 `<60` 自动红色标识。
4. 页面顶部显示统计：
   - 平均成绩
   - 平均学分绩点
5. 支持点击总成绩查看“成绩构成”弹窗：
   - 平时成绩/比例
   - 期末成绩/比例
   - 总成绩（数字颜色规则：`>=80` 绿色，`60-79.99` 黄色，`<60` 红色）

### 2.4 等级考试成绩

1. 对接独立接口查询。
2. 展示序号、考级课程（等级）、成绩、考试时间。
3. 按考试时间排序（早到晚）。
4. `大学英语四六级` 成绩 `>=425` 绿色，否则红色。

### 2.5 空教室查询

1. 条件查询：校区、周次、星期、节次。
2. 按“无上课 + 无考试 + 无占用”判定空教室。
3. 三校区映射：
   - 岱宗校区
   - 泮河校区
   - 西北片区
4. 分区分组展示并支持折叠动画。

### 2.6 培养方案

1. 展示各课程类别学分进度（要求/已修/正修/未修）。
2. 已完成类别有明显标记。
3. 支持展开查看该类别下具体科目。
4. 类别标识（小字 Tag）已适配：如 `XF`、`BS`、`XY`、`XT`、`XD`、`XZ/XR/XG` 等。

### 2.7 远程更新日志

1. 支持通过 GitHub 上的 JSON 远程下发公告。
2. 首次检测到新 `version` 自动弹窗。
3. 支持手动点击课表页“更新日志”按钮查看。
4. 同一版本点“知道了”后不重复弹出。

## 3. 技术栈

1. Next.js 15（App Router）
2. React 19
3. TypeScript
4. Node.js
5. Cheerio（服务端 HTML 解析）

## 4. 页面路由

1. `/login` 登录页
2. `/timetable` 个人信息及课程表
3. `/scores` 课程成绩查询
4. `/grade-exams` 等级考试成绩查询
5. `/empty-rooms` 空教室查询
6. `/training-plan` 培养方案

## 5. 本地启动

### 5.1 安装依赖

```bash
npm install
```

### 5.2 配置环境变量

先复制模板：

```bash
cp .env.example .env.local
```

Windows PowerShell 可用：

```powershell
Copy-Item .env.example .env.local
```

### 5.3 启动开发环境

```bash
npm run dev
```

默认地址：

- `http://localhost:3002`

### 5.4 生产构建

```bash
npm run build
npm run start
```

## 6. 环境变量说明

`.env.local` 示例：

```env
JW_BASE_URL=https://jw.sdau.edu.cn
SESSION_SECRET=replace-with-a-long-random-string
JW_TIMEOUT_MS=12000
JW_RETRY_COUNT=1
JW_USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36
SESSION_COOKIE_SECURE=true
JW_CAMPUS_DAIZONG_CODE=001
JW_CAMPUS_ZHONGYANG_CODE=002
JW_CAMPUS_XIBEI_CODE=A5F850229661E843E0536685C2CAF624
NEXT_PUBLIC_CHANGELOG_URL=
```

建议：

1. `SESSION_SECRET` 使用长度 32+ 的随机字符串。
2. 本地 HTTP 调试时，可将 `SESSION_COOKIE_SECURE=false`。
3. 线上 HTTPS 必须 `SESSION_COOKIE_SECURE=true`。

## 7. 更新日志功能使用教程（GitHub）

### 7.1 新建更新日志 JSON

在仓库根目录创建文件：

- `updates/sdau-mobile-jw.json`

内容示例：

```json
{
  "version": "V1.0",
  "title": "更新公告",
  "publishedAt": "2026-03-08 20:30",
  "items": [
    "优化课表页按钮布局",
    "新增更新日志按钮手动查看",
    "修复若干移动端显示问题"
  ]
}
```

### 7.2 推送到 GitHub

```bash
git add updates/sdau-mobile-jw.json
git commit -m "chore: update changelog to V1.2"
git push
```

### 7.3 配置前端读取地址

在 `.env.local` 增加：

```env
NEXT_PUBLIC_CHANGELOG_URL=https://raw.githubusercontent.com/xxxxx/main/updates/sdau-mobile-jw.json
```

然后重启项目：

```bash
npm run dev
```

### 7.4 触发规则

1. `version` 变化后，用户首次进入会自动弹窗。
2. 用户点击“知道了”后，本地记忆该版本不再自动弹。
3. 用户仍可手动点击“更新日志”按钮查看。

## 8. API 概览

1. `POST /api/auth/login` 登录
2. `POST /api/auth/logout` 退出
3. `GET /api/timetable` 课表与个人信息
4. `GET /api/course-scores` 课程成绩
5. `GET /api/course-scores/usual` 平时/期末成绩构成
6. `GET /api/grade-exam-scores` 等级考试成绩
7. `GET /api/empty-rooms/context` 当前学期与周次上下文
8. `GET /api/empty-rooms` 空教室查询
9. `GET /api/training-plan` 培养方案

## 9. 部署建议

### 9.1 推荐：Vercel

原因：

1. 对 Next.js 原生支持最好。
2. API Route 可直接运行。
3. 成本低，上线快。

说明：

- 这个项目是全栈应用，不适合 GitHub Pages。

### 9.2 国内访问方案（可选）

如果你本地可访问、外网访问受限，可考虑：

1. Cloudflare Tunnel（最低成本，不需要自建云服务器）
2. 自有云服务器 + 反向代理（可控性更高）

## 10. 常见问题

### 10.1 本地提示“教务系统暂不可用”

排查顺序：

1. 本机网络是否可直连 `jw.sdau.edu.cn`。
2. `JW_BASE_URL` 是否正确。
3. 超时参数是否过小（可适当提高 `JW_TIMEOUT_MS`）。
4. 本地代理/公司网络是否拦截请求。

### 10.2 出现中文乱码或 UTF-8 报错

1. 确保源码文件保存为 UTF-8（无 BOM 更稳）。
2. 避免在编辑器中混入异常转义字符。
3. 重新保存后执行 `npm run build` 验证。

### 10.3 为什么 GitHub Pages 不能直接部署

原因：

1. 项目依赖服务端 API（`/api/*`）。
2. GitHub Pages 不提供 Node.js 运行时。

## 11. 安全与合规提醒

1. 不要把真实学号密码写入代码仓库。
2. 不要提交 `.env.local`。
3. 建议为 `SESSION_SECRET` 使用独立随机值并定期更换。
4. 仅在你有权限的账号范围内使用该系统。

## 12. 开发命令

```bash
npm run dev      # 本地开发（端口 3002）
npm run build    # 生产构建
npm run start    # 生产启动（端口 3002）
npm run lint     # 代码检查
```

## 13. Powered By

Powered by Next.js 15, React 19, TypeScript, Node.js, and Cheerio.
