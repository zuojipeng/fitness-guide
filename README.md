# 健身动作指南

输入想练的动作（中文或英文），查看动作图解、分解动画和视频教学。

线上地址：https://fitness-guide.hahazuo460.workers.dev

- 动作库：[free-exercise-db](https://github.com/yuhonas/free-exercise-db)（876 个动作，公共领域），存放在 `public/exercises.json`
- 中文检索：`public/zh.js` 里的中英词表，可以继续往里加词
- 图片：Worker 在 `/img/*` 代理 GitHub 上的原图并做边缘缓存（`src/worker.js`）
- 视频教学：跳转到 B 站 / YouTube 的对应搜索结果

## 本地开发与部署

```bash
npx wrangler dev      # 本地预览
npx wrangler deploy   # 部署到 Cloudflare Workers
```
