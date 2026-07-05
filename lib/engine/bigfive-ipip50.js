/**
 * Big Five IPIP-50 计分
 * 题库来源：IPIP (Public Domain) · @alheimsins/b5-50-ipip-neo-pi-r
 */

const DOMAINS = ['O', 'C', 'E', 'A', 'N']

function reverseScore(value) {
  const n = Number(value)
  if (n === 1) return 5
  if (n === 2) return 4
  if (n === 4) return 2
  if (n === 5) return 1
  return 3
}

function levelFromNormalized(n) {
  if (n <= 35) return 'low'
  if (n >= 66) return 'high'
  return 'medium'
}

export function score(items, answers) {
  const raw = { O: 0, C: 0, E: 0, A: 0, N: 0 }
  const counts = { O: 0, C: 0, E: 0, A: 0, N: 0 }

  for (const item of items) {
    const answer = answers[item.id] ?? answers[String(item.num)]
    if (answer == null) continue
    let value = Number(answer)
    if (item.keyed === 'minus') value = reverseScore(value)
    raw[item.domain] += value
    counts[item.domain] += 1
  }

  const domains = {}
  for (const domain of DOMAINS) {
    const count = counts[domain] || 10
    const min = count
    const max = count * 5
    const normalized = Math.round(((raw[domain] - min) / (max - min)) * 100)
    domains[domain] = {
      raw: raw[domain],
      normalized,
      level: levelFromNormalized(normalized),
      itemCount: count
    }
  }

  return { engine: 'bigfive-ipip50', domains, raw }
}
