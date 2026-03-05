# 山东农业大学综合教务系统

一个面向手机优先的第三方教务系统网站，适配 `https://jw.sdau.edu.cn`，提供登录、个人信息、课程表、课程成绩、等级考试成绩、空教室查询等功能。

## 技术栈

- Next.js 15（App Router）
- React 19
- TypeScript
- Node.js
- Cheerio（服务端解析教务页面）

## 功能概览

1. 登录与会话
- 学号密码登录（服务端代登录教务系统）
- 仅保存服务端短期会话 Cookie，不持久化明文密码

2. 个人信息及课程表
- 展示姓名、学号、班级、专业、学院
- 支持周次切换、当天置顶、课程详情
- 同名课程使用同色块增强可读性

3. 课程成绩查询
- 学期范围：2022-2023-1 到 2029-2030-2
- 展示课程代码、课程名、学分、成绩、绩点
- 显示平均成绩（#F56C7E）和平均学分绩点（#838CC7）

4. 等级考试成绩查询
- 独立接口查询
- 展示序号、考级课程（等级）、成绩、考试时间

5. 空教室查询
- 条件：校区、星期几、节次
- 严格以“无上课/无考试/无占用”为判定标准
- 分组展示支持折叠动画

## 校区映射

- 岱宗校区：`001`
- 泮河校区：`002`
- 西北片区：`A5F850229661E843E0536685C2CAF624`

## 页面路由

- `/login` 登录
- `/timetable` 个人信息及课程表
- `/scores` 课程成绩查询
- `/grade-exams` 等级考试成绩查询
- `/empty-rooms` 空教室查询

## 环境变量

复制模板：

```bash
cp .env.example .env.local
```

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

说明：
- 本地调试可设 `SESSION_COOKIE_SECURE=false`
- 线上 HTTPS 必须设 `SESSION_COOKIE_SECURE=true`
- `SESSION_SECRET` 建议使用 32 位以上随机字符串

## 本地运行

```bash
npm install
npm run dev
```

默认启动在：
- `http://localhost:3002`

## 构建与生产启动

```bash
npm run lint
npm run build
npm run start
```

## 远程更新日志弹窗

在 `.env.local` 配置：

```env
NEXT_PUBLIC_CHANGELOG_URL=https://raw.githubusercontent.com/<你的用户名>/<仓库名>/main/updates/sdau-mobile-jw.json
```

远程 JSON 示例：

```json
{
  "version": "V1.1",
  "title": "更新公告",
  "publishedAt": "2026-03-05 20:30",
  "items": [
    "新增空教室分区折叠与过渡动画",
    "修复切换校区后保留上次结果的问题",
    "优化成绩页面学期选择体验"
  ]
}
```

规则：
- `version` 变化时自动弹窗
- 用户点击“我知道了”后，同版本不再重复弹出

## Powered By

Powered by Next.js 15, React 19, TypeScript, and Node.js.
