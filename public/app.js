import { createSearch } from "./search.js";
import { ZH_TERMS, ZH_LABELS as L, HOT } from "./zh.js";

const $ = (s) => document.querySelector(s);
let lib = null;
const img = (path) => "/img/" + path;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const zh = (group, v) => L[group][v] || v;

function card(e) {
  return `<button class="card" data-id="${esc(e.id)}">
    <div class="anim">${e.images.map((p) => `<img loading="lazy" src="${img(p)}" alt="">`).join("")}</div>
    <div class="info">
      <h3>${esc(e.name)}</h3>
      <p>${e.primaryMuscles.map((m) => zh("muscle", m)).join(" · ")} ｜ ${zh("equipment", e.equipment || "other")}</p>
    </div>
  </button>`;
}

function render(raw) {
  const list = lib.search(raw);
  $("#results").innerHTML = list.map(card).join("");
  $("#status").textContent = list.length
    ? `“${raw}” 找到 ${list.length} 个动作，点击查看图解与教学`
    : `没有找到“${raw}”，试试换个说法，比如“哑铃卧推”或英文 “bench press”`;
}

function showDetail(id) {
  const e = lib.get(id);
  if (!e) return;
  const q = $("#q").value.trim();
  const zhQuery = /[一-鿿]/.test(q) ? q : e.name;
  const tags = [
    zh("level", e.level), zh("category", e.category), zh("equipment", e.equipment || "other"),
    ...e.primaryMuscles.map((m) => "主练 " + zh("muscle", m)),
    ...e.secondaryMuscles.map((m) => "辅助 " + zh("muscle", m)),
  ];
  $("#detail-body").innerHTML = `
    <h2>${esc(e.name)}</h2>
    <div class="tags">${tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>
    <section>
      <h4>分解动画</h4>
      <div class="anim big">${e.images.map((p) => `<img src="${img(p)}" alt="">`).join("")}</div>
    </section>
    <section>
      <h4>动作图解</h4>
      <div class="frames">${e.images.map((p, i) => `<figure><img src="${img(p)}" alt=""><figcaption>${i === 0 ? "① 起始姿势" : "② 发力终点"}</figcaption></figure>`).join("")}</div>
    </section>
    <section>
      <h4>视频教学</h4>
      <div class="videos">
        <a class="btn bili" target="_blank" rel="noopener" href="https://search.bilibili.com/all?keyword=${encodeURIComponent(zhQuery + " 动作教学")}">B站：${esc(zhQuery)} 教学视频</a>
        <a class="btn yt" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=${encodeURIComponent(e.name + " proper form")}">YouTube：${esc(e.name)}</a>
      </div>
    </section>
    <section>
      <h4>动作要领（英文原文）</h4>
      <ol class="steps">${e.instructions.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
    </section>`;
  $("#detail").showModal();
  $("#detail").scrollTop = 0;
}

function go(q) {
  $("#q").value = q;
  history.replaceState(null, "", "#q=" + encodeURIComponent(q));
  render(q);
}

$("#hot").innerHTML = HOT.map((h) => `<button type="button">${h}</button>`).join("");
$("#hot").addEventListener("click", (ev) => ev.target.tagName === "BUTTON" && go(ev.target.textContent));
$("#search").addEventListener("submit", (ev) => { ev.preventDefault(); const q = $("#q").value.trim(); if (q) go(q); });
$("#results").addEventListener("click", (ev) => { const c = ev.target.closest(".card"); if (c) showDetail(c.dataset.id); });
$("#detail").addEventListener("click", (ev) => { if (ev.target.id === "detail") ev.target.close(); });

// 按部位找动作：点肌肉图
function goMuscle(keys, label) {
  keys = keys.filter((k) => Object.hasOwn(L.muscle, k)); // 网址里的参数只接受已知肌肉
  if (!keys.length) return;
  const seen = new Set();
  const list = keys.flatMap((k) => lib.byMuscle(k, Infinity)).filter((e) => !seen.has(e.id) && seen.add(e.id));
  history.replaceState(null, "", "#m=" + encodeURIComponent(keys.join(",")));
  document.querySelectorAll(".body path.on").forEach((el) => el.classList.remove("on"));
  document.querySelectorAll(`.body path[data-m="${keys.join(",")}"]`).forEach((el) => el.classList.add("on"));
  $("#results").innerHTML = list.map(card).join("");
  $("#status").textContent = `主练「${label}」的动作 ${list.length} 个，点击查看图解与教学`;
  $("#status").scrollIntoView({ behavior: "smooth", block: "start" });
}

function drawBody(paths) {
  const view = (side, title) => {
    const v = paths[side];
    const shapes = v.parts.map((p) => {
      const d = p.paths.join(" ");
      if (!p.muscles) return `<path class="shell" d="${d}"/>`;
      const label = [...new Set(p.muscles.map((m) => L.muscle[m] || m))].join(" · ");
      return `<path data-m="${p.muscles.join(",")}" data-label="${esc(label)}" d="${d}"><title>${esc(label)}</title></path>`;
    }).join("");
    return `<figure><svg viewBox="${v.viewBox.join(" ")}" role="img" aria-label="${title}">${shapes}</svg><figcaption>${title}</figcaption></figure>`;
  };
  $("#body").innerHTML = view("front", "正面") + view("back", "背面");
  $("#body").addEventListener("click", (ev) => {
    const el = ev.target.closest("path[data-m]");
    if (el) goMuscle(el.dataset.m.split(","), el.dataset.label);
  });
}

Promise.all([fetch("/exercises.json").then((r) => r.json()), fetch("/body-paths.json").then((r) => r.json())])
  .then(([data, paths]) => {
    lib = createSearch(data, ZH_TERMS);
    drawBody(paths);
    // 网址里的参数可能是坏链接：解码失败或肌肉名无效时，当作没有参数
    const hash = (k) => {
      const raw = (location.hash.match(new RegExp(k + "=([^&]+)")) || [])[1] || "";
      try { return decodeURIComponent(raw); } catch { return ""; }
    };
    const muscles = hash("m").split(",").filter((m) => Object.hasOwn(L.muscle, m));
    if (hash("q")) go(hash("q"));
    else if (muscles.length) goMuscle(muscles, [...new Set(muscles.map((m) => L.muscle[m]))].join(" · "));
    else $("#status").textContent = `动作库共 ${lib.size} 个动作，输入你想练的动作，或者点下面的身体部位`;
    if (hash("id")) showDetail(hash("id"));
  })
  .catch(() => ($("#status").textContent = "动作库加载失败，请刷新重试"));

