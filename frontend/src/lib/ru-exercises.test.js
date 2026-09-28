import { describe, expect, it } from 'vitest'
import { EXDB } from './exercises-data.js'
import { ruAliasesFor, ruNameFor } from './ru-exercises.js'
import { searchExercises } from './exercises.js'

describe('Russian exercise catalogue', () => {
  it('covers every built-in exercise with a Russian name and five aliases', () => {
    expect(EXDB.length).toBe(1324)
    for (const ex of EXDB) {
      const name = ruNameFor(ex)
      const aliases = ruAliasesFor(ex)
      expect(name, ex.id + ' ' + ex.n).toMatch(/[А-Яа-яЁё]/)
      expect(aliases, ex.id + ' ' + ex.n).toHaveLength(5)
      expect(new Set(aliases.map(x => x.toLowerCase().replace(/ё/g, 'е'))).size).toBe(5)
    }
  })

  it('finds common Russian gym slang', () => {
    expect(searchExercises(EXDB, 'бенч', {})[0]?.id).toBe('0025')
    expect(searchExercises(EXDB, 'гребля', {})[0]?.id).toBe('0861')
    expect(searchExercises(EXDB, 'бабочка', {})[0]?.id).toBe('0596')
    expect(searchExercises(EXDB, 'молотки', {})[0]?.id).toBe('0313')
    expect(searchExercises(EXDB, 'протяжка', {})[0]?.id).toBe('0120')
  })

  it('matches Russian words in any order and tolerates ё/е', () => {
    expect(searchExercises(EXDB, 'блок верхний', {}).some(ex => ex.id === '0818')).toBe(true)
    expect(searchExercises(EXDB, 'жим штанги лежа', {})[0]?.id).toBe('0025')
  })

  it('searches personal aliases from profile state', () => {
    const st = { exAliases: { '0025': ['мой любимый жим'] } }
    expect(searchExercises(EXDB, 'любимый жим', st)[0]?.id).toBe('0025')
  })

  it('keeps the English canonical name searchable', () => {
    expect(searchExercises(EXDB, 'barbell bench press', {})[0]?.id).toBe('0025')
  })
})
