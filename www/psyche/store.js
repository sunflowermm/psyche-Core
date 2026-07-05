const KEY = 'psyche-history-v1'
const PREFS = 'psyche-prefs-v1'
const MAX = 50

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, val) {
  localStorage.setItem(key, JSON.stringify(val))
}

export function getPrefs() {
  return read(PREFS, { gender: 'male' })
}

export function setPrefs(patch) {
  const next = { ...getPrefs(), ...patch }
  write(PREFS, next)
  return next
}

export function listHistory() {
  return read(KEY, { version: 1, items: [] }).items
}

function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`
}

export function saveResult(entry) {
  const box = read(KEY, { version: 1, items: [] })
  const item = {
    id: newId(),
    completedAt: new Date().toISOString(),
    ...entry
  }
  box.items.unshift(item)
  box.items = box.items.slice(0, MAX)
  write(KEY, box)
  return item
}

export function removeResult(id) {
  const box = read(KEY, { version: 1, items: [] })
  box.items = box.items.filter((x) => x.id !== id)
  write(KEY, box)
}

export function clearHistory() {
  write(KEY, { version: 1, items: [] })
}

export function mbtiImage(type, gender = 'male') {
  if (!type) return ''
  const g = gender === 'female' ? 'mbti-f' : 'mbti'
  return `/psyche/assets/${g}/${String(type).toLowerCase()}.svg`
}
