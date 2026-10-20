// 静态资源由 Workers Assets 直接返回；这里只处理 /img/*：
// 从 GitHub 拉取动作图片并在边缘缓存，避免浏览器直连 raw.githubusercontent.com。
const IMG_ORIGIN = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/img/")) return env.ASSETS.fetch(request);

    const path = url.pathname.slice(5);
    if (!/^[\w\-./]+\.(jpg|png|gif)$/i.test(path) || path.includes("..")) {
      return new Response("Not found", { status: 404 });
    }

    const cache = caches.default;
    const hit = await cache.match(request);
    if (hit) return hit;

    const upstream = await fetch(IMG_ORIGIN + path, { cf: { cacheEverything: true, cacheTtl: 2592000 } });
    if (!upstream.ok) return new Response("Not found", { status: 404 });

    const res = new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "image/jpeg",
        "Cache-Control": "public, max-age=2592000, immutable",
      },
    });
    ctx.waitUntil(cache.put(request, res.clone()));
    return res;
  },
};
