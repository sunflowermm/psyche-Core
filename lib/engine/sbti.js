/** SBTI 17 维 L/M/H → Manhattan 距离，相似度 (1 - d/34)*100% */
function sumToLevel(score, numQ = 2) {
  if (score <= numQ * 1.5) return 'L'
  if (score <= numQ * 2.0) return 'M'
  return 'H'
}

function levelNum(level) {
  return { L: 1, M: 2, H: 3 }[level] ?? 2
}

function parsePattern(pattern) {
  return pattern.replace(/-/g, '').split('')
}

function buildDimensions(data, answers) {
  const rawScores = {}
  for (const dim of data.dimensionOrder) rawScores[dim] = 0

  for (const q of data.questions) {
    rawScores[q.dim] += Number(answers[q.id] ?? answers[String(q.id)] ?? 0)
  }

  const levels = {}
  const dimensions = []
  for (const dim of data.dimensionOrder) {
    const numQ = data.dimQuestionCount[dim] || 2
    const level = sumToLevel(rawScores[dim], numQ)
    levels[dim] = level
    const meta = data.dimensionMeta[dim] || {}
    dimensions.push({
      code: dim,
      name: meta.name || dim,
      model: meta.model,
      raw: rawScores[dim],
      level,
      levelNum: levelNum(level),
      explanation: data.dimExplanations?.[dim]?.[level] || ''
    })
  }
  return { rawScores, levels, dimensions }
}

function rankTypes(data, userVector) {
  return data.normalTypes.map((type) => {
    const vector = parsePattern(type.pattern).map(levelNum)
    let distance = 0
    let exact = 0
    for (let i = 0; i < vector.length; i++) {
      const diff = Math.abs(userVector[i] - vector[i])
      distance += diff
      if (diff === 0) exact += 1
    }
    const similarity = Math.max(0, Math.round((1 - distance / 34) * 100))
    const lib = data.typeLibrary[type.code] || {}
    return {
      code: type.code,
      pattern: type.pattern,
      distance,
      exact,
      similarity,
      ...lib
    }
  }).sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance
    if (b.exact !== a.exact) return b.exact - a.exact
    return b.similarity - a.similarity
  })
}

function toPersonality(entry) {
  if (!entry) return null
  return {
    code: entry.code,
    name: entry.cn || entry.name || entry.code,
    motto: entry.intro || entry.oneliner || '',
    oneliner: entry.oneliner || '',
    description: entry.desc || '',
    rarity: entry.rarity,
    intro: entry.intro || ''
  }
}

export function score(data, answers) {
  const { levels, dimensions } = buildDimensions(data, answers)
  const userVector = data.dimensionOrder.map((dim) => levelNum(levels[dim]))
  const ranked = rankTypes(data, userVector)
  const bestNormal = ranked[0]

  const drunk = data.drunkTrigger
  const drunkTriggered = drunk
    && Number(answers[drunk.gateId]) === drunk.gateValue
    && Number(answers[drunk.triggerId]) === drunk.triggerValue

  let finalEntry
  let isSpecial = false
  let secondaryType = null
  let mode = 'normal'

  if (drunkTriggered && data.typeLibrary.DRUNK) {
    finalEntry = { ...data.typeLibrary.DRUNK, code: 'DRUNK' }
    secondaryType = bestNormal
    isSpecial = true
    mode = 'drunk'
  } else if (bestNormal.similarity < (data.fallbackThreshold ?? 60) && data.typeLibrary.HHHH) {
    finalEntry = { ...data.typeLibrary.HHHH, code: 'HHHH' }
    isSpecial = true
    mode = 'fallback'
  } else {
    finalEntry = bestNormal
  }

  const personality = toPersonality(finalEntry)
  const similarity = mode === 'drunk' ? 100 : (mode === 'fallback' ? bestNormal.similarity : bestNormal.similarity)

  return {
    engine: 'sbti',
    type: personality.code,
    personality,
    similarity,
    dimensions,
    levels,
    isSpecial,
    mode,
    secondaryType: secondaryType ? toPersonality(secondaryType) : null,
    matchDetails: ranked.slice(0, 5).map((r) => ({
      code: r.code,
      name: r.cn,
      similarity: r.similarity,
      distance: r.distance
    }))
  }
}

export function validateAnswers(data, answers) {
  const required = [...data.questions, ...(data.specialQuestions || [])]
  const missing = required.filter((q) => answers[q.id] == null && answers[String(q.id)] == null)
  return { complete: missing.length === 0, missing: missing.map((q) => q.id), total: required.length }
}
