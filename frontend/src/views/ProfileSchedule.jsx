import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { Button, Segmented, TextArea } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { isoOf, todayISO } from '../lib/format.js'
import { monthDays, parseShiftList } from '../lib/trainer-planner.js'

const SHIFT_COLORS = ['#0a84ff', '#bf5af2', '#40c8e0', '#30d158', '#ff9f0a', '#ff375f', '#5e5ce6', '#63e6e2', '#ffd60a', '#ff453a']

const shiftKey = shift => shift ? shift.start + '–' + shift.end : null
const monthLabel = month => new Date(month + '-01T12:00:00').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
const dayLabel = iso => new Date(iso + 'T12:00:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

function EditDaySheet({ iso, current, entered, onSave, onClear, close }) {
  const [kind, setKind] = useState(entered && current == null ? 'off' : 'work')
  const [start, setStart] = useState(current?.start || '08:00')
  const [end, setEnd] = useState(current?.end || '17:00')

  return <>
    <div className="sheet-title">
      <h3>{dayLabel(iso)}</h3>
      <p>Рабочая смена или выходной</p>
    </div>

    <Segmented
      value={kind}
      onChange={setKind}
      options={[
        { value: 'work', label: 'Работа', icon: 'briefcase' },
        { value: 'off', label: 'Выходной', icon: 'moon' },
      ]}
    />

    {kind === 'work' && <div className="ps-time-grid">
      <label>
        <span>Начало</span>
        <input type="time" value={start} onChange={e => setStart(e.target.value)} />
      </label>
      <label>
        <span>Конец</span>
        <input type="time" value={end} onChange={e => setEnd(e.target.value)} />
      </label>
    </div>}

    <div className="sheet-actions">
      <Button variant="primary" onClick={() => {
        onSave(kind === 'off' ? null : { start, end })
        close()
      }}>Сохранить</Button>
      {entered && <Button variant="danger" onClick={() => { onClear(); close() }}>Убрать день из графика</Button>}
    </div>
  </>
}

function ImportScheduleSheet({ month, onImport, close }) {
  const [raw, setRaw] = useState('')
  const parsed = useMemo(() => raw.trim() ? parseShiftList(raw, month) : null, [raw, month])
  const entered = parsed ? Object.keys(parsed.shifts).length : 0
  const work = parsed ? Object.values(parsed.shifts).filter(Boolean).length : 0

  return <>
    <div className="sheet-title">
      <h3>Вставить график</h3>
      <p className="capitalize">{monthLabel(month)}</p>
    </div>

    <div className="ps-import-note">Одна строка = один день. «-» = выходной.</div>

    <TextArea
      value={raw}
      onChange={e => setRaw(e.target.value)}
      rows={12}
      placeholder={'07:00 до 16:00\n08:00 до 17:00\n-\n-\n15:00 до 00:00'}
    />

    {parsed && <div className="ps-import-summary">
      Распознано: <strong>{entered}</strong> · рабочих: <strong>{work}</strong> · выходных: <strong>{entered - work}</strong>
    </div>}

    {!!parsed?.warnings.length && <div className="ps-import-warnings">
      {parsed.warnings.map((w, i) => <div key={i}>{w}</div>)}
    </div>}

    <div className="sheet-actions">
      <Button
        variant="primary"
        disabled={!entered}
        onClick={() => {
          onImport(parsed.shifts)
          close()
        }}
      >
        Сохранить месяц
      </Button>
      <Button variant="plain" onClick={close}>Отмена</Button>
    </div>
  </>
}

export default function ProfileSchedule() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const openSheet = useUI(s => s.openSheet)

  const initialShifts = S.profileSchedule?.workShifts || S.trainerPlanner?.workShifts || {}
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const dates = useMemo(() => monthDays(month), [month])
  const shifts = initialShifts

  const entered = dates.filter(iso => Object.prototype.hasOwnProperty.call(shifts, iso)).length
  const workDays = dates.filter(iso => shifts[iso]).length
  const shiftCounts = useMemo(() => {
    const map = new Map()
    dates.forEach(iso => {
      const shift = shifts[iso]
      if (!shift) return
      const key = shiftKey(shift)
      map.set(key, (map.get(key) || 0) + 1)
    })
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [dates, shifts])

  const colorMap = useMemo(
    () => Object.fromEntries(shiftCounts.map(([key], index) => [key, SHIFT_COLORS[index % SHIFT_COLORS.length]])),
    [shiftCounts],
  )

  const replaceMonth = parsed => update(s => {
    const legacy = s.trainerPlanner?.workShifts || {}
    const current = s.profileSchedule?.workShifts || legacy
    const next = Object.fromEntries(Object.entries(current).filter(([iso]) => !iso.startsWith(month + '-')))
    s.profileSchedule = { ...(s.profileSchedule || {}), workShifts: { ...next, ...parsed } }
    if (s.trainerPlanner?.workShifts) delete s.trainerPlanner.workShifts
  })

  const saveDay = (iso, value) => update(s => {
    const legacy = s.trainerPlanner?.workShifts || {}
    const current = s.profileSchedule?.workShifts || legacy
    s.profileSchedule = { ...(s.profileSchedule || {}), workShifts: { ...current, [iso]: value } }
    if (s.trainerPlanner?.workShifts) delete s.trainerPlanner.workShifts
  })

  const clearDay = iso => update(s => {
    const legacy = s.trainerPlanner?.workShifts || {}
    const current = { ...(s.profileSchedule?.workShifts || legacy) }
    delete current[iso]
    s.profileSchedule = { ...(s.profileSchedule || {}), workShifts: current }
    if (s.trainerPlanner?.workShifts) delete s.trainerPlanner.workShifts
  })

  const openDay = iso => {
    const enteredDay = Object.prototype.hasOwnProperty.call(shifts, iso)
    openSheet(close => <EditDaySheet
      iso={iso}
      current={shifts[iso]}
      entered={enteredDay}
      onSave={value => saveDay(iso, value)}
      onClear={() => clearDay(iso)}
      close={close}
    />)
  }

  const openImport = () => openSheet(close => <ImportScheduleSheet month={month} onImport={replaceMonth} close={close} />)

  const firstDay = dates[0] ? new Date(dates[0] + 'T12:00:00').getDay() : 1
  const offset = (firstDay + 6) % 7
  const cells = [...Array(offset).fill(null), ...dates]

  const shiftMonth = delta => {
    const d = new Date(month + '-01T12:00:00')
    d.setMonth(d.getMonth() + delta)
    setMonth(isoOf(d).slice(0, 7))
  }

  return <div className="narrow profile-schedule">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label="Назад"><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 10 }}>
        <h1>Мой график</h1>
        <div className="sub">Смены на месяц — одним взглядом</div>
      </div>
    </div>

    <div className="ps-month-switch">
      <button className="iconbtn" onClick={() => shiftMonth(-1)}><Icon name="chevronLeft" /></button>
      <strong className="capitalize">{monthLabel(month)}</strong>
      <button className="iconbtn" onClick={() => shiftMonth(1)}><Icon name="chevronRight" /></button>
    </div>

    <div className="card ps-summary">
      <div className="row between">
        <div>
          <div className="t-head">{entered === dates.length ? 'График заполнен' : `Заполнено ${entered} из ${dates.length}`}</div>
          <div className="muted small">{workDays} рабочих · {entered - workDays} выходных · {shiftCounts.length} типов смен</div>
        </div>
        <span className="lrow-i" style={{ background: 'var(--blue)' }}><Icon name="calendar" /></span>
      </div>
      <Button variant="tinted" icon="clipboard" onClick={openImport}>Вставить график списком</Button>
    </div>

    <div className="ps-calendar card">
      <div className="ps-week">
        {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(x => <span key={x}>{x}</span>)}
      </div>
      <div className="ps-grid">
        {cells.map((iso, i) => {
          if (!iso) return <span key={'e' + i} className="ps-empty" />
          const enteredDay = Object.prototype.hasOwnProperty.call(shifts, iso)
          const shift = shifts[iso]
          const key = shiftKey(shift)
          const color = key ? colorMap[key] : null
          const today = iso === todayISO()
          return <button
            key={iso}
            className={'ps-day' + (shift ? ' work' : enteredDay ? ' off' : '') + (today ? ' today' : '')}
            style={color ? { '--shift': color } : undefined}
            onClick={() => openDay(iso)}
          >
            <span>{Number(iso.slice(-2))}</span>
            <i>{shift ? shift.start.replace(':00', '') + '–' + shift.end.replace(':00', '') : enteredDay ? 'Вых' : '—'}</i>
          </button>
        })}
      </div>
    </div>

    {!!shiftCounts.length && <section className="ps-legend">
      <h4 className="sec">Цвета смен</h4>
      <div className="card">
        {shiftCounts.map(([key, count]) => <div className="ps-legend-row" key={key}>
          <i style={{ background: colorMap[key] }} />
          <span>{key}</span>
          <b>{count} дн.</b>
        </div>)}
      </div>
    </section>}

    <div className="muted small ps-help">
      Нажми на день, чтобы изменить смену. Этот график хранится в профиле и автоматически используется планировщиком тренировок.
    </div>
  </div>
}
