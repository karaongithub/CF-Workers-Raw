# 🚀 CF-Workers-Raw Pro - 精简版

[![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![GitHub](https://img.shields.io/badge/GitHub-Private_Repo-181717?logo=github&logoColor=white)](https://github.com)
[![License](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Code Size](https://img.shields.io/badge/Code%20Size-3.3%20KB-brightgreen.svg)](#)

🔐 **CF-Workers-Raw Pro** 是一个基于 Cloudflare Workers 的轻量级、高性能 GitHub 私有库代理方案。它允许你通过自定义令牌安全地访问私有仓库文件，而无需暴露真实的 GitHub PAT。

---

## ✨ 核心优势

- 🛡️ **双重鉴权系统**：支持全局管理员令牌与路径专用令牌 (`TOKEN_PATH`)
- 🔌 **灵活 Token 模式**：支持 `?token=xxx` 和 `?xxx` 两种写法，更灵活便捷
- 🕵️ **深度伪装**：通过环境变量完全隐藏 GitHub 用户名、仓库名及分支信息
- ⚡ **代码精简**：相比原始版本减少 33% 代码行数，提升运行效率
- 🛡️ **增强安全**：完整的错误处理、敏感头移除、边界值防护
- 🎭 **仿真首页**：内置简化 Nginx 伪装页面，防止接口被恶意扫描
- 📦 **模块化设计**：函数清晰职责划分，易于维护和扩展

---

## 🚀 新版本改进说明

### 代码优化
| 优化项 | 原始版本 | 新版本 | 改进 |
|:---:|:---:|:---:|:---:|
| **代码行数** | 177 行 | 119 行 | ↓ 33% |
| **函数提取** | 基础函数 | 4 个模块化函数 | ✅ 更清晰 |
| **Token 处理** | 不完整 | 完整 trim() | ✅ 更稳健 |
| **错误处理** | 无 | 完整 try-catch | ✅ 更可靠 |
| **空值过滤** | 基础 split | filter(Boolean) | ✅ 更严谨 |

### 核心改进
1. **Token 获取优化**：兼容 `?token=xxx` 和 `?xxx` 两种写法
2. **安全增强**：对所有 token 进行 `.trim()` 处理，防止空格导致验证失败
3. **模块化函数**：
   - `getProvidedToken()` - Token 获取
   - `buildGitHubRawUrl()` - URL 构建
   - `addConfigList()` - 配置列表解析
4. **完整异常处理**：try-catch 捕获所有运行时错误
5. **代码规范**：统一命名风格，移除中文变量，提升可读性

---

## 🛠️ 如何配置参数？

在 Cloudflare Workers 控制台的 **Settings -> Variables** 中添加以下变量：

| 变量名 | 类型 | 必填 | 示例/说明 |
| :--- | :--- | :--- | :--- |
| **`GH_TOKEN`** | **Secret** | ✅ | 你的 GitHub 个人访问令牌 (PAT)，必须有读取权限 |
| **`TOKEN`** | Variable | ❌ | 全局自定义访问密钥 (如：`mypassword123`) |
| **`TOKEN_PATH`** | Variable | ❌ | 路径专用鉴权，格式：`令牌@路径` (换行或逗号分隔) |
| **`GH_NAME`** | Variable | ❌ | 隐藏模式：你的 GitHub 用户名 |
| **`GH_REPO`** | Variable | ❌ | 隐藏模式：你的 GitHub 仓库名 |
| **`GH_BRANCH`** | Variable | ❌ | 隐藏模式：分支名 (默认为 `main`) |
| **`ERROR`** | Variable | ❌ | 自定义错误提示文字 |
| **`URL302`** | Variable | ❌ | 鉴权失败时重定向 URL (302 跳转) |
| **`URL`** | Variable | ❌ | 鉴权失败时代理到的 URL (200 返回) |

---

## 📖 使用场景示例

假设你的域名为 `raw.example.com`，私有库文件为 `cmliu/MyRepo/main/config.json`。

### 1. 简易模式 (隐藏所有路径信息)
**前提配置**：`GH_NAME="cmliu"`, `GH_REPO="MyRepo"`, `GH_BRANCH="main"`, `GH_TOKEN="ghp_xxxxx"`

**访问方式**（两种等价）：
- 新方式：`https://raw.example.com/config.json?YOUR_TOKEN`
- 旧方式：`https://raw.example.com/config.json?token=YOUR_TOKEN`

**效果**：外部完全无法察觉这是一个 GitHub 文件，看起来像你自己的静态服务器。

### 2. 路径专用令牌 (TOKEN_PATH)
**前提配置**：`TOKEN_PATH="123@admin\n456@public"`（换行分隔）或 `TOKEN_PATH="123@admin,456@public"`（逗号分隔）

**验证规则**：
- ✅ **访问**: `/admin/db.sql?123` (成功，token 与路径匹配)
- ✅ **访问**: `/public/list.txt?456` (成功，token 与路径匹配)
- ❌ **访问**: `/admin/db.sql?456` (报错：TOKEN错误)
- ❌ **访问**: `/admin/db.sql` (报错：TOKEN不能为空)

### 3. 原始路径模式
**访问方式**：
- `https://raw.example.com/cmliu/MyRepo/main/config.json?YOUR_TOKEN`
- `https://raw.example.com/cmliu/MyRepo/main/config.json?token=YOUR_TOKEN`

---

## ❌ 错误处理说明

| 错误消息 | HTTP 状态码 | 原因 | 解决方法 |
| :--- | :--- | :--- | :--- |
| **TOKEN不能为空** | 400 | URL 中缺失 token 参数 | 在链接末尾加上正确的 token 参数 |
| **TOKEN错误** | 403 | 提供的 token 与配置不匹配 | 检查 TOKEN 或 TOKEN_PATH 环境变量 |
| **服务器GitHub TOKEN配置错误** | 500 | 未设置 `GH_TOKEN` 或权限不足 | 前往 Workers 设置添加有效的 GH_TOKEN |
| **无法获取文件，检查路径或TOKEN是否正确。** | 其他 | GitHub 返回非 200 状态码 | 检查文件是否存在及 Token 权限 |
| **服务器错误: [message]** | 500 | 运行时异常 | 检查日志或提交 Issue |

---

## 🏗️ 部署步骤

### 方式一：手动部署
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 创建一个新的 **Worker**
3. 将 `CF-Workers-Raw.js` 代码粘贴到编辑器
4. 进入 **Settings -> Variables**，配置上述环境变量
5. **保存并部署**

### 方式二：一键部署（推荐）
```bash
# 使用 Wrangler CLI
npm install -g wrangler
wrangler login
wrangler publish
