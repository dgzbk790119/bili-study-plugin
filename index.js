// 学习台 · DeepSeek Harness 插件：Host 半边
// 1. 注册给模型的两个工具（lib/tools.js）：保存生成的目录、抓取 B 站视频
// 2. /bili-study/             面板页面（web/index.html）
//    /bili-study/api/state    读写持久化状态
//    /bili-study/api/fetch    从 B 站链接抓视频（脚本化，不经过模型）
//    /bili-study/api/ask      概念速查：面板内直接调 LLM 回答，不跳出到对话
import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchFromUrl } from './lib/bili.js'
import { readState, writeState } from './lib/store.js'
import { TOOLS } from './lib/tools.js'

const ROOT = fileURLToPath(new URL('.', import.meta.url))
const BASE = '/bili-study'

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
}

export const name = 'bili-study'
export const inject = ['webServer', 'tools', 'llm']

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}
function notFound(res) {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
  res.end('not found')
}

// 只在 web/ 目录内找文件，拒绝 .. 和目录外符号链接。
function safeFile(rel) {
  if (!rel || rel.split('/').some((p) => p.startsWith('.'))) return null
  const base = realpathSync(join(ROOT, 'web'))
  const file = normalize(join(base, rel))
  if (!file.startsWith(base + sep) || !existsSync(file)) return null
  const real = realpathSync(file)
  return real.startsWith(base + sep) && statSync(real).isFile() ? real : null
}
function serveFile(req, res, file) {
  res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' })
  if (req.method === 'HEAD') return res.end()
  createReadStream(file).pipe(res)
}
// 只接受同源 JSON POST。
function readJson(req, max = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const origin = req.headers.origin
    if (req.method !== 'POST') return reject(Object.assign(new Error('method'), { status: 405 }))
    if (!/^application\/json\b/.test(req.headers['content-type'] || '')) return reject(Object.assign(new Error('type'), { status: 415 }))
    if (origin && origin.replace(/^https?:\/\//, '') !== req.headers.host) return reject(Object.assign(new Error('origin'), { status: 403 }))
    let size = 0
    const chunks = []
    req.on('data', (c) => { size += c.length; if (size > max) req.destroy(); else chunks.push(c) })
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')) } catch (e) { reject(Object.assign(e, { status: 400 })) } })
    req.on('error', reject)
  })
}

// 概念速查：面板内直接调 LLM 回答，不跳出到对话界面。
async function askLlm(ctx, prompt) {
  let provider = 'deepseek-official'
  let model = 'deepseek-v4-pro'
  let reasoningEffort
  try {
    const sel = ctx.get('agentDefaultModel')?.currentSelection?.()
    if (sel?.provider) provider = sel.provider
    if (sel?.model) model = sel.model
    if (sel?.reasoningEffort) reasoningEffort = sel.reasoningEffort
  } catch { /* 读不到默认模型就用内置兜底 */ }
  const chunks = ctx.llm.stream({
    provider, model, reasoningEffort,
    system: '你是学习台里的概念讲解助手。用中文、面向学习者、条理清晰，尽量控制在 300 字以内。数学公式请用 LaTeX 书写：行内用 $...$，独立成行用 $$...$$。',
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    maxTokens: 1200,
    temperature: 0.6,
    signal: AbortSignal.timeout(90000),
  })
  let answer = ''
  let error = null
  try {
    for await (const c of chunks) {
      if (c.type === 'text-delta') answer += c.text
      else if (c.type === 'finish') {
        if (c.reason.kind === 'error' || c.reason.kind === 'aborted') error = c.reason.failure?.message || '模型调用失败'
      }
    }
  } catch (e) {
    error = e?.message || '模型调用异常'
  }
  if (error) return { ok: false, error }
  const text = answer.trim()
  if (!text) return { ok: false, error: '没有生成回答' }
  return { ok: true, answer: text }
}

export function apply(ctx) {
  for (const tool of TOOLS) ctx.tools.register(tool)

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'prefix',
      path: BASE,
      async handler(req, res) {
        const url = new URL(req.url || '/', 'http://x')
        const rest = decodeURIComponent(url.pathname.slice(BASE.length)) || '/'
        if (rest === '/api/state' && (req.method === 'GET' || req.method === 'HEAD')) {
          return sendJson(res, 200, { ok: true, state: readState() })
        }
        if (rest === '/api/state' && req.method === 'POST') {
          try {
            const body = await readJson(req)
            const state = body && body.state ? body.state : body
            if (!state || typeof state !== 'object') return sendJson(res, 400, { ok: false, error: '状态格式不对' })
            writeState(state)
            return sendJson(res, 200, { ok: true })
          } catch (e) {
            return sendJson(res, e.status || 400, { ok: false, error: e.message })
          }
        }
        if (rest === '/api/fetch' && req.method === 'POST') {
          try {
            const body = await readJson(req)
            const r = await fetchFromUrl(String(body.url || ''))
            return sendJson(res, 200, r)
          } catch (e) {
            return sendJson(res, 400, { ok: false, error: e.message })
          }
        }
        if (rest === '/api/ask' && req.method === 'POST') {
          try {
            const body = await readJson(req)
            const q = String(body.question || '').trim()
            if (!q) return sendJson(res, 400, { ok: false, error: '问题为空' })
            const r = await askLlm(ctx, q)
            return sendJson(res, r.ok ? 200 : 500, r)
          } catch (e) {
            return sendJson(res, 500, { ok: false, error: e.message })
          }
        }
        if (req.method !== 'GET' && req.method !== 'HEAD') return notFound(res)
        const rel = rest === '/' ? 'index.html' : rest.slice(1)
        const f = safeFile(rel)
        return f ? serveFile(req, res, f) : notFound(res)
      },
    }),
  )
}
