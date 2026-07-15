import plugin from '../../../src/infrastructure/plugins/plugin.js'
import {
  getConfig, resolveSlug, resolveEnabled, startQuizSession, submitSession, tryRenderResult,
  getSession, answerQuestion, abandonSession, formatQuestionMessage, validateAnswer
} from '../lib/psyche-service.js'

const SESSION_TIMEOUT_SEC = 600

export class PsycheQuiz extends plugin {
  constructor() {
    super({
      name: '心理测评',
      dsc: 'MBTI / SBTI / CBTI / 大五人格 — 多维度心理测评',
      event: 'message',
      priority: 5000,
      rule: [
        { reg: '^#(心理)?测评$', fnc: 'listTests' },
        { reg: '^#(心理)?测评帮助$', fnc: 'help' },
        { reg: '^#(心理)?测评(?:列表|清单)$', fnc: 'listTests' },
        { reg: '^#(心理)?测评(.+)$', fnc: 'startTest' },
        { reg: '^#(取消|退出)测评$', fnc: 'cancelTest' }
      ]
    })
  }

  getUserId() {
    return String(this.e.user_id || this.e.sender?.user_id || 'anonymous')
  }

  async listTests() {
    const cfg = await getConfig()
    const items = resolveEnabled(cfg)
    return this.reply([
      '【心理测评】',
      ...items.map((a) => `· #测评 ${a.slug} — ${a.name}（${a.questionCount}题）`),
      '',
      'MBTI · SBTI · CBTI · 大五 IPIP-50/120',
      '#取消测评 放弃当前测评'
    ].join('\n'))
  }

  async help() {
    return this.reply([
      '#测评 mbti — MBTI OEJTS 32题',
      '#测评 mbti-quick — MBTI 速测 8题',
      '#测评 sbti — SBTI 电子灵魂',
      '#测评 cbti — 程序员行为类型',
      '#测评 bigfive — 大五 IPIP-50',
      '#测评 shennong — 神农校园混测',
      '',
      '网页：/psyche/ · #测评 查看全部 · #取消测评'
    ].join('\n'))
  }

  async startTest() {
    const raw = this.e.msg.replace(/^#(心理)?测评/, '').trim()
    const slug = resolveSlug(raw)
    if (!slug) return this.listTests()

    const cfg = await getConfig()
    if (!resolveEnabled(cfg).some((a) => a.slug === slug || a.id === slug)) {
      return this.reply(`未找到或未启用「${raw}」，发送 #测评 查看列表。`)
    }

    try {
      const { session, assessment } = await startQuizSession({
        userId: this.getUserId(),
        slug,
        lang: cfg.defaultLang || 'zh',
        ttlMs: (cfg.sessionTtlMinutes || 30) * 60 * 1000
      })
      this.e._psycheSessionId = session.id
      this.setContext('psycheQuiz', false, SESSION_TIMEOUT_SEC, '测评已超时')
      const q = session.questions[0]
      return this.reply([
        `▶ ${assessment.name} · ${session.questions.length} 题`,
        formatQuestionMessage(q, 1, session.questions.length)
      ].join('\n\n'), true, { at: true })
    } catch (err) {
      return this.reply(`无法开始测评：${err.message}`)
    }
  }

  async cancelTest() {
    const stored = this.getContext('psycheQuiz')
    if (!stored?._psycheSessionId) return this.reply('当前没有进行中的测评。')
    abandonSession(stored._psycheSessionId)
    this.finish('psycheQuiz')
    return this.reply('已取消测评。')
  }

  async psycheQuiz(storedE) {
    const session = getSession(storedE?._psycheSessionId)
    if (!session || session.status !== 'active') {
      this.finish('psycheQuiz')
      return this.reply('会话已失效，请重新 #测评 开始。')
    }

    const current = session.questions[session.index]
    if (!validateAnswer(current, this.e.msg.trim())) {
      const { min, max } = current.scale || { min: 1, max: 5 }
      return this.reply(`请回复 ${min}~${max} 的整数。`)
    }

    answerQuestion(session.id, current.id, Number(this.e.msg.trim()))
    const updated = getSession(session.id)

    if (updated.index >= updated.questions.length) {
      try {
        const cfg = await getConfig()
        const { text, render } = await submitSession(updated.id)
        this.finish('psycheQuiz')
        if (cfg.renderResults !== false && this.e.runtime) {
          const img = await tryRenderResult(this.e.runtime, render)
          if (img) {
            await this.reply(img)
            return this.reply(`${text}\n\n感谢完成！`, true, { at: true })
          }
        }
        return this.reply(`${text}\n\n感谢完成！`, true, { at: true })
      } catch (err) {
        this.finish('psycheQuiz')
        return this.reply(`计算失败：${err.message}`)
      }
    }

    const next = updated.questions[updated.index]
    return this.reply(formatQuestionMessage(next, updated.index + 1, updated.questions.length))
  }
}
