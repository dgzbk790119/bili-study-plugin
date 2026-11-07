# dsh-bili-study（B 站学习台）

DeepSeek Harness（dsh）面板插件：聚合 B 站知识 UP 主的视频，按「科目 → 章 → 主题」目录学习，边看边记笔记，在面板里问 AI 查概念，带积分奖励。已有视频可以用面板的「智能分类」按钮批量归到学科主题（先预览建议，确认后才写入）。

## 结构
- `index.js`：Host 半边。注册给模型的工具，提供 `/bili-study/` 页面和 `/api/state`、`/api/fetch`、`/api/ask`（按前端预设 id 选 system 提示与 maxTokens）、`/api/classify`、`/api/links`（按科目生成 AI 前置连线，只返回不写盘）接口
- `client.js`：浏览器半边。侧栏加「B 站学习台」入口，主区域用 iframe 嵌入页面；把 dsh 明暗主题 postMessage 给页面
- `lib/bili.js`：解析 B 站链接（UP 主主页、收藏夹、单个视频）并抓取视频
- `lib/store.js`：状态读写，存在 `$DSH_HOME/bili-study/state.json`（默认 `~/.dsh`）；`links` 存科目下的前置连线 `[{ from, to }]`
- `lib/tools.js`：模型工具 `bili_study_save_catalog`、`bili_study_fetch`
- `web/index.html`：面板骨架；笔记标题栏的「∑ 公式」按钮弹出符号面板（浮层不占布局）
- `web/app.js`：面板逻辑（纯脚本，无框架）。学科树、观看页、概念速查、笔记；通用 SVG 知识图谱渲染器 `renderGraph`（观看页与概念速查共用）；观看页的节内切换条与 AI 前置连线
- `web/style.css`：主题变量与组件样式（明暗主题、公式浮层、知识图谱、节内切换条）
- `web/katex/`：内置的 KaTeX，用来渲染公式

## 发布（让别人能安装）
- `package.json` 必须是可发布包：不要 `private`；`dsh.bundle.patch` 指向 `cordis.patch.yml`；有界面时保留 `dsh.client.platform: "web"` 与 `exports["./client"]`；`files` 要覆盖 `lib/`、`web/`、`locale/`、入口、patch、README、LICENSE
- `engines.dsh` 声明兼容范围（当前用 `>=0.2.1-rc.5 <0.3.0`，预发布版本也参与匹配）；改动 DSH API 依赖后要同步调整
- 规则与发布渠道见 `PUBLISHING.md`；发布前跑 `npm pack --dry-run`，并在隔离 profile 里实测安装
- 用户侧安装：面板「插件 → 添加插件」填包名/Git 地址/压缩包/绝对路径；或 `dsh plugin --profile <name> add <spec>`

## 约束
- 不登录 B 站，不规避反爬，抓取限速
- 播放用 B 站官方嵌入播放器，不搬运视频
- 数据只存本机，不做账户
- 页面要离线可用，不引外部 CDN
