const defaults = {
  study: { label: 'Обучение', set: 0, reveal: true },
  practice: { label: 'Тренировка', set: 0, reveal: true },
  independent: { label: 'Самостоятельная', set: 2, reveal: false },
  test: { label: 'Контроль', set: 3, reveal: false },
};

const safeId = /^[a-z0-9-]{1,30}$/;
const hasText = value => typeof value === 'string' && value.trim().length > 0;

export function lessonLayout(config) {
  const { sets } = config;
  if (!hasText(config.key) || !hasText(config.slug) || !Array.isArray(sets) || !sets.length
    || !Array.isArray(sets[0]?.tasks) || !sets[0].tasks.length) {
    throw new Error('У урока должен быть ключ, имя файла и хотя бы один комплект задач.');
  }
  const count = sets[0].tasks.length;
  for (const set of sets) {
    if (!hasText(set?.label) || !Array.isArray(set.tasks) || set.tasks.length !== count) {
      throw new Error('В каждом комплекте должны быть одноимённые позиции по числу задач основного комплекта.');
    }
    for (const task of set.tasks) {
      if (!hasText(task?.title) || !hasText(task.statement) || !hasText(task.source)
        || !(typeof task.check === 'function' || Number.isFinite(task.answer))) {
        throw new Error('У задачи должны быть заголовок, условие, источник и проверяемый ответ.');
      }
      for (const item of task.checkpoints ?? []) {
        if (!hasText(item.label) || !Number.isFinite(item.answer)) throw new Error('Проверьте настройку промежуточного шага.');
      }
    }
  }
  const ids = sets[0].tasks.map(task => task.id);
  if (ids.some(id => id !== undefined && (typeof id !== 'string' || !safeId.test(id)))
    || new Set(ids.filter(Boolean)).size !== ids.filter(Boolean).length) {
    throw new Error('Идентификаторы задач должны быть уникальными и состоять из латинских строчных букв, цифр и дефисов.');
  }
  const modes = Object.fromEntries(Object.entries(defaults).map(([mode, definition]) => {
    const set = config.modeSets?.[mode] ?? Math.min(definition.set, sets.length - 1);
    if (!Number.isInteger(set) || !sets[set]) throw new Error('Выбранного комплекта для режима нет.');
    return [mode, { ...definition, set }];
  }));
  const titles = ['Начало', 'Теория', ...sets[0].tasks.map(task => task.title), 'Итоги'];
  const last = titles.length - 1;
  function keyFor(mode, slide, variant) {
    const slot = ids[slide - 2] ? 'q-' + ids[slide - 2] : String(slide);
    return mode === 'study' && variant === 0 ? slot : mode + '-' + slot + '-' + variant;
  }
  function variantFor(mode, selection) {
    return mode === 'practice' && Number.isInteger(selection) && sets[selection]
      ? selection : modes[mode].set;
  }
  return { modes, titles, last, keyFor, variantFor };
}
