# SDAU 移动端教务系统（第三方）

一个基于 Next.js 的手机优先教务系统前端与服务端一体项目，适配 `https://jw.sdau.edu.cn` 的登录与课表抓取流程。

## 功能范围

- 学号密码登录（服务端代登录，不在前端直接请求教务站点）
- 课表抓取与标准化输出
- 个人信息展示：姓名、学号、班级、专业、学院
- 移动端优先 UI（当天课表置顶、其他日期可收起展开）
- 服务端会话 Cookie（不持久化明文密码）

## 当前适配路径

- 主页面：`/framework/xsMainV.jsp`
- 个人信息页面：`/framework/xsMainV_new.htmlx?t1=1`
- 课表页面：`/xskb/xskb_list.do?viweType=0`

## 技术栈

- Next.js 15（App Router）
- TypeScript
- Cheerio（服务端 HTML 解析）

## 项目结构

- `src/app/login`：登录页
- `src/app/timetable`：课表页
- `src/app/api/auth/login`：登录 API
- `src/app/api/auth/logout`：退出 API
- `src/app/api/timetable`：课表 + 个人信息 API
- `src/lib/jw`：教务系统适配层（登录、抓取、解析）
- `src/lib/session`：会话加密与存储
- `src/types`：前后端共享类型

## 环境变量

复制模板：

```bash
cp .env.example .env.local
```

`.env.local` 至少需要：

```env
JW_BASE_URL=https://jw.sdau.edu.cn
SESSION_SECRET=请填写32位以上随机字符串
JW_TIMEOUT_MS=12000
JW_RETRY_COUNT=1
JW_USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36
SESSION_COOKIE_SECURE=false
```

说明：

- `SESSION_SECRET` 不是随意短字符串，建议 32 位以上随机值。
- 本地 `http://localhost` 调试时，`SESSION_COOKIE_SECURE=false`。
- 生产 HTTPS 环境请设为 `true`。

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 启动开发模式

```bash
npm run dev
```

3. 打开：

- `http://localhost:3000/login`

## 生产构建

```bash
npm run lint
npm run build
npm run start
```

## API 说明

### `POST /api/auth/login`

请求：

```json
{ "studentId": "2024xxxxxx", "password": "******" }
```

响应：

```json
{ "ok": true }
```

或

```json
{ "ok": false, "code": "INVALID_CREDENTIALS | JW_UNAVAILABLE", "message": "..." }
```

### `POST /api/auth/logout`

```json
{ "ok": true }
```

### `GET /api/timetable?term=YYYY-YYYY-X`

```json
{
  "ok": true,
  "data": {
    "term": "2025-2026-2",
    "generatedAt": "2026-03-05T00:00:00.000Z",
    "profile": {
      "name": "张三",
      "studentId": "2024xxxxxx",
      "className": "xx班",
      "major": "xx专业",
      "college": "xx学院",
      "displayName": "张三-2024xxxxxx"
    },
    "courses": []
  }
}
```

## 部署建议

本项目依赖服务端 API，不适合纯静态托管。

- 推荐：Vercel（最省事，前后端一体）
- 可选：轻量云主机（Node + Nginx + PM2）
- 不推荐：GitHub Pages（仅静态，无法运行本项目后端 API）

## 常见问题

1. 本地提示 `JW_UNAVAILABLE`，云端正常
- 多数是本地网络/代理/DNS 问题，不是业务逻辑错误。
- 先确认本机能否在终端请求 `https://jw.sdau.edu.cn`。

2. 登录成功但课表异常
- 学校页面结构变更会影响解析，需要更新 `src/lib/jw/timetable-parser.ts`。

3. Vercel 报 Next.js 漏洞版本
- 当前项目已使用 `next@15.5.12` 和 `eslint-config-next@15.5.12`。
