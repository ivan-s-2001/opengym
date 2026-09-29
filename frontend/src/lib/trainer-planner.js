import { isoOf, todayISO, uid, weekKey } from './format.js'
import { resolveWorkShift, scheduleKnown } from './work-schedule.js'

export const TRAINER_COLORS = ['#bf5af2', '#0a84ff', '#30d158', '#ff9f0a', '#ff375f', '#40c8e0', '#ffd60a', '#ff453a']

export const DEFAULT_TRAINER_PLANNER = {
  subscriptionSize: 0,
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
    trainers: raw?.trainers || [],
    sessions: raw?.sessions || [],
  }
}

function blockedForDate(dateISO, profileSchedule, settings) {
  const result = []

  for (const offset of [-1, 0, 1]) {
    const iso = addISO(dateISO, offset)
    const shift = resolveWorkShift(profileSchedule, iso)
    if (shift === undefined || shift === null) continue

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

export function availabilityForTrainerDate(plannerRaw, profileSchedule, trainer, dateISO) {
  const planner = normalizePlanner(plannerRaw)

  if (!scheduleKnown(profileSchedule, dateISO)) {
    return { date: dateISO, kind: 'missing', windows: [] }
  }

  const d = dateAt(dateISO)
  const slots = (trainer.slots || [])
    .filter(x => Number(x.day) === d.getDay() && timeMin(x.end) > timeMin(x.start))

  if (!slots.length) {
    return { date: dateISO, kind: 'trainer-off', windows: [] }
  }

  const blocks = blockedForDate(dateISO, profileSchedule, planner.settings)
  const windows = []

  for (const slot of slots) {
    const base = [dateAt(dateISO, slot.start).getTime(), dateAt(dateISO, slot.end).getTime()]

    for (const free of subtract(base, blocks)) {
      const rounded = roundedWindow(dateISO, free, planner.settings.stepMinutes)
      if (rounded && rounded.minutes >= planner.settings.workoutMinutes) windows.push(rounded)
    }
  }

  return {
    date: dateISO,
    kind: windows.length ? 'available' : 'busy',
    windows,
  }
}

function candidateSession(planner, profileSchedule, trainer, dateISO) {
  const a = availabilityForTrainerDate(planner, profileSchedule, trainer, dateISO)
  if (!a.windows.length) return null

  const window = [...a.windows]
    .sort((x, y) => y.minutes - x.minutes || timeMin(x.start) - timeMin(y.start))[0]

  const end = minTime(timeMin(window.start) + planner.settings.workoutMinutes)

  return {
    id: uid(),
    date: dateISO,
    start: window.start,
    end,
    trainerId: trainer.id,
    status: 'planned',
  }
}

function canPlace(dateISO, sessions, blockedDates = new Set()) {
  if (blockedDates.has(dateISO)) return false

  const counted = sessions.filter(s => s.status !== 'missed')
  if (counted.some(s => Math.abs(diffDays(s.date, dateISO)) < 2)) return false

  const wk = weekKey(dateISO)
  return counted.filter(s => weekKey(s.date) === wk).length < 3
}

function cadencePenalty(sessions, blockedDates = new Set()) {
  let p = 0
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date))

  for (let i = 1; i < sorted.length; i++) {
    const gap = diffDays(sorted[i - 1].date, sorted[i].date)
    if (gap > 3) p += gap - 3
    else if (gap < 2) p += 10
  }

  // A trainer course that has to sit right next to many solo sessions is less comfortable,
  // even when it does not collide on the exact same day.
  for (const session of sorted) {
    if (blockedDates.has(addISO(session.date, -1))) p += 1
    if (blockedDates.has(addISO(session.date, 1))) p += 1
  }

  return p
}

export function buildTrainerCourse(
  plannerRaw,
  profileSchedule,
  trainer,
  fromISO = todayISO(),
  blockedDates = new Set(),
) {
  const planner = normalizePlanner(plannerRaw)
  const target = Math.max(0, Math.floor(Number(planner.subscriptionSize) || 0))
  const sessions = []
  let date = fromISO
  const max = addISO(fromISO, 180)

  while (sessions.length < target && date <= max) {
    const c = candidateSession(planner, profileSchedule, trainer, date)

    if (c && canPlace(date, sessions, blockedDates)) {
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
    penalty: cadencePenalty(sessions, blockedDates),
  }
}

export function trainerCoursePlans(
  plannerRaw,
  profileSchedule,
  fromISO = todayISO(),
  blockedDates = new Set(),
) {
  const planner = normalizePlanner(plannerRaw)

  return (planner.trainers || [])
    .filter(t => (t.slots || []).length)
    .map(t => buildTrainerCourse(planner, profileSchedule, t, fromISO, blockedDates))
    .sort((a, b) => {
      if (a.complete !== b.complete) return a.complete ? -1 : 1
      if (a.sessions.length !== b.sessions.length) return b.sessions.length - a.sessions.length
      if (a.penalty !== b.penalty) return a.penalty - b.penalty
      return String(a.finishDate || '9999').localeCompare(String(b.finishDate || '9999'))
    })
}

export function intersectionDates(
  plannerRaw,
  profileSchedule,
  trainer,
  fromISO = todayISO(),
  days = 90,
) {
  const out = new Set()

  for (let i = 0; i < days; i++) {
    const iso = addISO(fromISO, i)
    if (availabilityForTrainerDate(plannerRaw, profileSchedule, trainer, iso).windows.length) {
      out.add(iso)
    }
  }

  return out
}

export function confirmTrainerCourse(
  plannerRaw,
  profileSchedule,
  trainerId,
  fromISO = todayISO(),
  blockedDates = new Set(),
) {
  const planner = normalizePlanner(plannerRaw)
  const trainer = planner.trainers.find(t => t.id === trainerId)
  if (!trainer) return planner

  const course = buildTrainerCourse(planner, profileSchedule, trainer, fromISO, blockedDates)

  return {
    ...planner,
    confirmedTrainerId: trainer.id,
    sessions: course.sessions,
  }
}

function refillMissing(planner, profileSchedule, trainer, sessions, fromISO, blockedDates) {
  const counted = sessions.filter(s => s.status === 'attended' || s.status === 'planned')
  let missing = Math.max(0, planner.subscriptionSize - counted.length)
  if (!missing) return sessions

  const base = sessions.filter(s => s.status !== 'missed')
  const additions = []
  let date = fromISO
  const max = addISO(fromISO, 180)

  while (missing > 0 && date <= max) {
    const c = candidateSession(planner, profileSchedule, trainer, date)
    const spacing = base.concat(additions)

    if (
      c &&
      !spacing.some(s => s.date === date) &&
      canPlace(date, spacing, blockedDates)
    ) {
      additions.push(c)
      missing--
      date = addISO(date, 2)
    } else {
      date = addISO(date, 1)
    }
  }

  return sessions
    .concat(additions)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
}

export function markSession(
  plannerRaw,
  profileSchedule,
  sessionId,
  status,
  fromISO = todayISO(),
  blockedDates = new Set(),
  workoutId = null,
) {
  const planner = normalizePlanner(plannerRaw)
  const trainer = planner.trainers.find(t => t.id === planner.confirmedTrainerId)
  if (!trainer) return planner

  let sessions = planner.sessions.map(s =>
    s.id === sessionId
      ? { ...s, status, ...(workoutId ? { workoutId } : {}) }
      : s,
  )

  if (status === 'missed') {
    sessions = refillMissing(
      planner,
      profileSchedule,
      trainer,
      sessions,
      fromISO,
      blockedDates,
    )
  }

  return { ...planner, sessions }
}

export function trainerSessionForDate(plannerRaw, iso) {
  const planner = normalizePlanner(plannerRaw)
  return planner.sessions.find(s => s.date === iso && s.status === 'planned') || null
}
