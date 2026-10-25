// Worker 的 /api/* 路由：状态码、字段、真实总数、异常输入
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const env = {ASSETS: {fetch: async () => new Response('asset')}};
const call = async (path, method = 'GET') => {
  const r = await worker.fetch(new Request('https://fitness.test' + path, {method}), env, {waitUntil() {}});
  const text = await r.text();
  return {status: r.status, body: r.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text};
};

test('搜索：字段齐全，total 是真实匹配数，limit 只限制返回条数', async () => {
  const r = await call('/api/search?q=' + encodeURIComponent('深蹲') + '&limit=3');
  assert.equal(r.status, 200);
  assert.equal(r.body.items.length, 3);
  assert.ok(r.body.total > 3);
  for (const k of ['id', 'name', 'equipmentZh', 'primaryMuscles', 'instructions', 'images', 'videos']) assert.ok(k in r.body.items[0], k);
});

test('参数错误与不存在', async () => {
  assert.equal((await call('/api/search?q=')).status, 400);
  assert.equal((await call('/api/search?q=' + 'x'.repeat(41))).status, 400);
  assert.equal((await call('/api/exercise/Nope')).status, 404);
  assert.equal((await call('/api/exercise/%E0')).status, 404); // 格式错误的编码不抛异常
  assert.equal((await call('/api/muscle/%E0')).status, 404);
  assert.equal((await call('/api/muscle/toString')).status, 404); // 原型链上的名字不算肌肉
  assert.equal((await call('/api/nothing')).status, 404);
  assert.equal((await call('/api/search?q=squat', 'POST')).status, 405);
});

test('单个动作与按肌肉列表', async () => {
  const one = await call('/api/exercise/Plank');
  assert.equal(one.status, 200);
  assert.equal(one.body.id, 'Plank');
  const lats = await call('/api/muscle/lats?limit=5');
  assert.equal(lats.status, 200);
  assert.equal(lats.body.items.length, 5);
  assert.ok(lats.body.total >= 5);
  assert.ok(lats.body.items.every((e) => e.primaryMuscles.some((m) => m.key === 'lats')));
});

test('非 /api、非 /img 的请求交给静态资源', async () => {
  assert.equal((await call('/')).body, 'asset');
});
