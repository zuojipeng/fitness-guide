// 从 MuscleMap（MIT，Melih Colpan）的 Swift 源文件生成 public/body-paths.json。
// 只取男性正面/背面的主要肌群，去掉细分子区域；记录每块肌肉对应动作库里的肌肉 key。
// 用法：node scripts/build-body-paths.mjs
import {writeFileSync} from 'node:fs';
const COMMIT = 'd53ddf4d480b65979f1008b203e6b6eda0e67e54';
const RAW = `https://raw.githubusercontent.com/melihcolpan/MuscleMap/${COMMIT}/Sources/MuscleMap/Data/`;
// MuscleMap 肌群 → free-exercise-db 的 primaryMuscles（null = 只画轮廓，不可点）
const MAP = {
  chest: ['chest'], abs: ['abdominals'], obliques: ['abdominals'], biceps: ['biceps'], triceps: ['triceps'],
  deltoids: ['shoulders'], forearm: ['forearms'], quadriceps: ['quadriceps'], adductors: ['adductors'],
  calves: ['calves'], trapezius: ['traps'], neck: ['neck'], gluteal: ['glutes', 'abductors'],
  hamstring: ['hamstrings'], lowerBack: ['lower back'], upperBack: ['lats', 'middle back'],
  tibialis: null, head: null, hair: null, hands: null, feet: null, ankles: null, knees: null,
};
async function parse(file) {
  const src = await (await fetch(RAW + file)).text();
  const parts = [];
  for (const block of src.split('BodyPartPathData(').slice(1)) {
    const slug = block.match(/slug:\s*\.(\w+)/)[1];
    if (!(slug in MAP)) continue; // 细分子区域（upperChest、innerQuad…）不要
    const paths = [...block.matchAll(/"(M[^"]+)"/g)].map((m) => m[1]);
    parts.push({slug, muscles: MAP[slug], paths});
  }
  return parts;
}
// MIT 要求版权和许可声明随副本一起分发：把 LICENSE 原文写进数据文件本身
const license = await (await fetch(`https://raw.githubusercontent.com/melihcolpan/MuscleMap/${COMMIT}/LICENSE`)).text();
const out = {
  source: `MuscleMap by Melih Colpan (MIT), commit ${COMMIT}, https://github.com/melihcolpan/MuscleMap`,
  license,
  front: {viewBox: [0, 95, 727, 1280], parts: await parse('MaleFrontPaths.swift')},
  back: {viewBox: [718, 95, 727, 1280], parts: await parse('MaleBackPaths.swift')},
};
writeFileSync(new URL('../public/body-paths.json', import.meta.url), JSON.stringify(out));
for (const v of ['front', 'back']) console.log(v, out[v].parts.map((p) => p.slug + (p.muscles ? '' : '·')).join(' '));
