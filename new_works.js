/**
 * Cloudflare Worker: GitHub Private Proxy Pro
 * 优化点：严格鉴权、流式转发、Header 清理、路径自动纠错
 */

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const params = url.searchParams;

        // 1. 首页伪装 (Nginx 风格)
        if (url.pathname === '/' || url.pathname === '') {
            return new Response(getNginxHtml(), {
                headers: { 'Content-Type': 'text/html; charset=UTF-8' }
            });
        }

        try {
            // 2. 鉴权中心 (Authentication Center)
            const clientToken = params.get('token');
            let isAuthorized = false;

            // 方案 A: 路径级鉴权 (TOKEN_PATH 格式: token1@path1,token2@path2)
            if (env.TOKEN_PATH) {
                const pathConfigs = env.TOKEN_PATH.split(/[,，\n]+/).filter(Boolean);
                for (const config of pathConfigs) {
                    const [reqToken, reqPath] = config.split('@').map(s => s.trim());
                    // 检查路径前缀匹配 (忽略大小写)
                    if (url.pathname.toLowerCase().startsWith('/' + reqPath.toLowerCase())) {
                        if (clientToken === reqToken) {
                            isAuthorized = true;
                            break;
                        } else {
                            return new Response('❌ Access Denied: Invalid path token', { status: 403 });
                        }
                    }
                }
            }

            // 方案 B: 全局管理员鉴权 (如果未命中路径鉴权且配置了全局 TOKEN)
            if (!isAuthorized && env.TOKEN) {
                if (clientToken === env.TOKEN) {
                    isAuthorized = true;
                } else {
                    return new Response('❌ Access Denied: Global token required', { status: 401 });
                }
            }

            // 如果没配任何 TOKEN 且也没命中，根据需求决定是否拦截 (这里设为严格模式)
            if (!isAuthorized && (env.TOKEN || env.TOKEN_PATH)) {
                return new Response('❌ Unauthorized: Token is missing', { status: 400 });
            }

            // 3. 构建 GitHub Raw URL (智能拼接)
            // 移除路径开头的斜杠
            let cleanPath = url.pathname.replace(/^\/+/, '');
            
            // 如果用户访问的不是以 raw.githubusercontent.com 开头的路径，自动补全
            let githubRawUrl = 'https://raw.githubusercontent.com/';
            
            if (cleanPath.startsWith('http')) {
                // 如果传入了完整 URL，提取有效部分
                githubRawUrl += cleanPath.split('githubusercontent.com/')[1] || '';
            } else if (env.GH_NAME && !cleanPath.startsWith(env.GH_NAME)) {
                // 如果配置了环境变量，且路径里没包含账号名，则自动补全：账号/仓库/分支/路径
                const repo = env.GH_REPO || '';
                const branch = env.GH_BRANCH || 'main';
                githubRawUrl += `${env.GH_NAME}/${repo}/${branch}/${cleanPath}`;
            } else {
                // 否则直接拼接
                githubRawUrl += cleanPath;
            }

            // 4. 发起 GitHub 请求
            const ghHeaders = new Headers();
            if (env.GH_TOKEN) {
                // 使用 Bearer 或 token 格式
                ghHeaders.set('Authorization', `token ${env.GH_TOKEN}`);
            }
            ghHeaders.set('User-Agent', 'Mozilla/5.0 (Cloudflare Worker)');

            const response = await fetch(githubRawUrl, { headers: ghHeaders });

            // 5. 响应处理 (Header 清理)
            if (response.ok) {
                const newHeaders = new Headers(response.headers);
                // 移除不必要的 GitHub 安全策略，防止浏览器报错
                newHeaders.delete('content-security-policy');
                newHeaders.delete('x-frame-options');
                newHeaders.delete('x-content-type-options');
                newHeaders.set('Access-Control-Allow-Origin', '*'); // 允许跨域

                return new Response(response.body, {
                    status: response.status,
                    headers: newHeaders
                });
            } else {
                const errorMsg = env.ERROR || `Failed to fetch from GitHub (Status: ${response.status})`;
                return new Response(errorMsg, { status: response.status });
            }

        } catch (err) {
            return new Response(`Worker Error: ${err.message}`, { status: 500 });
        }
    }
};

// 伪装页面内容
function getNginxHtml() {
    return `<!DOCTYPE html><html><head><title>Welcome to nginx!</title><style>body { width: 35em; margin: 0 auto; font-family: Tahoma, Verdana, Arial, sans-serif; }</style></head><body><h1>Welcome to nginx!</h1><p>If you see this page, the nginx web server is successfully installed and working.</p><p><em>Thank you for using nginx.</em></p></body></html>`;
}
