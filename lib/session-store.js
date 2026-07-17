import { randomBytes } from 'node:crypto'

const sessions = new Map()
const history = new Map()

const DEFAULT_TTL_MS = 30 * 60 * 1000

function newSessionId() {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID()
    }
  } catch { /* fall through */ }
  return randomBytes(16).toString('hex').replace(
    /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
    '$1-$2-$3-$4-$5'
  )
}

function userKey(userId) {
  return String(userId || 'anonymous')
}

export function createSession({ userId, assessment, questions, lang = 'zh', ttlMs = DEFAULT_TTL_MS }) {
  const id = newSessionId()
  const now = Date.now()
  const session = {
    id,
    userId: userKey(userId),
    assessmentId: assessment.id,
    assessmentSlug: assessment.slug,
    engine: assessment.engine,
    lang,
    questions,
    answers: {},
    index: 0,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + ttlMs,
    status: 'active'
  }
  sessions.set(id, session)
  return session
}

export function getSession(sessionId) {
  const session = sessions.get(sessionId)
  if (!session) return null
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId)
    return null
  }
  return session
}

export function rewindSession(sessionId) {
  const session = getSession(sessionId)
  if (!session || session.status !== 'active' || session.index <= 0) return null
  session.index -= 1
  session.updatedAt = Date.now()
  return session
}

export function sessionProgress(session) {
  const q = session.questions[session.index]
  return {
    progress: { current: session.index + 1, total: session.questions.length },
    currentQuestion: q,
    previousAnswer: q ? session.answers[String(q.id)] ?? null : null,
    canBack: session.index > 0
  }
}

export function answerQuestion(sessionId, questionId, value) {
  const session = getSession(sessionId)
  if (!session || session.status !== 'active') return null
  const n = Number(value)
  session.answers[String(questionId)] = Number.isFinite(n) ? n : value
  session.updatedAt = Date.now()
  const idx = session.questions.findIndex((q) => String(q.id) === String(questionId))
  if (idx >= 0 && idx >= session.index) session.index = idx + 1
  return session
}

export function completeSession(sessionId, result) {
  const session = getSession(sessionId)
  if (!session) return null
  session.status = 'completed'
  session.result = result
  session.completedAt = Date.now()
  const key = session.userId
  if (!history.has(key)) history.set(key, [])
  const list = history.get(key)
  list.unshift({
    sessionId: session.id,
    assessmentId: session.assessmentId,
    assessmentSlug: session.assessmentSlug,
    result,
    completedAt: session.completedAt
  })
  if (list.length > 20) list.length = 20
  return session
}

export function abandonSession(sessionId) {
  const session = sessions.get(sessionId)
  if (!session) return false
  session.status = 'abandoned'
  sessions.delete(sessionId)
  return true
}

export function getHistory(userId, limit = 10) {
  return (history.get(userKey(userId)) || []).slice(0, limit)
}

export function cleanupExpired() {
  const now = Date.now()
  for (const [id, session] of sessions.entries()) {
    if (now > session.expiresAt) sessions.delete(id)
  }
}
