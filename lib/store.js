// 学习台：状态持久化。存在 $DSH_HOME/bili-study/state.json（没有 DSH_HOME 时是 ~/.dsh）。
// 目录、视频、笔记、进度、奖励都放这一份文件里；脚本和模型工具共用同一套读写。
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const dataDir = () => join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'bili-study')
const stateFile = () => join(dataDir(), 'state.json')

export function defaultState() {
  return {
    version: 1,
    catalog: [],   // 目录树：{ id, name, note?, children?[], videos?: string[] }，叶子是主题，videos 是 BV 号数组
    videos: {},    // bvid -> 视频对象
    sources: [],   // 已收录来源：{ type: 'up'|'fav'|'video', id, name, url, addedAt }
    notes: {},     // key(bvid 或 bvid-p<n>) -> { text, updatedAt }
    progress: {},  // bvid -> { seen?, liked?, later? }（值为时间戳）
    rewards: { points: 0, streak: 0, best: 0, lastActive: '', badges: [], log: [] },
    lastWatch: null, // { bvid, part, topicId, sourceId } 上次看到的视频，进入面板直接恢复
  }
}

export function readState() {
  try {
    const s = JSON.parse(readFileSync(stateFile(), 'utf8'))
    return { ...defaultState(), ...s }
  } catch {
    return defaultState()
  }
}

export function writeState(state) {
  mkdirSync(dataDir(), { recursive: true })
  const tmp = `${stateFile()}.${process.pid}`
  writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n')
  renameSync(tmp, stateFile())
}

// 给目录树补上稳定 id，并剔除明显非法的节点。模型生成的是纯 name/children/videos。
export function normalizeCatalog(nodes) {
  const walk = (list) => {
    const out = []
    for (const n of Array.isArray(list) ? list : []) {
      if (!n || typeof n !== 'object' || !n.name) continue
      const node = { id: typeof n.id === 'string' && n.id ? n.id : randomUUID().slice(0, 8), name: String(n.name).slice(0, 120) }
      if (n.note) node.note = String(n.note).slice(0, 300)
      const children = walk(n.children)
      if (children.length) node.children = children
      const videos = Array.isArray(n.videos) ? n.videos.filter((v) => typeof v === 'string' && v).slice(0, 500) : []
      if (videos.length) node.videos = videos
      out.push(node)
    }
    return out
  }
  return walk(nodes)
}

// 模型工具：把生成的目录整份替换进状态（保留视频、笔记、进度、奖励）。
export function saveCatalog(catalog) {
  const s = readState()
  s.catalog = normalizeCatalog(catalog)
  writeState(s)
  return s
}

// 抓回来的视频并入状态：去重写进 videos，来源追加（不重复）。
export function addSourceVideos(kind, id, name, url, videos) {
  const s = readState()
  for (const v of Array.isArray(videos) ? videos : []) {
    if (!v || !v.bvid) continue
    s.videos[v.bvid] = { ...(s.videos[v.bvid] || {}), ...v, sourceId: String(id), sourceType: kind }
  }
  if (!s.sources.some((x) => x.type === kind && String(x.id) === String(id))) {
    s.sources.unshift({ type: kind, id: String(id), name: name || '', url: url || '', addedAt: new Date().toISOString() })
  }
  writeState(s)
  return s
}

// 把视频分配到某个主题节点下（脚本化操作，无需 AI）。
export function assignVideos(topicId, bvids) {
  const s = readState()
  const ids = Array.isArray(bvids) ? bvids.filter((b) => typeof b === 'string' && b) : []
  if (!ids.length) return s
  let hit = false
  const walk = (nodes) => {
    for (const n of nodes) {
      if (n.id === topicId) {
        const set = new Set(n.videos || [])
        for (const b of ids) set.add(b)
        n.videos = [...set]
        hit = true
        return true
      }
      if (n.children && walk(n.children)) return true
    }
    return false
  }
  if (walk(s.catalog)) {
    writeState(s)
    return s
  }
  return s
}
