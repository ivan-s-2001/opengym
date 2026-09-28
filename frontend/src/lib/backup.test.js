import { describe, expect, it } from 'vitest'
import { mergeBackupState, validBackupState } from './backup.js'

describe('backup validation', () => {
  const valid = { workouts: [], routines: [] }

  it('accepts the minimal valid openGym backup shape', () => {
    expect(validBackupState(valid)).toBe(true)
  })

  it('rejects malformed arrays that would crash the app after import', () => {
    expect(validBackupState({ workouts: {}, routines: [] })).toBe(false)
    expect(validBackupState({ workouts: [], routines: {} })).toBe(false)
    expect(validBackupState({ workouts: [{}], routines: [] })).toBe(false)
    expect(validBackupState({ workouts: [], routines: [{}] })).toBe(false)
  })

  it('rejects malformed optional local fields', () => {
    expect(validBackupState({ ...valid, bodyweight: {} })).toBe(false)
    expect(validBackupState({ ...valid, customEx: {} })).toBe(false)
    expect(validBackupState({ ...valid, exAliases: [] })).toBe(false)
  })

  it('merges old backups onto current defaults without mutating defaults', () => {
    const defaults = { lang: 'ru', workouts: [], routines: [], exAliases: {} }
    const data = { workouts: [], routines: [], lang: 'en' }
    const merged = mergeBackupState(defaults, data)
    expect(merged.lang).toBe('en')
    expect(merged.exAliases).toEqual({})
    expect(defaults.lang).toBe('ru')
  })
})
