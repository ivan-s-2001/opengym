import { isoOf } from './format.js'

const pad = n => String(n).padStart(2, '0')
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key)
const dateAt = iso => new Date(iso + 'T12:00:00')

export const DEFAULT_PROFILE_SCHEDULE = {
  workShifts: {},
  weekly: {},
  cycle: null,
}

export const normalizeProfileSchedule = raw => ({
  ...DEFAULT_PROFILE_SCHEDULE,
  ...(raw || {}),
  workShifts: raw?.workShifts || {},
  weekly: raw?.weekly || {},
  cycle: raw?.cycle || null,
})

export const shiftKey = shift => shift ? shift.start + '–' + shift.end : 'off'

export function resolveWorkShift(raw, iso) {
  const schedule = normalizeProfileSchedule(raw)

  if (has(schedule.workShifts, iso)) return schedule.workShifts[iso]

  const cycle = schedule.cycle
  if (cycle?.startDate && Array.isArray(cycle.days) && cycle.days.length) {
    const from = dateAt(cycle.startDate)
    const to = dateAt(iso)
    const delta = Math.floor((to - from) / 86400000)
    if (delta >= 0) {
      const idx = delta % cycle.days.length
      return cycle.days[idx]
    }
  }

  const weekday = String(dateAt(iso).getDay())
  if (has(schedule.weekly, weekday)) return schedule.weekly[weekday]

  return undefined
}

export const scheduleKnown = (raw, iso) => resolveWorkShift(raw, iso) !== undefined

export function monthDays(monthValue) {
  const [year, month] = String(monthValue || '').split('-').map(Number)
  if (!year || !month) return []
  const count = new Date(year, month, 0).getDate()
  return Array.from({ length: count }, (_, i) => monthValue + '-' + pad(i + 1))
}

export function materializeMonth(raw, monthValue) {
  return Object.fromEntries(monthDays(monthValue).map(iso => [iso, resolveWorkShift(raw, iso)]))
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

    const sh = Number(match[1]), sm = Number(match[2]), eh = Number(match[3]), em = Number(match[4])
    if (sh > 23 || eh > 23 || sm > 59 || em > 59) {
      warnings.push((i + 1) + ': некорректное время «' + line + '»')
      continue
    }

    shifts[iso] = {
      start: pad(sh) + ':' + pad(sm),
      end: pad(eh) + ':' + pad(em),
    }
  }

  if (lines.length > days) warnings.push('Лишние строки после ' + days + '-го дня проигнорированы')
  return { shifts, warnings }
}

export function replaceMonthOverrides(raw, monthValue, shifts) {
  const schedule = normalizeProfileSchedule(raw)
  const workShifts = Object.fromEntries(
    Object.entries(schedule.workShifts).filter(([iso]) => !iso.startsWith(monthValue + '-')),
  )
  return { ...schedule, workShifts: { ...workShifts, ...shifts } }
}

export function setDateOverride(raw, iso, value) {
  const schedule = normalizeProfileSchedule(raw)
  return { ...schedule, workShifts: { ...schedule.workShifts, [iso]: value } }
}

export function clearDateOverride(raw, iso) {
  const schedule = normalizeProfileSchedule(raw)
  const workShifts = { ...schedule.workShifts }
  delete workShifts[iso]
  return { ...schedule, workShifts }
}

export function setWeeklyDay(raw, day, value) {
  const schedule = normalizeProfileSchedule(raw)
  return { ...schedule, weekly: { ...schedule.weekly, [String(day)]: value } }
}

export function clearWeeklyDay(raw, day) {
  const schedule = normalizeProfileSchedule(raw)
  const weekly = { ...schedule.weekly }
  delete weekly[String(day)]
  return { ...schedule, weekly }
}

export function setCycle(raw, startDate, days) {
  const schedule = normalizeProfileSchedule(raw)
  return {
    ...schedule,
    cycle: startDate && Array.isArray(days) && days.length
      ? { startDate, days }
      : null,
  }
}

export function scheduleCoverage(raw, fromISO, maxDays = 120) {
  let known = 0
  let lastKnown = null
  for (let i = 0; i < maxDays; i++) {
    const d = dateAt(fromISO)
    d.setDate(d.getDate() + i)
    const iso = isoOf(d)
    if (scheduleKnown(raw, iso)) {
      known++
      lastKnown = iso
    }
  }
  return { known, lastKnown }
}
