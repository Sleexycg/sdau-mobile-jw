# 山东农业大学综合教务系统移动端

面向手机优先的第三方教务系统网站，适配 `https://jw.sdau.edu.cn`，提供统一登录、个人信息、课程表、课程成绩、等级考试成绩、空教室查询。

- 技术栈：Next.js 15 + TypeScript + App Router
- 运行形态：前后端一体（必须有 Node 服务）
- 数据策略：不落库，不保存明文密码，仅使用服务端短期会话 Cookie

## 1. 功能清单

### 1.1 登录与会话
- 登录页标题：`山东农业大学综合教务系统移动端`
- 输入学号/密码后由服务端代登录教务系统
- 登录成功后写入 HttpOnly 会话
- 退出登录会清理本地会话与远端状态

### 1.2 个人信息与课程表
- 页面标题：`个人信息及课程表`
- 展示姓名、学号、班级、专业、学院
- 支持周次切换、当天置顶、展开/收起
- 每门课显示：课程名、教师、教室、节次、时间
- 同名课程使用同一底色，便于识别
- 周末全天无课时显示“无课”

### 1.3 课程成绩查询
- 页面标题：`课程成绩查询`
- 学期下拉范围：`2022-2023-1` 到 `2029-2030-2`
- 显示列：课程代码、课程名、学分、成绩、绩点
- 顶部统计：平均成绩（红色 `#F56C7E`）、平均学分绩点（紫色 `#838CC7`）

### 1.4 等级考试成绩查询
- 页面标题：`等级考试成绩查询`
- 接口独立于课程成绩
- 显示：序号、考级课程（等级）、成绩、考试时间

### 1.5 空教室查询
- 页面标题：`空教室查询`
- 查询条件：校区、星期几、节次
- 打开页面即显示“当前学期 + 当前周 + 今天星期几”
- 严格按“空教室”定义：目标节次单元格必须为空（无上课/考试/借用/占用）
- 分组展示（支持展开/收起动画）
  - 岱宗校区：`5N教室` / `5S教室` / `12号楼` / `其他区域`
  - 泮河校区：`东南片区(19#*)` / `中央片区(其余)`
  - 西北片区：`21号楼(21#*)` / `22号楼(22#*)` / `其他区域`
- 切换校区时会自动清空上一校区结果，避免数据残留

### 1.6 远程更新日志自动弹窗
- 支持通过远程 JSON 下发更新日志
- 前端检测到新版本（version 未读）自动弹窗
- 同一版本只弹一次（浏览器本地缓存）

## 2. 校区与代码映射

- 岱宗校区：`001`
- 泮河校区：`002`
- 西北片区：`A5F850229661E843E0536685C2CAF624`

> 若学校后续调整编码，可通过环境变量覆盖。

## 3. 页面路由

- `/login` 登录
- `/timetable` 个人信息及课程表
- `/scores` 课程成绩
- `/grade-exams` 等级考试成绩
- `/empty-rooms` 空教室

底部导航已接入以上 4 个业务页（课表/课程成绩/等级考试/空教室）。

## 4. API 概览

### 4.1 认证
- `POST /api/auth/login`
  - Request: `{ studentId: string; password: string }`
  - Response: `{ ok: true }` 或 `{ ok: false, code, message }`
- `POST /api/auth/logout`
  - Response: `{ ok: true }`

### 4.2 课表与信息
- `GET /api/timetable?term=YYYY-YYYY-X`
  - 返回个人信息 + 标准化课程表

### 4.3 成绩
- `GET /api/course-scores?term=YYYY-YYYY-X`
  - 返回课程成绩列表 + 平均成绩 + 平均学分绩点
- `GET /api/grade-exam-scores`
  - 返回等级考试成绩列表

### 4.4 空教室
- `GET /api/empty-rooms/context`
  - 返回当前学期与当前周
- `POST /api/empty-rooms`
  - Request:
  ```json
  {
    "campus": "岱宗校区",
    "weekday": 4,
    "sectionCode": "0102"
  }
  ```
  - `sectionCode` 支持：`0102`、`0304`、`中午`、`0506`、`0708`、`0910`、`晚间`

## 5. 环境变量

先复制模板：

```bash
cp .env.example .env.local
```

`.env.local` 说明：

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

关键项：
- `SESSION_SECRET`：必须是高强度随机串，建议 32 位以上
- `SESSION_COOKIE_SECURE`：
  - 本地 `http://localhost` 调试请设为 `false`
  - 线上 HTTPS（Vercel/自建域名）设为 `true`

可用命令生成随机密钥（任选一个）：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```bash
openssl rand -hex 32
```


## 5.1 远程更新日志配置

在 `.env.local` 中设置：

```env
NEXT_PUBLIC_CHANGELOG_URL=https://raw.githubusercontent.com/Sleexycg/sdau-mobile-jw/main/updates/sdau-mobile-jw.json
```

```json
{
  "version": "V1.0",
  "title": "更新公告",
  "publishedAt": "2026-03-05 20:30",
  "items": [
    "新增空教室分区折叠与过渡动画",
    "修复切换校区后保留上次结果的问题",
    "优化成绩页面学期选择体验"
  ]
}
```

字段说明：
- `version`：版本标识，必须唯一（建议用日期+序号）
- `title`：弹窗标题（可选）
- `publishedAt`：发布时间（可选）
- `items`：更新点列表（推荐）
- `details`：多行文本（可选，未提供 `items` 时使用）

使用方式：
1. 发布新功能后，修改远程 JSON 的 `version` 与内容
2. 用户下次打开页面会自动弹窗
3. 用户点击“我知道了”后，该版本不再重复弹出
## 6. 本地开发

```bash
npm install
npm run dev
```

默认地址：
- `http://localhost:3000`

若使用 3002 端口：

```bash
npm run dev -- -p 3002
```

## 7. 构建与生产启动

```bash
npm run lint
npm run build
npm run start
```

## 8. 部署方案

### 8.1 推荐：Vercel（最省事）

1. 代码推送到 GitHub
2. Vercel 导入该仓库
3. Framework 选择 Next.js（通常自动识别）
4. 在 Vercel 项目中配置环境变量（与 `.env.local` 同名）
5. Deploy

注意：
- 不要把 `Output Directory` 设为 `public`（Next.js 不需要）
- 若出现 Next.js 安全版本提示，按要求升级 `next` 与 `eslint-config-next`

### 8.2 国内访问优化（不新增云服务器）

如果海外域名访问不稳定，可用 Cloudflare Tunnel 将本地服务映射到固定域名。

基本流程：
1. 本地保持 `npm run dev -- -p 3002` 或 `npm run start`
2. 安装并登录 `cloudflared`
3. 创建 Tunnel 与 DNS 记录
4. 将公网域名转发到 `http://localhost:3002`

这样后端仍在你本地机器上运行，成本最低，但要求本机持续在线。

## 9. Git 推送最简流程（Git Bash）

```bash
git init
git branch -M main
git config --global user.name "你的GitHub用户名"
git config --global user.email "你的邮箱"
git add .
git commit -m "feat: initial release"
git remote add origin git@github.com:你的用户名/你的仓库.git
git push -u origin main
```

若 HTTPS push 失败，优先改 SSH。

## 10. 常见问题排查

### 10.1 `stream did not contain valid UTF-8`
某些编辑操作把文件写成了 UTF-16。把对应源码文件改回 UTF-8（无 BOM）即可。

### 10.2 本地报 `JW_UNAVAILABLE`，云端正常
通常是本地网络问题（DNS/代理/防火墙/运营商链路）。先确认本机可直接访问 `https://jw.sdau.edu.cn`。

### 10.3 第三/四大节空教室查不到
已在后端加入组合节次回退策略；若学校接口再次变更，需根据最新响应调整解析规则。

### 10.4 Git 警告 `LF will be replaced by CRLF`
是 Windows 常见换行提示，不影响功能。可按团队规范统一行尾设置。

## 11. 项目目录（核心）

- `src/app` 页面与 API 路由
- `src/components` 业务组件（课表/成绩/等级考试/空教室/导航）
- `src/lib/jw` 教务系统适配层（登录、抓取、解析）
- `src/lib/session` 会话加解密
- `src/types` 共享类型定义

## 12. 合规与安全建议

- 严禁把真实账号密码提交到仓库
- `.env.local` 不要上传 GitHub
- 仅在受信任设备部署与运行
- 定期更新依赖，特别是 `next` 和安全相关库
