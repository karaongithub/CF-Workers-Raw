let token = "";

function getProvidedToken(url) {
	const t = url.searchParams.get("token");
	if (t) return t.trim();

	const q = url.search ? decodeURIComponent(url.search.slice(1)) : "";
	if (!q) return "";

	for (const p of q.split("&")) {
		if (!p.includes("=")) return decodeURIComponent(p).trim();
	}
	return "";
}

function buildGitHubRawUrl(url, env) {
	let raw = "https://raw.githubusercontent.com";

	if (new RegExp(raw, "i").test(url.pathname)) {
		return raw + url.pathname.split(raw)[1];
	}

	if (env.GH_NAME) {
		raw += "/" + env.GH_NAME;
		if (env.GH_REPO) {
			raw += "/" + env.GH_REPO;
			if (env.GH_BRANCH) raw += "/" + env.GH_BRANCH;
		}
	}

	return raw + url.pathname;
}

function addConfigList(s) {
	if (!s) return [];
	let x = s.replace(/[\t|"'\r\n]+/g, ",").replace(/,+/g, ",").trim();
	if (x.startsWith(",")) x = x.slice(1);
	if (x.endsWith(",")) x = x.slice(0, -1);
	return x ? x.split(",").filter(Boolean) : [];
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		if (url.pathname === "/") {
			const envKey = env.URL302 ? "URL302" : env.URL ? "URL" : null;
			if (envKey) {
				const urls = addConfigList(env[envKey]);
				const target = urls[Math.floor(Math.random() * urls.length)];
				return envKey === "URL302" ? Response.redirect(target, 302) : fetch(new Request(target, request));
			}
			return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>Welcome to nginx!</title></head><body><h1>Welcome to nginx!</h1></body></html>`, {
				headers: { "Content-Type": "text/html; charset=UTF-8" }
			});
		}

		try {
			const providedToken = getProvidedToken(url);
			const headers = new Headers();
			let authTokenSet = false;

			if (env.TOKEN_PATH) {
				const configs = addConfigList(env.TOKEN_PATH);
				const pn = decodeURIComponent(url.pathname.toLowerCase());

				for (const cfg of configs) {
					const [requiredToken, pathPart] = cfg.split("@").map(v => v.trim());
					if (!requiredToken || !pathPart) continue;

					const p = "/" + pathPart.toLowerCase();
					const match = pn === p || pn.startsWith(p + "/");
					if (!match) continue;

					if (!providedToken) return new Response("TOKEN不能为空", { status: 400 });
					if (providedToken !== requiredToken) return new Response("TOKEN错误", { status: 403 });
					if (!env.GH_TOKEN) return new Response("服务器GitHub TOKEN配置错误", { status: 500 });

					headers.set("Authorization", `token ${env.GH_TOKEN}`);
					authTokenSet = true;
					break;
				}
			}

			if (!authTokenSet) {
				if (env.GH_TOKEN && env.TOKEN) {
					token = providedToken === env.TOKEN ? env.GH_TOKEN : (providedToken || token);
				} else {
					token = providedToken || env.GH_TOKEN || env.TOKEN || token;
				}

				if (!token || token === "") return new Response("TOKEN不能为空", { status: 400 });
				headers.set("Authorization", `token ${token}`);
			}

			const rawUrl = buildGitHubRawUrl(url, env);
			const res = await fetch(rawUrl, { headers });

			if (res.ok) {
				return new Response(res.body, {
					status: res.status,
					headers: res.headers
				});
			}

			return new Response(env.ERROR || "无法获取文件，检查路径或TOKEN是否正确。", {
				status: res.status
			});
		} catch (e) {
			return new Response(`服务器错误: ${e.message}`, { status: 500 });
		}
	}
};
