import { describe, expect, it } from 'vitest'
import { hasData } from './state-data.js'

describe('hasData', () => {
  it('treats an active workout as user data', () => {
    expect(hasData({ active: { id: 'active-1', entries: [] }, workouts: [], routines: [], bodyweight: [] })).toBe(true)
  })

  it('still treats a fresh empty profile as empty', () => {
    expect(hasData({ active: null, workouts: [], routines: [], bodyweight: [] })).toBe(false)
  })

  it('recognizes completed workouts, routines and weigh-ins', () => {
    expect(hasData({ active: null, workouts: [{ id: 'w1' }], routines: [], bodyweight: [] })).toBe(true)
    expect(hasData({ active: null, workouts: [], routines: [{ id: 'r1' }], bodyweight: [] })).toBe(true)
    expect(hasData({ active: null, workouts: [], routines: [], bodyweight: [{ w: 80 }] })).toBe(true)
  })
})
