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

/** Bot 指令别名 → 正式 slug（仅非恒等映射） */
const SLUG_ALIASES = {
  'mbti速测': 'mbti-quick',
  极速: 'mbti-28',
  标准: 'mbti-40',
  通用: 'mbti-40',
  深度: 'mbti-93',
  deep: 'mbti-93',
  情境: 'mbti-scene',
  scene: 'mbti-scene',
  职场: 'mbti-work',
  work: 'mbti-work',
  大五: 'bigfive',
  '大五深度': 'bigfive-deep',
  ipip120: 'bigfive-deep',
  程序员: 'cbti',
  电子灵魂: 'sbti',
  神农: 'shennong',
  沈农: 'shennong',
  混测: 'shennong'
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
