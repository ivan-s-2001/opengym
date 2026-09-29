import { isoOf, todayISO, uid, weekKey } from './format.js'

export const TRAINER_COLORS = ['#bf5af2', '#0a84ff', '#30d158', '#ff9f0a', '#ff375f', '#40c8e0', '#ffd60a', '#ff453a']

export const DEFAULT_TRAINER_PLANNER = {
  subscriptionSize: 0,
  workShifts: {},
  trainers: [],
  confirmedTrainerId: null,
  sessions: [],
  settings: {
    workoutMinutes: 60,
    travelBeforeMinutes: 30,
    travelAfterMinutes: 30,
    stepMinutes: 15,
  },
}

const pad = n => String(n).padStart(2, '0')
const dateAt = (iso, time = '12:00') => new Date(iso + 'T' + time + ':00')
const timeMin = value => {
  const [h, m] = String(value || '00:00').split(':').map(Number)
  return h * 60 + m
}
const minTime = minutes => pad(Math.floor(minutes / 60) % 24) + ':' + pad(minutes % 60)
const addISO = (iso, days) => {
  const d = dateAt(iso)
  d.setDate(d.getDate() + days)
  return isoOf(d)
}
const diffDays = (a, b) => Math.round((dateAt(b) - dateAt(a)) / 86400000)

export function normalizePlanner(raw) {
  return {
    ...DEFAULT_TRAINER_PLANNER,
    ...(raw || {}),
    settings: { ...DEFAULT_TRAINER_PLANNER.settings, ...(raw?.settings || {}) },
    workShifts: raw?.workShifts || {},
    trainers: raw?.trainers || [],
    sessions: raw?.sessions || [],
  }
}

export function parseShiftList(raw, monthValue) {
  if (!/^\d{4}-\d{2}$/.test(monthValue || '')) return { shifts: {}, warnings: ['Выберите месяц'] }
  const [year, month] = monthValue.split('-').map(Number)
  const days = new Date(year, month, 0).getDate()
  const lines = String(raw || '').replace(/\r/g, '').split('\n')
  const shifts = {}
  const warnings = []

  for (let i = 0; i < Math.min(lines.length, days); i++) {
    const iso = monthValue + '-' + pad(i + 1)
    const line = lines[i].trim()
    if (!line) continue
    if (/^[-—–]$/.test(line)) {
      shifts[iso] = null
      continue
    }
    const match = line.match(/(\d{1,2})\s*[:.]\s*(\d{2})\s*(?:до|[-–—])\s*(\d{1,2})\s*[:.]\s*(\d{2})/i)
    if (!match) {
      warnings.push((i + 1) + ': не удалось распознать «' + line + '»')
      continue
    }
    const start = pad(Number(match[1])) + ':' + match[2]
    const end = pad(Number(match[3])) + ':' + match[4]
    shifts[iso] = { start, end }
  }
  if (lines.length > days) warnings.push('Лишние строки после ' + days + '-го дня проигнорированы')
  return { shifts, warnings }
}

function blockedForDate(dateISO, shifts, settings) {
  const result = []
  for (const offset of [-1, 0, 1]) {
    const iso = addISO(dateISO, offset)
    if (!Object.prototype.hasOwnProperty.call(shifts, iso)) continue
    const shift = shifts[iso]
    if (!shift) continue
    let start = dateAt(iso, shift.start).getTime()
    let end = dateAt(iso, shift.end).getTime()
    if (end <= start) end += 86400000
    start -= settings.travelBeforeMinutes * 60000
    end += settings.travelAfterMinutes * 60000
    result.push([start, end])
  }
  return result.sort((a, b) => a[0] - b[0])
}

function subtract(base, blocks) {
  let segments = [base]
  for (const block of blocks) {
    const next = []
    for (const seg of segments) {
      if (block[0] >= seg[1] || block[1] <= seg[0]) {
        next.push(seg)
        continue
      }
      if (block[0] > seg[0]) next.push([seg[0], Math.min(block[0], seg[1])])
      if (block[1] < seg[1]) next.push([Math.max(block[1], seg[0]), seg[1]])
    }
    segments = next
  }
  return segments
}

function roundedWindow(dateISO, interval, step) {
  const dayStart = dateAt(dateISO, '00:00').getTime()
  const toMinutes = t => Math.round((t - dayStart) / 60000)
  const a = toMinutes(interval[0])
  const b = toMinutes(interval[1])
  const start = Math.ceil(a / step) * step
  const end = Math.floor(b / step) * step
  if (end <= start || start < 0 || end > 1440) return null
  return { start: minTime(start), end: minTime(end), minutes: end - start }
}

export function availabilityForTrainerDate(plannerRaw, trainer, dateISO) {
  const planner = normalizePlanner(plannerRaw)
  if (!Object.prototype.hasOwnProperty.call(planner.workShifts, dateISO)) {
    return { date: dateISO, kind: 'missing', windows: [] }
  }
  const d = dateAt(dateISO)
  const slots = (trainer.slots || []).filter(x => Number(x.day) === d.getDay() && timeMin(x.end) > timeMin(x.start))
  if (!slots.length) return { date: dateISO, kind: 'trainer-off', windows: [] }

  const blocks = blockedForDate(dateISO, planner.workShifts, planner.settings)
  const windows = []
  for (const slot of slots) {
    const base = [dateAt(dateISO, slot.start).getTime(), dateAt(dateISO, slot.end).getTime()]
    for (const free of subtract(base, blocks)) {
      const rounded = roundedWindow(dateISO, free, planner.settings.stepMinutes)
      if (rounded && rounded.minutes >= planner.settings.workoutMinutes) windows.push(rounded)
    }
  }
  return { date: dateISO, kind: windows.length ? 'available' : 'busy', windows }
}

function candidateSession(planner, trainer, dateISO) {
  const a = availabilityForTrainerDate(planner, trainer, dateISO)
  if (!a.windows.length) return null
  const window = [...a.windows].sort((x, y) => y.minutes - x.minutes || timeMin(x.start) - timeMin(y.start))[0]
  const end = minTime(timeMin(window.start) + planner.settings.workoutMinutes)
  return { id: uid(), date: dateISO, start: window.start, end, trainerId: trainer.id, status: 'planned' }
}

function canPlace(dateISO, sessions) {
  if (sessions.some(s => Math.abs(diffDays(s.date, dateISO)) < 2)) return false
  const wk = weekKey(dateISO)
  return sessions.filter(s => weekKey(s.date) === wk).length < 3
}

function cadencePenalty(sessions) {
  let p = 0
  for (let i = 1; i < sessions.length; i++) {
    const gap = diffDays(sessions[i - 1].date, sessions[i].date)
    if (gap > 3) p += gap - 3
    else if (gap < 2) p += 10
  }
  return p
}

export function buildTrainerCourse(plannerRaw, trainer, fromISO = todayISO()) {
  const planner = normalizePlanner(plannerRaw)
  const target = Math.max(0, Math.floor(Number(planner.subscriptionSize) || 0))
  const sessions = []
  let date = fromISO
  const max = addISO(fromISO, 180)

  while (sessions.length < target && date <= max) {
    const c = candidateSession(planner, trainer, date)
    if (c && canPlace(date, sessions)) {
      sessions.push(c)
      date = addISO(date, 2)
    } else {
      date = addISO(date, 1)
    }
  }

  return {
    trainer,
    sessions,
    target,
    complete: sessions.length === target,
    finishDate: sessions.at(-1)?.date || null,
    penalty: cadencePenalty(sessions),
  }
}

export function trainerCoursePlans(plannerRaw, fromISO = todayISO()) {
  const planner = normalizePlanner(plannerRaw)
  return (planner.trainers || [])
    .filter(t => (t.slots || []).length)
    .map(t => buildTrainerCourse(planner, t, fromISO))
    .sort((a, b) => {
      if (a.complete !== b.complete) return a.complete ? -1 : 1
      if (a.sessions.length !== b.sessions.length) return b.sessions.length - a.sessions.length
      if (a.penalty !== b.penalty) return a.penalty - b.penalty
      return String(a.finishDate || '9999').localeCompare(String(b.finishDate || '9999'))
    })
}

export function intersectionDates(plannerRaw, trainer, fromISO = todayISO(), days = 90) {
  const out = new Set()
  for (let i = 0; i < days; i++) {
    const iso = addISO(fromISO, i)
    if (availabilityForTrainerDate(plannerRaw, trainer, iso).windows.length) out.add(iso)
  }
  return out
}

export function confirmTrainerCourse(plannerRaw, trainerId, fromISO = todayISO()) {
  const planner = normalizePlanner(plannerRaw)
  const trainer = planner.trainers.find(t => t.id === trainerId)
  if (!trainer) return planner
  const course = buildTrainerCourse(planner, trainer, fromISO)
  return { ...planner, confirmedTrainerId: trainer.id, sessions: course.sessions }
}

export function markSession(plannerRaw, sessionId, status, fromISO = todayISO()) {
  const planner = normalizePlanner(plannerRaw)
  const trainer = planner.trainers.find(t => t.id === planner.confirmedTrainerId)
  if (!trainer) return planner

  const sessions = planner.sessions.map(s => s.id === sessionId ? { ...s, status } : s)
  if (status !== 'missed') return { ...planner, sessions }

  const counted = sessions.filter(s => s.status === 'attended' || s.status === 'planned').length
  const missing = Math.max(0, planner.subscriptionSize - counted)
  if (!missing) return { ...planner, sessions }

  const active = sessions.filter(s => s.status !== 'missed')
  let date = fromISO
  const lastFuture = active.filter(s => s.date >= fromISO).sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  if (lastFuture?.date > date) date = addISO(lastFuture.date, 2)
  const max = addISO(fromISO, 180)
  const additions = []

  while (additions.length < missing && date <= max) {
    const c = candidateSession(planner, trainer, date)
    const spacingBase = active.concat(additions)
    if (c && !spacingBase.some(s => s.date === date) && canPlace(date, spacingBase)) {
      additions.push(c)
      date = addISO(date, 2)
    } else {
      date = addISO(date, 1)
    }
  }

  return { ...planner, sessions: sessions.concat(additions).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)) }
}

export function monthDays(monthValue) {
  const [year, month] = monthValue.split('-').map(Number)
  if (!year || !month) return []
  const count = new Date(year, month, 0).getDate()
  return Array.from({ length: count }, (_, i) => monthValue + '-' + pad(i + 1))
}
