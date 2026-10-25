import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSearch, describe} from '../public/search.js';
import {ZH_TERMS, ZH_LABELS} from '../public/zh.js';

const data = JSON.parse(readFileSync(new URL('../public/exercises.json', import.meta.url), 'utf8'));
// baseline.json：2026-10-25 用重构前（commit dd24a86）app.js 的搜索逻辑生成，17 个查询词的前 10 条结果
const baseline = JSON.parse(readFileSync(new URL('./baseline.json', import.meta.url), 'utf8'));
const s = createSearch(data, ZH_TERMS);

test('热门词搜索结果与重构前一致（前 10 条）', () => {
  for (const [q, ids] of Object.entries(baseline)) assert.deepEqual(s.search(q).slice(0, 10).map((e) => e.id), ids, q);
});

test('limit 生效，空查询返回空', () => {
  assert.equal(s.search('深蹲', 3).length, 3);
  assert.deepEqual(s.search('   '), []);
});

test('按肌肉列动作：只含主练该肌肉的动作，标准动作在前', () => {
  const lats = s.byMuscle('lats', 20);
  assert.ok(lats.length > 0);
  assert.ok(lats.every((e) => e.primaryMuscles.includes('lats')));
  const quadFeatured = ['Barbell_Full_Squat', 'Barbell_Squat', 'Goblet_Squat', 'Barbell_Lunge', 'Dumbbell_Lunges', 'Leg_Press', 'Leg_Extensions'];
  assert.ok(s.byMuscle('quadriceps', 3).every((e) => quadFeatured.includes(e.id)));
});

test('describe 输出中文标签、图片路径和视频链接', () => {
  const d = describe(s.get('Barbell_Full_Squat'), ZH_LABELS, '深蹲');
  assert.equal(d.equipmentZh, '杠铃');
  assert.equal(d.primaryMuscles[0].zh, '股四头肌');
  assert.ok(d.images.every((p) => p.startsWith('/img/Barbell_Full_Squat/')));
  assert.match(d.videos.bilibili, /keyword=%E6%B7%B1%E8%B9%B2/);
  assert.equal(d.page, '/#id=Barbell_Full_Squat');
});
