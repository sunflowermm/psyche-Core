/**
 * MBTI 二选一计分 — 来源 luhuadong/mbti-test (MIT)
 * choice 1 → E/S/T/J，choice 2 → I/N/F/P；平分取 I/N/F/P
 */
const POLES = {
  EI: ['E', 'I'],
  SN: ['S', 'N'],
  TF: ['T', 'F'],
  JP: ['J', 'P']
}

export function score(data, answers) {
  const counts = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 }

  for (const q of data.questions) {
    const raw = answers[String(q.id)] ?? answers[q.id]
    if (raw == null) continue
    const choice = Number(raw)
    const [left, right] = POLES[q.dimension]
    if (choice === 1) counts[left] += 1
    else counts[right] += 1
  }

  const type = ['EI', 'SN', 'TF', 'JP'].map((dim) => {
    const [left, right] = POLES[dim]
    return counts[left] > counts[right] ? left : right
  }).join('')

  const dimensionSummary = {}
  for (const dim of Object.keys(POLES)) {
    const [left, right] = POLES[dim]
    const total = counts[left] + counts[right]
    const leftPercent = total ? Math.round((counts[left] / total) * 100) : 50
    dimensionSummary[dim] = {
      preference: counts[left] > counts[right] ? left : right,
      left, right,
      leftPercent,
      rightPercent: 100 - leftPercent,
      scores: { [left]: counts[left], [right]: counts[right] }
    }
  }

  return { engine: 'mbti-binary', type, counts, dimensionSummary }
}
