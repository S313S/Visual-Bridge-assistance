# Cloudflare Worker 部署指南

本指南将帮助您将 Visual Bridge AI 的后端代理部署到 Cloudflare Workers，从而保护您的 API 密钥。

---

## 前置条件

1. 一个 [Cloudflare 账号](https://dash.cloudflare.com/sign-up)（免费）
2. 您的火山引擎 API Key
3. 您的 GitHub Personal Access Token（用于访问私有知识库）

---

## 第一步：安装 Wrangler CLI

```bash
npm install -g wrangler
```

---

## 第二步：登录 Cloudflare

```bash
wrangler login
```

浏览器会自动打开，按提示授权即可。

---

## 第三步：部署 Worker

进入 Worker 目录并部署：

```bash
cd cloudflare-worker
wrangler deploy
```

部署成功后，您会看到类似输出：

```
Published visual-bridge-proxy (1.0.0)
  https://visual-bridge-proxy.YOUR_ACCOUNT.workers.dev
```

**记住这个 URL**，后面会用到。

---

## 第四步：配置 Secrets（重要！）

在 Cloudflare Dashboard 中配置敏感信息：

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages** → 选择 `visual-bridge-proxy`
3. 点击 **Settings** → **Variables**
4. 在 **Environment Variables** 区域，点击 **Add variable**

添加以下变量（选择 **Encrypt** 以保护敏感信息）：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `VOLC_API_KEY` | 您的火山引擎 Key | **必填** |
| `VOLC_TEXT_MODEL` | `doubao-seed-1-8-251228` | 文本模型 |
| `VOLC_IMAGE_MODEL` | `doubao-seedream-4-5-251128` | 图片模型 |
| `GITHUB_TOKEN` | `ghp_xxxx...` | GitHub Token |
| `KB_URL` | `https://github.com/...` | 角色提示词 URL |
| `DOUBAO_KB_URL` | `https://github.com/...` | 豆包知识库 URL |
| `ALLOWED_ORIGIN` | `https://s313s.github.io` | 允许的前端域名 |

5. 点击 **Save and Deploy**

---

## 第五步：更新前端环境变量

在您的前端项目根目录创建 `.env.production` 文件：

```env
VITE_WORKER_URL=https://visual-bridge-proxy.YOUR_ACCOUNT.workers.dev
```

然后重新构建并部署到 GitHub Pages：

```bash
npm run build
# 将 dist 目录部署到 gh-pages 分支
```

---

## 验证

1. 访问您的 GitHub Pages 网站
2. 打开浏览器开发者工具 (F12) → Console
3. 发送一条消息
4. 您应该看到：`[API] Using Worker mode: https://...`

如果看到这条日志，说明一切正常！🎉

---

## 故障排除

### 1. CORS 错误
确保 `ALLOWED_ORIGIN` 设置正确，包含完整的域名（如 `https://s313s.github.io`）。

### 2. 401 Unauthorized
检查 `VOLC_API_KEY` 是否正确配置。

### 3. Worker 没有响应
运行 `wrangler tail` 查看实时日志：
```bash
wrangler tail
```

---

## 费用

Cloudflare Workers 免费套餐包含：
- **每天 10 万次请求**
- **10ms CPU 时间/请求**

对于个人或小团队使用完全足够。
