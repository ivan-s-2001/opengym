import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { Button, NumberField, Segmented, TextField } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { fmtDate, isoOf, todayISO, uid } from '../lib/format.js'
import {
  TRAINER_COLORS,
  availabilityForTrainerDate,
  confirmTrainerCourse,
  intersectionDates,
  markSession,
  monthDays,
  normalizePlanner,
  parseShiftList,
  trainerCoursePlans,
} from '../lib/trainer-planner.js'

const DAYS = [
  { day: 1, label: 'Пн' }, { day: 2, label: 'Вт' }, { day: 3, label: 'Ср' },
  { day: 4, label: 'Чт' }, { day: 5, label: 'Пт' }, { day: 6, label: 'Сб' },
  { day: 0, label: 'Вс' },
]

const addDays = (iso, days) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return isoOf(d)
}

const monthLabel = month => new Date(month + '-01T12:00:00').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

function usePlanner() {
  const raw = useStore(s => s.S.trainerPlanner)
  const update = useStore(s => s.update)
  const planner = normalizePlanner(raw)
  const setPlanner = next => update(s => { s.trainerPlanner = typeof next === 'function' ? next(normalizePlanner(s.trainerPlanner)) : next })
  return [planner, setPlanner]
}

function SubscriptionSetup({ planner, setPlanner }) {
  return <div className="tp-hero card">
    <div className="tp-kicker">Абонемент</div>
    <div className="tp-title">Сколько занятий нужно отходить?</div>
    <div className="tp-sub">По этому числу OpenGym построит курс отдельно для каждого тренера.</div>
    <div className="tp-number-row">
      <NumberField
        value={planner.subscriptionSize || ''}
        decimal={false}
        inputMode="numeric"
        aria-label="Количество занятий"
        onChange={v => setPlanner(p => ({ ...p, subscriptionSize: Math.min(99, Math.max(0, Math.floor(v || 0))) }))}
      />
      <span>занятий</span>
    </div>
  </div>
}

function WorkScheduleEditor({ planner, setPlanner }) {
  const todayMonth = todayISO().slice(0, 7)
  const [month, setMonth] = useState(todayMonth)
  const [raw, setRaw] = useState('')
  const [warnings, setWarnings] = useState([])
  const dates = monthDays(month)
  const entered = dates.filter(d => Object.prototype.hasOwnProperty.call(planner.workShifts, d)).length
  const work = dates.filter(d => planner.workShifts[d]).length

  const importList = () => {
    const parsed = parseShiftList(raw, month)
    setWarnings(parsed.warnings)
    setPlanner(p => ({ ...p, workShifts: { ...p.workShifts, ...parsed.shifts } }))
  }

  return <section className="tp-section">
    <div className="tp-section-head">
      <div>
        <h3>Мой график</h3>
        <p>{entered ? `${entered} дней заполнено · ${work} рабочих` : 'Нужен для расчёта пересечений'}</p>
      </div>
      <input className="tp-month" type="month" value={month} min={todayMonth} onChange={e => setMonth(e.target.value)} />
    </div>

    <div className="card tp-work-card">
      <div className="tp-mini-cal">
        {dates.map(iso => {
          const known = Object.prototype.hasOwnProperty.call(planner.workShifts, iso)
          const shift = planner.workShifts[iso]
          return <div key={iso} className={'tp-mini-day' + (shift ? ' work' : known ? ' off' : '')}>
            <span>{Number(iso.slice(-2))}</span>
            <i>{shift ? shift.start.replace(':00', '') : known ? 'вых' : '—'}</i>
          </div>
        })}
      </div>
      <textarea
        className="field area tp-shift-import"
        value={raw}
        onChange={e => setRaw(e.target.value)}
        placeholder={'08:00–17:00\n08:00–17:00\n-\n15:00–00:00\n…'}
      />
      <div className="tp-hint">Одна строка = один день выбранного месяца. «-» = выходной.</div>
      {warnings.map((w, i) => <div className="tp-warning" key={i}>{w}</div>)}
      <Button variant="tinted" icon="clipboard" onClick={importList}>Загрузить график месяца</Button>
    </div>
  </section>
}

function TrainerEditor({ trainer, index, onChange, onDelete }) {
  const [openDay, setOpenDay] = useState(1)
  const slots = (trainer.slots || []).filter(s => Number(s.day) === openDay).sort((a, b) => a.start.localeCompare(b.start))

  const replaceSlot = (slot, patch) => {
    onChange({
      ...trainer,
      slots: trainer.slots.map(s => s.id === slot.id ? { ...s, ...patch } : s),
    })
  }

  const addSlot = () => {
    const last = slots.at(-1)
    onChange({
      ...trainer,
      slots: [...trainer.slots, {
        id: uid(),
        day: openDay,
        start: last?.end || '17:00',
        end: last ? '21:00' : '20:00',
      }],
    })
  }

  return <div className="card tp-trainer-edit">
    <div className="tp-trainer-top">
      <span className="tp-avatar" style={{ '--trainer': trainer.color }}><Icon name="person" /></span>
      <TextField value={trainer.name} onChange={e => onChange({ ...trainer, name: e.target.value })} placeholder={'Тренер ' + (index + 1)} />
      <button className="iconbtn" onClick={onDelete} aria-label="Удалить тренера"><Icon name="trash" /></button>
    </div>

    <div className="tp-swatches">
      {TRAINER_COLORS.map(color => <button
        key={color}
        className={'tp-swatch' + (trainer.color === color ? ' on' : '')}
        style={{ '--trainer': color }}
        onClick={() => onChange({ ...trainer, color })}
        aria-label={'Цвет ' + color}
      />)}
    </div>

    <div className="tp-week-tabs">
      {DAYS.map(d => {
        const active = trainer.slots.some(s => Number(s.day) === d.day)
        return <button key={d.day} className={(openDay === d.day ? 'on' : '') + (active ? ' active' : '')} onClick={() => setOpenDay(d.day)}>
          {d.label}
        </button>
      })}
    </div>

    <div className="tp-slot-list">
      {slots.map(slot => <div className="tp-slot" key={slot.id}>
        <input type="time" value={slot.start} onChange={e => replaceSlot(slot, { start: e.target.value })} />
        <span>—</span>
        <input type="time" value={slot.end} onChange={e => replaceSlot(slot, { end: e.target.value })} />
        <button onClick={() => onChange({ ...trainer, slots: trainer.slots.filter(s => s.id !== slot.id) })}><Icon name="xmark" /></button>
      </div>)}
      <Button size="sm" variant="tinted" icon="plus" onClick={addSlot}>Добавить время</Button>
    </div>
  </div>
}

function TrainersEditor({ planner, setPlanner }) {
  const addTrainer = () => {
    const i = planner.trainers.length
    const trainer = { id: uid(), name: '', color: TRAINER_COLORS[i % TRAINER_COLORS.length], slots: [] }
    setPlanner(p => ({ ...p, trainers: [...p.trainers, trainer] }))
  }

  return <section className="tp-section">
    <div className="tp-section-head">
      <div><h3>Тренеры</h3><p>Добавь весь пул — OpenGym сравнит каждого</p></div>
      <Button size="sm" variant="tinted" icon="plus" onClick={addTrainer}>Добавить</Button>
    </div>
    <div className="tp-stack">
      {planner.trainers.map((trainer, index) => <TrainerEditor
        key={trainer.id}
        trainer={trainer}
        index={index}
        onChange={next => setPlanner(p => ({ ...p, trainers: p.trainers.map(t => t.id === next.id ? next : t) }))}
        onDelete={() => setPlanner(p => ({ ...p, trainers: p.trainers.filter(t => t.id !== trainer.id) }))}
      />)}
      {!planner.trainers.length && <div className="empty">Добавь хотя бы одного тренера и его недельный график.</div>}
    </div>
  </section>
}

function PlannerCalendar({ planner, trainer, course, month, setMonth, activeSessionId, onSession }) {
  const dates = monthDays(month)
  const first = dates[0] ? new Date(dates[0] + 'T12:00:00').getDay() : 1
  const mondayOffset = (first + 6) % 7
  const cells = [...Array(mondayOffset).fill(null), ...dates]
  const intersection = useMemo(() => intersectionDates(planner, trainer, todayISO(), 180), [planner, trainer])
  const sessionsByDate = useMemo(() => Object.fromEntries(course.sessions.map(s => [s.date, s])), [course.sessions])

  const shiftMonth = n => {
    const d = new Date(month + '-01T12:00:00')
    d.setMonth(d.getMonth() + n)
    setMonth(isoOf(d).slice(0, 7))
  }

  return <div className="tp-calendar card">
    <div className="tp-cal-head">
      <button className="iconbtn" onClick={() => shiftMonth(-1)}><Icon name="chevronLeft" /></button>
      <strong>{monthLabel(month)}</strong>
      <button className="iconbtn" onClick={() => shiftMonth(1)}><Icon name="chevronRight" /></button>
    </div>
    <div className="tp-cal-week">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(x => <span key={x}>{x}</span>)}</div>
    <div className="tp-cal-grid">
      {cells.map((iso, i) => {
        if (!iso) return <span className="tp-cal-empty" key={'e' + i} />
        const session = sessionsByDate[iso]
        const possible = intersection.has(iso)
        const past = iso < todayISO()
        const status = session?.status
        return <button
          key={iso}
          className={'tp-cal-day' + (session ? ' session' : '') + (possible ? ' possible' : '') + (activeSessionId === session?.id ? ' selected' : '') + (past ? ' past' : '') + (status ? ' ' + status : '')}
          style={{ '--trainer': trainer.color }}
          onClick={() => session && onSession?.(session)}
        >
          <span>{Number(iso.slice(-2))}</span>
          {session ? <i>{session.start}</i> : possible ? <b /> : null}
        </button>
      })}
    </div>
    <div className="tp-cal-legend">
      <span><i style={{ '--trainer': trainer.color }} />в плане</span>
      <span><b style={{ '--trainer': trainer.color }} />есть пересечение</span>
    </div>
  </div>
}

function CourseComparison({ planner, setPlanner }) {
  const plans = useMemo(() => trainerCoursePlans(planner, todayISO()), [planner])
  const [selectedId, setSelectedId] = useState(null)
  const selected = plans.find(p => p.trainer.id === selectedId) || plans[0]
  const [month, setMonth] = useState(todayISO().slice(0, 7))

  if (!planner.subscriptionSize) return <div className="empty">Сначала укажи размер абонемента.</div>
  if (!planner.trainers.length) return null
  if (!plans.length) return <div className="empty">Добавь расписание хотя бы одному тренеру.</div>

  return <section className="tp-section">
    <div className="tp-section-head"><div><h3>Лучший курс</h3><p>Все даты считаются от сегодня. Прошлые не участвуют.</p></div></div>

    <div className="tp-trainer-switch">
      {plans.map((plan, i) => <button
        key={plan.trainer.id}
        className={selected?.trainer.id === plan.trainer.id ? 'on' : ''}
        style={{ '--trainer': plan.trainer.color }}
        onClick={() => setSelectedId(plan.trainer.id)}
      >
        <span className="tp-dot" />
        <span><strong>{plan.trainer.name || 'Тренер'}</strong><small>{plan.sessions.length}/{plan.target} занятий</small></span>
        {i === 0 && <em>лучший</em>}
      </button>)}
    </div>

    {selected && <>
      <div className="tp-course-summary card">
        <div>
          <span className="tp-avatar" style={{ '--trainer': selected.trainer.color }}><Icon name="person" /></span>
          <div><strong>{selected.trainer.name || 'Тренер'}</strong><small>{selected.complete ? 'Абонемент помещается в график' : 'Не хватает будущего графика'}</small></div>
        </div>
        <div className="tp-metrics">
          <span><strong>{selected.sessions.length}</strong><small>занятий</small></span>
          <span><strong>{selected.finishDate ? fmtDate(selected.finishDate) : '—'}</strong><small>последнее</small></span>
          <span><strong>{selected.penalty === 0 ? 'ровно' : '+' + selected.penalty}</strong><small>ритм</small></span>
        </div>
      </div>

      <PlannerCalendar planner={planner} trainer={selected.trainer} course={selected} month={month} setMonth={setMonth} />

      <Button
        variant="primary"
        icon="check"
        disabled={!selected.complete}
        onClick={() => setPlanner(confirmTrainerCourse(planner, selected.trainer.id, todayISO()))}
      >
        Выбрать {selected.trainer.name || 'тренера'} для абонемента
      </Button>
    </>}
  </section>
}

function ActiveCourse({ planner, setPlanner }) {
  const trainer = planner.trainers.find(t => t.id === planner.confirmedTrainerId)
  const [view, setView] = useState('calendar')
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const [selectedSession, setSelectedSession] = useState(null)
  if (!trainer) return null

  const attended = planner.sessions.filter(s => s.status === 'attended').length
  const missed = planner.sessions.filter(s => s.status === 'missed').length
  const planned = planner.sessions.filter(s => s.status === 'planned')
  const done = attended >= planner.subscriptionSize
  const course = { trainer, sessions: planner.sessions, target: planner.subscriptionSize }

  const setStatus = (session, status) => {
    const next = markSession(planner, session.id, status, todayISO())
    setPlanner(next)
    setSelectedSession(null)
  }

  return <>
    <div className="tp-progress card">
      <div className="tp-progress-head">
        <span className="tp-avatar" style={{ '--trainer': trainer.color }}><Icon name="person" /></span>
        <div><div className="tp-kicker">{done ? 'Абонемент завершён' : 'Активный абонемент'}</div><div className="tp-title">{trainer.name || 'Тренер'}</div></div>
        <strong>{attended}/{planner.subscriptionSize}</strong>
      </div>
      <div className="tp-progress-track"><i style={{ width: Math.min(100, attended / Math.max(1, planner.subscriptionSize) * 100) + '%', '--trainer': trainer.color }} /></div>
      <div className="tp-progress-meta">{planned.length} впереди · {missed} пропущено · засчитываются только посещённые</div>
    </div>

    <Segmented
      className="tp-view-seg"
      value={view}
      onChange={setView}
      options={[
        { value: 'calendar', label: 'Календарь', icon: 'calendar' },
        { value: 'days', label: 'По дням', icon: 'list' },
      ]}
    />

    {view === 'calendar'
      ? <PlannerCalendar planner={planner} trainer={trainer} course={course} month={month} setMonth={setMonth} activeSessionId={selectedSession?.id} onSession={setSelectedSession} />
      : <div className="tp-session-list">
        {planner.sessions.sort((a,b) => a.date.localeCompare(b.date)).map((s, i) => <div className={'card tp-session ' + s.status} key={s.id}>
          <div className="tp-session-num">{s.status === 'attended' ? <Icon name="check" /> : s.status === 'missed' ? <Icon name="xmark" /> : i + 1}</div>
          <div className="grow"><strong>{fmtDate(s.date, true)}</strong><small>{s.start}–{s.end}</small></div>
          <span className={'tag ' + (s.status === 'attended' ? 'acc' : '')}>{s.status === 'attended' ? 'Был' : s.status === 'missed' ? 'Пропустил' : 'Запланировано'}</span>
          {s.status === 'planned' && s.date <= todayISO() && <button className="iconbtn" onClick={() => setSelectedSession(s)}><Icon name="chevronRight" /></button>}
        </div>)}
      </div>}

    {selectedSession && <div className="tp-action card">
      <div><strong>{fmtDate(selectedSession.date, true)} · {selectedSession.start}</strong><small>Отметь результат. Пропуск не уменьшает остаток абонемента.</small></div>
      <div className="grid2">
        <Button variant="primary" icon="check" onClick={() => setStatus(selectedSession, 'attended')}>Ходил</Button>
        <Button variant="danger" icon="xmark" onClick={() => setStatus(selectedSession, 'missed')}>Не ходил</Button>
      </div>
    </div>}
  </>
}

export default function TrainerPlanner() {
  const [planner, setPlanner] = usePlanner()

  if (planner.confirmedTrainerId) {
    return <div className="tp-root"><ActiveCourse planner={planner} setPlanner={setPlanner} /></div>
  }

  return <div className="tp-root">
    <SubscriptionSetup planner={planner} setPlanner={setPlanner} />
    <WorkScheduleEditor planner={planner} setPlanner={setPlanner} />
    <TrainersEditor planner={planner} setPlanner={setPlanner} />
    <CourseComparison planner={planner} setPlanner={setPlanner} />
  </div>
}
