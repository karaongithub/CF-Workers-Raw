let token = "";

function getProvidedToken(url) {
	// 兼容两种写法：
	// 1) ?token=abc
	// 2) ?abc
	const tokenFromParam = url.searchParams.get('token');
	if (tokenFromParam) {
		return tokenFromParam.trim();
	}

	if (!url.search) return '';

	const rawQuery = decodeURIComponent(url.search.slice(1));
	if (!rawQuery) return '';

	const parts = rawQuery.split('&').filter(Boolean);
	for (const part of parts) {
		if (!part.includes('=')) {
			return decodeURIComponent(part).trim();
		}
	}

	return '';
}

function buildGithubRawUrl(url, env) {
	let githubRawUrl = 'https://raw.githubusercontent.com';

	if (new RegExp(githubRawUrl, 'i').test(url.pathname)) {
		githubRawUrl += url.pathname.split(githubRawUrl)[1];
	} else {
		if (env.GH_NAME) {
			githubRawUrl += '/' + env.GH_NAME;
			if (env.GH_REPO) {
				githubRawUrl += '/' + env.GH_REPO;
				if (env.GH_BRANCH) githubRawUrl += '/' + env.GH_BRANCH;
			}
		}
		githubRawUrl += url.pathname;
	}

	return githubRawUrl;
}

function getFinalToken(providedToken, env) {
	if (providedToken) {
		if (env.GH_TOKEN && env.TOKEN) {
			return providedToken === env.TOKEN ? env.GH_TOKEN : providedToken;
		}
		return providedToken;
	}

	return env.GH_TOKEN || env.TOKEN || token;
}

function getResponseHeaders(originalHeaders) {
	const headers = new Headers(originalHeaders);
	headers.delete('content-security-policy');
	headers.delete('x-frame-options');
	headers.delete('x-content-type-options');
	headers.delete('server');
	headers.set('Access-Control-Allow-Origin', '*');
	return headers;
}

async function validatePathAuth(pathname, providedToken, env) {
	if (!env.TOKEN_PATH) return null;

	const pathConfigs = await ADD(env.TOKEN_PATH);
	const normalizedPathname = decodeURIComponent(pathname.toLowerCase());

	for (const pathConfig of pathConfigs) {
		const configParts = pathConfig.split('@');
		if (configParts.length !== 2) continue;

		const [requiredToken, pathPart] = configParts.map(s => s.trim());
		if (!requiredToken || !pathPart) continue;

		const normalizedPath = '/' + pathPart.toLowerCase();
		const pathMatches =
			normalizedPathname === normalizedPath ||
			normalizedPathname.startsWith(normalizedPath + '/');

		if (!pathMatches) continue;

		if (!providedToken) {
			return { ok: false, status: 400, message: 'TOKEN不能为空' };
		}

		if (providedToken !== requiredToken) {
			return { ok: false, status: 403, message: 'TOKEN错误' };
		}

		if (!env.GH_TOKEN) {
			return { ok: false, status: 500, message: '服务器GitHub TOKEN配置错误' };
		}

		const headers = new Headers();
		headers.set('Authorization', `token ${env.GH_TOKEN}`);
		return { ok: true, headers };
	}

	return null;
}

async function nginx() {
	const text = `
	<!DOCTYPE html>
	<html>
	<head>
	<meta charset="UTF-8">
	<title>Welcome to nginx!</title>
	<style>
		body {
			width: 35em;
			margin: 0 auto;
			font-family: Tahoma, Verdana, Arial, sans-serif;
		}
	</style>
	</head>
	<body>
	<h1>Welcome to nginx!</h1>
	<p>If you see this page, the nginx web server is successfully installed and working. Further configuration is required.</p>

	<p>For online documentation and support please refer to
	<a href="http://nginx.org/">nginx.org</a>.<br/>
	Commercial support is available at
	<a href="http://nginx.com/">nginx.com</a>.</p>

	<p><em>Thank you for using nginx.</em></p>
	</body>
	</html>
	`;
	return text;
}

async function ADD(envadd) {
	if (!envadd) return [];

	let addtext = envadd
		.replace(/[\t|"'\r\n]+/g, ',')
		.replace(/,+/g, ',')
		.trim();

	if (addtext.startsWith(',')) addtext = addtext.slice(1);
	if (addtext.endsWith(',')) addtext = addtext.slice(0, -1);

	return addtext ? addtext.split(',').filter(item => item.trim()) : [];
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		// 首页伪装页
		if (url.pathname === '/' || url.pathname === '') {
			const envKey = env.URL302 ? 'URL302' : (env.URL ? 'URL' : null);
			if (envKey) {
				const URLs = await ADD(env[envKey]);
				const URL = URLs[Math.floor(Math.random() * URLs.length)];
				return envKey === 'URL302'
					? Response.redirect(URL, 302)
					: fetch(new Request(URL, request));
			}

			return new Response(await nginx(), {
				headers: {
					'Content-Type': 'text/html; charset=UTF-8',
				},
			});
		}

		try {
			const providedToken = getProvidedToken(url);
			const headers = new Headers();

			// 先走 TOKEN_PATH 路径鉴权
			const pathAuthResult = await validatePathAuth(url.pathname, providedToken, env);

			if (pathAuthResult) {
				if (!pathAuthResult.ok) {
					return new Response(pathAuthResult.message, {
						status: pathAuthResult.status,
					});
				}
				headers.set('Authorization', pathAuthResult.headers.get('Authorization'));
			} else {
				const finalToken = getFinalToken(providedToken, env);

				if (!finalToken || finalToken === '') {
					return new Response('TOKEN不能为空', { status: 400 });
				}

				headers.set('Authorization', `token ${finalToken}`);
				token = finalToken;
			}

			const githubRawUrl = buildGithubRawUrl(url, env);
			const response = await fetch(githubRawUrl, { headers });

			if (response.ok) {
				return new Response(response.body, {
					status: response.status,
					headers: getResponseHeaders(response.headers),
				});
			} else {
				const errorText = env.ERROR || '无法获取文件，检查路径或TOKEN是否正确。';
				return new Response(errorText, { status: response.status });
			}
		} catch (error) {
			console.error('Worker Error:', error);
			return new Response(`服务器错误: ${error.message}`, {
				status: 500,
				headers: {
					'Content-Type': 'text/plain; charset=UTF-8',
				},
			});
		}
	}
};
