// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { hasData } from './useStore.js'

describe('hasData', () => {
  it('treats an active workout as user data', () => {
    expect(hasData({ active: { id: 'active-1', entries: [] }, workouts: [], routines: [], bodyweight: [] })).toBe(true)
  })

  it('still treats a fresh empty profile as empty', () => {
    expect(hasData({ active: null, workouts: [], routines: [], bodyweight: [] })).toBe(false)
  })
})
