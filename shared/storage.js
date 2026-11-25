const fields = ['answers', 'correct', 'attempts', 'revealed', 'modelHelp', 'hints', 'solved', 'ink', 'notebook', 'heights', 'paper', 'selected', 'positions'];
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const positiveInt = value => Number.isInteger(value) && value > 0;
const color = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const stroke = value => isRecord(value) && ['pen', 'marker', 'erase'].includes(value.mode)
  && color(value.color) && finite(value.width) && value.width > 0 && value.width <= 80
  && Array.isArray(value.points) && value.points.length > 0 && value.points.length <= 100000
  && value.points.every(point => Array.isArray(point) && point.length === 2 && point.every(finite));
const validators = {
  answers: value => typeof value === 'string' && value.length <= 512,
  correct: value => typeof value === 'boolean',
  attempts: value => Number.isInteger(value) && value >= 0,
  revealed: value => typeof value === 'boolean' || positiveInt(value),
  modelHelp: value => typeof value === 'boolean',
  hints: positiveInt,
  solved: value => ['independent', 'hint', 'solution'].includes(value),
  ink: value => Array.isArray(value) && value.every(stroke),
  notebook: value => Array.isArray(value) && value.every(stroke),
  heights: value => positiveInt(value) && value >= 420 && value <= 4800,
  paper: value => isRecord(value) && ['grid', 'lined', 'plain'].includes(value.kind)
    && [14, 20, 28].includes(value.cell) && [75, 100, 125, 150].includes(value.zoom),
  selected: value => Number.isInteger(value) && value >= 0,
  positions: value => Number.isInteger(value) && value >= 0,
};

function decode(data) {
  if (!isRecord(data)) throw new Error('Файл не содержит прогресс урока.');
  const result = { i: Number.isInteger(data.i) ? data.i : 0, mode: data.mode };
  for (const field of fields) {
    result[field] = Object.create(null);
    if (data[field] === undefined) continue;
    if (!isRecord(data[field])) throw new Error('В файле повреждены данные урока.');
    for (const [key, value] of Object.entries(data[field])) {
      if (!/^[\w-]{1,80}$/.test(key) || !validators[field](value)) {
        throw new Error('В файле повреждены данные урока.');
      }
      result[field][key] = value;
    }
  }
  return result;
}

export function lessonStorage(key) {
  let state;
  try {
    state = decode(JSON.parse(localStorage.getItem(key) || '{}'));
  } catch {
    state = decode({});
  }
  return {
    get state() { return state; },
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
      state = decode(raw);
    },
    reset() { state = decode({}); },
  };
}
