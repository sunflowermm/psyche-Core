function levelNum(v, max = 3) {
  if (v <= max * 0.45) return 0
  if (v <= max * 0.75) return 1
  return 2
}

export function score(data, answers, extra = {}) {
  const hidden = extra.hidden || {}
  const raw = Object.fromEntries(data.axes.map((a) => [a, 0]))
  for (const q of data.questions) {
    const v = Number(answers[String(q.id)] ?? answers[q.id] ?? 2)
    raw[q.axis] = (raw[q.axis] || 0) + v
  }

  const counts = {}
  for (const q of data.questions) counts[q.axis] = (counts[q.axis] || 0) + 1

  const vector = data.axes.map((a) => levelNum(raw[a], counts[a] * 3))
  const dimensions = data.axes.map((a, i) => ({
    code: a,
    name: data.axisMeta?.[a]?.name || a,
    raw: raw[a],
    levelNum: vector[i],
    percentage: Math.round((raw[a] / ((counts[a] || 1) * 3)) * 100)
  }))

  const ranked = data.archetypes.map((arch) => {
    let distance = 0
    let exact = 0
    for (let i = 0; i < vector.length; i++) {
      const diff = Math.abs(vector[i] - (arch.vector[i] ?? 1))
      distance += diff
      if (diff === 0) exact++
    }
    const maxD = vector.length * 2
    const similarity = Math.max(0, Math.round((1 - distance / maxD) * 100))
    return { arch, distance, exact, similarity }
  }).sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance
    return b.exact - a.exact
  })

  let best = ranked[0]
  if (hidden.campusPet === 'horse' && data.specialArchetype) {
    best = { arch: data.specialArchetype, distance: 0, exact: vector.length, similarity: 100 }
  }

  const p = best.arch
  return {
    engine: 'shennong',
    type: p.code,
    personality: p,
    similarity: best.similarity,
    dimensions,
    isSpecial: Boolean(hidden.campusPet === 'horse' && data.specialArchetype),
    matchDetails: ranked.slice(0, 5).map((r) => ({
      code: r.arch.code,
      name: r.arch.name,
      similarity: r.similarity
    }))
  }
}
