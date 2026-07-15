import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { webAsset, psycheGeneratedPath } from './asset-paths.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ASSETS_FILE = path.join(__dirname, 'data/assets.json')
const WWW_ROOT = path.join(__dirname, '../www/psyche/assets')

let cache = null

function loadAssets() {
  if (cache) return cache
  if (!fs.existsSync(ASSETS_FILE)) {
    return { mbti: {}, ocean: {}, cbti: {}, sbti: {}, shennong: {}, traits: {} }
  }
  // PowerShell Set-Content 等可能写入 UTF-8 BOM，JSON.parse 会炸
  const text = fs.readFileSync(ASSETS_FILE, 'utf8').replace(/^\uFEFF/, '')
  cache = JSON.parse(text)
  return cache
}

function dominantDomain(domains) {
  const entries = Object.entries(domains || {})
  if (!entries.length) return null
  return entries.sort((a, b) => b[1].normalized - a[1].normalized)[0][0]
}

function assetFileExists(webPath) {
  if (!webPath?.startsWith('/psyche/assets/')) return false
  const rel = webPath.slice('/psyche/assets/'.length)
  const fp = path.join(WWW_ROOT, rel)
  return fs.existsSync(fp) && fs.statSync(fp).size > 200
}

function getTypeAsset(engine, typeCode) {
  const assets = loadAssets()
  const key = String(typeCode || '')
  if (engine === 'mbti-oejts' || engine === 'mbti-binary' || engine === 'mbti') {
    return assets.mbti?.[key.toUpperCase()] || null
  }
  if (engine === 'cbti') return assets.cbti?.[key] || assets.cbti?.[key.toUpperCase()] || null
  if (engine === 'sbti') return assets.sbti?.[key] || null
  if (engine === 'shennong') return assets.shennong?.[key] || null
  if (engine === 'bigfive-ipip50') return assets.ocean?.[key] || null
  return null
}

function resolveImage(engine, typeCode) {
  const key = String(typeCode || '')
  if (engine === 'cbti' || engine === 'sbti' || engine === 'shennong') {
    const gen = psycheGeneratedPath(engine, key)
    if (assetFileExists(gen)) return gen
  }
  const asset = getTypeAsset(engine, typeCode)
  if (asset?.image && assetFileExists(asset.image)) return asset.image
  if (engine === 'bigfive-ipip50' && typeCode) {
    return webAsset('ocean', `${typeCode.toLowerCase()}.svg`)
  }
  return asset?.image || null
}

export function enrichResult(result, assessment) {
  const engine = assessment.engine
  let typeCode = result.type
  if ((engine === 'cbti' || engine === 'sbti' || engine === 'shennong') && result.personality) typeCode = result.personality.code
  if (engine === 'bigfive-ipip50' && result.domains) typeCode = dominantDomain(result.domains)
  const asset = getTypeAsset(engine, typeCode)
  const image = resolveImage(engine, typeCode)
  return {
    ...result,
    typeCode,
    asset: asset || null,
    displayName: asset?.name || result.personality?.name || asset?.title || typeCode,
    image,
    color: asset?.color || result.personality?.color || '#6366f1'
  }
}

export function buildRenderPayload(result, assessment, lang = 'zh', hiddenMeta = null) {
  const enriched = enrichResult(result, assessment)
  const p = result.personality || {}
  const dims = []

  if (result.dimensionSummary) {
    for (const [code, info] of Object.entries(result.dimensionSummary)) {
      dims.push({ code, label: code, left: info.leftPercent, right: info.rightPercent, preference: info.preference })
    }
  } else if (result.dimensions?.length) {
    for (const d of result.dimensions) {
      dims.push({
        code: d.code,
        label: d.name || d.code,
        value: d.levelNum ? d.levelNum * 33 : d.percentage,
        level: d.level,
        hint: d.explanation || ''
      })
    }
  } else if (result.domains) {
    const names = { O: '开放性', C: '尽责性', E: '外向性', A: '宜人性', N: '神经质' }
    for (const [code, info] of Object.entries(result.domains)) {
      dims.push({ code, label: names[code] || code, value: info.normalized, level: info.level })
    }
  }

  const subtitle = enriched.asset?.motto || p.motto || ''
  const oneliner = enriched.asset?.oneliner || p.oneliner || p.intro || ''

  return {
    title: assessment.name,
    type: enriched.typeCode,
    displayName: enriched.displayName,
    subtitle,
    oneliner: oneliner !== subtitle ? oneliner : '',
    color: enriched.color,
    image: enriched.image,
    similarity: result.similarity,
    dimensions: dims,
    description: (p.description || p.desc || '').slice(0, 480),
    statusQuo: (() => {
      const base = p.statusQuo || ''
      const lore = result.petLore
      if (lore?.title && lore?.blurb) {
        return base ? `${base} · 萌宠缘分：${lore.title}——${lore.blurb}` : `${lore.title}——${lore.blurb}`
      }
      return base || lore?.blurb || ''
    })(),
    strengths: p.strengths || [],
    weaknesses: p.weaknesses || [],
    spirit: p.spirit || '',
    techStack: p.techStack || '',
    rarity: p.rarity ?? enriched.asset?.rarity ?? null,
    isSpecial: Boolean(result.isSpecial),
    petLore: result.petLore || null,
    mode: result.mode || null,
    secondaryType: result.secondaryType
      ? { code: result.secondaryType.code, name: result.secondaryType.name || result.secondaryType.cn }
      : null,
    matchDetails: (result.matchDetails || []).slice(0, 5),
    hiddenTags: buildHiddenTags(hiddenMeta),
    lang
  }
}

function buildHiddenTags(meta) {
  if (!meta) return []
  const tags = []
  if (meta.drink === 'coffee' && meta.drinkAttitude === 'addict') tags.push('咖啡因过载')
  if (meta.nightOwl === 'owl') tags.push('夜行程序员')
  if (meta.drink === 'cola') tags.push('快乐水驱动')
  if (meta.campusPet === 'horse') tags.push('纯牛马认证')
  if (meta.campusPet === 'goose') tags.push('大鹅幸存者')
  if (meta.campusPet === 'cat' || meta.campusPet === 'mimi345') tags.push('3/4/5舍咪咪家属')
  if (meta.campusPet === 'doggate') tags.push('老校门狗学长认证')
  if (meta.campusPet === 'bijiao') tags.push('一教美丽咪咪粉丝')
  if (meta.campusPet === 'squirrel') tags.push('银杏大道松鼠外交官')
  if (meta.campusPet === 'mouse') tags.push('小鼠致敬')
  if (meta.midnightSnack === 'milktea') tags.push('奶茶续命')
  if (meta.midnightSnack === 'noodle') tags.push('泡面战神')
  if (meta.midnightSnack === 'canteen') tags.push('魅力食堂夜宵')
  if (meta.midnightSnack === 'spicy') tags.push('校门炒米粉党')
  if (meta.dormFate === 'fresh4') tags.push('大一四人蜜月期')
  if (meta.dormFate === 'draw6') tags.push('大二抽签生存者')
  if (meta.dormFate === 'south') tags.push('南校区通勤党')
  if (meta.dormFate === 'lucky') tags.push('高年级好运宿舍')
  return tags
}
