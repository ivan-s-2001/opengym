import { EXDB } from './exercises-data.js'
import { t, getLang } from './i18n.js'
import { ruNameFor, ruAliasesFor } from './ru-exercises.js'

export { EXDB }
export const EXIDX = {}
EXDB.forEach(e => { EXIDX[e.id] = e })
export const BODYPARTS = [...new Set(EXDB.map(e => e.bp))].sort()

// Equipment options present in a given list of exercises, most common first (issue #6).
// Deriving them from the *already filtered* list keeps the chip row short and means
// every body-part × equipment combination on screen has results behind it.
export function equipmentOf(list) {
  const c = {}
  list.forEach(e => { if (e.eq) c[e.eq] = (c[e.eq] || 0) + 1 })
  return Object.keys(c).sort((a, b) => c[b] - c[a] || (a < b ? -1 : 1))
}

// Custom (user-created) exercises live in synced state S.customEx (issue #11) and are
// merged into the id index here so every EXIDX[id] lookup keeps working unchanged.
let customIds = []
export function registerCustom(list) {
  customIds.forEach(id => delete EXIDX[id])
  customIds = (list || []).map(e => e.id)
  ;(list || []).forEach(e => { EXIDX[e.id] = e })
}
// Full searchable catalogue — customs first so your own exercises are easy to find.
export const allExercises = st => [...(st.customEx || []), ...EXDB]

export const exerciseName = ex => {
  if (!ex) return ''
  if (ex.custom || getLang() !== 'ru') return ex.n || ''
  return ruNameFor(ex)
}

export const systemAliases = ex => (ex && !ex.custom ? ruAliasesFor(ex) : [])

export const userAliases = (st, exOrId) => {
  const id = typeof exOrId === 'string' ? exOrId : exOrId?.id
  const values = id && st?.exAliases?.[id]
  return Array.isArray(values) ? values.filter(Boolean) : []
}

export function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ё/g, 'е')
    .toLowerCase()
    .replace(/[–—−]/g, '-')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const wordsOf = value => normalizeSearch(value).split(' ').filter(Boolean)

// One-edit tolerance for words long enough that a typo is more likely than a different word.
function nearWord(a, b) {
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false
  if (a === b) return true
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  if (i === a.length || i === b.length) return Math.abs(a.length - b.length) <= 1
  if (a.length === b.length) {
    return a.slice(i + 1) === b.slice(i + 1) ||
      (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2))
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1)
}

const scoreField = (field, token, weight) => {
  const hay = normalizeSearch(field)
  if (!hay) return 0
  if (hay === token) return weight * 5
  if (hay.startsWith(token)) return weight * 4
  const words = hay.split(' ')
  if (words.some(w => w === token)) return weight * 4
  if (words.some(w => w.startsWith(token))) return weight * 3
  const idx = hay.indexOf(token)
  if (idx >= 0) return weight * 2 - Math.min(idx, 20) * 0.02
  if (words.some(w => nearWord(token, w))) return weight
  return 0
}

// Search score across Russian display name, built-in aliases, user aliases, canonical English
// name and the old metadata fields. Every query token has to match somewhere, in any order.
export function exerciseSearchScore(ex, query, st) {
  const tokens = wordsOf(query)
  if (!tokens.length) return 1
  if (!ex) return 0

  const fields = [
    [exerciseName(ex), 120],
    [ex.custom ? '' : ruNameFor(ex), 115],
    ...systemAliases(ex).map(v => [v, 105]),
    ...userAliases(st, ex).map(v => [v, 115]),
    [ex.n, 80],
    [ex.tg, 25],
    [ex.eq, 20],
    [ex.bp, 15],
    [ex.desc, 5],
  ]

  let total = 0
  for (const token of tokens) {
    let best = 0
    for (const [field, weight] of fields) best = Math.max(best, scoreField(field, token, weight))
    if (!best) return 0
    total += best
  }
  return total
}

export function searchExercises(list, query, st) {
  const q = normalizeSearch(query)
  if (!q) return list
  return list
    .map((ex, index) => ({ ex, index, score: exerciseSearchScore(ex, q, st) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(x => x.ex)
}

// Media normally sits next to the app (img/ and gif/, mounted into the web container).
// A build can point them somewhere else — the demo build pulls them off a CDN instead of
// shipping ~140 MB of images into the deployment.
const IMG_BASE = import.meta.env.VITE_IMG_BASE || 'img/'
const GIF_BASE = import.meta.env.VITE_GIF_BASE || 'gif/'
export const imgSrc = ex => IMG_BASE + ex.img
export const gifSrc = ex => GIF_BASE + ex.gif

// Cardio exercises log time + speed instead of weight × reps.
export const isCardio = idOrEx => (typeof idOrEx === 'string' ? EXIDX[idOrEx] : idOrEx)?.bp === 'cardio'

// An id that resolves to nothing — a plan file built against a different exercise dataset,
// a custom exercise deleted on another device before the sync arrived — still has to
// render. A placeholder keeps it visible (and removable) instead of taking the whole view
// down on the first `ex.n`.
export const exOr = id => EXIDX[id] ||
  { id, n: t('Unknown exercise'), bp: '', tg: '', eq: '', sm: [], st: [], missing: true }
