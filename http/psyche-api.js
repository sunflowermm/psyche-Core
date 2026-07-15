/**
 * 心理测评 REST API
 */
import { HttpResponse } from '../../../src/utils/http-utils.js'
import {
  getConfig, resolveEnabled, startQuizSession, submitSession,
  getAssessment, loadAssessmentData, getQuestionSet,
  getSession, answerQuestion, rewindSession, sessionProgress, abandonSession, getHistory, cleanupExpired
} from '../lib/psyche-service.js'
import { getWebVersion } from '../lib/web-version.js'

const uid = (req) => req.body?.userId || req.query?.userId || req.headers['x-psyche-user'] || 'anonymous'

export default {
  name: 'psyche-api',
  dsc: '心理测评 API',
  priority: 120,
  routes: [
    {
      method: 'GET', path: '/api/psyche/assessments', systemAuth: false,
      handler: HttpResponse.asyncHandler(async (req, res) => {
        cleanupExpired()
        const runtimeConfig = await getConfig()
        return HttpResponse.success(res, {
          assessments: resolveEnabled(runtimeConfig),
          defaultLang: runtimeConfig.defaultLang || 'zh',
          webVersion: getWebVersion()
        })
      }, 'psyche.list')
    },
    {
      method: 'GET', path: '/api/psyche/assessments/:slug', systemAuth: false,
      handler: HttpResponse.asyncHandler(async (req, res) => {
        const runtimeConfig = await getConfig()
        const a = getAssessment(req.params.slug)
        if (!a || !resolveEnabled(runtimeConfig).some((x) => x.id === a.id)) return HttpResponse.notFound(res, '测评不存在')
        const lang = req.query.lang || runtimeConfig.defaultLang || 'zh'
        const data = loadAssessmentData(a, lang)
        const questions = getQuestionSet(a, data, lang)
        return HttpResponse.success(res, {
          assessment: a, questionCount: questions.length, questions,
          epilogue: data.hiddenQuestions || []
        })
      }, 'psyche.detail')
    },
    {
      method: 'POST', path: '/api/psyche/sessions', systemAuth: false,
      handler: HttpResponse.asyncHandler(async (req, res) => {
        const runtimeConfig = await getConfig()
        const { slug, lang: bodyLang } = req.body || {}
        if (!slug) return HttpResponse.validationError(res, '缺少 slug')
        const { session, assessment, data } = await startQuizSession({
          userId: uid(req), slug, lang: bodyLang || runtimeConfig.defaultLang || 'zh',
          ttlMs: (runtimeConfig.sessionTtlMinutes || 30) * 60 * 1000
        })
        return HttpResponse.success(res, {
          sessionId: session.id,
          assessment: { id: assessment.id, slug: assessment.slug, name: assessment.name, hasArt: assessment.hasArt, engine: assessment.engine },
          total: session.questions.length,
          firstQuestion: session.questions[0],
          epilogue: data.hiddenQuestions || []
        })
      }, 'psyche.session.create')
    },
    {
      method: 'GET', path: '/api/psyche/sessions/:sessionId', systemAuth: false,
      handler: HttpResponse.asyncHandler(async (req, res) => {
        const s = getSession(req.params.sessionId)
        if (!s) return HttpResponse.notFound(res, '会话不存在')
        return HttpResponse.success(res, { sessionId: s.id, status: s.status, ...sessionProgress(s) })
      }, 'psyche.session.get')
    },
    {
      method: 'POST', path: '/api/psyche/sessions/:sessionId/answer', systemAuth: false,
      handler: HttpResponse.asyncHandler(async (req, res) => {
        const { questionId, value } = req.body || {}
        const s = answerQuestion(req.params.sessionId, questionId, value)
        if (!s) return HttpResponse.notFound(res, '会话不存在')
        const done = s.index >= s.questions.length
        return HttpResponse.success(res, { complete: done, ...sessionProgress(s) })
      }, 'psyche.session.answer')
    },
    {
      method: 'POST', path: '/api/psyche/sessions/:sessionId/back', systemAuth: false,
      handler: HttpResponse.asyncHandler(async (req, res) => {
        const s = rewindSession(req.params.sessionId)
        if (!s) return HttpResponse.validationError(res, '已在第一题或会话无效')
        return HttpResponse.success(res, sessionProgress(s))
      }, 'psyche.session.back')
    },
    {
      method: 'POST', path: '/api/psyche/sessions/:sessionId/submit', systemAuth: false,
      handler: HttpResponse.asyncHandler(async (req, res) => {
        const out = await submitSession(req.params.sessionId, { hidden: req.body?.hidden })
        return HttpResponse.success(res, out)
      }, 'psyche.session.submit')
    },
    {
      method: 'DELETE', path: '/api/psyche/sessions/:sessionId', systemAuth: false,
      handler: HttpResponse.asyncHandler(async (req, res) => {
        if (!abandonSession(req.params.sessionId)) return HttpResponse.notFound(res, '会话不存在')
        return HttpResponse.success(res, { abandoned: true })
      }, 'psyche.session.abandon')
    },
    {
      method: 'GET', path: '/api/psyche/history', systemAuth: false,
      handler: HttpResponse.asyncHandler(async (req, res) => {
        return HttpResponse.success(res, { history: getHistory(uid(req), Math.min(Number(req.query.limit) || 10, 20)) })
      }, 'psyche.history')
    }
  ]
}
