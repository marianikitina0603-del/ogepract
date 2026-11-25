const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const positiveInt = value => Number.isInteger(value) && value > 0;
const flag = value => typeof value === 'boolean';
const nonnegativeInt = value => Number.isInteger(value) && value >= 0;
const color = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const stroke = value => isRecord(value) && ['pen', 'marker', 'erase'].includes(value.mode)
  && color(value.color) && finite(value.width) && value.width > 0 && value.width <= 80
  && Array.isArray(value.points) && value.points.length > 0 && value.points.length <= 100000
  && value.points.every(point => Array.isArray(point) && point.length === 2 && point.every(finite));
const stepFields = (value, validate) => isRecord(value) && Object.entries(value).every(
  ([key, datum]) => /^\d{1,3}$/.test(key) && validate(datum),
);
const validators = {
  answers: value => typeof value === 'string' && value.length <= 512,
  correct: flag,
  attempts: nonnegativeInt,
  revealed: value => flag(value) || positiveInt(value),
  modelHelp: flag,
  stepHelp: flag,
  checkpointAnswers: value => stepFields(value, item => typeof item === 'string' && item.length <= 80),
  checkpointMarks: value => stepFields(value, flag),
  completed: flag,
  hints: positiveInt,
  solved: value => ['independent', 'hint', 'solution'].includes(value),
  ink: value => Array.isArray(value) && value.every(stroke),
  notebook: value => Array.isArray(value) && value.every(stroke),
  heights: value => positiveInt(value) && value >= 420 && value <= 4800,
  paper: value => isRecord(value) && ['grid', 'lined', 'plain'].includes(value.kind)
    && [14, 20, 28].includes(value.cell) && [75, 100, 125, 150].includes(value.zoom),
  selected: nonnegativeInt,
  positions: nonnegativeInt,
};

function decode(data, strict = true) {
  if (!isRecord(data)) throw new Error('Файл не содержит прогресс урока.');
  const result = { i: Number.isInteger(data.i) ? data.i : 0, mode: typeof data.mode === 'string' ? data.mode : undefined };
  let repaired = false;
  for (const [field, validate] of Object.entries(validators)) {
    result[field] = Object.create(null);
    if (data[field] === undefined) continue;
    if (!isRecord(data[field])) { repaired = true; continue; }
    for (const [key, value] of Object.entries(data[field])) {
      if (!/^[\w-]{1,80}$/.test(key)) { repaired = true; continue; }
      if (!validate(value)) {
        repaired = true;
        if (['ink', 'notebook'].includes(field) && Array.isArray(value)) {
          result[field][key] = value.filter(stroke);
        }
        continue;
      }
      result[field][key] = value;
    }
  }
  if (strict && repaired) throw new Error('В файле повреждены данные урока.');
  return { state: result, repaired };
}

export function lessonStorage(key) {
  let state, repaired;
  try {
    ({ state, repaired } = decode(JSON.parse(localStorage.getItem(key) || '{}'), false));
  } catch {
    ({ state } = decode({}));
    repaired = true;
  }
  return {
    get state() { return state; },
    repaired,
    save() {
      try {
        localStorage.setItem(key, JSON.stringify(state));
        return true;
      } catch {
        return false;
      }
    },
    report() { return { ...state, schema: 1, lesson: key }; },
    restore(raw, legacySource) {
      if (raw?.lesson !== key && !(legacySource && !raw?.lesson && raw?.source === legacySource)) {
        throw new Error('Этот файл относится к другому уроку.');
      }
      if (raw.schema !== undefined && raw.schema !== 1) throw new Error('Неподдерживаемая версия отчёта.');
      state = decode(raw).state;
    },
    reset() { state = decode({}).state; },
  };
}
