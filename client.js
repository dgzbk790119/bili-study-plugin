// 学习台 · DeepSeek Harness 插件：浏览器半边
//   - 侧栏加一个「学习台」入口，主区域是插件页面（/bili-study/，iframe）
//   - 明暗主题跟随 dsh：把配色 postMessage 给页面（页面见 web/scheme.js）
//   - 页面里点「AI 建目录」「问 AI」：postMessage 一段草稿，这里开一个新对话并把草稿
//     填进输入框（不直接发送，用户补完再发）
window.__ModuleLoader__.load({
  id: 'dsh-bili-study',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const h = React.createElement
    const PANEL = 'bili-study'
    const SRC = '/bili-study/'

    // 侧栏图标：书 + 播放键
    function PanelIcon(props) {
      const s = (props && props.size) || 18
      return h('svg', { width: s, height: s, viewBox: '0 0 64 64', fill: 'none' },
        h('rect', { x: 8, y: 12, width: 48, height: 40, rx: 7, fill: 'currentColor', opacity: 0.9 }),
        h('path', { d: 'M26 24 L42 32 L26 40 Z', fill: '#fff' }))
    }

    function apply(ctx) {
      const frames = new Set()
      let scheme = null
      const post = (frame) => scheme && frame.contentWindow && frame.contentWindow.postMessage({ type: 'bili-study:scheme', scheme }, location.origin)
      ctx.inject(['theme'], (c) => {
        const push = (snap) => { scheme = snap.active.colorScheme; frames.forEach(post) }
        push(c.theme.getTheme())
        c.on('theme/change', push)
      })

      function StudyPanel() {
        const ref = React.useRef(null)
        React.useEffect(() => {
          const self = ref.current
          if (self) frames.add(self)
          function onMessage(e) {
            const frame = ref.current
            if (!frame || e.source !== frame.contentWindow || e.origin !== location.origin) return
            const m = e.data
            if (!m || m.type !== 'bili-study:start' || typeof m.prompt !== 'string') return
            try {
              ctx.uiWorkspace.startSession(undefined, { prompt: m.prompt, whenDraftExists: 'replace' })
            } catch (err) {
              console.error('[bili-study] 开新对话失败', err)
              frame.contentWindow.postMessage({ type: 'bili-study:start-failed', message: String((err && err.message) || err) }, location.origin)
            }
          }
          addEventListener('message', onMessage)
          return () => { removeEventListener('message', onMessage); frames.delete(self) }
        }, [])
        return h('iframe', { ref, src: SRC, title: '学习台', allow: 'fullscreen', onLoad: (e) => post(e.currentTarget), style: { width: '100%', height: '100%', border: 0, display: 'block' } })
      }

      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register({ name: 'sidebar.panellist', id: PANEL, order: 7, label: () => '学习台' }, PanelIcon))
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL }, StudyPanel))
    }

    exports.isPlugin = true
    exports.inject = ['slots', 'uiWorkspace']
    exports.apply = apply
    return module.exports
  },
})
