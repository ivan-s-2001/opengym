export function validBackupState(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  if (!Array.isArray(data.workouts) || !data.workouts.every(w => w && typeof w === 'object' && Array.isArray(w.entries))) return false
  if (!Array.isArray(data.routines) || !data.routines.every(r => r && typeof r === 'object' && Array.isArray(r.ex))) return false
  if (data.bodyweight != null && !Array.isArray(data.bodyweight)) return false
  if (data.customEx != null && !Array.isArray(data.customEx)) return false
  if (data.exAliases != null && (typeof data.exAliases !== 'object' || Array.isArray(data.exAliases))) return false
  if (data.active != null && (typeof data.active !== 'object' || Array.isArray(data.active))) return false
  return true
}

export function mergeBackupState(defaults, data) {
  const base = JSON.parse(JSON.stringify(defaults))
  return { ...base, ...data }
}
