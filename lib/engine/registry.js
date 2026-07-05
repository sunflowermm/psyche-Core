import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../data')

const dataCache = new Map()
let manifest = null

function readJson(fileName) {
  if (dataCache.has(fileName)) return dataCache.get(fileName)
  const parsed = JSON.parse(fs.readFileSync(path.join(DATA_DIR, fileName), 'utf8'))
  dataCache.set(fileName, parsed)
  return parsed
}

export function getManifest() {
  if (!manifest) manifest = readJson('assessments.json')
  return manifest
}

export function listAssessments({ category, enabledIds } = {}) {
  let items = getManifest().assessments.slice()
  if (category) items = items.filter((a) => a.category === category)
  if (enabledIds?.length) {
    const set = new Set(enabledIds)
    items = items.filter((a) => set.has(a.id))
  }
  return items
}

export function getAssessment(idOrSlug) {
  return getManifest().assessments.find((a) => a.id === idOrSlug || a.slug === idOrSlug)
}

export function loadAssessmentData(assessment, lang = 'zh') {
  const file = assessment.dataFiles?.[lang] || assessment.dataFile
  if (!file) throw new Error('assessment missing dataFile')
  const data = readJson(file)
  if (!data.extends) return data
  const base = readJson(data.extends)
  const { extends: _ext, ...overlay } = data
  return {
    ...base,
    ...overlay,
    questions: overlay.questions ?? base.questions,
    hiddenQuestions: overlay.hiddenQuestions ?? base.hiddenQuestions,
    specialQuestions: overlay.specialQuestions ?? base.specialQuestions,
    dimQuestionCount: overlay.dimQuestionCount ?? base.dimQuestionCount,
    drunkTrigger: overlay.drunkTrigger ?? base.drunkTrigger
  }
}

const pickLang = (obj, lang) => {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  return obj[lang] || obj.zh || obj.en || Object.values(obj)[0] || ''
}

const pickOptions = (options, lang) => {
  if (Array.isArray(options)) return options
  return options?.[lang] || options?.zh || options?.en || []
}

export function getQuestionSet(assessment, data, lang = 'zh') {
  switch (assessment.engine) {
    case 'mbti-oejts': {
      const ids = assessment.variant === 'quick'
        ? Object.values(data.quickQuestionIds).flat().sort((a, b) => a - b)
        : data.questions.map((q) => q.id)
      const byId = new Map(data.questions.map((q) => [q.id, q]))
      return ids.map((id) => {
        const q = byId.get(id)
        return {
          id: String(q.id), type: 'bipolar-likert', dimension: q.dimension,
          text: pickLang(q.title, lang),
          leftTrait: pickLang(q.leftTrait, lang), rightTrait: pickLang(q.rightTrait, lang),
          scale: { min: 1, max: 5 }
        }
      })
    }
    case 'bigfive-ipip50':
      return data.map((item, i) => ({
        id: item.id || String(i + 1), type: 'likert', dimension: item.domain,
        text: item.text,
        choices: item.choices?.map((c) => ({ text: c.text, score: c.score })) || [],
        scale: { min: 1, max: 5 }
      }))
    case 'cbti':
      return data.questions.map((q) => ({
        id: String(q.id), type: 'choice', dimension: q.dimension, text: q.text,
        options: q.options.map((o) => ({ value: o.value, label: o.label })),
        scale: { min: 1, max: 3 }
      }))
    case 'mbti-binary':
      return data.questions.map((q) => {
        const opts = Array.isArray(q.options) ? q.options : pickOptions(q.options, lang)
        return {
          id: String(q.id), type: 'binary', dimension: q.dimension,
          text: pickLang(q.question, lang),
          options: opts.map((label, i) => ({ value: i + 1, label: String(label) })),
          scale: { min: 1, max: 2 }
        }
      })
    case 'sbti': {
      const mapQ = (q) => {
        const vals = q.options.map((o) => o.value)
        return {
          id: q.id, type: 'choice', dimension: q.dim || q.kind || 'special', text: q.text,
          options: q.options.map((o) => ({ value: o.value, label: o.label })),
          scale: { min: Math.min(...vals), max: Math.max(...vals) },
          special: Boolean(q.special)
        }
      }
      return [...data.questions.map(mapQ), ...(data.specialQuestions || []).map(mapQ)]
    }
    case 'shennong':
      return data.questions.map((q) => ({
        id: String(q.id), type: 'choice', dimension: q.axis, text: q.text,
        options: q.options.map((o) => ({ value: o.value, label: o.label })),
        scale: { min: 1, max: 3 }
      }))
    default:
      throw new Error(`unsupported engine: ${assessment.engine}`)
  }
}

export async function scoreAssessment(assessment, data, answers, extra = {}) {
  switch (assessment.engine) {
    case 'mbti-oejts':
      return (await import('./mbti-oejts.js')).score(data, answers, assessment.variant === 'quick')
    case 'bigfive-ipip50':
      return (await import('./bigfive-ipip50.js')).score(data, answers)
    case 'cbti':
      return (await import('./cbti.js')).score(data, answers, extra.hidden || {})
    case 'mbti-binary':
      return (await import('./mbti-binary.js')).score(data, answers)
    case 'sbti':
      return (await import('./sbti.js')).score(data, answers)
    case 'shennong':
      return (await import('./shennong.js')).score(data, answers, extra)
    default:
      throw new Error(`unsupported engine: ${assessment.engine}`)
  }
}

export function formatQuestionMessage(q, index, total) {
  if (q.type === 'bipolar-likert') {
    return [`第 ${index}/${total} 题`, q.text, '', `1 — ${q.leftTrait}`, `5 — ${q.rightTrait}`, '', '请回复 1~5（3 为中立）'].join('\n')
  }
  if (q.type === 'binary') {
    const opts = q.options.map((o) => `${o.value} — ${o.label}`).join('\n')
    return [`第 ${index}/${total} 题`, q.text, '', opts, '', '请回复 1 或 2'].join('\n')
  }
  if (q.type === 'choice') {
    const opts = q.options.map((o) => `${o.value} — ${o.label}`).join('\n')
    return [`第 ${index}/${total} 题`, q.text, '', opts, '', `请回复 1~${q.scale.max}`].join('\n')
  }
  if (q.type === 'likert') {
    const choices = q.choices?.length
      ? q.choices.map((c, i) => `${i + 1} — ${c.text}`).join('\n')
      : '1~5 Likert scale'
    return [`第 ${index}/${total} 题`, q.text, '', choices, '', '请回复 1~5'].join('\n')
  }
  return `${index}/${total} ${q.text}`
}

export function formatResultText(result, assessment, lang = 'zh') {
  if (assessment.engine === 'cbti' && result.personality) {
    const p = result.personality
    return [
      `【${assessment.name}】`, `${p.code} · ${p.name}`, p.motto || '',
      `匹配度 ${result.similarity}%`, '',
      ...(p.strengths?.length ? ['优势：', ...p.strengths.map((s) => `· ${s}`), ''] : []),
      p.spirit || ''
    ].filter(Boolean).join('\n')
  }
  if (assessment.engine === 'sbti' && result.personality) {
    const p = result.personality
    const lines = [
      `【${assessment.name}】`, `${p.code} · ${p.name}`, p.motto || '',
      `匹配度 ${result.similarity}%`
    ]
    if (p.oneliner) lines.push('', p.oneliner)
    if (result.isSpecial && result.secondaryType) {
      lines.push('', `（标准库最接近：${result.secondaryType.code} · ${result.secondaryType.name}）`)
    }
    if (p.rarity != null) lines.push('', `稀有度：${p.rarity}%`)
    return lines.filter(Boolean).join('\n')
  }
  if (assessment.engine === 'shennong' && result.personality) {
    const p = result.personality
    return [
      `【${assessment.name}】`, `${p.code} · ${p.name}`, p.motto || '',
      `匹配度 ${result.similarity}%`, '',
      ...(p.strengths?.length ? ['优势：', ...p.strengths.map((s) => `· ${s}`), ''] : []),
      p.spirit || ''
    ].filter(Boolean).join('\n')
  }
  if (assessment.engine === 'mbti-oejts' || assessment.engine === 'mbti-binary') {
    const lines = [`【${assessment.name}】`, `类型：${result.type}`, '', '维度倾向：']
    for (const [dim, info] of Object.entries(result.dimensionSummary || {})) {
      lines.push(`· ${dim}: ${info.preference} (${info.leftPercent}% / ${info.rightPercent}%)`)
    }
    if (result.confidence?.clarityIndex != null) lines.push('', `清晰度：${result.confidence.clarityIndex}%`)
    return lines.join('\n')
  }
  if (assessment.engine === 'bigfive-ipip50') {
    const names = { O: '开放性', C: '尽责性', E: '外向性', A: '宜人性', N: '神经质' }
    return [`【${assessment.name}】`, ...Object.entries(result.domains || {}).map(([d, s]) => `· ${names[d] || d}: ${s.normalized}/100 (${s.level})`)].join('\n')
  }
  return JSON.stringify(result, null, 2)
}

export function validateAnswer(q, value) {
  const n = Number(value)
  const { min = 1, max = 5 } = q.scale || {}
  return Number.isInteger(n) && n >= min && n <= max
}
