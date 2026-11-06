# dsh-bili-study（学习台）

DeepSeek Harness（dsh）面板插件：聚合 B 站知识 UP 主的视频，按「科目 → 章 → 主题」目录学习，边看边记笔记，在面板里问 AI 查概念，带积分奖励。

## 结构
- `index.js`：Host 半边。注册给模型的工具，提供 `/bili-study/` 页面和 `/api/state`、`/api/fetch`、`/api/ask` 接口
- `client.js`：浏览器半边。侧栏加「学习台」入口，主区域用 iframe 嵌入页面；把 dsh 明暗主题 postMessage 给页面
- `lib/bili.js`：解析 B 站链接（UP 主主页、收藏夹、单个视频）并抓取视频
- `lib/store.js`：状态读写，存在 `$DSH_HOME/bili-study/state.json`（默认 `~/.dsh`）
- `lib/tools.js`：模型工具 `bili_study_save_catalog`、`bili_study_fetch`
- `web/`：面板页面（纯脚本，无框架）；`web/katex/` 是内置的 KaTeX，用来渲染公式

## 约束
- 不登录 B 站，不规避反爬，抓取限速
- 播放用 B 站官方嵌入播放器，不搬运视频
- 数据只存本机，不做账户
- 页面要离线可用，不引外部 CDN
