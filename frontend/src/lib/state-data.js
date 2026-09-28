export const hasData = st =>
  !!(st?.active || (st?.workouts || []).length || (st?.routines || []).length || (st?.bodyweight || []).length)
