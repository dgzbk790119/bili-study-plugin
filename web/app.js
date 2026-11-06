/* 学习台 面板逻辑（纯脚本，无框架） */
'use strict'
const $ = (s, r) => (r || document).querySelector(s)
const $$ = (s, r) => [...(r || document).querySelectorAll(s)]
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const fmtDur = (s) => { s = Number(s) || 0; return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` }
const fmtPlay = (n) => (n >= 1e4 ? (n / 1e4).toFixed(1) + '万' : String(n || 0))
const bvUrl = (v, p) => `https://www.bilibili.com/video/${v.bvid}${p > 1 ? '?p=' + p : ''}`
const playerSrc = (v, p) => `https://player.bilibili.com/player.html?isOutside=true&bvid=${v.bvid}&p=${p || 1}&autoplay=0&high_quality=1&danmaku=0`

// ---- 预设的概念学习提示词（可脚本化，无需 AI 现场发挥）----
const PRESETS = [
  { id: 'plain', label: '通俗讲解', tpl: '请用通俗易懂的方式给我讲清楚「{x}」。从零基础讲起，先给一句话定义，再讲核心要点，举一个生活中的例子，最后用一句话总结。' },
  { id: 'feynman', label: '费曼学习法', tpl: '请用费曼学习法给我讲「{x}」：假装讲给一个完全没学过的人听，用最简单的语言，然后指出初学者最容易误解的地方，最后出一道自测题考我。' },
  { id: 'map', label: '知识串联', tpl: '请解释「{x}」，并说清它和相邻知识点的关系：需要哪些前置知识？它之后通向哪里？请画一个简单的知识脉络（用文字版层级表示）。' },
  { id: 'exam', label: '题型总结', tpl: '围绕「{x}」这个知识点，总结常见题型和解题思路，各给一道典型例题并写出解析步骤（学习向，非刷题导向）。' },
  { id: 'analogy', label: '类比记忆', tpl: '请给「{x}」找一个生动的类比，帮助我长期记忆，并说明这个类比的适用边界（哪里不能类比）。' },
  { id: 'explore', label: '领域探索', tpl: '我想研究「{x}」这个概念。给我这个概念里最重要的 5～10 个名词（nouns，核心对象/实体），以及与它们相关的最重要的动词（verbs，核心过程/关系），并说明它们如何相互作用；最后给我一个最小单系统（minimal system）的集合——用最少的元素抓住这个概念的骨架。' },
]

// ---- 公式工具栏（笔记里快速插入算式/符号；模板是 LaTeX，符号是 Unicode）----
const FORMULA_BAR = [
  { label: '分式', tex: '$\\frac{}{}$', cur: 7 },
  { label: '根号', tex: '$\\sqrt{}$', cur: 7 },
  { label: '上标', tex: '$x^{}$', cur: 4 },
  { label: '下标', tex: '$x_{}$', cur: 4 },
  { label: '求和', tex: '$\\sum_{}^{}$', cur: 7 },
  { label: '积分', tex: '$\\int_{}^{}$', cur: 7 },
  { label: '∑', tex: '∑' }, { label: '∫', tex: '∫' }, { label: '∏', tex: '∏' },
  { label: '√', tex: '√' }, { label: 'π', tex: 'π' }, { label: 'θ', tex: 'θ' },
  { label: '∞', tex: '∞' }, { label: '±', tex: '±' }, { label: '×', tex: '×' }, { label: '÷', tex: '÷' },
  { label: '≤', tex: '≤' }, { label: '≥', tex: '≥' }, { label: '≠', tex: '≠' }, { label: '≈', tex: '≈' },
  { label: '∈', tex: '∈' }, { label: '∀', tex: '∀' }, { label: '∃', tex: '∃' }, { label: '→', tex: '→' },
  { label: 'Δ', tex: 'Δ' }, { label: '∂', tex: '∂' }, { label: '∇', tex: '∇' },
  { label: 'α', tex: 'α' }, { label: 'β', tex: 'β' }, { label: 'γ', tex: 'γ' }, { label: 'λ', tex: 'λ' },
  { label: 'σ', tex: 'σ' }, { label: 'ω', tex: 'ω' },
  { label: '²', tex: '²' }, { label: '³', tex: '³' }, { label: '°', tex: '°' }, { label: '·', tex: '·' },
]

// ---- 线条图标（Lucide 风格：24 网格、stroke=currentColor、stroke-width 2、fill none；离线可用）----
const ic = (inner) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`
const ICONS = {
  sparkles: ic('<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>'),
  plus: ic('<path d="M5 12h14"/><path d="M12 5v14"/>'),
  download: ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>'),
  note: ic('<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5z"/><path d="M15 3v6h6"/>'),
  eye: ic('<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'),
  save: ic('<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>'),
  bot: ic('<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>'),
  shuffle: ic('<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.8-1.1 2-1.7 3.3-1.7H22"/><path d="M18 2l4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="M18 14l4 4-4 4"/>'),
  tag: ic('<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>'),
  grid: ic('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'),
  dot: ic('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>'),
  star: ic('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
  starFill: `<svg class="ic" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  pencil: ic('<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>'),
  trash: ic('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>'),
  folder: ic('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>'),
  check: ic('<path d="M20 6 9 17l-5-5"/>'),
  more: `<svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`,
}
// 把 index.html 里 <span data-icon="…"> 占位符替换成对应 SVG
function decorateStaticIcons() {
  $$('[data-icon]').forEach((el) => { const s = ICONS[el.dataset.icon]; if (s) el.outerHTML = s })
}

// ---- 状态 ----
let STATE = null
let view = { mode: 'overview', topicId: null, bvid: null, part: 1, sourceId: null }
let selPreset = 'plain'
let notePreviewOn = false
let saveTimer = null
let collapsed = new Set()      // 学科树里收起的节点
let expandedSrc = new Set()    // UP主 区展开的来源（'' 表示未分类）
let upOpen = false             // UP主 区是否展开（默认收起）

const defaultState = () => ({ version: 1, catalog: [], videos: {}, sources: [], notes: {}, progress: {}, rewards: { points: 0, streak: 0, best: 0, lastActive: '', badges: [], log: [] }, lastWatch: null })

async function loadState() {
  try {
    const r = await fetch('/bili-study/api/state')
    const j = await r.json()
    STATE = { ...defaultState(), ...(j.state || {}) }
  } catch (e) {
    STATE = defaultState()
  }
  // 记住上次看的视频，直接回到那个页面
  const lw = STATE.lastWatch
  if (lw && lw.bvid && STATE.videos[lw.bvid]) {
    view = { mode: 'watch', bvid: lw.bvid, part: lw.part || 1, topicId: lw.topicId || null, sourceId: lw.sourceId || null }
  }
  renderAll()
}
function saveState(immediate) {
  if (saveTimer) clearTimeout(saveTimer)
  const run = () => fetch('/bili-study/api/state', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ state: STATE }) }).catch(() => {})
  if (immediate) return run()
  saveTimer = setTimeout(run, 400)
}
function persist() { saveState(true) }

// 软刷新：只更新数据与侧栏/顶栏，观看时不重建播放器，避免打断播放
async function refreshSoft() {
  try {
    const j = await (await fetch('/bili-study/api/state')).json()
    STATE = { ...defaultState(), ...(j.state || {}) }
  } catch { return }
  renderSide()
  if (view.mode !== 'watch') renderContent()
}

// ---- 目录 / 来源工具 ----
function walk(nodes, fn) { for (const n of nodes || []) { if (fn(n)) return true; if (n.children && walk(n.children, fn)) return true } return false }
function forAllNodes(fn) { const rec = (nodes) => { for (const n of nodes || []) { fn(n); if (n.children) rec(n.children) } }; rec(STATE.catalog) }
function findNode(id) { let out = null; walk(STATE.catalog, (n) => { if (n.id === id) { out = n; return true } }); return out }
function topicVideos(node) { return (node && node.videos) || [] }
function nodeCount(node) { let c = 0; walk([node], (n) => { c += (n.videos || []).length }); return c }
function assignedBvids() { const s = new Set(); walk(STATE.catalog, (n) => (n.videos || []).forEach((b) => s.add(b))); return s }
function unassigned() { const a = assignedBvids(); return Object.keys(STATE.videos).filter((b) => !a.has(b)) }
function videosOfSource(sourceId) { return Object.keys(STATE.videos).filter((b) => STATE.videos[b] && STATE.videos[b].sourceId === String(sourceId)) }
function isLeaf(n) { return !n.children || !n.children.length }
function isTopicDone(node) { const vs = topicVideos(node); return vs.length > 0 && vs.every((b) => STATE.progress[b] && STATE.progress[b].seen) }
function ancestorPath(topicId) { const parts = []; const rec = (nodes, trail) => { for (const n of nodes || []) { const t = [...trail, n]; if (n.id === topicId) { parts.push(...t); return true } if (n.children && rec(n.children, t)) return true } }; rec(STATE.catalog, []); return parts }
// 一个视频当前所属的主题节点（叶子），没归类返回 null
function topicOf(bvid) { let out = null; walk(STATE.catalog, (n) => { if (isLeaf(n) && (n.videos || []).includes(bvid)) { out = n; return true } }); return out }
// 观看时的播放列表：主题 → 来源 → 未分类
function watchList() {
  if (view.topicId) return (findNode(view.topicId) || {}).videos || []
  if (view.sourceId) return videosOfSource(view.sourceId)
  return unassigned()
}
// 把一个视频从所有主题里移除
function removeVideoFromTopic(bvid) { forAllNodes((n) => { if ((n.videos || []).includes(bvid)) n.videos = (n.videos || []).filter((x) => x !== bvid) }) }
// 把一个视频移动到指定主题（移动语义：先从其他主题移除，再加入目标）
function moveVideo(bvid, topicId) {
  removeVideoFromTopic(bvid)
  const t = findNode(topicId)
  if (t) { const set = new Set(t.videos || []); set.add(bvid); t.videos = [...set] }
}

// ---- 渲染 ----
function renderSide() { renderUpList(); renderTree(); renderHeader() }
function renderAll() { renderSide(); renderContent() }
function refreshUI() { renderSide(); if (view.mode !== 'watch') renderContent() }

// 今日目标：今天看完几个视频算完成（改这个常量即可调整目标）
const DAILY_GOAL_VIDEOS = 3

function renderHeader() {
  $('#points').textContent = STATE.rewards.points || 0
  $('#streak').textContent = `连续 ${STATE.rewards.streak || 0} 天`
  const done = Math.min(todaySeenCount(), DAILY_GOAL_VIDEOS)
  const ring = $('#goalRing')
  if (ring) {
    const C = 2 * Math.PI * 9
    const fg = ring.querySelector('.ring-fg')
    if (fg) fg.style.strokeDashoffset = String(C * (1 - (DAILY_GOAL_VIDEOS ? done / DAILY_GOAL_VIDEOS : 0)))
    ring.classList.toggle('done', DAILY_GOAL_VIDEOS > 0 && done >= DAILY_GOAL_VIDEOS)
    ring.title = `今日目标：${done}/${DAILY_GOAL_VIDEOS} 个视频`
  }
  const btn = $('#btnRewards')
  if (btn) btn.title = `学习奖励 · 今日目标 ${done}/${DAILY_GOAL_VIDEOS}`
}

// 学科树
function renderTree() {
  const box = $('#catalogTree')
  if (!STATE.catalog.length) { box.innerHTML = '<div class="empty">还没有目录。点「AI 建目录」或「加科目」开始。</div>'; return }
  const rec = (nodes, depth) => nodes.map((n) => {
    const leaf = isLeaf(n)
    const count = leaf ? (n.videos || []).length : nodeCount(n)
    const done = leaf && isTopicDone(n)
    const active = (view.mode === 'topic' && view.topicId === n.id) || (view.mode === 'watch' && view.topicId === n.id)
    const caret = leaf ? '<span class="caret"></span>' : `<span class="caret">${collapsed.has(n.id) ? '▸' : '▾'}</span>`
    const kids = n.children && n.children.length
      ? `<ul class="${collapsed.has(n.id) ? 'collapsed' : ''}">${rec(n.children, depth + 1)}</ul>`
      : ''
    return `<li>${row(n, leaf, count, done, active, caret)}${kids}</li>`
  }).join('')
  box.innerHTML = `<ul class="tree">${rec(STATE.catalog, 0)}</ul>`
}
function row(n, leaf, count, done, active, caret) {
  const cls = ['row', leaf ? 'leaf' : 'branch', active ? 'active' : '', done ? 'done' : ''].filter(Boolean).join(' ')
  return `<div class="row ${cls}" data-id="${esc(n.id)}">${caret}<span class="name">${esc(n.name)}</span><span class="n">${count || ''}</span></div>`
}

// UP主 区：来源 + 未分类，各带视频名列表（展开后）
function renderUpList() {
  const box = $('#upList')
  const total = Object.keys(STATE.videos).length
  const cnt = $('#upCount'); if (cnt) cnt.textContent = total
  const caret = $('#upCaret'); if (caret) caret.textContent = upOpen ? '▾' : '▸'
  box.classList.toggle('up-collapsed', !upOpen)
  const blocks = [upBlock('', '', '未分类', unassigned())]
  for (const s of STATE.sources || []) {
    blocks.push(upBlock(String(s.id), srcTag(s.type), srcDisplayName(s), videosOfSource(s.id)))
  }
  box.innerHTML = blocks.join('') || '<div class="empty">还没有来源。点「粘贴 B 站链接」加入。</div>'
}
function upBlock(id, tag, label, bvids) {
  const watchingHere = view.mode === 'watch' && !view.topicId && view.sourceId === (id || null)
  const exp = expandedSrc.has(id) || watchingHere
  const active = (view.mode === 'sources' && view.sourceId === (id || null)) || watchingHere
  const caret = bvids.length ? `<span class="caret">${exp ? '▾' : '▸'}</span>` : '<span class="caret"></span>'
  const tagHtml = tag ? `<span class="tag">${esc(tag)}</span>` : ''
  let h = `<div class="src ${active ? 'active' : ''}" data-src="${esc(id)}">${caret}${tagHtml}<span class="name">${esc(label)}</span><span class="n">${bvids.length || ''}</span><button class="vassign" data-grid="${esc(id)}" title="查看全部（网格）">${ICONS.grid}</button></div>`
  if (exp && bvids.length) {
    h += `<ul class="vlist">${bvids.map((b) => {
      const v = STATE.videos[b]
      const t = topicOf(b)
      const cur = view.mode === 'watch' && view.bvid === b
      return `<li class="vitem ${cur ? 'cur' : ''}" data-video="${esc(b)}" data-src="${esc(id)}" title="${esc(v ? v.title : '')}">
        <span class="vt">${esc(v ? v.title : b)}</span>
        ${t ? `<span class="vtag" title="学科：${esc(t.name)}">${ICONS.dot}</span>` : ''}
        <button class="vassign" data-assign="${esc(b)}" title="调整学科分类">${ICONS.tag}</button>
      </li>`
    }).join('')}</ul>`
  }
  return h
}
function srcTag(type) { return { up: 'UP主', fav: '收藏夹', video: '视频' }[type] || '来源' }
// 来源显示名：名字为空或仍是网址时，退回「类型 id」短名，避免显示整条网址
function srcDisplayName(s) {
  const name = String((s && s.name) || '').trim()
  if (!name || /^https?:\/\//i.test(name) || /bilibili\.com/i.test(name)) {
    return `${srcTag(s && s.type)} ${String((s && s.id) || '')}`.trim()
  }
  return name
}

function renderContent() {
  const box = $('#content')
  box.removeAttribute('aria-busy')
  if (view.mode === 'watch' && view.bvid) return renderWatch(box)
  if (view.mode === 'topic' && view.topicId) return renderTopic(box)
  if (view.mode === 'sources') return renderSourcesView(box)
  renderOverview(box)
  showSide(false)
}

// ---- 概览 ----
function renderOverview(box) {
  const total = Object.keys(STATE.videos).length
  const seen = Object.keys(STATE.videos).filter((b) => STATE.progress[b] && STATE.progress[b].seen).length
  const unc = unassigned().length
  const first = firstUnfinished()
  let h = `<div class="hero"><h1>欢迎来到学习台 👋</h1>
    <p>聚合 B 站学习视频，按目录专注学习。已收录 <b>${total}</b> 个视频 · 已看 <b>${seen}</b> 个 · 未分类 <b>${unc}</b> 个。</p>
    <div class="row">`
  if (first) h += `<button class="btn primary" data-go="topic:${esc(first.id)}">接着学：${esc(first.name)}</button>`
  h += `<button class="btn" id="hintAi">${ICONS.sparkles}<span>用提示词生成目录</span></button>
      <button class="btn" id="hintLink">${ICONS.plus}<span>粘贴 B 站链接抓视频</span></button></div></div>`
  if (unc) h += `<h2 class="title">未分类的视频</h2>${grid(unassigned())}`
  else h += `<div class="empty-state">还没有视频。<br>先从「粘贴 B 站链接」开始，把喜欢的博主主页加进来；再「AI 建目录」，把视频归到学科里。</div>`
  box.innerHTML = h
}
function firstUnfinished() {
  let out = null
  walk(STATE.catalog, (n) => { if (isLeaf(n) && (n.videos || []).length && !isTopicDone(n)) { out = n; return true } })
  return out
}

// ---- 主题 / 来源视图 ----
function renderTopic(box) {
  const n = findNode(view.topicId)
  if (!n) { box.innerHTML = '<p class="empty-state">没有这个主题。</p>'; return }
  const vs = (n.videos || []).map((b) => STATE.videos[b]).filter(Boolean)
  showSide(false)
  const path = ancestorPath(view.topicId).map((x) => esc(x.name)).join(' › ')
  const done = isTopicDone(n)
  const seenCount = (n.videos || []).filter((b) => STATE.progress[b] && STATE.progress[b].seen).length
  const totalCount = (n.videos || []).length
  const pct = totalCount ? Math.round(seenCount / totalCount * 100) : 0
  const progress = totalCount ? `<div class="progress">
    <div class="progress-label">已看 <b>${seenCount}</b> / ${totalCount}</div>
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
  </div>` : ''
  box.innerHTML = `<div class="crumb">${path}（右键目录项可重命名/删除）</div><h2 class="title">${esc(n.name)}${done ? '<span class="note">✓ 已学完</span>' : ''}</h2>${progress}
    ${n.note ? `<p class="crumb">${esc(n.note)}</p>` : ''}` + (vs.length ? grid(vs.map((v) => v.bvid)) : '<div class="empty-state">这个主题还没有视频。<br>点左侧 UP主 区的「归类」按钮，把视频归进来。</div>')
}
function renderSourcesView(box) {
  showSide(false)
  const list = view.sourceId ? videosOfSource(view.sourceId) : unassigned()
  const src = view.sourceId && (STATE.sources || []).find((s) => String(s.id) === String(view.sourceId))
  const title = view.sourceId ? (src ? `${srcTag(src.type)} · ${srcDisplayName(src)}` : '来源') : '未分类的视频'
  const hint = view.sourceId ? '<div class="crumb">点卡片下的「加入主题 / 调整分类」把视频归到学科目录；UP主 列表里视频会同时保留。</div>' : '<div class="crumb">这些视频还没归类。点卡片下的「加入主题」归到学科目录。</div>'
  box.innerHTML = `<h2 class="title">${esc(title)}</h2>${hint}` + (list.length ? grid(list) : '<div class="empty-state">这里还没有视频。</div>')
}

// ---- 观看 ----
function renderWatch(box) {
  const v = STATE.videos[view.bvid]
  if (!v) { box.innerHTML = '<p class="empty-state">没有这个视频。</p>'; return }
  showSide(true)
  markSeen(view.bvid)
  const p = view.part || 1
  const pages = v.pages || []
  const partbar = pages.length > 1 ? `<div class="partbar">${pages.map((pg) => `<button data-part="${pg.page}" class="${pg.page === p ? 'on' : ''}">P${pg.page} ${esc(pg.part)}</button>`).join('')}</div>` : ''
  const list = watchList()
  const i = list.indexOf(view.bvid)
  const nxt = list[i + 1]
  const t = topicOf(view.bvid)
  const subParts = []
  if (v.author) subParts.push(esc(v.author))
  subParts.push(`${fmtPlay(v.play)} 播放`)
  subParts.push(fmtDur(v.duration))
  if (v.collection) subParts.push(esc(v.collection))
  const subTail = t ? ` · 学科：<span class="tag">${esc(t.name)}</span>` : ' · 未归类'
  const playlist = list.length > 1 ? `<div class="playlist">
    <div class="playlist-head"><span>本节播放列表</span><span class="pl-pos">第 <b>${i + 1}</b> / 共 ${list.length} 个</span></div>
    <div class="playlist-list" id="playlistList">${list.map((b, idx) => {
      const vv = STATE.videos[b]
      const seen = STATE.progress[b] && STATE.progress[b].seen
      const cur = b === view.bvid
      return `<button class="pl-item ${cur ? 'cur' : ''}" data-pl="${esc(b)}" title="${esc(vv ? vv.title : b)}">
        <span class="pl-num">${idx + 1}</span>
        <span class="pl-title">${esc(vv ? vv.title : b)}</span>
        ${seen ? `<span class="pl-seen">${ICONS.check}</span>` : ''}
      </button>`
    }).join('')}</div>
  </div>` : ''
  box.innerHTML = `<div class="watch">
    <iframe class="player" allowfullscreen src="${playerSrc(v, p)}"></iframe>
    ${partbar}
    <div class="vtitle">${esc(v.title)}</div>
    <div class="vsub">${subParts.join(' · ')}${subTail}</div>
    <div class="bar">
      <a class="btn" href="${bvUrl(v, p)}" target="_blank" rel="noopener">去 B 站看（高清）↗</a>
      <button class="btn" data-act="classify">${ICONS.shuffle}<span>调整分类</span></button>
      ${nxt ? `<button class="btn" data-go="watch:${esc(nxt)}">下一个 →</button>` : ''}
      <button class="btn" data-act="toggleLater">${STATE.progress[view.bvid]?.later ? ICONS.starFill : ICONS.star}<span>${STATE.progress[view.bvid]?.later ? '已收藏' : '稍后看'}</span></button>
    </div>
    ${playlist}
    <div class="crumb">快捷键：<span class="kbd">j</span>/<span class="kbd">k</span> 上下切换 · 右侧记笔记 · <b>右键</b>标题可调整分类</div>
  </div>`
  renderNotePane(v, p)
  requestAnimationFrame(() => {
    const pl = box.querySelector('.playlist-list')
    if (pl) { const cur = pl.querySelector('.pl-item.cur'); if (cur) cur.scrollIntoView({ block: 'nearest' }) }
    const on = box.querySelector('.partbar button.on')
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })
}
function renderNotePane(v, p) {
  const key = noteKey(v.bvid, p)
  const note = STATE.notes[key]
  $('#noteText').value = note ? note.text : ''
  $('#noteHint').textContent = note && note.updatedAt ? '已存 ' + fmtWhen(note.updatedAt) : '自动保存'
  $('#noteText').dataset.key = key
  if (notePreviewOn) $('#notePreview').innerHTML = renderRich($('#noteText').value)
}
function noteKey(bvid, p) { return p > 1 ? `${bvid}-p${p}` : bvid }
function fmtWhen(ts) { try { const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` } catch { return '' } }
// 立即保存当前笔记（不等自动保存）
function saveNoteNow() {
  const ta = $('#noteText')
  const key = ta.dataset.key
  if (!key) return
  const n = STATE.notes[key] || (STATE.notes[key] = {})
  n.text = ta.value
  n.updatedAt = new Date().toISOString()
  if (ta.value.trim() && !n._rewarded) { n._rewarded = true; reward(10, '记笔记') }
  persist()
  $('#noteHint').textContent = '已保存 ' + fmtWhen(n.updatedAt)
  toast('笔记已保存')
}
function toggleNotePreview() {
  notePreviewOn = !notePreviewOn
  $('#notePreview').classList.toggle('hidden', !notePreviewOn)
  $('#btnPreview').classList.toggle('on', notePreviewOn)
  if (notePreviewOn) $('#notePreview').innerHTML = renderRich($('#noteText').value)
}

function showSide(on) { $('#sidePane').classList.toggle('hidden', !on) }

// ---- 视频网格 ----
function grid(bvids) {
  if (!bvids || !bvids.length) return '<div class="empty-state">这里还没有视频。</div>'
  return `<div class="grid">${bvids.map((b) => card(STATE.videos[b], b)).join('')}</div>`
}
function card(v, b) {
  if (!v) return ''
  const seen = STATE.progress[b] && STATE.progress[b].seen
  const img = v.pic ? `<img loading="lazy" referrerpolicy="no-referrer" src="${esc(v.pic)}@480w_270h.jpg" alt="">` : ''
  const t = topicOf(b)
  const inSourceView = view.mode === 'sources' || view.mode === 'overview'
  const menuBtn = inSourceView ? `<button class="card-menu" data-menu="${esc(b)}" title="${t ? '调整分类' : '加入主题'}">${ICONS.more}</button>` : ''
  const metaParts = []
  if (v.author) metaParts.push(v.author)
  metaParts.push(`${fmtPlay(v.play)} 播放`)
  if (t) metaParts.push(`学科：${t.name}`)
  return `<div class="card ${seen ? 'seen' : ''}" data-open="${esc(b)}">
    <div class="thumb">${img}${menuBtn}${seen ? `<span class="seen-check" title="已看过">${ICONS.check}</span>` : ''}<span class="d">${fmtDur(v.duration)}</span></div>
    <div class="meta"><div class="t">${esc(v.title)}</div><div class="s">${esc(metaParts.join(' · '))}</div></div>
  </div>`
}

// ---- 奖励（脚本化规则）----
function dayStr(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function todayStr() { return dayStr(new Date()) }
// 今天看完的视频数（progress[b].seen 存的是看过的毫秒时间戳）
function todaySeenCount() {
  const today = todayStr()
  let n = 0
  for (const b of Object.keys(STATE.progress || {})) {
    const p = STATE.progress[b]
    if (!p || !p.seen) continue
    const ts = typeof p.seen === 'number' ? p.seen : Date.parse(p.seen)
    if (ts && dayStr(new Date(ts)) === today) n++
  }
  return n
}
function touchStreak() {
  const r = STATE.rewards
  const today = todayStr()
  if (r.lastActive !== today) {
    const y = new Date(Date.now() - 86400e3)
    const ystr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`
    r.streak = r.lastActive === ystr ? (r.streak || 0) + 1 : 1
    r.best = Math.max(r.best || 0, r.streak)
    r.lastActive = today
  }
}
function reward(delta, label) {
  touchStreak()
  const r = STATE.rewards
  r.points = (r.points || 0) + delta
  r.log = r.log || []
  r.log.unshift({ t: new Date().toISOString(), delta, label })
  if (r.log.length > 50) r.log.length = 50
  updateBadges()
  if (delta > 0) toast(`⭐ +${delta} ${label}`)
  renderHeader()
}
function countDoneTopics() { let c = 0; walk(STATE.catalog, (n) => { if (isLeaf(n) && isTopicDone(n)) c++ }); return c }
// 徽章定义：cur/goal 同时用于解锁判断和「还差多少」的进度文案
function badgeDefs() {
  const r = STATE.rewards || {}
  const seen = Object.keys(STATE.progress || {}).filter((b) => STATE.progress[b] && STATE.progress[b].seen).length
  const notes = Object.keys(STATE.notes || {}).filter((k) => { const n = STATE.notes[k]; return n && n.text && n.text.trim() }).length
  const defs = [
    { id: 'first', ico: '🎯', n: '初来乍到', cur: seen, goal: 1, unit: '个视频' },
    { id: 'notes', ico: '📝', n: '笔记达人', cur: notes, goal: 1, unit: '篇笔记' },
    { id: 'streak3', ico: '🔥', n: '连续 3 天', cur: r.streak || 0, goal: 3, unit: '天' },
    { id: 'topic', ico: '🏆', n: '学完一个主题', cur: countDoneTopics(), goal: 1, unit: '个主题' },
    { id: 'v10', ico: '📚', n: '看完 10 个视频', cur: seen, goal: 10, unit: '个视频' },
    { id: 'p100', ico: '💯', n: '累计 100 分', cur: r.points || 0, goal: 100, unit: '分' },
    { id: 'streak7', ico: '⚡', n: '连续 7 天', cur: r.streak || 0, goal: 7, unit: '天' },
    { id: 'v50', ico: '🎓', n: '看完 50 个视频', cur: seen, goal: 50, unit: '个视频' },
  ]
  for (const d of defs) d.cond = d.cur >= d.goal
  return defs
}
function updateBadges() {
  const r = STATE.rewards
  const have = new Set(r.badges || [])
  for (const d of badgeDefs()) if (d.cond && !have.has(d.id)) have.add(d.id)
  r.badges = [...have]
}
function markSeen(bvid) {
  if (!bvid || !STATE.videos[bvid]) return
  const p = STATE.progress[bvid] || (STATE.progress[bvid] = {})
  if (!p.seen) { p.seen = Date.now(); reward(10, '看完一个视频') }
  if (view.topicId) {
    const n = findNode(view.topicId)
    if (n && isTopicDone(n) && !n.__doneRewarded) { n.__doneRewarded = true; reward(20, '学完一个主题 🎉') }
  }
  // 记住当前位置，下次进入直接回到这里
  STATE.lastWatch = { bvid, part: view.part || 1, topicId: view.topicId || null, sourceId: view.sourceId || null }
  renderHeader(); renderTree(); persist()
}

// ---- 右键菜单 ----
function showCtxMenu(x, y, items) {
  const m = $('#ctxmenu')
  m.innerHTML = items.map((it, i) => `<div class="ctx-item ${it.danger ? 'danger' : ''}" data-i="${i}">${it.html || esc(it.label)}</div>`).join('')
  m._items = items
  m.style.display = 'block'
  const r = m.getBoundingClientRect()
  let left = x, top = y
  if (left + r.width > innerWidth - 8) left = innerWidth - r.width - 8
  if (top + r.height > innerHeight - 8) top = innerHeight - r.height - 8
  m.style.left = left + 'px'; m.style.top = top + 'px'
}
function hideCtxMenu() { $('#ctxmenu').style.display = 'none' }

// ---- 交互绑定 ----
function bind() {
  // 学科树：点击（展开/进主题）+ 右键（重命名/删除）
  $('#catalogTree').addEventListener('click', (e) => {
    const row = e.target.closest('[data-id]')
    if (!row) return
    const n = findNode(row.dataset.id)
    if (!n) return
    if (isLeaf(n)) { view = { mode: 'topic', topicId: n.id, part: 1 }; renderContent(); renderSide() }
    else { if (collapsed.has(n.id)) collapsed.delete(n.id); else collapsed.add(n.id); renderTree() }
  })
  $('#catalogTree').addEventListener('contextmenu', (e) => {
    const row = e.target.closest('[data-id]')
    if (!row) return
    e.preventDefault()
    const id = row.dataset.id
    const n = findNode(id)
    if (!n) return
    showCtxMenu(e.clientX, e.clientY, [
      { label: '重命名', html: `${ICONS.pencil}<span>重命名</span>`, onClick: () => openRename(id) },
      { label: '删除', html: `${ICONS.trash}<span>删除</span>`, danger: true, onClick: () => deleteNode(id) },
    ])
  })
  // UP主 区：点击（展开/进来源、点视频看、归类、查看网格）
  $('#upList').addEventListener('click', (e) => {
    const assign = e.target.closest('[data-assign]')
    if (assign) { openMoveAssign(assign.dataset.assign); return }
    const grid = e.target.closest('[data-grid]')
    if (grid) { view = { mode: 'sources', sourceId: grid.dataset.grid || null, part: 1 }; renderContent(); renderSide(); return }
    const vid = e.target.closest('[data-video]')
    if (vid) { openVideoFromSource(vid.dataset.video, vid.dataset.src || null); return }
    const src = e.target.closest('[data-src]')
    if (src) {
      const id = src.dataset.src
      if (expandedSrc.has(id)) expandedSrc.delete(id); else expandedSrc.add(id)
      renderUpList()
    }
  })
  // UP主 区标题：点击展开/收起
  $('#upHead').addEventListener('click', () => { upOpen = !upOpen; renderUpList() })
  // 内容区事件（事件委托）
  $('#content').addEventListener('click', (e) => {
    const menu = e.target.closest('[data-menu]')
    if (menu) {
      e.stopPropagation()
      const b = menu.dataset.menu
      const cur = topicOf(b)
      const r = menu.getBoundingClientRect()
      showCtxMenu(r.right - 8, r.bottom + 4, [{
        label: cur ? '调整学科分类' : '加入学科分类',
        html: (cur ? ICONS.shuffle : ICONS.folder) + `<span>${cur ? '调整学科分类' : '加入学科分类'}</span>`,
        onClick: () => openMoveAssign(b),
      }])
      return
    }
    const pl = e.target.closest('[data-pl]')
    if (pl) { openVideo(pl.dataset.pl); return }
    const assign = e.target.closest('[data-assign]')
    if (assign) { openMoveAssign(assign.dataset.assign); return }
    const card = e.target.closest('[data-open]')
    if (card) { openVideo(card.dataset.open); return }
    const go = e.target.closest('[data-go]')
    if (go) { const [m, arg] = go.dataset.go.split(':'); if (m === 'topic') { view = { mode: 'topic', topicId: arg, part: 1 } } else if (m === 'watch') { openVideo(arg) } renderContent(); return }
    const act = e.target.closest('[data-act]')
    if (act && act.dataset.act === 'toggleLater') { const p = STATE.progress[view.bvid] || (STATE.progress[view.bvid] = {}); if (p.later) delete p.later; else p.later = Date.now(); renderContent(); persist(); return }
    if (act && act.dataset.act === 'classify') { openMoveAssign(view.bvid); return }
    const part = e.target.closest('[data-part]')
    if (part) { view.part = Number(part.dataset.part); renderContent(); return }
    if (e.target.closest('#hintAi')) return openAiCatalog()
    if (e.target.closest('#hintLink')) return openAddSource()
  })
  // 观看页右键 → 调整分类
  $('#content').addEventListener('contextmenu', (e) => {
    if (view.mode !== 'watch' || !view.bvid) return
    if (!e.target.closest('.watch')) return
    e.preventDefault()
    const b = view.bvid
    const cur = topicOf(b)
    const items = [{ label: cur ? '调整学科分类…' : '加入学科分类…', html: (cur ? ICONS.shuffle : ICONS.folder) + `<span>${cur ? '调整学科分类…' : '加入学科分类…'}</span>`, onClick: () => openMoveAssign(b) }]
    if (cur) items.push({ label: `移出「${cur.name}」`, danger: true, onClick: () => { removeVideoFromTopic(b); persist(); refreshUI(); toast('已移出分类') } })
    showCtxMenu(e.clientX, e.clientY, items)
  })
  // 右键菜单自身
  $('#ctxmenu').addEventListener('click', (e) => {
    const it = e.target.closest('[data-i]')
    if (!it) return
    const fn = ($('#ctxmenu')._items || [])[Number(it.dataset.i)]?.onClick
    hideCtxMenu()
    if (fn) fn()
  })
  addEventListener('click', hideCtxMenu)
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { hideCtxMenu(); closeModal() } })
  // 顶栏
  $('#btnAiCatalog').onclick = openAiCatalog
  $('#btnAddSource').onclick = openAddSource
  $('#btnAddSubject').onclick = openAddSubject
  $('#btnExport').onclick = exportNotes
  $('#btnRewards').onclick = openRewards
  // 笔记
  const ta = $('#noteText')
  ta.addEventListener('input', () => {
    const key = ta.dataset.key; if (!key) return
    const n = STATE.notes[key] || (STATE.notes[key] = {})
    n.text = ta.value; n.updatedAt = new Date().toISOString()
    saveState()
    if (ta.value.trim() && !n._rewarded) { n._rewarded = true; reward(10, '记笔记') }
    if (notePreviewOn) $('#notePreview').innerHTML = renderRich(ta.value)
  })
  ta.addEventListener('blur', () => { if (ta.dataset.key) persist() })
  $('#btnSaveNote').onclick = saveNoteNow
  $('#btnPreview').onclick = toggleNotePreview
  // 公式工具栏：插入算式模板 / 数学符号
  $('#formulaBar').innerHTML = FORMULA_BAR.map((f) => `<button class="fbtn" data-tex="${esc(f.tex)}" data-cur="${f.cur ?? ''}">${esc(f.label)}</button>`).join('')
  $('#formulaBar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tex]'); if (!b) return
    insertAtCursor($('#noteText'), b.dataset.tex, b.dataset.cur ? Number(b.dataset.cur) : undefined)
  })
  // AI
  $('#presets').innerHTML = PRESETS.map((p) => `<button data-preset="${p.id}" class="${p.id === selPreset ? 'on' : ''}">${esc(p.label)}</button>`).join('')
  $('#presets').addEventListener('click', (e) => {
    const b = e.target.closest('[data-preset]'); if (!b) return
    selPreset = b.dataset.preset
    $$('#presets button').forEach((x) => x.classList.toggle('on', x.dataset.preset === selPreset))
  })
  $('#btnAsk').onclick = askAi
  $('#aiConcept').addEventListener('keydown', (e) => { if (e.key === 'Enter') askAi() })
  // 明暗主题
  addEventListener('message', (e) => {
    if (e.origin !== location.origin) return
    const m = e.data
    if (m && m.type === 'bili-study:scheme') document.documentElement.dataset.scheme = m.scheme
  })
  // 回到面板时刷新（模型工具可能改了状态）；观看时只刷新侧栏和顶栏，不打断播放
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshSoft() })
  // 快捷键
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA/.test((document.activeElement || {}).tagName)) return
    if (view.mode !== 'watch') return
    const list = watchList()
    const i = list.indexOf(view.bvid)
    if (e.key === 'j' && list[i + 1]) openVideo(list[i + 1])
    else if (e.key === 'k' && list[i - 1]) openVideo(list[i - 1])
  })
}

function openVideo(bvid) {
  const v = STATE.videos[bvid]; if (!v) return
  let topicId = view.topicId
  let sourceId = view.sourceId
  if (!topicId && !sourceId) {
    const t = topicOf(bvid)
    if (t) topicId = t.id
  }
  view = { mode: 'watch', bvid, part: 1, topicId, sourceId }
  renderContent(); renderSide()
}
function openVideoFromSource(bvid, sourceId) {
  const v = STATE.videos[bvid]; if (!v) return
  view = { mode: 'watch', bvid, part: 1, topicId: null, sourceId: sourceId || null }
  renderContent(); renderSide()
}

// ---- 弹层 / 提示 ----
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show')
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600)
}
function openModal(html) { $('#modal').innerHTML = `<div class="modal-mask">${html}</div>`; const x = $('#modal .modal'); if (x && x.querySelector('input,textarea')) x.querySelector('input,textarea').focus() }
function closeModal() { $('#modal').innerHTML = '' }
$('#modal').addEventListener('click', (e) => { if (e.target.classList.contains('modal-mask')) closeModal() })

// ---- AI 建目录 / 问 AI ----
function startChat(prompt) {
  parent.postMessage({ type: 'bili-study:start', prompt }, location.origin)
}
function openAiCatalog() {
  openModal(`<div class="modal">
    <h2>${ICONS.sparkles}<span>用提示词生成学习目录</span></h2>
    <p class="desc">描述你想学的领域，AI 会生成「科目 → 章 → 主题」的大纲，存进左侧「学科」目录。<br>视频之后由你粘贴 B 站链接填充（这一步纯脚本，不费 AI）。</p>
    <div class="field"><label>你的学习需求</label><textarea id="aiPrompt" placeholder="例如：我想系统学习高中物理（人教版），从必修一开始……"></textarea></div>
    <div class="actions"><button class="btn" onclick="closeModal()">取消</button><button class="btn primary" id="doAiCatalog">生成目录</button></div>
  </div>`)
  $('#doAiCatalog').onclick = () => {
    const p = $('#aiPrompt').value.trim()
    if (!p) return toast('先写一句你想学的领域')
    closeModal()
    startChat(`请根据我的学习需求，生成一份「学习视频目录」大纲（只给结构化大纲，不要视频链接、不要 BV 号）。

我的需求：${p}

要求：
1. 面向学习领域（K12 或成人学习均可），用中文。
2. 结构最多三层：科目 → 章 → 主题，叶子节点是具体学习主题。
3. 覆盖该领域主要知识点，数量适中（每个科目 3-6 章，每章 3-8 个主题）。
4. 生成后调用工具 bili_study_save_catalog 保存。catalog 参数结构：
   [{ "name": "科目", "children": [{ "name": "章", "children": [{ "name": "主题" }] }] }]
   叶子节点不要 children，也不要 videos。`)
    toast('已生成草稿，去对话发送后，目录会出现在这里')
  }
}
async function askAi() {
  const c = $('#aiConcept').value.trim()
  if (!c) return toast('先输入一个概念')
  const preset = PRESETS.find((p) => p.id === selPreset) || PRESETS[0]
  const prompt = preset.tpl.replace('{x}', c) + '\n\n（这是我正在看的学习视频里的概念，请面向学习给我讲清楚，别太长。）'
  const box = $('#aiAnswer')
  const btn = $('#btnAsk')
  box.innerHTML = '<div class="ai-loading"><span class="typing-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="sr-only">思考中…</span></div>'
  btn.disabled = true
  try {
    const r = await fetch('/bili-study/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: prompt }) })
    const j = await r.json()
    if (j.ok) box.innerHTML = `<div class="ai-answer-text">${renderAnswer(j.answer)}</div>`
    else box.innerHTML = `<div class="chat-hint" style="color:var(--danger)">${esc(j.error || '查询失败')}</div>`
  } catch (e) {
    box.innerHTML = `<div class="chat-hint" style="color:var(--danger)">查询失败：${esc(e && e.message)}</div>`
  } finally {
    btn.disabled = false
  }
}
function renderAnswer(text) { return renderRich(text) }

// 富文本渲染：Markdown（标题/列表/段落/加粗/代码）+ LaTeX 公式（$...$ 行内，$$...$$ 独立行）
function renderRich(text) {
  // 归一化其它常见 LaTeX 定界符：\(...\) → $...$，\[...\] → $$...$$
  text = String(text ?? '')
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => '$$' + m + '$$')
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => '$' + m + '$')
  // 先整体转义 HTML，再把公式抽成占位符交给 KaTeX；占位符不参与后续 Markdown 替换
  const safe = esc(text)
  const math = []
  const withPh = safe.replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g, (whole, display, inline) => {
    const isDisplay = display !== undefined
    const latex = unescapeMath((isDisplay ? display : inline).trim())
    let out = whole
    try {
      if (window.katex) out = window.katex.renderToString(latex, { throwOnError: false, displayMode: isDisplay })
    } catch { /* 渲染失败保留原文 */ }
    const idx = math.push({ html: out, display: isDisplay }) - 1
    return `\u0000${idx}\u0000`
  })
  return markdownBlocks(withPh.split('\n'), math)
}

// 转义后的 LaTeX 需要还原 & < > 等实体，否则 KaTeX 会把它们当普通字符
function unescapeMath(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

// 行内格式：**加粗**、`代码`、公式占位符（HTML 已整体转义过，安全）
function inlineFormat(s, math) {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\u0000(\d+)\u0000/g, (_, i) => (math[Number(i)] ? math[Number(i)].html : ''))
}

// 块级 Markdown：空行分段、#/##/### 标题、- / 1. 列表、独立成行的公式
function markdownBlocks(lines, math) {
  const out = []
  let para = []
  let list = null
  const flushPara = () => {
    if (!para.length) return
    out.push(`<p>${para.map((l) => inlineFormat(l, math)).join('<br>')}</p>`)
    para = []
  }
  const flushList = () => {
    if (!list) return
    out.push(`<${list.type}>${list.items.map((i) => `<li>${inlineFormat(i, math)}</li>`).join('')}</${list.type}>`)
    list = null
  }
  for (const line of lines) {
    const t = line.trim()
    if (!t) { flushPara(); flushList(); continue }
    const h = t.match(/^(#{1,3})\s+(.+)$/)
    if (h) {
      flushPara(); flushList()
      const lv = Math.min(h[1].length + 2, 5)
      out.push(`<h${lv}>${inlineFormat(h[2], math)}</h${lv}>`)
      continue
    }
    // 独立成行的 $$...$$ 直接作为块输出，避免被 <p> 包住
    const ph = t.match(/^\u0000(\d+)\u0000$/)
    if (ph && math[Number(ph[1])] && math[Number(ph[1])].display) {
      flushPara(); flushList(); out.push(math[Number(ph[1])].html); continue
    }
    const ul = t.match(/^[-*]\s+(.+)$/)
    if (ul) {
      flushPara()
      if (list && list.type === 'ul') list.items.push(ul[1])
      else { flushList(); list = { type: 'ul', items: [ul[1]] } }
      continue
    }
    const ol = t.match(/^\d+\.\s+(.+)$/)
    if (ol) {
      flushPara()
      if (list && list.type === 'ol') list.items.push(ol[1])
      else { flushList(); list = { type: 'ol', items: [ol[1]] } }
      continue
    }
    flushList(); para.push(t)
  }
  flushPara(); flushList()
  return out.join('')
}

// 在 textarea 光标处插入文本（可选把光标放到插入文本内第 cur 个字符后）
function insertAtCursor(ta, text, cur) {
  const start = ta.selectionStart ?? ta.value.length
  const end = ta.selectionEnd ?? start
  ta.setRangeText(text, start, end, 'end')
  const pos = start + (cur ?? text.length)
  ta.selectionStart = ta.selectionEnd = pos
  ta.focus()
  ta.dispatchEvent(new Event('input'))
}

// ---- 粘贴链接 / 抓取 ----
function openAddSource() {
  openModal(`<div class="modal">
    <h2>${ICONS.plus}<span>粘贴 B 站链接</span></h2>
    <p class="desc">支持 UP 主主页（space.bilibili.com/…）、单个视频页、收藏夹链接。抓取走脚本接口，不费 AI。</p>
    <div class="field"><label>链接</label><input type="text" id="srcUrl" placeholder="https://space.bilibili.com/14229967"></div>
    <div id="srcPreview"></div>
    <div class="actions"><button class="btn" onclick="closeModal()">取消</button><button class="btn" id="doFetch">抓取预览</button></div>
  </div>`)
  $('#doFetch').onclick = () => {
    const url = $('#srcUrl').value.trim()
    if (!url) return toast('先粘贴链接')
    const btn = $('#doFetch'); btn.disabled = true; btn.textContent = '抓取中…'
    fetch('/bili-study/api/fetch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) })
      .then((r) => r.json()).then((r) => {
        btn.disabled = false; btn.textContent = '抓取预览'
        if (!r.ok) { $('#srcPreview').innerHTML = `<p class="chat-hint" style="color:var(--danger)">${esc(r.error || '抓取失败')}</p>`; return }
        const titles = (r.videos || []).slice(0, 8).map((v) => esc(v.title)).join('</div><div>')
        $('#srcPreview').innerHTML = `<p class="desc">找到 <b>${r.videos.length}</b> 个视频：</p><div class="preview"><div>${titles}</div></div>
          <div class="actions"><button class="btn" onclick="closeModal()">取消</button><button class="btn primary" id="doAdd">确认加入（${r.videos.length} 个）</button></div>`
        $('#doAdd').onclick = () => addSource(r, url)
      }).catch(() => { btn.disabled = false; btn.textContent = '抓取预览'; toast('抓取失败') })
  }
}
function addSource(r, url) {
  const id = String(r.id ?? url)
  for (const v of r.videos || []) { STATE.videos[v.bvid] = { ...(STATE.videos[v.bvid] || {}), ...v, sourceId: id, sourceType: r.kind } }
  if (!(STATE.sources || []).some((s) => String(s.id) === id)) STATE.sources.unshift({ type: r.kind, id, name: (r.meta && r.meta.name) || url, url, addedAt: new Date().toISOString() })
  persist(); closeModal()
  view = { mode: 'sources', sourceId: id, part: 1 }
  renderAll()
  toast(`已加入 ${(r.videos || []).length} 个视频到「UP主」目录，点「归类」归到学科`)
}

// ---- 分类 / 移动 ----
function leafOptions(nodes) {
  let h = '<option value="" disabled>— 请选择主题 —</option>'
  const rec = (list, d) => {
    for (const n of list || []) {
      if (isLeaf(n)) h += `<option value="${esc(n.id)}">${'　'.repeat(Math.min(d, 3))}${esc(n.name)}</option>`
      else rec(n.children, d + 1)
    }
  }
  rec(nodes, 0)
  return h
}
function openMoveAssign(bvid) {
  const v = STATE.videos[bvid]
  const cur = topicOf(bvid)
  const opts = leafOptions(STATE.catalog)
  openModal(`<div class="modal">
    <h2>${cur ? ICONS.shuffle : ICONS.folder}<span>${cur ? '调整学科分类' : '加入学科分类'}</span></h2>
    <p class="desc">${esc(v && v.title)}${cur ? `<br>当前分类：${esc(cur.name)}` : ''}<br>归到学科后，视频仍会保留在 UP主 目录里。</p>
    <div class="field"><label>选择主题</label><select id="assignSel">${opts}</select></div>
    <div class="actions">
      ${cur ? `<button class="btn" id="doRemove" style="margin-right:auto">移出分类</button>` : ''}
      <button class="btn" onclick="closeModal()">取消</button>
      <button class="btn primary" id="doAssign">${cur ? '移动到此' : '分配'}</button>
    </div>
  </div>`)
  if (cur) $('#assignSel').value = cur.id
  $('#doAssign').onclick = () => {
    const tid = $('#assignSel').value
    if (!tid) return toast('选一个主题')
    moveVideo(bvid, tid)
    persist(); closeModal(); refreshUI(); toast('已更新分类')
  }
  const rm = $('#doRemove')
  if (rm) rm.onclick = () => { removeVideoFromTopic(bvid); persist(); closeModal(); refreshUI(); toast('已移出分类') }
}

// ---- 目录重命名 / 删除 ----
function openRename(id) {
  const n = findNode(id); if (!n) return
  openModal(`<div class="modal">
    <h2>${ICONS.pencil}<span>重命名</span></h2>
    <div class="field"><label>名称</label><input type="text" id="renameInput" value="${esc(n.name)}"></div>
    <div class="actions"><button class="btn" onclick="closeModal()">取消</button><button class="btn primary" id="doRename">保存</button></div>
  </div>`)
  $('#doRename').onclick = () => {
    const name = $('#renameInput').value.trim()
    if (!name) return toast('名称不能为空')
    n.name = name
    persist(); closeModal(); refreshUI(); toast('已重命名')
  }
}
function removeNode(id) {
  const rec = (nodes) => {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === id) { nodes.splice(i, 1); return true }
      if (nodes[i].children && rec(nodes[i].children)) return true
    }
    return false
  }
  rec(STATE.catalog)
}
function deleteNode(id) {
  const n = findNode(id); if (!n) return
  const count = nodeCount(n)
  openModal(`<div class="modal">
    <h2>${ICONS.trash}<span>删除「${esc(n.name)}」</span></h2>
    <p class="desc">${count ? `这个目录下有 ${count} 个视频，删除后它们会回到「未分类」（UP主 目录里仍保留）。` : '这个目录是空的。'}</p>
    <div class="actions"><button class="btn" onclick="closeModal()">取消</button><button class="btn primary" id="doDelete" style="background:var(--danger);border-color:var(--danger)">删除</button></div>
  </div>`)
  $('#doDelete').onclick = () => { removeNode(id); persist(); closeModal(); refreshUI(); toast('已删除') }
}

// ---- 手动加科目 ----
function openAddSubject() {
  openModal(`<div class="modal">
    <h2>${ICONS.plus}<span>手动加科目</span></h2>
    <p class="desc">不加视频也可以先搭骨架。之后在 UP主 区点视频旁的「归类」，把视频归到主题。</p>
    <div class="field"><label>科目名</label><input type="text" id="subjName" placeholder="例如：数学"></div>
    <div class="field"><label>章（用逗号分隔，可选）</label><input type="text" id="subjChs" placeholder="函数, 几何, 概率"></div>
    <div class="actions"><button class="btn" onclick="closeModal()">取消</button><button class="btn primary" id="doSubj">添加</button></div>
  </div>`)
  $('#doSubj').onclick = () => {
    const name = $('#subjName').value.trim()
    if (!name) return toast('填一个科目名')
    const chs = $('#subjChs').value.split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
    const node = { id: uid(), name }
    if (chs.length) node.children = chs.map((c) => ({ id: uid(), name: c, videos: [] }))
    else node.videos = []
    STATE.catalog.push(node)
    persist(); closeModal(); renderSide(); toast('已添加科目')
  }
}
function uid() { return 'n-' + Math.random().toString(36).slice(2, 9) }

// ---- 导出笔记 ----
function exportNotes() {
  const keys = Object.keys(STATE.notes || {})
  if (!keys.length) return toast('还没有笔记')
  const lines = []
  for (const k of keys) {
    const n = STATE.notes[k]
    if (!n || !n.text || !n.text.trim()) continue
    const bvid = k.replace(/-p\d+$/, '')
    const v = STATE.videos[bvid]
    const title = v ? v.title : bvid
    const part = k.includes('-p') ? ' · ' + k.split('-p')[1] + 'P' : ''
    lines.push(`## ${title}${part}\n- 链接：https://www.bilibili.com/video/${bvid}\n- 时间：${n.updatedAt ? fmtWhen(n.updatedAt) : ''}\n\n${n.text.trim()}\n`)
  }
  const md = `# 学习笔记\n\n导出时间：${new Date().toLocaleString()}\n\n---\n\n` + lines.join('\n---\n\n')
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `学习笔记-${todayStr()}.md`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  toast('已导出 Markdown 到本地')
}

// ---- 奖励弹层 ----
function openRewards() {
  const r = STATE.rewards
  const defs = badgeDefs()
  const level = Math.floor(Math.sqrt((r.points || 0) / 25)) + 1
  const have = new Set(r.badges || [])
  const log = (r.log || []).slice(0, 8).map((l) => `<div class="logline">${l.label} <span style="float:right">+${l.delta}</span></div>`).join('')
  openModal(`<div class="modal">
    <h2>${ICONS.starFill}<span>学习奖励</span></h2>
    <div class="statline">
      <div class="st"><b>${r.points || 0}</b><span>积分</span></div>
      <div class="st"><b>Lv${level}</b><span>等级</span></div>
      <div class="st"><b>${r.streak || 0} 天</b><span>连续（最高 ${r.best || 0}）</span></div>
    </div>
    <p class="desc">规则：看完视频 +10 · 记笔记 +10 · 学完主题 +20 · 连续学习有成就。</p>
    <div class="badge-grid">${defs.map((d) => {
      const unlocked = have.has(d.id) || d.cond
      const note = unlocked ? '已获得' : `还差 ${Math.max(0, d.goal - d.cur)} ${d.unit}`
      return `<div class="badge ${unlocked ? '' : 'locked'}"><div class="ico">${d.ico}</div><div>${d.n}</div><div class="n">${note}</div></div>`
    }).join('')}</div>
    ${log ? `<h2 class="sub">最近</h2>${log}` : ''}
    <div class="actions"><button class="btn primary" onclick="closeModal()">好</button></div>
  </div>`)
}

// ---- 启动 ----
decorateStaticIcons()
bind()
loadState()
