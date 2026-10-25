// 搜索逻辑：网页（app.js）和 Worker 接口（src/worker.js）共用这一份，保证两边结果一致。

// 每类动作里最"标准"的版本，搜索时排在前面
const FEATURED = new Set(["Barbell_Full_Squat", "Barbell_Squat", "Goblet_Squat", "Barbell_Bench_Press_-_Medium_Grip", "Dumbbell_Bench_Press",
  "Barbell_Deadlift", "Romanian_Deadlift", "Bent_Over_Barbell_Row", "One-Arm_Dumbbell_Row", "Seated_Cable_Rows", "Barbell_Glute_Bridge",
  "Barbell_Hip_Thrust", "Wide-Grip_Lat_Pulldown", "Barbell_Lunge", "Dumbbell_Lunges", "Plank", "Pushups", "Pullups", "Chin-Up",
  "Dumbbell_Shoulder_Press", "Barbell_Shoulder_Press", "Barbell_Curl", "Dumbbell_Bicep_Curl", "Hammer_Curls", "Side_Lateral_Raise",
  "Crunches", "Dips_-_Triceps_Version", "Leg_Press", "Lying_Leg_Curls", "Leg_Extensions", "Standing_Calf_Raises", "Face_Pull"]);

// 统一成"空格分隔的小写单词"，用词首匹配，避免 row 命中 narrow/throw
const norm = (s) => " " + s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function createSearch(data, zhTerms) {
  const zhKeys = Object.keys(zhTerms).sort((a, b) => b.length - a.length);
  const DB = data.map((e) => ({
    ...e,
    _name: norm(e.name),
    _meta: norm([e.equipment, e.category, ...e.primaryMuscles, ...e.secondaryMuscles].join(" ")),
  }));
  const byId = new Map(DB.map((e) => [e.id, e]));

  // 把查询拆成若干"词组"，每个词组是一组同义英文写法，命中任一即可。
  function parseQuery(raw) {
    let q = raw.trim().toLowerCase();
    const groups = [];
    for (const k of zhKeys) {
      if (q.includes(k)) {
        for (const g of zhTerms[k]) groups.push(g);
        q = q.split(k).join(" ");
      }
    }
    q.replace(/[一-鿿]/g, " ")
      .split(/[\s,，]+/)
      .filter((w) => w.length > 1)
      .forEach((w) => groups.push([w.replace(/s$/, "")]));
    return groups.map((g) => g.map(norm));
  }

  function search(raw, limit = 60) {
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
    return (full.length ? full : scored).slice(0, limit).map(([, e]) => e);
  }

  // 主练某块肌肉的动作（肌肉图用）：标准动作在前，其余按名字长短
  function byMuscle(key, limit = 60) {
    return DB.filter((e) => e.primaryMuscles.includes(key))
      .sort((a, b) => (FEATURED.has(b.id) - FEATURED.has(a.id)) || a._name.length - b._name.length)
      .slice(0, limit);
  }

  return { search, byMuscle, get: (id) => byId.get(id), size: DB.length };
}

// 接口返回的动作格式（控制台等外部调用方使用）
export function describe(e, labels, q = "") {
  const zh = (group, v) => labels[group][v] || v;
  const zhQuery = /[一-鿿]/.test(q) ? q : e.name;
  const muscles = (list) => list.map((key) => ({ key, zh: zh("muscle", key) }));
  return {
    id: e.id,
    name: e.name,
    level: e.level, levelZh: zh("level", e.level),
    category: e.category, categoryZh: zh("category", e.category),
    equipment: e.equipment || "other", equipmentZh: zh("equipment", e.equipment || "other"),
    primaryMuscles: muscles(e.primaryMuscles),
    secondaryMuscles: muscles(e.secondaryMuscles),
    instructions: e.instructions,
    images: e.images.map((p) => "/img/" + p),
    videos: {
      bilibili: "https://search.bilibili.com/all?keyword=" + encodeURIComponent(zhQuery + " 动作教学"),
      youtube: "https://www.youtube.com/results?search_query=" + encodeURIComponent(e.name + " proper form"),
    },
    page: "/#id=" + encodeURIComponent(e.id),
  };
}
