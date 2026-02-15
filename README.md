# 🚀 CF-Workers-Raw Pro

[![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![GitHub](https://img.shields.io/badge/GitHub-Private_Repo-181717?logo=github&logoColor=white)](https://github.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

🔐 **CF-Workers-Raw Pro** 是一个基于 Cloudflare Workers 的极致安全 GitHub 私有库代理方案。它允许你通过自定义令牌安全地访问私有仓库文件，而无需暴露真实的 GitHub PAT。

---

## ✨ 核心优势

- 🛡️ **双重鉴权**：支持全局管理员令牌与路径专用令牌 (`TOKEN_PATH`)。
- 🕵️ **深度伪装**：通过环境变量完全隐藏 GitHub 用户名、仓库名及分支信息。
- 🚀 **性能优化**：采用流式传输技术，移除 GitHub 敏感 Header，解决跨域及 CSP 报错。
- 🎭 **安全伪装**：内置 Nginx 仿真首页，防止接口被恶意扫描。
- ⚡ **智能对齐**：自动补全路径，支持原样路径与隐藏路径两种访问模式。

---

## 🛠️ 如何配置参数？

在 Cloudflare Workers 控制台的 **Settings -> Variables** 中添加以下变量：

| 变量名 | 类型 | 必填 | 示例/说明 |
| :--- | :--- | :--- | :--- |
| **`GH_TOKEN`** | **Secret** | ✅ | 你的 GitHub 个人访问令牌 (PAT) |
| **`TOKEN`** | Variable | ❌ | 全局自定义访问密钥 (如：`mypassword`) |
| **`TOKEN_PATH`** | Variable | ❌ | 路径专用鉴权，格式：`令牌@路径` (换行或逗号分隔) |
| **`GH_NAME`** | Variable | ❌ | 隐藏模式：你的 GitHub 用户名 |
| **`GH_REPO`** | Variable | ❌ | 隐藏模式：你的 GitHub 仓库名 |
| **`GH_BRANCH`** | Variable | ❌ | 隐藏模式：分支名 (默认为 `main`) |
| **`ERROR`** | Variable | ❌ | 自定义错误提示文字 |

---

## 📖 使用场景示例

假设你的域名为 `raw.example.com`，私有库文件为 `cmliu/MyRepo/main/config.json`。

### 1. 简易模式 (隐藏所有路径信息)
**前提配置**：`GH_NAME="cmliu"`, `GH_REPO="MyRepo"`, `GH_BRANCH="main"`
- **访问 URL**: `https://raw.example.com/config.json?token=YOUR_TOKEN`
- **效果**: 外部完全无法察觉这是一个 GitHub 文件，看起来像你自己的静态服务器。

### 2. 路径专用令牌 (TOKEN_PATH)
**前提配置**：`TOKEN_PATH="123@admin,456@public"`
- ✅ **访问**: `/admin/db.sql?token=123` (成功)
- ✅ **访问**: `/public/list.txt?token=456` (成功)
- ❌ **访问**: `/admin/db.sql?token=456` (报错：权限不足)

### 3. 原始路径模式
- **访问 URL**: `https://raw.example.com/cmliu/MyRepo/main/config.json?token=YOUR_TOKEN`

---

## ❌ 错误处理说明

| 错误消息 | 原因 | 解决方法 |
| :--- | :--- | :--- |
| **TOKEN不能为空** | URL 中缺失 `?token=` 参数 | 在链接末尾加上正确的 token 参数 |
| **TOKEN错误** | 提供的 token 与全局或路径配置不匹配 | 检查环境变量 `TOKEN` 或 `TOKEN_PATH` |
| **无法获取文件...** | GitHub 路径错误或 GH_TOKEN 权限不足 | 检查仓库是否存在及 Token 的读取权限 |
| **服务器配置错误** | 未在后台设置 `GH_TOKEN` | 前往 Workers 设置添加加密变量 |

---

## 🏗️ 部署方式

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 创建一个新的 **Worker**，将 `_worker.js` 代码粘贴进去。
3. 在 **Settings -> Variables** 中配置上述环境变量。
4. 保存并部署。

> [!IMPORTANT]
> **安全提醒**：请务必将 `GH_TOKEN` 设置为 **Secret** 模式，以防泄露。

---

## 🙏 鸣谢
本项目基于 [cmliu/CF-Workers-Raw](https://github.com/cmliu/CF-Workers-Raw) 优化增强。

---
