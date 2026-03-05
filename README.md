# SDAU 教务移动端（第三方）

基于 Next.js 的手机优先教务系统，已适配 `https://jw.sdau.edu.cn` 当前新版登录与课表页面。

## 功能概览

- 学号密码登录（服务端登录，不在前端直连教务）
- 读取个人信息并展示：姓名、学号、班级、专业、学院
- 读取学期课表并按周展示（支持课程详情弹层）
- 服务端加密会话 Cookie（不存储明文账号密码）

## 技术栈

- Next.js 15 (App Router)
- TypeScript
- Cheerio（服务端 HTML 解析）

## 目录结构

- `src/app/login`：登录页
- `src/app/timetable`：课表页
- `src/app/api/auth/*`：登录/退出 API
- `src/app/api/timetable`：课表 + 个人信息 API
- `src/lib/jw/*`：教务系统适配层（登录、课表、解析）
- `src/lib/session/*`：会话加密与存储

## 环境变量

复制 `.env.example` 为 `.env.local`：

```bash
cp .env.example .env.local
```

必须配置：

- `SESSION_SECRET`：会话加密密钥（建议 32 位以上随机字符串）

可选配置：

- `JW_BASE_URL`：默认 `https://jw.sdau.edu.cn`
- `JW_TIMEOUT_MS`：教务请求超时（毫秒）
- `JW_RETRY_COUNT`：教务请求失败重试次数
- `JW_USER_AGENT`：请求头 UA`r`n- `SESSION_COOKIE_SECURE`：是否仅 HTTPS 发送会话 Cookie（生产建议 `true`；本地 HTTP 联调可设 `false`）

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 启动开发环境

```bash
npm run dev
```

3. 打开

- [http://localhost:3000](http://localhost:3000)

## 生产构建

```bash
npm run lint
npm run build
npm run start
```

## API 说明

### 1) `POST /api/auth/login`

请求体：

```json
{ "studentId": "2024xxxxxx", "password": "******" }
```

返回：

- 成功：`{ "ok": true }`
- 失败：`{ "ok": false, "code": "...", "message": "..." }`

### 2) `POST /api/auth/logout`

返回：

```json
{ "ok": true }
```

### 3) `GET /api/timetable?term=YYYY-YYYY-X`

返回：

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

## 适配说明（当前版本）

已按你校新版路径适配：

- 主界面：`/framework/xsMainV.jsp`
- 个人信息页：`/framework/xsMainV_new.htmlx?t1=1`
- 课表页：`/xskb/xskb_list.do?viweType=0`

如果后续学校改版（字段名、class 名、页面结构变化），需要更新 `src/lib/jw/client.ts` 与 `src/lib/jw/timetable-parser.ts`。

## 部署说明

### 推荐：Vercel（前后端一体）

原因：本项目依赖服务端 API 登录教务系统，Vercel 可直接部署 Next.js 全栈。

步骤：

1. 推送代码到 GitHub
2. 在 Vercel 导入仓库
3. 配置环境变量（至少 `SESSION_SECRET`）
4. 一键部署

### GitHub Pages 注意事项

GitHub Pages 只能托管静态文件，**不能运行本项目的服务端 API**。因此：

- 不能把本仓库直接完整部署成“可登录教务”的纯 Pages 站点
- 若必须用 Pages：需要拆分为
  - 前端静态站（Pages）
  - 独立后端服务（如 Vercel/云服务器）

前端再通过 `NEXT_PUBLIC_API_BASE_URL` 调用后端 API。

## 常见问题

1. 登录失败但账号密码确认正确
- 先确认学校教务是否临时维护或限制访问
- 检查是否在校园网/VPN环境

2. 课表为空
- 可能当前学期无排课
- 也可能页面结构变化导致解析失败（需更新解析器）

3. 页面报 `JW_UNAVAILABLE`
- 教务系统超时或接口异常，稍后重试
- 可调大 `JW_TIMEOUT_MS`
