// Russian exercise catalogue overlay.
//
// The upstream exercise IDs stay untouched. Russian names and aliases are derived at runtime,
// so workouts, imports and media keep resolving against the original 1,324-entry dataset.
// Common gym movements get hand-curated Russian wording and slang; the long tail falls back to
// deterministic Russian movement/equipment/target rules. ruAliasesFor() always returns exactly
// five unique system aliases for every built-in exercise.

const C = (name, aliases) => ({ name, aliases })

const CURATED = {
  '0025': C('Жим штанги лёжа', ['Жим лёжа', 'Жим лежа', 'Жим штанги на грудь', 'Классический жим', 'Бенч']),
  '0032': C('Становая тяга со штангой', ['Становая', 'Классическая становая', 'Классическая тяга', 'Тяга с пола', 'Дедлифт']),
  '0043': C('Приседания со штангой', ['Присед', 'Присед со штангой', 'Классический присед', 'Штанга присед', 'Сквот']),
  '0027': C('Тяга штанги в наклоне', ['Тяга в наклоне', 'Штанга к поясу', 'Тяга штанги к животу', 'Тяга на спину', 'Наклонная тяга']),
  '0085': C('Румынская тяга со штангой', ['Румынка', 'Румынская', 'Румынская становая', 'Тяга на прямых ногах', 'РДЛ']),
  '0120': C('Тяга штанги к подбородку', ['Протяжка', 'Протяжка со штангой', 'Тяга к подбородку', 'Тяга на дельты', 'Штанга к подбородку']),
  '0241': C('Разгибание рук на верхнем блоке', ['Трицепс на блоке', 'Разгибания на блоке', 'Верхний блок на трицепс', 'Трицепс с рукояткой', 'Разгиб рук вниз']),
  '0294': C('Сгибание рук с гантелями', ['Гантели на бицепс', 'Бицепс с гантелями', 'Подъём гантелей на бицепс', 'Сгибания на бицепс', 'Бицуха с гантелями']),
  '0313': C('Молотковые сгибания с гантелями', ['Молотки', 'Молоток', 'Бицепс молотком', 'Гантели молотком', 'Молотковые сгибания']),
  '0334': C('Махи гантелями в стороны', ['Махи в стороны', 'Махи на среднюю дельту', 'Разводка в стороны', 'Подъёмы гантелей в стороны', 'Средняя дельта']),
  '0489': C('Гиперэкстензия', ['Гиперы', 'Гипер', 'Разгибания спины', 'Гипер на поясницу', 'Поясница']),
  '0577': C('Жим от груди в рычажном тренажёре', ['Жим в хаммере', 'Хаммер на грудь', 'Рычажный жим', 'Жим от груди в тренажёре', 'Грудной хаммер']),
  '0585': C('Разгибание ног в тренажёре', ['Разгибания ног', 'Квадрицепс в тренажёре', 'Разгибание ног сидя', 'Тренажёр на квадрицепс', 'Разгиб ног']),
  '0586': C('Сгибание ног лёжа в тренажёре', ['Сгибания ног лёжа', 'Бицепс бедра лёжа', 'Сгиб ног лёжа', 'Задняя поверхность бедра', 'Тренажёр на бицепс бедра']),
  '0599': C('Сгибание ног сидя в тренажёре', ['Сгибания ног сидя', 'Бицепс бедра сидя', 'Сгиб ног сидя', 'Задняя поверхность бедра сидя', 'Тренажёр на бицепс бедра']),
  '0596': C('Сведение рук в тренажёре', ['Бабочка', 'Баттерфляй', 'Сведение на грудь', 'Разводка в тренажёре', 'Пек-дек']),
  '0662': C('Отжимания от пола', ['Отжимания', 'Отжимания от пола', 'Отжимоны', 'Грудь от пола', 'Классические отжимания']),
  '0687': C('Русские скручивания', ['Русский твист', 'Повороты корпуса сидя', 'Скручивания с поворотом', 'Твисты на пресс', 'Русские повороты']),
  '0739': C('Жим ногами 45°', ['Жим ногами', 'Платформа', 'Ноги в платформе', 'Жим платформы', 'Жим в тренажёре ногами']),
  '0766': C('Жим над головой в машине Смита', ['Жим в Смите', 'Смит на плечи', 'Жим Смита вверх', 'Плечи в Смите', 'Жим в тренажёре Смита']),
  '0770': C('Приседания в машине Смита', ['Присед в Смите', 'Смит присед', 'Приседания в Смите', 'Присед в тренажёре Смита', 'Смит на ноги']),
  '0818': C('Тяга верхнего блока параллельным хватом', ['Верхний блок', 'Вертикальный блок', 'Тяга сверху', 'Вертикальная тяга', 'Блок к груди']),
  '0861': C('Тяга горизонтального блока', ['Горизонтальная тяга', 'Нижний блок', 'Тяга нижнего блока', 'Гребля', 'Блок к животу']),
  '1326': C('Подтягивания обратным хватом', ['Подтягивания на бицепс', 'Подтягивания снизу', 'Обратный хват', 'Подтяги обратным хватом', 'Чин-ап']),
  '1429': C('Подтягивания широким хватом', ['Широкие подтягивания', 'Подтяги широким', 'Подтягивания на широчайшие', 'Широкий хват', 'Подтягивания к груди широким']),
  '0195': C('Сгибание рук на скамье Скотта в кроссовере', ['Скамья Скотта', 'Бицепс на Скотте', 'Скотт на блоке', 'Сгибания на Скотте', 'Бицепс в Скотте']),
  '0070': C('Сгибание рук со штангой на скамье Скотта', ['Скамья Скотта', 'Бицепс на Скотте', 'Штанга на Скотте', 'Сгибания на Скотте', 'Скотт']),
  '0308': C('Разводка гантелей лёжа', ['Разводка гантелей', 'Разводка на грудь', 'Разведения лёжа', 'Гантели в стороны лёжа', 'Разводка']),
  '0572': C('Подтягивания в гравитроне', ['Гравитрон', 'Подтягивания с противовесом', 'Подтяги в гравитроне', 'Подтягивания с помощью', 'Ассистированные подтягивания']),
  '0630': C('Альпинист', ['Скалолаз', 'Маунтин клаймбер', 'Бег в планке', 'Колени к груди в планке', 'Альпинист в планке']),
  '1160': C('Берпи', ['Бёрпи', 'Бурпи', 'Упал-отжался-прыгнул', 'Берпи с отжиманием', 'Бёрпи с прыжком']),
  '0857': C('Ролик для пресса', ['Ролик', 'Колесо для пресса', 'Выкаты с роликом', 'Выкаты на пресс', 'Аб-роллер']),
  '1349': C('Тяга Т-грифа в тренажёре', ['Тяга Т-грифа', 'Т-гриф', 'Тяга Т-штанги', 'Тяга в Т-тренажёре', 'Тяга на спину Т-гриф'])
}

const TARGET_RU = {
  abs: 'пресс', adductors: 'приводящие', biceps: 'бицепс', calves: 'икры',
  'cardiovascular system': 'кардио', delts: 'плечи', forearms: 'предплечья',
  glutes: 'ягодицы', hamstrings: 'бицепс бедра', 'hip flexors': 'сгибатели бедра',
  lats: 'широчайшие', 'lower back': 'поясница', obliques: 'косые мышцы',
  pectorals: 'грудь', quads: 'квадрицепс', spine: 'поясница', traps: 'трапеции',
  triceps: 'трицепс', 'upper back': 'спина'
}

const EQUIPMENT_RU = {
  barbell: 'со штангой', dumbbell: 'с гантелями', kettlebell: 'с гирей',
  cable: 'на блоке', band: 'с резинкой', 'resistance band': 'с резинкой',
  'smith machine': 'в машине Смита', 'leverage machine': 'в тренажёре',
  assisted: 'с помощью', 'medicine ball': 'с медболом',
  'stability ball': 'на фитболе', weighted: 'с отягощением',
  'trap bar': 'с трэп-грифом', 'sled machine': 'в тренажёре'
}

const EQUIPMENT_SHORT = {
  barbell: 'штанга', dumbbell: 'гантели', kettlebell: 'гиря', cable: 'блок',
  band: 'резинка', 'resistance band': 'резинка', 'smith machine': 'Смит',
  'leverage machine': 'тренажёр', 'sled machine': 'тренажёр', assisted: 'тренажёр',
  'medicine ball': 'медбол', 'stability ball': 'фитбол', weighted: 'вес',
  'trap bar': 'трэп-гриф', 'body weight': 'свой вес'
}

const norm = value => String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/в°/g, '°').replace(/\s+/g, ' ').trim()
const targetOf = ex => TARGET_RU[ex && ex.tg] || 'мышцы'
const eqPhrase = ex => EQUIPMENT_RU[ex && ex.eq] || ''
const eqShort = ex => EQUIPMENT_SHORT[ex && ex.eq] || ''

function withEq(base, ex) {
  const eq = eqPhrase(ex)
  return eq ? (base + ' ' + eq) : base
}

function qualifier(name) {
  const q = []
  if (/one arm|one hand|single arm/.test(name)) q.push('одной рукой')
  if (/one leg|single leg/.test(name)) q.push('на одной ноге')
  if (/alternat/.test(name)) q.push('попеременно')
  if (/close[- ]grip|narrow/.test(name)) q.push('узким хватом')
  if (/wide[- ]grip|wide grip/.test(name)) q.push('широким хватом')
  if (/reverse grip|underhand|supinated/.test(name)) q.push('обратным хватом')
  if (/seated/.test(name)) q.push('сидя')
  if (/standing/.test(name)) q.push('стоя')
  if (/kneeling/.test(name)) q.push('с колен')
  if (/lying/.test(name)) q.push('лёжа')
  if (/incline/.test(name)) q.push('на наклонной скамье')
  if (/decline/.test(name)) q.push('на отрицательном наклоне')
  return q
}

export function ruNameFor(ex) {
  if (!ex) return ''
  if (ex.custom) return ex.n || ''
  const curated = CURATED[ex.id]
  if (curated) return curated.name

  const n = norm(ex.n)
  const q = qualifier(n)
  const qText = q.length ? ' (' + q.join(', ') + ')' : ''

  if (/stretch/.test(n)) return 'Растяжка: ' + targetOf(ex) + qText
  if (/jump rope/.test(n)) return 'Прыжки со скакалкой'
  if (/burpee/.test(n)) return 'Берпи' + qText
  if (/mountain climber/.test(n)) return 'Альпинист'
  if (/jumping jack|star jump/.test(n)) return 'Прыжки с разведением рук и ног'
  if (/treadmill/.test(n)) return /walk/.test(n) ? 'Ходьба на беговой дорожке' : 'Бег на беговой дорожке'
  if (/elliptical/.test(n)) return 'Эллиптический тренажёр'
  if (/stationary bike|exercise bike/.test(n)) return 'Велотренажёр'
  if (/skierg|ski erg/.test(n)) return 'Лыжный тренажёр'
  if (/stepmill|stepper/.test(n)) return 'Степпер'

  if (/pull[- ]?up|chin[- ]?up/.test(n)) {
    let base = 'Подтягивания'
    if (/assisted/.test(n)) base += ' с помощью'
    if (/wide/.test(n)) base += ' широким хватом'
    else if (/close|narrow/.test(n)) base += ' узким хватом'
    else if (/reverse|chin/.test(n)) base += ' обратным хватом'
    return base + qText
  }
  if (/pulldown/.test(n)) {
    let base = 'Тяга верхнего блока'
    if (/close|narrow/.test(n)) base += ' узким хватом'
    else if (/wide/.test(n)) base += ' широким хватом'
    return base
  }
  if (/push[- ]?up/.test(n)) {
    let base = 'Отжимания'
    if (/diamond|close/.test(n)) base += ' узким хватом'
    else if (/wide/.test(n)) base += ' широким хватом'
    else if (/kneeling/.test(n)) base += ' с колен'
    else if (/wall/.test(n)) base += ' от стены'
    return withEq(base, ex)
  }

  if (/bench press/.test(n)) {
    let base = 'Жим лёжа'
    if (/incline/.test(n)) base = 'Жим на наклонной скамье'
    else if (/decline/.test(n)) base = 'Жим на скамье с отрицательным наклоном'
    if (/close/.test(n)) base += ' узким хватом'
    else if (/wide/.test(n)) base += ' широким хватом'
    return withEq(base, ex)
  }
  if (/chest press/.test(n)) return withEq('Жим от груди', ex)
  if (/shoulder press|overhead press|military press/.test(n)) return withEq(/military/.test(n) ? 'Армейский жим' : 'Жим над головой', ex) + qText
  if (/push press/.test(n)) return withEq('Швунг жимовой', ex)
  if (/pallof|palof/.test(n)) return 'Жим Паллофа'
  if (/press/.test(n) && !/leg press/.test(n)) return withEq('Жим', ex) + qText

  if (/deadlift/.test(n)) {
    let base = 'Становая тяга'
    if (/romanian/.test(n)) base = 'Румынская тяга'
    else if (/stiff|straight leg/.test(n)) base = 'Тяга на прямых ногах'
    else if (/sumo/.test(n)) base = 'Становая тяга сумо'
    return withEq(base, ex)
  }
  if (/good morning/.test(n)) return withEq('Наклоны «доброе утро»', ex)
  if (/squat/.test(n)) {
    let base = 'Приседания'
    if (/split/.test(n)) base = 'Сплит-присед'
    else if (/front/.test(n)) base = 'Фронтальные приседания'
    else if (/hack/.test(n)) base = 'Гакк-присед'
    else if (/jump/.test(n)) base = 'Выпрыгивания из приседа'
    else if (/sumo/.test(n)) base = 'Приседания сумо'
    else if (/single leg|one leg/.test(n)) base = 'Приседания на одной ноге'
    return withEq(base, ex) + qText
  }
  if (/lunge/.test(n)) {
    let base = 'Выпады'
    if (/walking/.test(n)) base = 'Выпады в ходьбе'
    else if (/lateral|side/.test(n)) base = 'Боковые выпады'
    else if (/rear|backward|reverse/.test(n)) base = 'Обратные выпады'
    return withEq(base, ex)
  }

  if (/leg press/.test(n)) return withEq('Жим ногами', ex) + qText
  if (/leg extension/.test(n)) return withEq('Разгибание ног', ex) + qText
  if (/leg curl|hamstring curl/.test(n)) return withEq('Сгибание ног', ex) + qText
  if (/calf raise/.test(n)) return withEq('Подъём на носки', ex) + qText

  if (/triceps pushdown|pushdown/.test(n)) return 'Разгибание рук на верхнем блоке' + qText
  if (/triceps extension|tricep extension/.test(n)) return withEq('Разгибание рук на трицепс', ex) + qText
  if (/dip/.test(n)) return /bench/.test(n) ? 'Отжимания от скамьи' : 'Отжимания на брусьях'
  if (/preacher curl/.test(n)) return withEq('Сгибание рук на скамье Скотта', ex) + qText
  if (/hammer curl/.test(n)) return withEq('Молотковые сгибания', ex) + qText
  if (/curl/.test(n)) {
    if (/wrist/.test(n)) return withEq('Сгибание кистей', ex) + qText
    if (/leg/.test(n)) return withEq('Сгибание ног', ex) + qText
    return withEq('Сгибание рук', ex) + qText
  }

  if (/upright row/.test(n)) return withEq('Тяга к подбородку', ex)
  if (/seated row/.test(n) && ex.eq === 'cable') return 'Тяга горизонтального блока' + qText
  if (/t-bar row/.test(n)) return withEq('Тяга Т-грифа', ex) + qText
  if (/row|rowing/.test(n)) {
    let base = 'Тяга'
    if (/one arm/.test(n)) base += ' одной рукой'
    if (/bent over|incline/.test(n)) base += ' в наклоне'
    return withEq(base, ex) + qText
  }

  if (/fly|pec deck/.test(n)) return withEq('Разведение рук', ex) + qText
  if (/lateral raise/.test(n)) return withEq('Махи в стороны', ex) + qText
  if (/front raise/.test(n)) return withEq('Подъём рук перед собой', ex) + qText
  if (/rear delt/.test(n)) return withEq('Разведение на заднюю дельту', ex) + qText
  if (/raise/.test(n)) {
    if (/leg/.test(n)) return withEq('Подъём ног', ex) + qText
    if (/hip/.test(n)) return withEq('Подъём таза', ex) + qText
    return withEq('Подъём', ex) + qText
  }

  if (/shrug/.test(n)) return withEq('Шраги', ex)
  if (/plank/.test(n)) return withEq(/side/.test(n) ? 'Боковая планка' : 'Планка', ex)
  if (/crunch/.test(n)) return withEq(/reverse/.test(n) ? 'Обратные скручивания' : 'Скручивания', ex) + qText
  if (/sit[- ]?up/.test(n)) return withEq('Подъём корпуса', ex) + qText
  if (/russian twist/.test(n)) return withEq('Русские скручивания', ex)
  if (/v[- ]?up/.test(n)) return withEq('Складка', ex)
  if (/hip thrust|glute bridge/.test(n)) return withEq('Ягодичный мост', ex)
  if (/pullover/.test(n)) return withEq('Пуловер', ex)
  if (/pull through/.test(n)) return withEq('Протяжка', ex)
  if (/rack pull/.test(n)) return withEq('Тяга с плинтов', ex)
  if (/hyperextension|back extension/.test(n)) return withEq(/reverse/.test(n) ? 'Обратная гиперэкстензия' : 'Гиперэкстензия', ex)
  if (/muscle up/.test(n)) return withEq('Выход силой', ex)
  if (/snatch/.test(n)) return withEq('Рывок', ex) + qText
  if (/clean/.test(n)) return withEq('Взятие на грудь', ex) + qText
  if (/jerk/.test(n)) return withEq('Толчок', ex) + qText
  if (/swing/.test(n)) return withEq('Махи', ex) + qText
  if (/thruster/.test(n)) return withEq('Трастер', ex)
  if (/farmer|carry/.test(n)) return withEq('Перенос веса', ex) + qText
  if (/rope climb/.test(n)) return 'Лазание по канату'
  if (/battle|battling rope/.test(n)) return 'Волны канатами'
  if (/tire flip/.test(n)) return 'Переворот покрышки'
  if (/sledge hammer/.test(n)) return 'Удары молотом'
  if (/dead bug/.test(n)) return 'Мёртвый жук'
  if (/superman/.test(n)) return 'Супермен'
  if (/wheel|rollerout/.test(n)) return 'Ролик для пресса'
  if (/side bend/.test(n)) return withEq('Боковые наклоны', ex) + qText
  if (/toe touch/.test(n)) return 'Касания носков' + qText
  if (/heel touch/.test(n)) return 'Касания пяток' + qText
  if (/ankle circle/.test(n)) return 'Круги стопами' + qText
  if (/wrist circle/.test(n)) return 'Круги кистями' + qText
  if (/wrist roller/.test(n)) return 'Ролик для предплечий'
  if (/pronation/.test(n)) return withEq('Пронация предплечья', ex)
  if (/supination/.test(n)) return withEq('Супинация предплечья', ex)
  if (/windmill/.test(n)) return withEq('Мельница', ex)
  if (/high knee/.test(n)) return 'Высокие колени'
  if (/inchworm/.test(n)) return 'Червячок'
  if (/bear crawl/.test(n)) return 'Медвежья ходьба'
  if (/walk/.test(n)) return 'Ходьба' + qText
  if (/run|sprint/.test(n)) return 'Бег' + qText
  if (/jump/.test(n)) return 'Прыжки' + qText
  if (/rotation|twist/.test(n)) return withEq('Повороты корпуса', ex) + qText

  const eq = eqPhrase(ex)
  return 'Упражнение: ' + targetOf(ex) + (eq ? ' ' + eq : '') + qText
}

function familyAliases(ex, name) {
  const n = norm(ex.n)
  if (/bench press/.test(n)) return ['Жим лёжа', 'Жим лежа', 'Жим на грудь', 'Бенч', 'Грудной жим']
  if (/pulldown/.test(n)) return ['Верхний блок', 'Вертикальная тяга', 'Тяга сверху', 'Блок к груди', 'Тяга блока']
  if (/seated row/.test(n) && ex.eq === 'cable') return ['Горизонтальная тяга', 'Нижний блок', 'Гребля', 'Блок к животу', 'Тяга сидя']
  if (/hammer curl/.test(n)) return ['Молотки', 'Молоток', 'Бицепс молотком', 'Гантели молотком', 'Молотковые сгибания']
  if (/lateral raise/.test(n)) return ['Махи в стороны', 'Махи на среднюю дельту', 'Разводка в стороны', 'Подъёмы в стороны', 'Средняя дельта']
  if (/upright row/.test(n)) return ['Протяжка', 'Тяга к подбородку', 'Протяжка на плечи', 'Тяга на дельты', 'Штанга к подбородку']
  if (/leg press/.test(n)) return ['Жим ногами', 'Платформа', 'Ноги в платформе', 'Жим платформы', 'Жим в тренажёре ногами']
  if (/leg extension/.test(n)) return ['Разгибания ног', 'Квадрицепс в тренажёре', 'Разгиб ног', 'Ноги разгибание', 'Тренажёр на квадрицепс']
  if (/leg curl/.test(n)) return ['Сгибания ног', 'Бицепс бедра', 'Сгиб ног', 'Задняя поверхность бедра', 'Тренажёр на бицепс бедра']
  if (/triceps pushdown|pushdown/.test(n)) return ['Трицепс на блоке', 'Разгибания на блоке', 'Верхний блок на трицепс', 'Трицепс с рукояткой', 'Разгиб рук вниз']
  if (/preacher curl/.test(n)) return ['Скамья Скотта', 'Бицепс на Скотте', 'Сгибания на Скотте', 'Скотт', 'Подъём на Скотте']
  if (/romanian deadlift/.test(n)) return ['Румынка', 'Румынская', 'Румынская становая', 'Тяга на прямых ногах', 'РДЛ']
  if (/deadlift/.test(n)) return ['Становая', 'Становая тяга', 'Тяга с пола', 'Дедлифт', 'Классическая тяга']
  if (/squat/.test(n)) return ['Присед', 'Приседания', 'Присед на ноги', 'Сквот', 'Ноги присед']
  if (/pull[- ]?up|chin[- ]?up/.test(n)) return ['Подтягивания', 'Подтяги', 'Турник', 'Подтягивание', 'Тяга своим весом']
  if (/hyperextension/.test(n)) return ['Гиперы', 'Гипер', 'Разгибания спины', 'Поясница', 'Гиперэкстензия']
  if (/fly|pec deck/.test(n)) return ['Разводка', 'Разведения', 'Сведение рук', 'Грудь разводка', 'Разводка на грудь']
  if (/chest press/.test(n) && /lever/.test(n)) return ['Жим в хаммере', 'Хаммер на грудь', 'Рычажный жим', 'Жим в тренажёре', 'Грудной хаммер']
  return []
}

function uniqueFive(values, ex, name) {
  const out = []
  const seen = new Set()
  const add = value => {
    const v = String(value || '').trim()
    const key = norm(v)
    if (!v || !key || key === norm(name) || seen.has(key)) return
    seen.add(key)
    out.push(v)
  }
  values.forEach(add)

  const target = targetOf(ex)
  const shortEq = eqShort(ex)
  const simple = name
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const noEq = simple
    .replace(/\s+(со штангой|с гантелями|с гирей|на блоке|с резинкой|в машине Смита|в тренажёре|с отягощением)$/i, '')
    .trim()

  ;[
    simple.replace(/ё/g, 'е'),
    noEq,
    shortEq ? shortEq + ' ' + noEq : '',
    target + ' ' + noEq,
    noEq + ' на ' + target,
    shortEq ? noEq + ' ' + shortEq : '',
    'упражнение на ' + target,
    'движение на ' + target
  ].forEach(add)

  let i = 1
  while (out.length < 5) {
    add(noEq + ' вариант ' + i)
    i++
  }
  return out.slice(0, 5)
}

export function ruAliasesFor(ex) {
  if (!ex || ex.custom) return []
  const curated = CURATED[ex.id]
  const name = ruNameFor(ex)
  return uniqueFive(curated ? curated.aliases : familyAliases(ex, name), ex, name)
}

export function ruMetaFor(ex) {
  return { name: ruNameFor(ex), aliases: ruAliasesFor(ex) }
}

export const hasCuratedRu = ex => !!(ex && CURATED[ex.id])
