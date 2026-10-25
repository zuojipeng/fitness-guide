// 静态资源由 Workers Assets 直接返回；这里处理：
// - /api/*：动作搜索接口（和网页共用 public/search.js）
// - /img/*：从 GitHub 拉取动作图片并在边缘缓存，避免浏览器直连 raw.githubusercontent.com
import data from "../public/exercises.json" with { type: "json" };
import { createSearch, describe } from "../public/search.js";
import { ZH_TERMS, ZH_LABELS } from "../public/zh.js";

const IMG_ORIGIN = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
const lib = createSearch(data, ZH_TERMS);

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" },
});
// 格式错误的 %xx 不让 Worker 抛异常，按“不存在”处理
const decode = (s) => { try { return decodeURIComponent(s); } catch { return null; } };
const limitOf = (url) => Math.min(30, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20));

function api(url) {
  const parts = url.pathname.split("/").filter(Boolean); // ["api", ...]
  if (parts[1] === "search" && parts.length === 2) {
    const q = (url.searchParams.get("q") || "").trim();
    if (!q || q.length > 40) return json({ error: "q 不能为空，且不超过 40 个字" }, 400);
    const all = lib.search(q, Infinity);
    return json({ query: q, total: all.length, items: all.slice(0, limitOf(url)).map((e) => describe(e, ZH_LABELS, q)) });
  }
  if (parts[1] === "exercise" && parts.length === 3) {
    const id = decode(parts[2]);
    const e = id && lib.get(id);
    return e ? json(describe(e, ZH_LABELS)) : json({ error: "动作不存在" }, 404);
  }
  if (parts[1] === "muscle" && parts.length === 3) {
    const key = decode(parts[2]);
    if (!key || !Object.hasOwn(ZH_LABELS.muscle, key)) return json({ error: "未知肌肉" }, 404);
    const all = lib.byMuscle(key, Infinity);
    return json({ muscle: key, muscleZh: ZH_LABELS.muscle[key], total: all.length, items: all.slice(0, limitOf(url)).map((e) => describe(e, ZH_LABELS)) });
  }
  return json({ error: "接口不存在" }, 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      if (request.method !== "GET") return json({ error: "只支持 GET" }, 405);
      return api(url);
    }
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
