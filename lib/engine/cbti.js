/** CBTI 15 维 L/M/H 向量 Manhattan 匹配 */
function rawToLevel(raw) {
  if (raw <= 3) return 'L'
  if (raw === 4) return 'M'
  return 'H'
}

function levelToNum(level) {
  if (level === 'L') return 0
  if (level === 'M') return 1
  return 2
}

function calculateDimensions(data, answers) {
  return data.dimensionDefs.map((def) => {
    const dimQuestions = data.questions.filter((q) => q.dimension === def.code)
    const max = dimQuestions.length * 3
    let raw = 0
    for (const q of dimQuestions) raw += Number(answers[String(q.id)] ?? answers[q.id] ?? 2)
    const level = rawToLevel(raw)
    return {
      code: def.code,
      name: def.name,
      model: def.model,
      modelName: def.modelName,
      raw,
      max,
      level,
      levelNum: levelToNum(level),
      percentage: Math.round((raw / max) * 100)
    }
  })
}

export function score(data, answers, hidden = {}) {
  const dimensions = calculateDimensions(data, answers)

  if (hidden.drink === 'coffee' && hidden.drinkAttitude === 'addict' && data.specialPersonality) {
    return {
      engine: 'cbti',
      personality: data.specialPersonality,
      similarity: 100,
      dimensions,
      isSpecial: true,
      matchDetails: []
    }
  }

  const userVector = dimensions.map((d) => d.levelNum)
  const ranked = data.personalities.map((p) => {
    let distance = 0
    let exact = 0
    for (let i = 0; i < 15; i++) {
      const diff = Math.abs(userVector[i] - (p.vector[i] ?? 1))
      distance += diff
      if (diff === 0) exact++
    }
    const similarity = Math.max(0, Math.round((1 - distance / 30) * 100))
    return { personality: p, distance, exact, similarity }
  })

  ranked.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance
    if (a.exact !== b.exact) return b.exact - a.exact
    return b.similarity - a.similarity
  })

  const best = ranked[0]
  return {
    engine: 'cbti',
    personality: best.personality,
    type: best.personality.code,
    similarity: best.similarity,
    dimensions,
    isSpecial: false,
    matchDetails: ranked.slice(0, 5).map((r) => ({
      code: r.personality.code,
      name: r.personality.name,
      similarity: r.similarity
    }))
  }
}

export function validateAnswers(data, answers) {
  const missing = data.questions.filter((q) => answers[String(q.id)] == null && answers[q.id] == null)
  return { complete: missing.length === 0, missing: missing.map((q) => String(q.id)), total: data.questions.length }
}
