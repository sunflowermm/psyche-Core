/**
 * MBTI OEJTS 1.2 计分
 * 算法来源：https://github.com/openjung/core (MIT)
 * 题库来源：Open Psychometrics OEJTS 1.2
 */

const DIMENSIONS = ['EI', 'SN', 'TF', 'JP']

function sumDimension(data, answers, dimension, questionIds) {
  return questionIds.reduce((sum, qId) => sum + (Number(answers[String(qId)] ?? answers[qId] ?? 3)), 0)
}

function toRightPercent(score, min, max) {
  return Math.round(((score - min) / (max - min)) * 100)
}

function buildDimensionSummary(data, scores, isQuick) {
  const summary = {}
  for (const dim of DIMENSIONS) {
    const meta = data.dimensions[dim]
    const score = scores[dim]
    const preference = score > meta.threshold ? meta.right : meta.left
    const rightPercent = toRightPercent(score, isQuick ? data.quickScoreMin : meta.scoreMin, isQuick ? data.quickScoreMax : meta.scoreMax)
    summary[dim] = {
      score,
      preference,
      left: meta.left,
      right: meta.right,
      leftPercent: 100 - rightPercent,
      rightPercent,
      leftName: meta.leftName,
      rightName: meta.rightName
    }
  }
  return summary
}

function buildConfidence(scores, isQuick) {
  const threshold = isQuick ? 6 : 24
  const maxDistance = isQuick ? 4 : 16
  let totalDistance = 0
  const perDim = {}
  for (const dim of DIMENSIONS) {
    const distance = Math.abs(scores[dim] - threshold)
    totalDistance += distance
    perDim[dim] = { distance, percentage: Math.round((distance / maxDistance) * 100) }
  }
  return { clarityIndex: Math.round((totalDistance / (maxDistance * 4)) * 100), dimensions: perDim }
}

export function score(data, answers, isQuick = false) {
  const questionMap = isQuick ? data.quickQuestionIds : data.dimensionQuestions
  const scores = {}
  for (const dim of DIMENSIONS) {
    scores[dim] = sumDimension(data, answers, dim, questionMap[dim])
  }

  const threshold = isQuick ? data.quickThreshold : 24
  const type = DIMENSIONS.map((dim) => {
    const meta = data.dimensions[dim]
    return scores[dim] > threshold ? meta.right : meta.left
  }).join('')

  const dimensionSummary = buildDimensionSummary(data, scores, isQuick)
  const confidence = buildConfidence(scores, isQuick)

  return {
    engine: 'mbti-oejts',
    type,
    scores,
    dimensionSummary,
    confidence,
    isQuick: Boolean(isQuick)
  }
}
