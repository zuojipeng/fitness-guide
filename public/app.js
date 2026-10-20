(() => {
  const $ = (s) => document.querySelector(s);
  const L = window.ZH_LABELS;
  const zhKeys = Object.keys(window.ZH_TERMS).sort((a, b) => b.length - a.length);
  let DB = [];
  // 每类动作里最"标准"的版本，搜索时排在前面
  const FEATURED = new Set(["Barbell_Full_Squat", "Barbell_Squat", "Goblet_Squat", "Barbell_Bench_Press_-_Medium_Grip", "Dumbbell_Bench_Press",
    "Barbell_Deadlift", "Romanian_Deadlift", "Bent_Over_Barbell_Row", "One-Arm_Dumbbell_Row", "Seated_Cable_Rows", "Barbell_Glute_Bridge",
    "Barbell_Hip_Thrust", "Wide-Grip_Lat_Pulldown", "Barbell_Lunge", "Dumbbell_Lunges", "Plank", "Pushups", "Pullups", "Chin-Up",
    "Dumbbell_Shoulder_Press", "Barbell_Shoulder_Press", "Barbell_Curl", "Dumbbell_Bicep_Curl", "Hammer_Curls", "Side_Lateral_Raise",
    "Crunches", "Dips_-_Triceps_Version", "Leg_Press", "Lying_Leg_Curls", "Leg_Extensions", "Standing_Calf_Raises", "Face_Pull"]);
  // 统一成"空格分隔的小写单词"，用词首匹配，避免 row 命中 narrow/throw
  const norm = (s) => " " + s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  const img = (path) => "/img/" + path;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const zh = (group, v) => L[group][v] || v;

  // 把查询拆成若干"词组"，每个词组是一组同义英文写法，命中任一即可。
  function parseQuery(raw) {
    let q = raw.trim().toLowerCase();
    const groups = [];
    for (const k of zhKeys) {
      if (q.includes(k)) {
        for (const g of window.ZH_TERMS[k]) groups.push(g);
        q = q.split(k).join(" ");
      }
    }
    q.replace(/[一-鿿]/g, " ")
      .split(/[\s,，]+/)
      .filter((w) => w.length > 1)
      .forEach((w) => groups.push([w.replace(/s$/, "")]));
    return groups.map((g) => g.map(norm));
  }

  function search(raw) {
    const groups = parseQuery(raw);
    if (!groups.length) return [];
    const scored = [];
    for (const e of DB) {
      let score = 0, hit = 0;
      for (const g of groups) {
        if (g.some((t) => e._name.includes(t))) { score += 10; hit++; }
        else if (g.some((t) => e._meta.includes(t))) { score += 3; hit++; }
      }
      if (!hit) continue;
      if (hit === groups.length) score += 50; // 所有词都命中优先
      if (FEATURED.has(e.id)) score += 8;
      score -= e._name.length / 20; // 名字越短越"标准"
      scored.push([score, e]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    // 有全命中的结果时，只展示全命中的
    const full = scored.filter(([s]) => s >= 50);
    return (full.length ? full : scored).slice(0, 60).map(([, e]) => e);
  }

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
    const list = search(raw);
    $("#results").innerHTML = list.map(card).join("");
    $("#status").textContent = list.length
      ? `“${raw}” 找到 ${list.length} 个动作，点击查看图解与教学`
      : `没有找到“${raw}”，试试换个说法，比如“哑铃卧推”或英文 “bench press”`;
  }

  function showDetail(id) {
    const e = DB.find((x) => x.id === id);
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

  $("#hot").innerHTML = window.HOT.map((h) => `<button type="button">${h}</button>`).join("");
  $("#hot").addEventListener("click", (ev) => ev.target.tagName === "BUTTON" && go(ev.target.textContent));
  $("#search").addEventListener("submit", (ev) => { ev.preventDefault(); const q = $("#q").value.trim(); if (q) go(q); });
  $("#results").addEventListener("click", (ev) => { const c = ev.target.closest(".card"); if (c) showDetail(c.dataset.id); });
  $("#detail").addEventListener("click", (ev) => { if (ev.target.id === "detail") ev.target.close(); });

  fetch("/exercises.json")
    .then((r) => r.json())
    .then((data) => {
      DB = data.map((e) => ({
        ...e,
        _name: norm(e.name),
        _meta: norm([e.equipment, e.category, ...e.primaryMuscles, ...e.secondaryMuscles].join(" ")),
      }));
      const init = decodeURIComponent((location.hash.match(/q=([^&]+)/) || [])[1] || "");
      if (init) go(init);
      else $("#status").textContent = `动作库共 ${DB.length} 个动作，输入你想练的动作开始吧`;
    })
    .catch(() => ($("#status").textContent = "动作库加载失败，请刷新重试"));
})();
