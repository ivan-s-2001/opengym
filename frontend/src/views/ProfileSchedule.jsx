import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { Button, Row, Section, Segmented, TextArea, TextField } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { isoOf, todayISO } from '../lib/format.js'
import {
  clearDateOverride,
  materializeMonth,
  monthDays,
  normalizeProfileSchedule,
  parseShiftList,
  replaceMonthOverrides,
  resolveWorkShift,
  setCycle,
  setDateOverride,
} from '../lib/work-schedule.js'

const DAYS = [
  { day: 1, label: 'Понедельник' },
  { day: 2, label: 'Вторник' },
  { day: 3, label: 'Среда' },
  { day: 4, label: 'Четверг' },
  { day: 5, label: 'Пятница' },
  { day: 6, label: 'Суббота' },
  { day: 0, label: 'Воскресенье' },
]

const SHIFT_COLORS = [
  'var(--blue)', 'var(--purple)', 'var(--orange)', 'var(--teal)',
  'var(--pink)', 'var(--green)', 'var(--indigo)', 'var(--yellow)',
]

const shiftLabel = shift => shift ? shift.start + '–' + shift.end : 'Выходной'
const monthLabel = month =>
  new Date(month + '-01T12:00:00').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

const dayLabel = iso =>
  new Date(iso + 'T12:00:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

function colorForShift(shift) {
  if (!shift) return 'var(--label-3)'
  const key = shift.start + shift.end
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return SHIFT_COLORS[hash % SHIFT_COLORS.length]
}

function EditDaySheet({ iso, schedule, onSave, onClear, close }) {
  const resolved = resolveWorkShift(schedule, iso)
  const explicit = Object.prototype.hasOwnProperty.call(schedule.workShifts || {}, iso)
  const [kind, setKind] = useState(resolved === null ? 'off' : 'work')
  const [start, setStart] = useState(resolved?.start || '08:00')
  const [end, setEnd] = useState(resolved?.end || '17:00')

  return <>
    <h3 className="capitalize">{dayLabel(iso)}</h3>
    <div className="muted small" style={{ marginBottom: 14 }}>
      {explicit ? 'Изменение только для этой даты' : 'Можно переопределить недельный шаблон или цикл только на этот день'}
    </div>

    <Segmented
      value={kind}
      onChange={setKind}
      options={[
        { value: 'work', label: 'Работа', icon: 'briefcase' },
        { value: 'off', label: 'Выходной', icon: 'moon' },
      ]}
    />

    {kind === 'work' && <div className="grid2" style={{ marginTop: 14 }}>
      <label className="stp-w">
        <span className="stp-l">Начало</span>
        <TextField type="time" value={start} onChange={e => setStart(e.target.value)} />
      </label>
      <label className="stp-w">
        <span className="stp-l">Конец</span>
        <TextField type="time" value={end} onChange={e => setEnd(e.target.value)} />
      </label>
    </div>}

    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={() => {
      onSave(kind === 'off' ? null : { start, end })
      close()
    }}>Сохранить</Button>

    {explicit && <>
      <div style={{ height: 8 }} />
      <Button variant="ghost" onClick={() => { onClear(); close() }}>
        Вернуть значение шаблона
      </Button>
    </>}
  </>
}

function ImportScheduleSheet({ month, onImport, close }) {
  const [raw, setRaw] = useState('')
  const parsed = useMemo(() => raw.trim() ? parseShiftList(raw, month) : null, [raw, month])
  const entered = parsed ? Object.keys(parsed.shifts).length : 0
  const work = parsed ? Object.values(parsed.shifts).filter(Boolean).length : 0

  return <>
    <h3>Вставить график списком</h3>
    <div className="muted small capitalize" style={{ marginBottom: 12 }}>{monthLabel(month)}</div>

    <TextArea
      value={raw}
      onChange={e => setRaw(e.target.value)}
      rows={12}
      placeholder={'07:00 до 16:00\n08:00 до 17:00\n-\n-\n15:00 до 00:00'}
    />

    {parsed && <div className="small muted" style={{ marginTop: 10 }}>
      Распознано: <b>{entered}</b> · рабочих: <b>{work}</b> · выходных: <b>{entered - work}</b>
    </div>}

    {!!parsed?.warnings.length && <div className="small" style={{ color: 'var(--orange)', marginTop: 8 }}>
      {parsed.warnings.map((w, i) => <div key={i}>{w}</div>)}
    </div>}

    <div style={{ height: 14 }} />
    <Button
      variant="primary"
      disabled={!entered}
      onClick={() => { onImport(parsed.shifts); close() }}
    >
      Сохранить месяц
    </Button>
  </>
}

function WeeklyScheduleSheet({ schedule, onSave, close }) {
  const [weekly, setWeekly] = useState({ ...(schedule.weekly || {}) })

  const setKind = (day, kind) => {
    setWeekly(current => {
      const next = { ...current }
      if (kind === 'unknown') delete next[String(day)]
      else if (kind === 'off') next[String(day)] = null
      else next[String(day)] = next[String(day)] || { start: '08:00', end: '17:00' }
      return next
    })
  }

  const setTime = (day, field, value) =>
    setWeekly(current => ({
      ...current,
      [String(day)]: {
        ...(current[String(day)] || { start: '08:00', end: '17:00' }),
        [field]: value,
      },
    }))

  return <>
    <h3>По дням недели</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>
      Подходит для 5/2 и любого расписания, которое повторяется каждую неделю.
    </div>

    <div className="sect-b">
      {DAYS.map(({ day, label }) => {
        const has = Object.prototype.hasOwnProperty.call(weekly, String(day))
        const shift = weekly[String(day)]
        const kind = !has ? 'unknown' : shift === null ? 'off' : 'work'

        return <div className="lrow" key={day} style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
          <div className="row between" style={{ width: '100%' }}>
            <span className="lrow-t">{label}</span>
            <div className="chips" style={{ margin: 0 }}>
              <button className={'chip' + (kind === 'work' ? ' on' : '')} onClick={() => setKind(day, 'work')}>Работа</button>
              <button className={'chip' + (kind === 'off' ? ' on' : '')} onClick={() => setKind(day, 'off')}>Вых</button>
              <button className={'chip' + (kind === 'unknown' ? ' on' : '')} onClick={() => setKind(day, 'unknown')}>—</button>
            </div>
          </div>
          {kind === 'work' && <div className="grid2" style={{ width: '100%' }}>
            <TextField type="time" value={shift.start} onChange={e => setTime(day, 'start', e.target.value)} />
            <TextField type="time" value={shift.end} onChange={e => setTime(day, 'end', e.target.value)} />
          </div>}
        </div>
      })}
    </div>

    <div style={{ height: 12 }} />
    <Button variant="primary" onClick={() => { onSave(weekly); close() }}>
      Сохранить шаблон
    </Button>
  </>
}

function CycleScheduleSheet({ schedule, onSave, close }) {
  const initial = schedule.cycle?.days?.length
    ? schedule.cycle.days
    : [
        { start: '08:00', end: '20:00' },
        { start: '08:00', end: '20:00' },
        null,
        null,
      ]
  const [startDate, setStartDate] = useState(schedule.cycle?.startDate || todayISO())
  const [days, setDays] = useState(initial.map(x => x ? { ...x } : null))

  const updateDay = (idx, value) => setDays(current => current.map((x, i) => i === idx ? value : x))

  return <>
    <h3>Повторяющийся цикл</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>
      Например 2/2, день/ночь/два выходных или любой другой цикл.
    </div>

    <label className="stp-w" style={{ marginBottom: 12 }}>
      <span className="stp-l">Первый день цикла</span>
      <TextField type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
    </label>

    <div className="sect-b">
      {days.map((shift, idx) => <div className="lrow" key={idx} style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
        <div className="row between" style={{ width: '100%' }}>
          <span className="lrow-t">День {idx + 1}</span>
          <div className="chips" style={{ margin: 0 }}>
            <button
              className={'chip' + (shift ? ' on' : '')}
              onClick={() => updateDay(idx, shift || { start: '08:00', end: '17:00' })}
            >Работа</button>
            <button
              className={'chip' + (!shift ? ' on' : '')}
              onClick={() => updateDay(idx, null)}
            >Выходной</button>
          </div>
        </div>
        {shift && <div className="grid2" style={{ width: '100%' }}>
          <TextField type="time" value={shift.start} onChange={e => updateDay(idx, { ...shift, start: e.target.value })} />
          <TextField type="time" value={shift.end} onChange={e => updateDay(idx, { ...shift, end: e.target.value })} />
        </div>}
      </div>)}
    </div>

    <div className="grid2" style={{ marginTop: 10 }}>
      <Button variant="tinted" icon="plus" onClick={() => setDays(x => [...x, null])}>Добавить день</Button>
      <Button variant="ghost" disabled={days.length <= 1} onClick={() => setDays(x => x.slice(0, -1))}>Убрать последний</Button>
    </div>

    <div style={{ height: 12 }} />
    <Button variant="primary" onClick={() => { onSave(startDate, days); close() }}>
      Сохранить цикл
    </Button>
  </>
}

export default function ProfileSchedule() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const openSheet = useUI(s => s.openSheet)

  const schedule = normalizeProfileSchedule(S.profileSchedule)
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const dates = useMemo(() => monthDays(month), [month])
  const resolved = useMemo(() => materializeMonth(schedule, month), [schedule, month])

  const entered = dates.filter(iso => resolved[iso] !== undefined).length
  const workDays = dates.filter(iso => resolved[iso]).length
  const explicitCount = dates.filter(iso => Object.prototype.hasOwnProperty.call(schedule.workShifts, iso)).length

  const saveSchedule = next => update(s => { s.profileSchedule = next })

  const openDay = iso => openSheet(close => <EditDaySheet
    iso={iso}
    schedule={schedule}
    onSave={value => saveSchedule(setDateOverride(schedule, iso, value))}
    onClear={() => saveSchedule(clearDateOverride(schedule, iso))}
    close={close}
  />)

  const openImport = () => openSheet(close => <ImportScheduleSheet
    month={month}
    onImport={shifts => saveSchedule(replaceMonthOverrides(schedule, month, shifts))}
    close={close}
  />)

  const openWeekly = () => openSheet(close => <WeeklyScheduleSheet
    schedule={schedule}
    onSave={weekly => saveSchedule({ ...schedule, weekly })}
    close={close}
  />)

  const openCycle = () => openSheet(close => <CycleScheduleSheet
    schedule={schedule}
    onSave={(startDate, days) => saveSchedule(setCycle(schedule, startDate, days))}
    close={close}
  />)

  const openFill = () => openSheet(close => <>
    <h3>Заполнить график</h3>
    <div className="sect-b">
      <Row
        icon="clipboard"
        iconTint="var(--blue)"
        title="Вставить списком"
        subtitle="Одна строка — один день выбранного месяца"
        accessory="chevron"
        onClick={() => { close(); openImport() }}
      />
      <Row
        icon="calendar"
        iconTint="var(--purple)"
        title="По дням недели"
        subtitle="Пн–Вс со своим временем или выходным"
        accessory="chevron"
        onClick={() => { close(); openWeekly() }}
      />
      <Row
        icon="reset"
        iconTint="var(--orange)"
        title="Повторяющийся цикл"
        subtitle="2/2, 3/3, день/ночь и другие варианты"
        accessory="chevron"
        onClick={() => { close(); openCycle() }}
      />
    </div>
  </>)

  const firstDay = dates[0] ? new Date(dates[0] + 'T12:00:00').getDay() : 1
  const offset = (firstDay + 6) % 7
  const cells = [...Array(offset).fill(null), ...dates]

  const shiftMonth = delta => {
    const d = new Date(month + '-01T12:00:00')
    d.setMonth(d.getMonth() + delta)
    setMonth(isoOf(d).slice(0, 7))
  }

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label="Назад"><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 10 }}>
        <h1>Мой график</h1>
        <div className="sub">Рабочие смены для планирования тренировок</div>
      </div>
    </div>

    <div className="row between" style={{ marginBottom: 12 }}>
      <button className="iconbtn" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц"><Icon name="chevronLeft" /></button>
      <b className="capitalize">{monthLabel(month)}</b>
      <button className="iconbtn" onClick={() => shiftMonth(1)} aria-label="Следующий месяц"><Icon name="chevronRight" /></button>
    </div>

    <div className="card">
      <div className="row between" style={{ marginBottom: 12 }}>
        <div>
          <div className="big" style={{ fontSize: 21 }}>{entered === dates.length ? 'График заполнен' : `Заполнено ${entered} из ${dates.length}`}</div>
          <div className="muted small" style={{ marginTop: 2 }}>
            {workDays} рабочих · {entered - workDays} выходных
          </div>
        </div>
        <span className="lrow-i" style={{ '--tint': 'var(--blue)' }}><Icon name="calendar" /></span>
      </div>
      <Button variant="tinted" icon="plus" onClick={openFill}>Заполнить график</Button>
    </div>

    <div className="card">
      <div className="cal-grid" style={{ marginTop: 0 }}>
        {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(label => <div className="cal-h" key={label}>{label}</div>)}
        {cells.map((iso, i) => {
          if (!iso) return <div key={'e' + i} />

          const value = resolved[iso]
          const known = value !== undefined
          const today = iso === todayISO()
          const color = value ? colorForShift(value) : 'var(--label-3)'

          return <button
            key={iso}
            className={'cal-d' + (today ? ' today' : '')}
            style={value ? {
              background: `color-mix(in srgb,${color} 15%,var(--surface))`,
              color,
            } : undefined}
            onClick={() => openDay(iso)}
          >
            <span>{Number(iso.slice(-2))}</span>
            <i style={{ background: known ? color : 'transparent' }} />
          </button>
        })}
      </div>
    </div>

    <Section title="Как заполнено">
      <Row
        icon="clipboard"
        iconTint="var(--blue)"
        title="Конкретные даты"
        subtitle="Импорт списком и ручные изменения имеют приоритет"
        value={explicitCount}
        accessory="chevron"
        onClick={openImport}
      />
      <Row
        icon="calendar"
        iconTint="var(--purple)"
        title="Шаблон недели"
        subtitle="Повторяется по дням недели"
        value={Object.keys(schedule.weekly).length ? 'Настроен' : 'Нет'}
        accessory="chevron"
        onClick={openWeekly}
      />
      <Row
        icon="reset"
        iconTint="var(--orange)"
        title="Повторяющийся цикл"
        subtitle="Используется вместо шаблона недели, начиная с выбранной даты"
        value={schedule.cycle ? `${schedule.cycle.days.length} дн.` : 'Нет'}
        accessory="chevron"
        onClick={openCycle}
      />
    </Section>

    <div className="small dim" style={{ textAlign: 'center', lineHeight: 1.5 }}>
      Тапни по дню, чтобы изменить только эту дату. Неуказанный день считается неизвестным, а не выходным.
    </div>
  </div>
}
