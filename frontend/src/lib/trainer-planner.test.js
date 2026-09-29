import { describe, expect, it } from 'vitest'
import { buildTrainerCourse, confirmTrainerCourse, markSession } from './trainer-planner.js'
import { weekKey } from './format.js'

const addDays = (iso, days) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

const from = '2026-09-29'
const workShifts = Object.fromEntries(Array.from({ length: 120 }, (_, i) => [addDays(from, i), null]))
const trainer = {
  id: 't1',
  name: 'Наташа',
  color: '#bf5af2',
  slots: [0, 1, 2, 3, 4, 5, 6].map(day => ({ id: 's' + day, day, start: '17:00', end: '21:00' })),
}
const planner = {
  subscriptionSize: 10,
  workShifts,
  trainers: [trainer],
  confirmedTrainerId: null,
  sessions: [],
  settings: { workoutMinutes: 60, travelBeforeMinutes: 30, travelAfterMinutes: 30, stepMinutes: 15 },
}

describe('trainer subscription planner', () => {
  it('plans the requested subscription from the supplied current day forward', () => {
    const course = buildTrainerCourse(planner, trainer, from)
    expect(course.complete).toBe(true)
    expect(course.sessions).toHaveLength(10)
    expect(course.sessions[0].date).toBe(from)
    expect(course.sessions.every(s => s.date >= from)).toBe(true)
  })

  it('keeps at least one full rest day and no more than three sessions per ISO week', () => {
    const course = buildTrainerCourse(planner, trainer, from)
    for (let i = 1; i < course.sessions.length; i++) {
      const a = new Date(course.sessions[i - 1].date + 'T12:00:00')
      const b = new Date(course.sessions[i].date + 'T12:00:00')
      expect(Math.round((b - a) / 86400000)).toBeGreaterThanOrEqual(2)
    }

    const byWeek = {}
    for (const session of course.sessions) {
      byWeek[weekKey(session.date)] = (byWeek[weekKey(session.date)] || 0) + 1
    }
    expect(Math.max(...Object.values(byWeek))).toBeLessThanOrEqual(3)
  })

  it('does not count a missed session and appends the next valid intersection', () => {
    const confirmed = confirmTrainerCourse(planner, trainer.id, from)
    const originalLast = confirmed.sessions.at(-1).date
    const missedId = confirmed.sessions[0].id
    const next = markSession(confirmed, missedId, 'missed', from)

    expect(next.sessions.filter(s => s.status === 'missed')).toHaveLength(1)
    expect(next.sessions.filter(s => s.status === 'planned' || s.status === 'attended')).toHaveLength(10)
    expect(next.sessions.at(-1).date > originalLast).toBe(true)
  })
})
