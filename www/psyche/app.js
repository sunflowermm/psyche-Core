import {
  getPrefs, setPrefs, listHistory, saveResult, removeResult, clearHistory, mbtiImage
} from './store.js'

const API = '/api/psyche'
const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]

function assetUrl(path) {
  if (!path) return ''
  const v = globalThis.__PSYCHE_VER__
  if (!v || path.includes('?')) return path
  return `${path}?v=${encodeURIComponent(v)}`
}

function confirmExitQuiz() {
  return confirm('退出当前测评？进度不会保存。')
}

const PAGES = [
  { id: 'home', label: '量表' },
  { id: 'history', label: '记录' }
]

const CATEGORIES = [
  { id: 'all', label: '全部' },
  { id: 'personality', label: '人格' },
  { id: 'career', label: '职业' }
]

const TIER = { lite: '轻量', standard: '标准', deep: '深度' }
const MBTI_ENGINES = new Set(['mbti-oejts', 'mbti-binary'])

const state = {
  page: 'home',
  filter: 'all',
  defaultLang: 'zh',
  assessments: [],
  sessionId: null,
  slug: null,
  assessmentName: '',
  keyHandler: null,
  prefs: getPrefs(),
  cbtiHidden: null,
  epilogue: [],
  quizRetry: null
}

function resultImage(render, engine) {
  if (MBTI_ENGINES.has(engine) && render?.type) {
    return mbtiImage(render.type, state.prefs.gender)
  }
  return render?.image || ''
}

function loadingPanel(text = '加载中…') {
  return `<div class="panel loading-panel"><div class="spinner" aria-hidden="true"></div><p class="loading-text">${text}</p></div>`
}

function formatApiError(message) {
  if (/会话不存在|已过期/.test(message || '')) {
    return '测评会话已过期，请返回量表重新开始'
  }
  return message || '操作失败'
}

async function api(path, opts = {}) {
  let res
  try {
    res = await fetch(`${API}${path}`, {
      headers: { 'Content-Type': 'application/json', ...opts.headers },
      ...opts
    })
  } catch {
    throw new Error('无法连接服务，请确认 AgentRuntime 已启动')
  }
  const json = await res.json()
  if (!json?.success) throw new Error(json?.message || `HTTP ${res.status}`)
  // HttpResponse.success 对普通对象会 Object.assign 到顶层（无 data 包裹）
  if (json.data !== undefined) return json.data
  const { success: _ok, message: _msg, ...payload } = json
  return payload
}

function show(id, animate = false) {
  $$('.view').forEach((v) => {
    v.classList.remove('active', 'view-animate')
  })
  const view = $(`#view-${id}`)
  view?.classList.add('active')
  if (animate) view?.classList.add('view-animate')
  $('#filters')?.classList.toggle('hidden', id !== 'home')
}

function bindKeys(max, onPick) {
  if (state.keyHandler) window.removeEventListener('keydown', state.keyHandler)
  state.keyHandler = (e) => {
    const n = Number(e.key)
    if (Number.isInteger(n) && n >= 1 && n <= max) onPick(n)
  }
  window.addEventListener('keydown', state.keyHandler)
}

function unbindKeys() {
  if (state.keyHandler) {
    window.removeEventListener('keydown', state.keyHandler)
    state.keyHandler = null
  }
}

function fmtTime(iso) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function renderStats(list) {
  const totalQ = list.reduce((s, a) => s + (a.questionCount || 0), 0)
  const hist = listHistory().length
  const art = list.filter((a) => a.hasArt).length
  $('#stats').textContent = `${list.length} 量表 · ${totalQ} 题 · ${art} 立绘 · ${hist} 记录`
}


function renderNav() {
  $('#nav').innerHTML = PAGES.map((p) =>
    `<button type="button" class="tab${state.page === p.id ? ' active' : ''}" data-page="${p.id}">${p.label}</button>`
  ).join('')
  $$('#nav .tab').forEach((btn) => {
    btn.onclick = () => {
      const target = btn.dataset.page
      if (state.sessionId && target !== state.page) {
        if (!confirmExitQuiz()) return
        void abortQuiz()
        return
      }
      state.page = target
      renderNav()
      if (state.page === 'home') { show('home'); applyHomeFilter() }
      else { unbindKeys(); show('history', true); renderHistory() }
    }
  })
}

async function abortQuiz() {
  const id = state.sessionId
  state.sessionId = null
  state.cbtiHidden = null
  state.epilogue = []
  unbindKeys()
  if (id) {
    try { await api(`/sessions/${id}`, { method: 'DELETE' }) } catch { /* ignore */ }
  }
  goHome()
}

function renderFilters() {
  const el = $('#filters')
  if (!el.dataset.ready) {
    el.innerHTML = CATEGORIES.map((c) =>
      `<button type="button" class="tab" data-cat="${c.id}">${c.label}</button>`
    ).join('')
    el.dataset.ready = '1'
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cat]')
      if (!btn || btn.dataset.cat === state.filter) return
      state.filter = btn.dataset.cat
      syncFilterTabs()
      applyHomeFilter()
    })
  }
  syncFilterTabs()
}

function syncFilterTabs() {
  $$('#filters .tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.cat === state.filter)
  })
}

function cardHtml(a) {
  const tier = a.tier ? `<span class="tier tier-${a.tier}">${TIER[a.tier] || a.tier}</span>` : ''
  const preview = a.preview || `/psyche/assets/covers/${a.slug}.svg`
  const isLogo = preview.includes('shennong')
  const thumb = `<div class="card-thumb${isLogo ? ' card-thumb-logo' : ''}"><img src="${assetUrl(preview)}" alt="" loading="lazy" decoding="async"></div>`
  const tags = [...(a.tags || []).slice(0, 2), ...(a.hasArt ? ['立绘'] : [])]
    .map((t) => `<span class="tag${t === '立绘' ? ' art' : ''}">${t}</span>`).join('')
  return `<article class="card" data-slug="${a.slug}" data-category="${a.category || ''}">
    ${thumb}
    <div class="card-body">
      <div class="card-head">${tier}<h3>${a.name}</h3></div>
      <p class="card-meta">${a.questionCount} 题 · 约 ${a.estimatedMinutes} 分钟</p>
      <div class="tags">${tags}</div>
    </div>
  </article>`
}

function applyHomeFilter() {
  const grid = $('#view-home .grid')
  if (!grid) return
  let count = 0
  $$('#view-home .card').forEach((card) => {
    const match = state.filter === 'all' || card.dataset.category === state.filter
    card.hidden = !match
    if (match) count += 1
  })
  $('#view-home .empty-filter')?.classList.toggle('hidden', count > 0)
}

function renderHome() {
  const el = $('#view-home')
  if (!el.querySelector('.home-body')) {
    if (!state.assessments.length) {
      el.innerHTML = '<p class="empty">暂无可用测评</p>'
      return
    }
    el.innerHTML = `<div class="home-body">
      <div class="grid">${state.assessments.map(cardHtml).join('')}</div>
      <p class="empty empty-filter hidden">该分类暂无测评</p>
    </div>`
    el.addEventListener('click', (e) => {
      const card = e.target.closest('.card')
      if (card && !card.hidden) startQuiz(card.dataset.slug)
    })
  }
  applyHomeFilter()
}

function renderHistory() {
  const items = listHistory()
  const el = $('#view-history')
  if (!items.length) {
    el.innerHTML = `<div class="panel empty-panel">
      <p class="empty">暂无测评记录</p>
      <p class="hint">完成任意量表后，结果会自动保存在本机浏览器。</p>
      <button type="button" class="btn btn-primary" id="go-home">去测评</button>
    </div>`
    $('#go-home').onclick = () => { state.page = 'home'; renderNav(); show('home'); applyHomeFilter() }
    return
  }
  el.innerHTML = `
    <div class="hist-head">
      <h2>测评记录 <span class="muted">${items.length}</span></h2>
      <button type="button" class="btn btn-ghost btn-sm" id="clear-hist">清空</button>
    </div>
    <div class="hist-list">${items.map((h) => `
      <article class="hist-card" data-id="${h.id}">
        ${h.render?.image ? `<img class="hist-thumb" src="${assetUrl(h.render.image)}" alt="">` : '<div class="hist-thumb ph"></div>'}
        <div class="hist-body">
          <p class="hist-title">${h.assessmentName || h.slug}</p>
          <p class="hist-type">${h.render?.displayName || h.render?.type || ''}</p>
          <p class="hist-meta">${fmtTime(h.completedAt)}${h.render?.similarity != null ? ` · 匹配 ${h.render.similarity}%` : ''}</p>
        </div>
        <button type="button" class="hist-del" data-del="${h.id}" title="删除">×</button>
      </article>`).join('')}</div>`
  $$('.hist-card').forEach((c) => {
    c.onclick = (e) => {
      if (e.target.closest('[data-del]')) return
      const item = items.find((x) => x.id === c.dataset.id)
      if (item) showStoredResult(item)
    }
  })
  $$('[data-del]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation()
      removeResult(b.dataset.del)
      renderStats(state.assessments)
      renderHistory()
    }
  })
  $('#clear-hist').onclick = () => {
    if (confirm('确定清空全部本地记录？')) {
      clearHistory()
      renderStats(state.assessments)
      renderHistory()
    }
  }
}

function optionsHtml(q, sel = () => '') {
  const labels = q.choices?.length
    ? q.choices.map((c) => c.text)
    : null
  if (q.type === 'binary' || q.type === 'choice') {
    return `<div class="options">${q.options.map((o) =>
      `<button type="button" class="opt${sel(o.value)}" data-v="${o.value}"><span class="opt-num">${o.value}</span><span class="opt-label">${o.label}</span></button>`
    ).join('')}</div>`
  }
  if (q.type === 'bipolar-likert') {
    return `<div class="likert-row">${[1, 2, 3, 4, 5].map((n) =>
      `<button type="button" class="likert-btn${sel(n)}" data-v="${n}">${n}</button>`).join('')}</div>
      <div class="bipolar-hints"><span>${q.leftTrait}</span><span>中立</span><span>${q.rightTrait}</span></div>`
  }
  const likertLabels = labels || ['非常不符合', '比较不符合', '不确定', '比较符合', '非常符合']
  return `<div class="likert-row">${[1, 2, 3, 4, 5].map((n) =>
    `<button type="button" class="likert-btn${sel(n)}" data-v="${n}" aria-label="${likertLabels[n - 1]}">${n}</button>`).join('')}</div>
    <div class="likert-labels">${likertLabels.map((l) => `<span>${l}</span>`).join('')}</div>`
}

function renderQuestion(q, index, total, previousAnswer = null, canBack = false) {
  const max = q.scale?.max || (q.type === 'binary' ? 2 : 5)
  const pct = Math.round(((index - 1) / total) * 100)
  const sel = (v) => previousAnswer != null && String(previousAnswer) === String(v) ? ' selected' : ''
  $('#view-quiz').innerHTML = `
    <div class="panel q-enter">
      <div class="quiz-head">
        <p class="quiz-name">${state.assessmentName}</p>
        <div class="progress-row">
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <span class="progress-text">${index} / ${total}</span>
        </div>
      </div>
      ${q.dimension ? `<p class="q-dim">${q.dimension}</p>` : ''}
      <p class="q-text">${q.text}</p>
      ${optionsHtml(q, sel)}
      <p class="hint">键盘 ${max === 2 ? '1 · 2' : `1–${max}`} · 点击选项作答</p>
      <div class="actions quiz-actions">
        <button type="button" class="btn btn-ghost" id="btn-back"${canBack ? '' : ' disabled'}>上一题</button>
        <button type="button" class="btn btn-ghost" id="btn-abort">回首页</button>
      </div>
    </div>`
  const pick = (v) => answer(q.id, v)
  $$('#view-quiz [data-v]').forEach((b) => { b.onclick = () => pick(Number(b.dataset.v)) })
  $('#btn-back').onclick = () => { if (canBack) void goBackQuestion() }
  $('#btn-abort').onclick = () => { if (confirmExitQuiz()) void abortQuiz() }
  bindKeys(max, pick)
}

async function goBackQuestion() {
  try {
    const data = await api(`/sessions/${state.sessionId}/back`, { method: 'POST' })
    renderQuestion(
      data.currentQuestion,
      data.progress.current,
      data.progress.total,
      data.previousAnswer,
      data.canBack
    )
  } catch (err) {
    showQuizError(err.message, 'back')
  }
}

async function answer(qid, value) {
  const panel = $('#view-quiz .panel')
  panel?.classList.add('q-exit')
  const anim = panel ? new Promise((r) => setTimeout(r, 90)) : Promise.resolve()
  try {
    const [data] = await Promise.all([
      api(`/sessions/${state.sessionId}/answer`, {
        method: 'POST',
        body: JSON.stringify({ questionId: qid, value })
      }),
      anim
    ])
    if (data.complete) {
      unbindKeys()
      if (state.epilogue?.length) return showEpilogue(0)
      return finishQuiz()
    }
    renderQuestion(
      data.currentQuestion,
      data.progress.current,
      data.progress.total,
      null,
      data.canBack
    )
  } catch (err) {
    panel?.classList.remove('q-exit')
    showQuizError(err.message, 'answer', { qid, value })
  }
}

async function startQuiz(slug) {
  const a = state.assessments.find((x) => x.slug === slug)
  state.slug = slug
  state.assessmentName = a?.name || slug
  state.page = 'quiz'
  renderNav()
  show('quiz', true)
  $('#view-quiz').innerHTML = loadingPanel('正在准备题目…')
  try {
    const data = await api('/sessions', {
      method: 'POST',
      body: JSON.stringify({ slug, lang: state.defaultLang })
    })
    state.sessionId = data.sessionId
    state.epilogue = data.epilogue || []
    renderQuestion(data.firstQuestion, 1, data.total, null, false)
  } catch (err) {
    showQuizError(err.message, 'start', { slug })
  }
}

function drawRadar(canvas, dims) {
  if (!canvas || !dims?.length) return
  const ctx = canvas.getContext('2d')
  const { width: w, height: h } = canvas
  const cx = w / 2
  const cy = h / 2
  const r = Math.min(w, h) * 0.36
  const n = dims.length
  ctx.clearRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(26,26,28,0.08)'
  for (let ring = 1; ring <= 4; ring++) {
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n - Math.PI / 2
      const rr = (r * ring) / 4
      const x = cx + Math.cos(a) * rr
      const y = cy + Math.sin(a) * rr
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    }
    ctx.closePath()
    ctx.stroke()
  }
  dims.forEach((d, i) => {
    if (i === 0) ctx.beginPath()
    const val = (d.value ?? d.right ?? 50) / 100
    const a = (Math.PI * 2 * i) / n - Math.PI / 2
    ctx.lineTo(cx + Math.cos(a) * r * val, cy + Math.sin(a) * r * val)
  })
  ctx.closePath()
  ctx.fillStyle = 'rgba(47,79,111,0.08)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(47,79,111,0.55)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = '#3a3a3c'
  ctx.font = '11px PingFang SC,sans-serif'
  dims.forEach((d, i) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2
    const x = cx + Math.cos(a) * (r + 18)
    const y = cy + Math.sin(a) * (r + 18)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(d.label || d.code, x, y)
  })
}

function showEpilogue(step) {
  const list = state.epilogue || []
  const q = list[step]
  if (!q) return finishQuiz()
  const triggerKey = q.triggerKey || 'drink'
  if (q.triggerPrev != null && state.cbtiHidden?.[triggerKey] !== q.triggerPrev) {
    return showEpilogue(step + 1)
  }
  show('quiz')
  const total = list.length
  const pct = Math.round(((step + 1) / total) * 100)
  $('#view-quiz').innerHTML = `
    <div class="panel q-enter">
      <div class="quiz-head">
        <p class="quiz-name">${state.assessmentName} · 彩蛋</p>
        <div class="progress-row">
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <span class="progress-text">彩蛋 ${step + 1} / ${total}</span>
        </div>
      </div>
      <p class="q-text">${q.text}</p>
      <div class="options">${q.options.map((o, i) =>
        `<button type="button" class="opt" data-v="${o.value}"><span class="opt-num">${i + 1}</span><span class="opt-label">${o.label}</span></button>`
      ).join('')}</div>
      <div class="actions quiz-actions">
        <button type="button" class="btn btn-ghost" id="skip-epilogue">跳过，看结果</button>
        <button type="button" class="btn btn-ghost" id="abort-epilogue">回首页</button>
      </div>
    </div>`
  $$('#view-quiz [data-v]').forEach((b) => {
    b.onclick = () => {
      state.cbtiHidden = state.cbtiHidden || {}
      state.cbtiHidden[q.hiddenKey || String(q.id)] = b.dataset.v
      showEpilogue(step + 1)
    }
  })
  $('#skip-epilogue').onclick = () => finishQuiz()
  $('#abort-epilogue').onclick = () => { if (confirmExitQuiz()) void abortQuiz() }
}

function resultBodyHtml(render) {
  const blocks = []
  if (render?.oneliner) blocks.push(`<p class="result-oneliner">${render.oneliner}</p>`)
  if (render?.rarity != null) blocks.push(`<p class="result-rarity">理论稀有度 ${render.rarity}%</p>`)
  if (render?.isSpecial && render?.secondaryType) {
    blocks.push(`<p class="result-secondary">标准库最接近：${render.secondaryType.code} · ${render.secondaryType.name}</p>`)
  }
  if (render?.hiddenTags?.length) {
    blocks.push(`<div class="result-tags">${render.hiddenTags.map((t) => `<span class="tag art">${t}</span>`).join('')}</div>`)
  }
  if (render?.description) blocks.push(`<p class="result-desc">${render.description}</p>`)
  if (render?.strengths?.length) {
    blocks.push(`<div class="result-block"><h3>优势</h3><ul>${render.strengths.map((s) => `<li>${s}</li>`).join('')}</ul></div>`)
  }
  if (render?.weaknesses?.length) {
    blocks.push(`<div class="result-block"><h3>弱点</h3><ul>${render.weaknesses.map((s) => `<li>${s}</li>`).join('')}</ul></div>`)
  }
  if (render?.spirit) blocks.push(`<blockquote class="result-spirit">${render.spirit}</blockquote>`)
  if (render?.techStack) blocks.push(`<p class="result-tech">技术栈 · ${render.techStack}</p>`)
  if (render?.matchDetails?.length) {
    blocks.push(`<div class="result-block"><h3>相近类型</h3><ul class="match-list">${render.matchDetails.map((m) =>
      `<li><span class="match-code">${m.code}</span> ${m.name || ''} <em>${m.similarity}%</em></li>`).join('')}</ul></div>`)
  }
  return blocks.join('')
}

function renderResultView({ render, result, engine, stored = false }) {
  const color = render?.color || '#2f4f6f'
  const dims = render?.dimensions || []
  const img = assetUrl(resultImage(render, engine))
  const isMbti = MBTI_ENGINES.has(engine)
  show('result', true)
  $('#view-result').innerHTML = `
    <div class="panel result-panel">
      <div class="result-hero">
        ${img ? `<img class="result-img" src="${img}" alt="">` : ''}
        <div class="type-badge" style="color:${color};background:${color}12;border:1px solid ${color}33">${render?.type || result?.type || ''}</div>
        <h2 class="result-name">${render?.displayName || ''}</h2>
        ${render?.subtitle ? `<p class="result-sub">${render.subtitle}</p>` : ''}
        ${render?.similarity != null ? `<p class="match">匹配 ${render.similarity}%</p>` : ''}
        ${isMbti ? `<div class="gender-toggle">
          <button type="button" class="btn btn-sm${state.prefs.gender === 'male' ? ' active' : ''}" data-g="male">男版立绘</button>
          <button type="button" class="btn btn-sm${state.prefs.gender === 'female' ? ' active' : ''}" data-g="female">女版立绘</button>
        </div>` : ''}
      </div>
      ${resultBodyHtml(render)}
      ${dims.length ? '<div class="radar-wrap"><canvas id="radar" width="320" height="280"></canvas></div>' : ''}
      <div class="dim-list">${dims.slice(0, 10).map((d, i) => `
        <div class="dim-row" style="animation-delay:${i * 0.04}s">
          <span class="dim-label">${d.label || d.code}</span>
          <div class="dim-bar"><div class="dim-fill" style="width:${d.value ?? d.right ?? 50}%"></div></div>
          <span class="dim-val">${d.value ?? d.right ?? ''}</span>
        </div>`).join('')}</div>
      <div class="actions">
        ${stored ? '' : `<button type="button" class="btn btn-primary" id="btn-retry">再测一次</button>`}
        <button type="button" class="btn btn-ghost" id="btn-home">返回量表</button>
        <button type="button" class="btn btn-ghost" id="btn-hist">查看记录</button>
      </div>
    </div>`
  drawRadar($('#radar'), dims)
  if (isMbti) {
    $$('[data-g]').forEach((b) => {
      b.onclick = () => {
        state.prefs = setPrefs({ gender: b.dataset.g })
        renderResultView({ render: { ...render, image: assetUrl(mbtiImage(render.type, state.prefs.gender)) }, result, engine })
      }
    })
  }
  $('#btn-retry')?.addEventListener('click', () => startQuiz(state.slug))
  $('#btn-home')?.addEventListener('click', goHome)
  $('#btn-hist')?.addEventListener('click', () => { state.page = 'history'; renderNav(); show('history', true); renderHistory() })
}

function showStoredResult(item) {
  if (!item.render) return
  state.slug = item.slug
  renderResultView({ render: item.render, result: item, engine: item.engine, stored: true })
}

function persistResult(payload) {
  const a = state.assessments.find((x) => x.slug === state.slug)
  const engine = a?.engine || ''
  const render = payload.render || {}
  saveResult({
    slug: state.slug,
    assessmentName: a?.name || state.slug,
    engine,
    type: render.type,
    render: {
      ...render,
      image: assetUrl(resultImage(render, engine))
    }
  })
  renderStats(state.assessments)
}

function showQuizError(message, action = 'submit', ctx = {}) {
  unbindKeys()
  state.quizRetry = { action, ...ctx }
  const expired = /会话不存在|已过期/.test(message || '')
  show('quiz')
  $('#view-quiz').innerHTML = `
    <div class="panel">
      <p class="empty">${formatApiError(message)}</p>
      <div class="actions">
        ${expired ? '' : '<button type="button" class="btn btn-primary" id="err-retry">重试</button>'}
        <button type="button" class="btn btn-ghost" id="err-home">返回量表</button>
      </div>
    </div>`
  $('#err-retry')?.addEventListener('click', () => {
    const { action: act, qid, value, slug } = state.quizRetry || {}
    if (act === 'answer' && qid != null) return answer(qid, value)
    if (act === 'back') return goBackQuestion()
    if (act === 'start' && slug) return startQuiz(slug)
    return finishQuiz()
  })
  $('#err-home').onclick = goHome
}

async function finishQuiz() {
  show('quiz')
  $('#view-quiz').innerHTML = loadingPanel('正在计算结果…')
  try {
    const payload = await api(`/sessions/${state.sessionId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ hidden: state.cbtiHidden || {} })
    })
    state.cbtiHidden = null
    const a = state.assessments.find((x) => x.slug === state.slug)
    persistResult(payload)
    renderResultView({ ...payload, engine: a?.engine || '' })
  } catch (err) {
    showQuizError(err.message, 'submit')
  }
}

function goHome() {
  unbindKeys()
  state.sessionId = null
  state.cbtiHidden = null
  state.epilogue = []
  state.page = 'home'
  renderNav()
  show('home')
  renderHome()
}

async function boot() {
  unbindKeys()
  state.page = 'home'
  show('home')
  $('#brand-home')?.addEventListener('click', () => {
    if (state.sessionId) {
      if (confirmExitQuiz()) void abortQuiz()
      return
    }
    if (state.page !== 'home') goHome()
  })
  $('#brand-home')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click() }
  })
  const data = await api('/assessments')
  if (data.webVersion) globalThis.__PSYCHE_VER__ = data.webVersion
  state.defaultLang = data.defaultLang || 'zh'
  state.assessments = data.assessments || []
  renderStats(state.assessments)
  renderNav()
  renderFilters()
  renderHome()
}

boot().catch((e) => {
  $('#view-home').innerHTML = `<p class="empty">${e.message}</p>`
})
