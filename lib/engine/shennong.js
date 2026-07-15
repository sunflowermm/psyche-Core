/** 神农 12 维：连续百分比匹配 + 彩蛋软加权，减少「全都混沌」感 */

function levelNum(pct) {
  if (pct <= 45) return 0
  if (pct <= 75) return 1
  return 2
}

/** archetype 0/1/2 → 期望百分比中心 */
function vectorTarget(v) {
  if (v <= 0) return 28
  if (v === 1) return 55
  return 82
}

/**
 * 隐藏题对结果的软加权（相似度加分，不硬改类型，除 horse→NIUMA）
 * 让「投喂/搬寝/南校」等选择真正影响匹配准确度
 */
const HIDDEN_BIAS = Object.freeze({
  campusPet: {
    mimi345: { FEEDER: 9, SHEKING: 2 },
    doggate: { FEEDER: 7, ROADDOG: 5 },
    bijiao: { FEEDER: 9, SOULNET: 2 },
    squirrel: { FEEDER: 6, NONGHUN: 3, CANTEEN: 2 }
  },
  dormFate: {
    draw6: { SHEBA: 11, HEATPROOF: 4, CILAO: 3 },
    south: { ROADDOG: 11, PAOKING: 3 },
    fresh4: { SHEKING: 3, MOART: 2 },
    lucky: { CANTEEN: 3, CHAOS: 2 }
  },
  midnightSnack: {
    canteen: { CANTEEN: 7 },
    noodle: { SHEBA: 4, HEATPROOF: 3 },
    milktea: { SOULNET: 5, MOART: 3 },
    spicy: { CILAO: 4, CHAOS: 2 },
    nothing: { LABGHOST: 4, JUANSHEN: 3 }
  }
})

function hiddenBonus(code, hidden) {
  let bonus = 0
  for (const [key, table] of Object.entries(HIDDEN_BIAS)) {
    const choice = hidden[key]
    if (!choice) continue
    const map = table[choice]
    if (map && map[code]) bonus += map[code]
  }
  return bonus
}

export function score(data, answers, extra = {}) {
  const hidden = extra.hidden || {}
  const axes = Array.isArray(data?.axes) ? data.axes : []
  const questions = Array.isArray(data?.questions) ? data.questions : []
  const archetypes = Array.isArray(data?.archetypes) ? data.archetypes : []
  if (!axes.length || !questions.length || !archetypes.length) {
    throw new Error('神农题库缺少 axes / questions / archetypes')
  }

  const raw = Object.fromEntries(axes.map((a) => [a, 0]))
  const counts = Object.fromEntries(axes.map((a) => [a, 0]))

  for (const q of questions) {
    const v = Number(answers[String(q.id)] ?? 2)
    raw[q.axis] = (raw[q.axis] || 0) + v
    counts[q.axis] = (counts[q.axis] || 0) + 1
  }

  const dimensions = axes.map((a) => {
    const max = (counts[a] || 1) * 3
    const percentage = Math.round((raw[a] / max) * 100)
    return {
      code: a,
      name: data.axisMeta?.[a]?.name || a,
      hint: data.axisMeta?.[a]?.hint || '',
      raw: raw[a],
      max,
      levelNum: levelNum(percentage),
      percentage
    }
  })

  const pctByAxis = Object.fromEntries(dimensions.map((d) => [d.code, d.percentage]))

  if (hidden.campusPet === 'horse' && data.specialArchetype) {
    return {
      engine: 'shennong',
      type: data.specialArchetype.code,
      personality: data.specialArchetype,
      similarity: 100,
      dimensions,
      isSpecial: true,
      petLore: data.petLore?.horse || null,
      dormFate: hidden.dormFate || null,
      matchDetails: [{ code: data.specialArchetype.code, name: data.specialArchetype.name, similarity: 100 }]
    }
  }

  const ranked = archetypes.map((arch) => {
    const vector = Array.isArray(arch.vector) ? arch.vector : []
    let sq = 0
    let exact = 0
    for (let i = 0; i < axes.length; i++) {
      const axis = axes[i]
      const userPct = pctByAxis[axis] ?? 55
      const target = vectorTarget(vector[i] ?? 1)
      const diff = Math.abs(userPct - target)
      sq += diff * diff
      if (levelNum(userPct) === (vector[i] ?? 1)) exact++
    }
    const rmse = Math.sqrt(sq / axes.length)
    let similarity = Math.max(0, Math.round(100 - rmse * 1.35))
    similarity = Math.min(99, similarity + hiddenBonus(arch.code, hidden))
    return { arch, exact, similarity, rmse }
  }).sort((a, b) => {
    if (b.similarity !== a.similarity) return b.similarity - a.similarity
    return b.exact - a.exact
  })

  const best = ranked[0]
  const petKey = hidden.campusPet
  const petLore = petKey && data.petLore?.[petKey] ? data.petLore[petKey] : null

  return {
    engine: 'shennong',
    type: best.arch.code,
    personality: best.arch,
    similarity: best.similarity,
    dimensions,
    isSpecial: false,
    petLore,
    dormFate: hidden.dormFate || null,
    matchDetails: ranked.slice(0, 5).map((r) => ({
      code: r.arch.code,
      name: r.arch.name,
      similarity: r.similarity
    }))
  }
}
