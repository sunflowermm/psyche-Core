import ConfigLoader from '../../../src/infrastructure/commonconfig/loader.js'
import {
  listAssessments, getAssessment, loadAssessmentData, getQuestionSet,
  scoreAssessment, formatQuestionMessage, formatResultText, validateAnswer
} from './engine/registry.js'
import { enrichResult, buildRenderPayload } from './assets.js'
import {
  createSession, getSession, answerQuestion, rewindSession, sessionProgress,
  completeSession, abandonSession, getHistory, cleanupExpired
} from './session-store.js'

export async function getConfig() {
  return ConfigLoader.get('psyche')?.read() || {}
}

const SLUG_ALIASES = {
  mbti: 'mbti', 'mbti速测': 'mbti-quick', 'mbti-quick': 'mbti-quick',
  'mbti-28': 'mbti-28', '28': 'mbti-28', 极速: 'mbti-28',
  'mbti-40': 'mbti-40', '40': 'mbti-40', 标准: 'mbti-40', 通用: 'mbti-40',
  'mbti-93': 'mbti-93', '93': 'mbti-93', 深度: 'mbti-93', deep: 'mbti-93',
  'mbti-scene': 'mbti-scene', 情境: 'mbti-scene', scene: 'mbti-scene',
  'mbti-work': 'mbti-work', 职场: 'mbti-work', work: 'mbti-work',
  大五: 'bigfive', bigfive: 'bigfive',
  'bigfive-deep': 'bigfive-deep', '大五深度': 'bigfive-deep', ipip120: 'bigfive-deep',
  cbti: 'cbti', cpti: 'cbti', 程序员: 'cbti', 'cbti-scene': 'cbti-scene',
  sbti: 'sbti', 'sbti-pro': 'sbti', 电子灵魂: 'sbti', 'sbti-scene': 'sbti-scene',
  shennong: 'shennong', 神农: 'shennong', 沈农: 'shennong', 混测: 'shennong'
}

export function resolveSlug(input) {
  const key = String(input || '').trim().toLowerCase()
  return SLUG_ALIASES[key] || key
}

export function resolveEnabled(cfg) {
  return listAssessments(cfg.enabledAssessments?.length ? { enabledIds: cfg.enabledAssessments } : {})
}

export async function startQuizSession({ userId, slug, lang, ttlMs }) {
  const assessment = getAssessment(slug)
  if (!assessment) throw new Error('测评不存在')
  const data = loadAssessmentData(assessment, lang)
  const questions = getQuestionSet(assessment, data, lang)
  const session = createSession({ userId, assessment, questions, lang, ttlMs })
  return { session, assessment, data }
}

export async function submitSession(sessionId, extra = {}) {
  const session = getSession(sessionId)
  if (!session) throw new Error('会话不存在或已过期')
  const assessment = getAssessment(session.assessmentId)
  const data = loadAssessmentData(assessment, session.lang)
  const result = await scoreAssessment(assessment, data, session.answers, extra)
  const enriched = enrichResult(result, assessment)
  completeSession(sessionId, enriched)
  return {
    result: enriched,
    text: formatResultText(enriched, assessment, session.lang),
    render: buildRenderPayload(enriched, assessment, session.lang, extra.hidden || null)
  }
}

export async function tryRenderResult(runtime, renderPayload) {
  if (!runtime?.render) return null
  try {
    return await runtime.render('心理测评', 'result', {
      saveId: `psyche_${Date.now()}`,
      imgType: 'png',
      quality: 92,
      sys: { scale: 2 },
      ...renderPayload
    }, { retType: 'base64' })
  } catch (err) {
    logger?.error?.(`[心理测评] 渲染失败: ${err.message}`)
    return null
  }
}

export {
  listAssessments, getAssessment, loadAssessmentData, getQuestionSet, scoreAssessment,
  formatQuestionMessage, formatResultText, validateAnswer,
  getSession, answerQuestion, rewindSession, sessionProgress, abandonSession, getHistory, cleanupExpired
}
