import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.window = { addEventListener() {} };
const { numberAnswer } = await import('../shared/math-keyboard.js');
const { lessonLayout } = await import('../shared/lesson-config.js');
const { lessonStorage } = await import('../shared/storage.js');
const { assistance, checkFinal, gradeTest, restartTest, taskFeedback } = await import('../shared/assessment.js');
const { magnifiedGap, createAnimation } = await import('../shared/interactive-math.js');
const { printFormats, writingCapacity } = await import('../shared/notebook-print.js');
const { pngArchive } = await import('../shared/export.js');
const { tireLesson } = await import('../tasks/1-5/tires/lesson.js');
const { dimensionDiagram, dimensions, rollingModel } = await import('../tasks/1-5/tires/wheels.js');

function storage(raw = {}) {
  const persisted = new Map([['demo', JSON.stringify(raw)]]);
  globalThis.localStorage = {
    getItem: key => persisted.get(key),
    setItem: (key, value) => persisted.set(key, value),
  };
  return lessonStorage('demo');
}

const sourceAnswers = [
  [195, 107.25, 549.8, 2.75, 1.4], [185, 112.75, 603, 13.3, 2.2],
  [275, 178.75, 775.2, 17.8, 2.3], [215, 137.5, 652.4, 1.7, 1.8],
];

test('Все 20 ответов соответствуют ключу сборника, стр. 1149', () => {
  for (const [setIndex, set] of tireLesson.sets.entries()) {
    set.tasks.forEach((task, index) => {
      assert(Math.abs(task.answer - sourceAnswers[setIndex][index]) < 1e-8, task.source);
      assert.equal(task.hints.length, 3);
      assert(task.steps.length >= 2);
      assert.equal(typeof task.mount, 'function');
    });
  }
});

test('Каталог ведёт в существующие полноэкранные уроки', async () => {
  globalThis.window.OGE_MATERIALS = null;
  await import('../catalog.js');
  const catalog = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert(!catalog.includes('<iframe'));
  for (const material of window.OGE_MATERIALS) {
    const file = await readFile(new URL('../' + material.path.split('?')[0], import.meta.url), 'utf8');
    assert(file.includes('id="lesson"'));
  }
});

test('Режимы и ключи совместимы со старыми записями', () => {
  const layout = lessonLayout(tireLesson);
  assert.equal(layout.keyFor('study', 3, 0), '3');
  assert.equal(layout.keyFor('practice', 3, 1), 'practice-3-1');
  assert.equal(layout.variantFor('test', 0), 3);
  assert.equal(layout.variantFor('practice', 2), 2);
  const single = lessonLayout({ ...tireLesson, sets: [tireLesson.sets[0]] });
  assert.equal(single.variantFor('test', 0), 0);
  const configured = lessonLayout({ ...tireLesson, modeSets: { test: 1 } });
  assert.equal(configured.variantFor('test', 0), 1);
  assert.throws(() => lessonLayout({ ...tireLesson, modeSets: { test: 6 } }));
});

test('Прогресс восстанавливает валидные записи, повреждённый импорт не заменяет их', () => {
  const stroke = { mode: 'pen', color: '#245c9b', width: 3, points: [[.5, .1]] };
  const saved = storage({ i: 3, answers: { 3: '107,25', 6: 16 }, notebook: { 3: [stroke, {}] }, ink: {} });
  assert.equal(saved.repaired, true);
  assert.equal(saved.state.answers[3], '107,25');
  assert.equal(saved.state.answers[6], undefined);
  assert.deepEqual(saved.state.notebook[3], [stroke]);
  assert.throws(() => saved.restore({ lesson: 'demo', correct: { 3: null } }));
  assert.throws(() => saved.restore({ lesson: 'demo', schema: '99' }));
  assert.equal(saved.state.answers[3], '107,25');
  saved.restore(saved.report());
  assert.equal(saved.state.answers[3], '107,25');
});

test('Допустимый числовой ввод и разбор типичной ошибки', () => {
  assert.equal(numberAnswer('429 / 4'), 107.25);
  assert.equal(numberAnswer('−1,4'), -1.4);
  assert.equal(numberAnswer('1 234,5'), 1234.5);
  for (const value of ['0x10', '1/0', '1e2', '2+2', '']) assert(Number.isNaN(numberAnswer(value)));
  assert.match(taskFeedback(tireLesson.sets[0].tasks[1], '65'), /процент/);
});

test('Помощь учитывается при первом решении, контроль проверяется единожды', () => {
  const { state } = storage();
  const task = tireLesson.sets[0].tasks[1];
  state.stepHelp[3] = true;
  assert.equal(assistance(state, '3'), 'hint');
  assert.equal(checkFinal(state, '3', task, '107,25'), true);
  assert.equal(state.solved[3], 'hint');
  state.modelHelp[3] = true;
  checkFinal(state, '3', task, '107,25');
  assert.equal(state.solved[3], 'hint');
  state.answers['test-3-3'] = '107,25';
  const entries = [{ key: 'test-3-3', task }, { key: 'test-4-3', task }];
  gradeTest(state, entries);
  gradeTest(state, entries);
  assert.equal(state.completed.test, true);
  assert.equal(state.attempts['test-3-3'], 1);
  assert.equal(state.correct['test-4-3'], undefined);
  state.notebook['test-3-3'] = [{ mode: 'pen', color: '#245c9b', width: 2, points: [[0, 0]] }];
  restartTest(state, entries);
  assert.equal(state.completed.test, undefined);
  assert.equal(state.answers['test-3-3'], undefined);
  assert.equal(state.correct['test-3-3'], undefined);
  assert.equal(state.attempts['test-3-3'], undefined);
  assert.equal(state.notebook['test-3-3'].length, 1);
  assert.equal(state.correct[3], true);
});

test('Максимальный профиль умещается в SVG, обе размерные линии соблюдают масштаб', () => {
  const tire = [295, 85, 17];
  const markup = dimensionDiagram(tire);
  const radius = dimensions(tire).radius * .27;
  assert(markup.includes('r="' + radius + '"'));
  assert(141 - radius >= 0);
  assert(171 - radius > 23);
  assert(171 + radius < 308);
  for (const name of ['H', 'B', 'd', 'D']) assert(markup.includes('>' + name + '</text>'));
});

test('Увеличение подписано верным целым множителем, кинематика согласована', () => {
  assert.deepEqual(magnifiedGap(2, 85, 40), { factor: 40, gap: 80 });
  assert.deepEqual(magnifiedGap(0, 85, 40), { factor: 40, gap: 0 });
  const tires = [[175, 70, 12], [175, 65, 13]];
  const elements = new Map();
  const root = { isConnected: true, querySelector(selector) {
    if (!elements.has(selector)) elements.set(selector, {});
    return elements.get(selector);
  } };
  globalThis.cancelAnimationFrame = () => {};
  globalThis.matchMedia = () => ({ matches: true });
  rollingModel(...tires)(root, { reveal: true, onReveal() {} });
  root.querySelector('[data-roll]').onclick();
  for (const tire of tires) {
    const wheel = dimensions(tire);
    assert.equal(wheel.roll, Math.PI * wheel.diameter);
    const x = 72 + wheel.roll * .15;
    assert(root.querySelector('[data-visual]').innerHTML.includes('translate(' + x));
    assert(x + wheel.radius * .15 < 540);
  }
  assert.match(root.querySelector('[data-visual]').innerHTML, /rotate\(360\)/);
  assert.equal(root.querySelector('[data-finish]').hidden, false);
  root.querySelector('[data-reset]').onclick();
  assert.equal(root.querySelector('[data-finish]').hidden, true);
  assert.match(root.querySelector('[data-distance-first]').textContent, /0 мм/);
});

test('Анимация завершается и сбрасывается в режиме уменьшенного движения', () => {
  const frames = [];
  const animation = createAnimation({ isConnected: true }, part => frames.push(part), 1000);
  animation.start();
  animation.reset();
  assert.deepEqual(frames, [1, 0]);
});

test('Разбиение тетради учитывает формат, условие и математические размеры', () => {
  for (const format of Object.values(printFormats)) {
    assert(writingCapacity(format, 0, 760) > 1000);
    assert(writingCapacity(format, 320, 760) < writingCapacity(format, 0, 760));
    assert.equal(writingCapacity(format, 5000, 760), 0);
  }
});

test('ZIP содержит оба указанных PNG и конечную запись о каталоге', async () => {
  const zip = await pngArchive([
    { name: 'first.png', blob: new Blob(['test1']) },
    { name: 'second.png', blob: new Blob(['test2']) },
  ]);
  const bytes = await zip.arrayBuffer();
  const data = new DataView(bytes);
  assert.equal(data.getUint32(0, true), 0x04034b50);
  assert.equal(data.getUint32(bytes.byteLength - 22, true), 0x06054b50);
  assert.equal(data.getUint16(bytes.byteLength - 12, true), 2);
});
