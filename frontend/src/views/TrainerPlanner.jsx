import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { Button, Row, Section, Segmented, Stepper, TextField } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { effectiveRoutineId } from '../lib/history.js'
import { fmtDate, isoOf, todayISO, uid } from '../lib/format.js'
import {
  TRAINER_COLORS,
  confirmTrainerCourse,
  intersectionDates,
  markSession,
  normalizePlanner,
  trainerCoursePlans,
} from '../lib/trainer-planner.js'
import {
  monthDays,
  normalizeProfileSchedule,
  scheduleCoverage,
} from '../lib/work-schedule.js'
import { trainerSessionStartSheet } from '../sheets.jsx'

const DAYS = [
  { day: 1, label: 'Пн' }, { day: 2, label: 'Вт' }, { day: 3, label: 'Ср' },
  { day: 4, label: 'Чт' }, { day: 5, label: 'Пт' }, { day: 6, label: 'Сб' },
  { day: 0, label: 'Вс' },
]

const monthLabel = month =>
  new Date(month + '-01T12:00:00').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

const pluralSessions = n => {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return 'занятие'
  if (m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14)) return 'занятия'
  return 'занятий'
}

function addDays(iso, days) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return isoOf(d)
}

function usePlanningData() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const planner = normalizePlanner(S.trainerPlanner)
  const profileSchedule = normalizeProfileSchedule(S.profileSchedule)

  const blockedSoloDates = useMemo(() => {
    const set = new Set()
    const from = todayISO()
    for (let i = 0; i < 180; i++) {
      const iso = addDays(from, i)
      if (effectiveRoutineId(S, iso)) set.add(iso)
    }
    return set
  }, [S.week, S.dayPlan, S.routines])

  const setPlanner = next => update(s => {
    const current = normalizePlanner(s.trainerPlanner)
    s.trainerPlanner = typeof next === 'function' ? next(current) : next
  })

  return { S, planner, profileSchedule, blockedSoloDates, setPlanner }
}

function CourseCalendar({ planner, profileSchedule, trainer, sessions, blockedSoloDates, showIntersections = true }) {
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const dates = monthDays(month)
  const first = dates[0] ? new Date(dates[0] + 'T12:00:00').getDay() : 1
  const offset = (first + 6) % 7
  const cells = [...Array(offset).fill(null), ...dates]
  const byDate = useMemo(() => Object.fromEntries((sessions || []).map(s => [s.date, s])), [sessions])
  const possible = useMemo(
    () => showIntersections ? intersectionDates(planner, profileSchedule, trainer, todayISO(), 180) : new Set(),
    [planner, profileSchedule, trainer, showIntersections],
  )

  const shiftMonth = delta => {
    const d = new Date(month + '-01T12:00:00')
    d.setMonth(d.getMonth() + delta)
    setMonth(isoOf(d).slice(0, 7))
  }

  return <div className="card">
    <div className="row between" style={{ marginBottom: 4 }}>
      <button className="iconbtn" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц"><Icon name="chevronLeft" /></button>
      <b className="capitalize">{monthLabel(month)}</b>
      <button className="iconbtn" onClick={() => shiftMonth(1)} aria-label="Следующий месяц"><Icon name="chevronRight" /></button>
    </div>

    <div className="cal-grid">
      {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(x => <div className="cal-h" key={x}>{x}</div>)}
      {cells.map((iso, i) => {
        if (!iso) return <div key={'e' + i} />

        const session = byDate[iso]
        const solo = blockedSoloDates.has(iso)
        const can = possible.has(iso)
        const attended = session?.status === 'attended'
        const missed = session?.status === 'missed'
        const planned = session?.status === 'planned'
        const color = trainer.color || 'var(--purple)'

        let style
        if (attended) style = { background: 'color-mix(in srgb,var(--green) 16%,var(--surface))', color: 'var(--green)' }
        else if (missed) style = { background: 'color-mix(in srgb,var(--red) 14%,var(--surface))', color: 'var(--red)' }
        else if (planned) style = { background: `color-mix(in srgb,${color} 16%,var(--surface))`, color }

        return <div
          key={iso}
          className={'cal-d' + (iso === todayISO() ? ' today' : '')}
          style={style}
          title={session ? session.start + '–' + session.end : can ? 'Есть пересечение' : solo ? 'Соло-тренировка' : ''}
        >
          <span>{Number(iso.slice(-2))}</span>
          {session
            ? <i style={{ background: attended ? 'var(--green)' : missed ? 'var(--red)' : color }} />
            : can
              ? <i style={{ background: color }} />
              : solo
                ? <i className="plan" />
                : <i />}
        </div>
      })}
    </div>

    <div className="cal-legend">
      <span><i style={{ background: trainer.color || 'var(--purple)' }} />С тренером</span>
      <span><i style={{ background: 'var(--label-3)' }} />Соло</span>
      <span><i style={{ background: 'var(--green)' }} />Посещено</span>
    </div>
  </div>
}

function PlanningTab({ planner, profileSchedule, blockedSoloDates, setPlanner, onOpenTrainers }) {
  const nav = useNavigate()
  const plans = useMemo(
    () => trainerCoursePlans(planner, profileSchedule, todayISO(), blockedSoloDates),
    [planner, profileSchedule, blockedSoloDates],
  )
  const [selectedId, setSelectedId] = useState(null)
  const selected = plans.find(x => x.trainer.id === selectedId) || plans[0]
  const coverage = scheduleCoverage(profileSchedule, todayISO(), 120)

  if (planner.confirmedTrainerId) {
    return <ActiveCourse
      planner={planner}
      profileSchedule={profileSchedule}
      blockedSoloDates={blockedSoloDates}
      setPlanner={setPlanner}
    />
  }

  return <>
    <Section title="Абонемент" footer="План строится только от сегодняшнего дня вперёд.">
      <div className="lrow">
        <span className="lrow-i" style={{ '--tint': 'var(--acc)' }}><Icon name="clipboard" /></span>
        <span className="lrow-m">
          <span className="lrow-t">Количество занятий</span>
          <span className="lrow-s">Сколько тренировок нужно посетить у одного тренера</span>
        </span>
        <Stepper
          value={planner.subscriptionSize || 0}
          decimal={false}
          onChange={v => setPlanner(p => ({ ...p, subscriptionSize: Math.min(99, Math.max(0, Math.round(v || 0))) }))}
        />
      </div>
    </Section>

    <Section title="Для расчёта">
      <Row
        icon="calendar"
        iconTint="var(--blue)"
        title="Мой график"
        subtitle={coverage.known ? `Известно ${coverage.known} будущих дней` : 'Рабочие смены ещё не заполнены'}
        value={coverage.known ? 'Готов' : 'Нужно заполнить'}
        accessory="chevron"
        onClick={() => nav('/settings/schedule')}
      />
      <Row
        icon="person"
        iconTint="var(--purple)"
        title="Тренеры"
        subtitle="Расписание каждого тренера считается отдельно"
        value={planner.trainers.length}
        accessory="chevron"
        onClick={onOpenTrainers}
      />
    </Section>

    {!planner.subscriptionSize ? (
      <div className="empty">
        <div className="ico"><Icon name="clipboard" /></div>
        Укажи размер абонемента — после этого появятся варианты расписания.
      </div>
    ) : !coverage.known ? (
      <div className="empty">
        <div className="ico"><Icon name="calendar" /></div>
        Сначала заполни личный график в профиле.
        <div style={{ height: 12 }} />
        <Button variant="primary" onClick={() => nav('/settings/schedule')}>Открыть мой график</Button>
      </div>
    ) : !planner.trainers.length ? (
      <div className="empty">
        <div className="ico"><Icon name="person" /></div>
        Добавь тренеров и их недельное расписание.
        <div style={{ height: 12 }} />
        <Button variant="primary" onClick={onOpenTrainers}>Добавить тренера</Button>
      </div>
    ) : !plans.length ? (
      <div className="empty">Ни у одного тренера пока нет расписания.</div>
    ) : <>
      <h4 className="sec">Сравнение</h4>
      <div className="chips" style={{ marginBottom: 10, overflowX: 'auto', flexWrap: 'nowrap' }}>
        {plans.map((plan, index) => <button
          key={plan.trainer.id}
          className={'chip nocap' + (selected?.trainer.id === plan.trainer.id ? ' on' : '')}
          onClick={() => setSelectedId(plan.trainer.id)}
          style={{ flex: '0 0 auto' }}
        >
          <span style={{ color: plan.trainer.color || 'var(--purple)' }}>●</span>
          {plan.trainer.name || 'Тренер'} · {plan.sessions.length}/{plan.target}
          {index === 0 ? ' · рекомендуем' : ''}
        </button>)}
      </div>

      {selected && <>
        <div className="card">
          <div className="row between">
            <div>
              <div className="row" style={{ gap: 7 }}>
                <span style={{ color: selected.trainer.color || 'var(--purple)' }}>●</span>
                <div className="big" style={{ fontSize: 22 }}>{selected.trainer.name || 'Тренер'}</div>
              </div>
              <div className="muted small" style={{ marginTop: 3 }}>
                {selected.complete
                  ? `Все ${selected.target} ${pluralSessions(selected.target)} помещаются в график`
                  : `Найдено ${selected.sessions.length} из ${selected.target}`}
              </div>
            </div>
            {selected === plans[0] && <span className="tag acc">Рекомендуем</span>}
          </div>

          <div className="tiles" style={{ marginTop: 14, marginBottom: 0 }}>
            <div className="tile">
              <div className="l">Занятий</div>
              <div className="v">{selected.sessions.length}/{selected.target}</div>
            </div>
            <div className="tile">
              <div className="l">Последнее</div>
              <div className="v" style={{ fontSize: 18 }}>{selected.finishDate ? fmtDate(selected.finishDate) : '—'}</div>
            </div>
          </div>

          {!selected.complete && coverage.known < 90 && <div className="small" style={{ color: 'var(--orange)', marginTop: 12 }}>
            Возможно, не хватает будущего рабочего графика. Добавь следующие месяцы в профиле.
          </div>}
        </div>

        <CourseCalendar
          planner={planner}
          profileSchedule={profileSchedule}
          trainer={selected.trainer}
          sessions={selected.sessions}
          blockedSoloDates={blockedSoloDates}
        />

        <Button
          variant="primary"
          icon="check"
          disabled={!selected.complete}
          onClick={() => setPlanner(confirmTrainerCourse(
            planner,
            profileSchedule,
            selected.trainer.id,
            todayISO(),
            blockedSoloDates,
          ))}
        >
          Выбрать {selected.trainer.name || 'тренера'}
        </Button>
      </>}
    </>}
  </>
}

function TrainerEditor({ planner, trainer, setPlanner }) {
  const [day, setDay] = useState(1)
  const slots = (trainer.slots || []).filter(x => Number(x.day) === day).sort((a, b) => a.start.localeCompare(b.start))

  const changeTrainer = next => setPlanner(p => ({
    ...p,
    trainers: p.trainers.map(t => t.id === next.id ? next : t),
  }))

  const replaceSlot = (slot, patch) =>
    changeTrainer({
      ...trainer,
      slots: trainer.slots.map(s => s.id === slot.id ? { ...s, ...patch } : s),
    })

  const addSlot = () => {
    const last = slots.at(-1)
    changeTrainer({
      ...trainer,
      slots: [...trainer.slots, {
        id: uid(),
        day,
        start: last?.end || '17:00',
        end: '20:00',
      }],
    })
  }

  return <>
    <Section title="Тренер">
      <div className="lrow">
        <span className="lrow-i" style={{ '--tint': trainer.color || 'var(--purple)' }}><Icon name="person" /></span>
        <span className="lrow-m"><span className="lrow-t">Имя</span></span>
        <TextField
          value={trainer.name}
          onChange={e => changeTrainer({ ...trainer, name: e.target.value })}
          placeholder="Имя тренера"
          style={{ width: 150 }}
        />
      </div>
      <div className="lrow" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <span className="lrow-t">Цвет в расписании</span>
        <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
          {TRAINER_COLORS.map(color => <button
            key={color}
            onClick={() => changeTrainer({ ...trainer, color })}
            aria-label={'Выбрать цвет ' + color}
            style={{ width: 48, height: 48, display: 'grid', placeItems: 'center' }}
          >
            <span className={'swatch' + ((trainer.color || TRAINER_COLORS[0]) === color ? ' on' : '')} style={{ background: color }} />
          </button>)}
        </div>
      </div>
    </Section>

    <h4 className="sec">Расписание</h4>
    <div className="chips" style={{ marginBottom: 10 }}>
      {DAYS.map(d => <button
        key={d.day}
        className={'chip' + (day === d.day ? ' on' : '')}
        onClick={() => setDay(d.day)}
      >
        {d.label}
        {trainer.slots.some(s => Number(s.day) === d.day) ? ' •' : ''}
      </button>)}
    </div>

    <div className="sect-b">
      {slots.map(slot => <div className="lrow" key={slot.id}>
        <span className="lrow-i" style={{ '--tint': trainer.color || 'var(--purple)' }}><Icon name="clock" /></span>
        <span className="lrow-m">
          <span className="lrow-t">Интервал</span>
        </span>
        <div className="row" style={{ gap: 6 }}>
          <TextField type="time" value={slot.start} onChange={e => replaceSlot(slot, { start: e.target.value })} style={{ width: 92 }} />
          <span className="muted">—</span>
          <TextField type="time" value={slot.end} onChange={e => replaceSlot(slot, { end: e.target.value })} style={{ width: 92 }} />
          <button
            className="iconbtn"
            onClick={() => changeTrainer({ ...trainer, slots: trainer.slots.filter(s => s.id !== slot.id) })}
            aria-label="Удалить интервал"
            style={{ color: 'var(--red)' }}
          ><Icon name="trash" /></button>
        </div>
      </div>)}
      {!slots.length && <div className="empty" style={{ padding: 24 }}>В этот день тренер не работает.</div>}
    </div>

    <div style={{ height: 10 }} />
    <Button variant="tinted" icon="plus" onClick={addSlot}>Добавить время</Button>

    {planner.confirmedTrainerId !== trainer.id && <>
      <div style={{ height: 8 }} />
      <Button
        variant="ghost"
        style={{ color: 'var(--red)' }}
        onClick={() => setPlanner(p => ({
          ...p,
          trainers: p.trainers.filter(t => t.id !== trainer.id),
        }))}
      >
        Удалить тренера
      </Button>
    </>}
  </>
}

function TrainersTab({ planner, setPlanner }) {
  const [selectedId, setSelectedId] = useState(planner.trainers[0]?.id || null)
  const selected = planner.trainers.find(t => t.id === selectedId) || planner.trainers[0] || null

  const addTrainer = () => {
    const trainer = {
      id: uid(),
      name: '',
      color: TRAINER_COLORS[planner.trainers.length % TRAINER_COLORS.length],
      slots: [],
    }
    setSelectedId(trainer.id)
    setPlanner(p => ({ ...p, trainers: [...p.trainers, trainer] }))
  }

  return <>
    <div className="row between" style={{ marginBottom: 10 }}>
      <div>
        <div className="big" style={{ fontSize: 22 }}>Тренеры</div>
        <div className="muted small">Универсальные тренеры и их рабочее время</div>
      </div>
      <Button size="sm" variant="tinted" icon="plus" onClick={addTrainer}>Добавить</Button>
    </div>

    {!!planner.trainers.length && <div className="chips" style={{ marginBottom: 12, overflowX: 'auto', flexWrap: 'nowrap' }}>
      {planner.trainers.map(trainer => <button
        key={trainer.id}
        className={'chip nocap' + (selected?.id === trainer.id ? ' on' : '')}
        onClick={() => setSelectedId(trainer.id)}
        style={{ flex: '0 0 auto' }}
      >
        <span style={{ color: trainer.color || 'var(--purple)' }}>●</span>
        {trainer.name || 'Без имени'}
      </button>)}
    </div>}

    {selected
      ? <TrainerEditor planner={planner} trainer={selected} setPlanner={setPlanner} />
      : <div className="empty">
          <div className="ico"><Icon name="person" /></div>
          Добавь первого тренера.
          <div style={{ height: 12 }} />
          <Button variant="primary" icon="plus" onClick={addTrainer}>Добавить тренера</Button>
        </div>}
  </>
}

function ActiveCourse({ planner, profileSchedule, blockedSoloDates, setPlanner }) {
  const trainer = planner.trainers.find(t => t.id === planner.confirmedTrainerId)
  const [view, setView] = useState('calendar')
  if (!trainer) return <div className="empty">Выбранный тренер больше не найден.</div>

  const attended = planner.sessions.filter(s => s.status === 'attended').length
  const missed = planner.sessions.filter(s => s.status === 'missed').length
  const remaining = Math.max(0, planner.subscriptionSize - attended)
  const todaySession = planner.sessions.find(s => s.date === todayISO() && s.status === 'planned')

  const setStatus = (session, status) => setPlanner(markSession(
    planner,
    profileSchedule,
    session.id,
    status,
    todayISO(),
    blockedSoloDates,
  ))

  return <>
    <div className="card">
      <div className="row between">
        <div className="row" style={{ gap: 10 }}>
          <span className="lrow-i" style={{ '--tint': trainer.color || 'var(--purple)' }}><Icon name="person" /></span>
          <div>
            <div className="muted small">{remaining ? 'Активный абонемент' : 'Абонемент завершён'}</div>
            <div className="big" style={{ fontSize: 22 }}>{trainer.name || 'Тренер'}</div>
          </div>
        </div>
        <div className="stat-v">{attended}/{planner.subscriptionSize}</div>
      </div>

      <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden', marginTop: 14 }}>
        <div style={{
          height: '100%',
          width: Math.min(100, attended / Math.max(1, planner.subscriptionSize) * 100) + '%',
          background: trainer.color || 'var(--purple)',
          borderRadius: 99,
        }} />
      </div>

      <div className="muted small" style={{ marginTop: 8 }}>
        {remaining} осталось · {missed} пропущено
      </div>

      {todaySession && <>
        <div style={{ height: 12 }} />
        <Button
          variant="primary"
          icon="play"
          onClick={() => trainerSessionStartSheet(todaySession.id)}
        >
          Начать сегодняшнюю тренировку · {todaySession.start}
        </Button>
      </>}
    </div>

    <Segmented
      value={view}
      onChange={setView}
      options={[
        { value: 'calendar', label: 'Календарь', icon: 'calendar' },
        { value: 'days', label: 'По дням', icon: 'list' },
      ]}
    />

    {view === 'calendar'
      ? <CourseCalendar
          planner={planner}
          profileSchedule={profileSchedule}
          trainer={trainer}
          sessions={planner.sessions}
          blockedSoloDates={blockedSoloDates}
          showIntersections={false}
        />
      : <div className="list">
          {[...planner.sessions]
            .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
            .map(session => {
              const canMark = session.status === 'planned' && session.date <= todayISO()
              const subtitle = session.start + '–' + session.end + ' · ' +
                (session.status === 'attended' ? 'посещено' : session.status === 'missed' ? 'пропущено' : 'запланировано')

              return <div className="item" key={session.id}>
                <span
                  className="lrow-i"
                  style={{ '--tint': session.status === 'attended'
                    ? 'var(--green)'
                    : session.status === 'missed'
                      ? 'var(--red)'
                      : trainer.color || 'var(--purple)' }}
                >
                  <Icon name={session.status === 'attended' ? 'check' : session.status === 'missed' ? 'xmark' : 'calendar'} />
                </span>
                <div className="grow">
                  <div className="tt">{fmtDate(session.date, true)}</div>
                  <div className="ss">{subtitle}</div>
                </div>
                {session.status === 'planned' && session.date === todayISO() && (
                  <Button size="sm" variant="tinted" onClick={() => trainerSessionStartSheet(session.id)}>Начать</Button>
                )}
                {canMark && session.date < todayISO() && <div className="row" style={{ gap: 4 }}>
                  <button className="iconbtn" onClick={() => setStatus(session, 'attended')} aria-label="Ходил" style={{ color: 'var(--green)' }}><Icon name="check" /></button>
                  <button className="iconbtn" onClick={() => setStatus(session, 'missed')} aria-label="Не ходил" style={{ color: 'var(--red)' }}><Icon name="xmark" /></button>
                </div>}
              </div>
            })}
        </div>}
  </>
}

export default function TrainerPlanner() {
  const nav = useNavigate()
  const { planner, profileSchedule, blockedSoloDates, setPlanner } = usePlanningData()
  const [tab, setTab] = useState('planning')

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/plan')} aria-label="Назад"><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 10 }}>
        <h1>С тренером</h1>
        <div className="sub">Абонемент и расписание в общем плане OpenGym</div>
      </div>
    </div>

    <Segmented
      value={tab}
      onChange={setTab}
      options={[
        { value: 'planning', label: 'Планирование', icon: 'calendar' },
        { value: 'trainers', label: 'Тренеры', icon: 'person' },
      ]}
    />

    <div style={{ height: 16 }} />

    {tab === 'planning'
      ? <PlanningTab
          planner={planner}
          profileSchedule={profileSchedule}
          blockedSoloDates={blockedSoloDates}
          setPlanner={setPlanner}
          onOpenTrainers={() => setTab('trainers')}
        />
      : <TrainersTab planner={planner} setPlanner={setPlanner} />}
  </div>
}
