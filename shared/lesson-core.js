import { lessonStorage } from './storage.js';
import { createInk, inkToolbar } from './annotation.js';
import { setupPanels } from './panels.js';
import { setupNotebook } from './notebook.js';
import { setupKeyboard, typeset, numberAnswer } from './math-keyboard.js';
import { capture, download, preparePrint } from './export.js';

const modes = {
  study: { label: 'Обучение', set: 0, reveal: true },
  practice: { label: 'Тренировка', set: 0, reveal: true },
  independent: { label: 'Самостоятельная', set: 2, reveal: false },
  test: { label: 'Контроль', set: 3, reveal: false },
};

const panel = (id, title, tools = true) => `<section class="lesson-panel" id="${id}" aria-label="${title}" hidden>
  <div class="panelbar"><strong>${title}</strong>
    ${tools ? '<button data-min aria-label="Свернуть">−</button><button data-max aria-label="Развернуть или восстановить">⛶</button>' : ''}
    <button data-close aria-label="Закрыть">×</button>
  </div><div class="inside"></div></section>`;

export function startLesson(config) {
  const root = document.querySelector('#lesson');
  root.innerHTML = `<header class="lesson-header">
    <a href="${config.catalogUrl || '../../../index.html#topic=1-5'}">← Каталог</a><strong>${config.shortTitle}</strong>
    <div class="lesson-row"><label>Режим <select id="lesson-mode">${Object.entries(modes).map(([id, mode]) =>
      `<option value="${id}">${mode.label}</option>`).join('')}</select></label>
    <button id="draw" aria-pressed="false">✎ На слайде</button>
    <button data-open="book">Тетрадь</button><button data-open="theory" id="theory-button">Теория</button>
    <button id="full" aria-label="Полноэкранный режим">⛶</button></div></header>
    <div class="lesson-row lesson-inkbar" id="inkbar" hidden>${inkToolbar()}</div>
    <main class="lesson-workspace">
      <article class="lesson-slide" id="slide"><div id="content"></div><canvas id="overlay" class="lesson-overlay" aria-label="Рисование на слайде"></canvas></article>
      ${panel('book', 'Рабочая тетрадь')}
    </main>
    <footer class="lesson-footer">
      <button id="prev" aria-label="Предыдущий слайд">←</button><button data-open="menu">Все слайды</button>
      <span id="position"></span><progress id="progress" aria-label="Положение в уроке"></progress>
      <button id="next" aria-label="Следующий слайд">→</button>
      <button id="snap">PNG слайда</button><button id="print-slide">Печать / PDF</button>
      <button data-open="progress-menu">Прогресс</button>
    </footer>
    <p id="lesson-status" role="status" aria-live="polite"></p>
    ${panel('theory', 'Теория')}${panel('menu', 'Все слайды', false)}${panel('progress-menu', 'Прогресс', false)}`;

  const $ = id => root.querySelector('#' + id);
  const storage = lessonStorage(config.key);
  const state = () => storage.state;
  let mode = Object.hasOwn(modes, state().mode) ? state().mode : 'study';
  const titleList = ['Начало', 'Теория', ...config.sets[0].tasks.map(task => task.title), 'Итоги'];
  const last = titleList.length - 1;
  const clamp = value => Math.max(0, Math.min(last, value));
  let index = clamp(state().i);
  let statusTimer;
  const book = $('book');
  const theory = $('theory');
  const status = text => {
    $('lesson-status').textContent = text;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { $('lesson-status').textContent = ''; }, 5500);
  };
  const save = () => {
    state().mode = mode;
    state().i = index;
    state().positions[mode] = index;
    if (!storage.save()) status('Браузер не сохранил изменения. Скачайте отчёт в меню «Прогресс».');
  };

  function split(docked) {
    book.classList.toggle('docked', docked);
    root.classList.toggle('lesson-split', docked);
    if (docked) book.classList.remove('max', 'min');
    book.querySelector('#split-book').setAttribute('aria-pressed', docked);
  }
  const panels = setupPanels(root, split);
  root.addEventListener('click', event => {
    const button = event.target.closest('[data-open]');
    if (button) panels.open(button.dataset.open, button);
  });
  function variantFor(slide) {
    const selected = state().selected[slide];
    if (mode === 'practice' && config.sets[selected]) return selected;
    return Math.min(modes[mode].set, config.sets.length - 1);
  }
  function keyFor(slide, variant = variantFor(slide)) {
    if (mode === 'study' && variant === 0) return String(slide);
    return mode + '-' + slide + '-' + variant;
  }
  function pageFor(slide, variant = variantFor(slide)) {
    const task = config.sets[variant].tasks[slide - 2];
    const key = keyFor(slide, variant);
    return { key, html: task
      ? `<h2>${task.title}</h2><p class="task-source">${task.source}</p>${task.notebookStatement ?? task.statement}${task.notebook ?? ''}`
      : `<h2>${config.shortTitle} · ${titleList[slide]}</h2>` };
  }
  function notebookPages() {
    const pages = [];
    for (const id of Object.keys(modes)) {
      for (let slide = 2; slide < last; slide++) {
        const variants = id === 'practice' ? config.sets.map((_, j) => j) : [Math.min(modes[id].set, config.sets.length - 1)];
        for (const variant of variants) {
          const key = id === 'study' ? String(slide) : id + '-' + slide + '-' + variant;
          const saved = state().notebook[key]?.length || state().paper[key] || state().heights[key];
          if (id !== mode && !saved) continue;
          if (id === mode && variant !== variantFor(slide) && !saved) continue;
          const task = config.sets[variant].tasks[slide - 2];
          pages.push({ key, html: `<h2>${task.title}</h2><p class="task-source">${task.source} · ${modes[id].label}</p>${task.notebookStatement ?? task.statement}${task.notebook ?? ''}` });
        }
      }
    }
    for (const slide of [0, 1, last]) {
      const page = pageFor(slide);
      if (state().notebook[page.key]?.length) pages.push(page);
    }
    return pages.length ? pages : [pageFor(index)];
  }
  const notebook = setupNotebook(book, {
    current: () => pageFor(index), pages: notebookPages, state, save, split, status, prefix: config.slug,
  });
  const overlay = $('overlay');
  const annotations = createInk(overlay, $('inkbar'), {
    strokes: () => (state().ink[keyFor(index)] ??= []), key: () => keyFor(index), save,
  });
  const finishWriting = () => { annotations.stop(); notebook.stop(); };
  const modeSelect = $('lesson-mode');

  function setDrawing(value) {
    $('draw').setAttribute('aria-pressed', value);
    $('inkbar').hidden = !value;
    overlay.classList.toggle('active', value);
    annotations.fit();
  }
  $('draw').onclick = () => setDrawing($('inkbar').hidden);

  function answerIsCorrect(task, answer) {
    if (task.check) return task.check(answer);
    return Math.abs(numberAnswer(answer) - task.answer) < 1e-8;
  }
  function helpCards(items, count) {
    return items.slice(0, count).map(item => `<p class="worked-step">${item}</p>`).join('');
  }

  function renderTask(task, variant) {
    const key = keyFor(index, variant);
    const { reveal } = modes[mode];
    const content = $('content');
    content.innerHTML = `<p class="task-source">${task.source}</p><h2>${task.title}</h2>
      ${reveal && config.sets.length > 1 ? `<div class="lesson-row variant-row">
        <label>Задание <select id="variant">${config.sets.map((set, j) => `<option value="${j}">${set.label}</option>`).join('')}</select></label></div>` : ''}
      <div class="task-layout"><div id="condition">${task.statement}
        <form class="lesson-row answer-row" id="answer-form">
          <label class="sr-only" for="answer">Ответ</label><input id="answer" inputmode="decimal" maxlength="512" autocomplete="off" placeholder="Ответ">
          <button type="submit" class="primary" id="check">${mode === 'test' ? 'Сохранить ответ' : 'Проверить'}</button>
          <button type="button" id="keyboard" aria-label="Математическая клавиатура" aria-expanded="false" aria-controls="keys">⌨</button>
        </form>
        <div class="math-preview" id="math-preview" hidden></div><div class="lesson-row kbd" id="keys" hidden></div>
        <p id="feedback" role="status"></p>
        <div class="lesson-row">${reveal ? '<button id="hint">Подсказка</button><button id="solution">Следующий шаг решения</button>' : ''}
          <button type="button" data-open="book">Черновик</button>
          ${reveal && config.sets.length > 1 ? '<button type="button" id="analog">Открыть аналог</button>' : ''}</div>
        <div id="hint-text"></div><div id="steps"></div>
      </div>${task.mount ? '<section class="interactive" id="interactive"></section>' : ''}</div>`;
    const input = $('answer');
    input.value = state().answers[key] ?? '';
    const feedback = $('feedback');
    const model = $('interactive');
    const onReveal = () => {
      if (!reveal) return;
      state().modelHelp[key] = true;
      save();
    };
    task.mount?.(model, { reveal, onReveal, condition: $('condition') });
    setupKeyboard(input, $('keyboard'), $('keys'), $('math-preview'));

    function updateFeedback() {
      const correct = state().correct[key];
      feedback.className = mode === 'test' || correct === undefined ? '' : correct ? 'good' : 'bad';
      if (correct === undefined) feedback.textContent = '';
      else if (mode === 'test') feedback.textContent = 'Ответ сохранён.';
      else feedback.textContent = correct ? 'Верно!' : (task.error || 'Пока неверно. Проверьте вычисления и единицы.');
    }
    input.oninput = () => {
      state().answers[key] = input.value;
      delete state().correct[key];
      delete state().solved[key];
      updateFeedback();
      save();
    };
    $('answer-form').onsubmit = event => {
      event.preventDefault();
      if (!input.value.trim()) { feedback.textContent = 'Введите ответ.'; input.focus(); return; }
      state().attempts[key] = (state().attempts[key] || 0) + 1;
      const correct = answerIsCorrect(task, input.value);
      state().correct[key] = correct;
      if (correct) {
        state().solved[key] ||= (state().revealed[key] || state().modelHelp[key]) ? 'solution' : state().hints[key] ? 'hint' : 'independent';
      }
      save();
      updateFeedback();
    };
    updateFeedback();

    if (reveal) {
      function updateHelp() {
        const hints = state().hints[key] || 0;
        const steps = state().revealed[key] === true ? 1 : state().revealed[key] || 0;
        $('hint-text').innerHTML = helpCards(task.hints, hints);
        $('steps').innerHTML = helpCards(task.steps, steps);
        $('hint').disabled = hints >= task.hints.length;
        $('solution').disabled = steps >= task.steps.length;
        typeset($('hint-text'));
        typeset($('steps'));
      }
      $('hint').onclick = () => { state().hints[key] = (state().hints[key] || 0) + 1; save(); updateHelp(); };
      $('solution').onclick = () => {
        const steps = Number(state().revealed[key] || 0);
        state().revealed[key] = steps + 1;
        save();
        updateHelp();
      };
      updateHelp();
    }
    if ($('variant')) {
      const choose = value => {
        if (mode === 'study' && value === 0) return;
        finishWriting();
        mode = 'practice';
        state().selected[index] = value;
        render();
      };
      $('variant').value = variant;
      $('variant').onchange = event => choose(+event.target.value);
      $('analog').onclick = () => choose(variant >= config.sets.length - 1 ? 1 : variant + 1);
    }
  }

  function renderResults() {
    const counts = { independent: 0, hint: 0, solution: 0 };
    const correct = config.sets[0].tasks.map((_, j) => {
      const slide = j + 2;
      const key = keyFor(slide);
      if (!state().correct[key]) return false;
      counts[state().solved[key] || ((state().revealed[key] || state().modelHelp[key]) ? 'solution' : 'independent')]++;
      return true;
    });
    $('content').innerHTML = `<h2>Итоги · ${modes[mode].label}</h2><p>Верно решено ${correct.filter(Boolean).length} из ${last - 2}.</p>
      <dl class="result-counts"><div><dt>Самостоятельно</dt><dd>${counts.independent}</dd></div><div><dt>С подсказкой</dt><dd>${counts.hint}</dd></div>
      <div><dt>После открытия решения</dt><dd>${counts.solution}</dd></div></dl>
      <ul class="result-list">${correct.map((ok, j) => `<li><button data-go="${j + 2}">${titleList[j + 2]}</button> ${ok ? 'верно' : 'к повторению'}</li>`).join('')}</ul>
      ${correct.every(Boolean) ? '<p>Попробуйте следующий комплект задач в режиме «Тренировка».</p>' : '<p>Вернитесь к отмеченным заданиям. Для разбора выберите режим «Обучение».</p>'}`;
  }

  function render() {
    const variant = variantFor(index);
    const task = config.sets[variant].tasks[index - 2];
    const { reveal } = modes[mode];
    modeSelect.value = mode;
    $('theory-button').hidden = !reveal;
    if (!reveal) theory.hidden = true;
    $('position').textContent = `${index + 1} / ${titleList.length}`;
    $('progress').max = titleList.length;
    $('progress').value = index + 1;
    $('prev').disabled = index === 0;
    $('next').disabled = index === last;
    const content = $('content');
    if (index === 0) {
      content.innerHTML = `<div class="lesson-intro"><p class="task-source">${config.section || 'ОГЭ №1–5 · Практико-ориентированные задачи'}</p>
        <h1>${config.title}</h1>${config.intro}<button class="primary" data-go="${reveal ? 1 : 2}">Начать урок →</button>
        <p class="task-source">${config.source}</p></div>`;
    } else if (index === 1) {
      content.innerHTML = reveal ? `<h2>${config.theoryTitle}</h2>${config.theory}` : '<h2>Перед началом</h2><p>Введите ответы на задания. Результаты доступны на последнем слайде.</p><button class="primary" data-go="2">Перейти к заданиям</button>';
    } else if (task) {
      renderTask(task, variant);
    } else {
      renderResults();
    }
    theory.querySelector('.inside').innerHTML =
      (task?.context ? `<section><h3>К этому заданию</h3>${task.context}</section>` : '') + config.theory;
    typeset(content);
    typeset(theory);
    notebook.refresh();
    annotations.refresh();
    save();
  }

  function go(slide) {
    const next = clamp(slide);
    if (next === index) return;
    finishWriting();
    index = next;
    render();
    window.scrollTo(0, 0);
  }
  modeSelect.onchange = () => {
    finishWriting();
    save();
    mode = modeSelect.value;
    index = clamp(state().positions[mode] ?? index);
    render();
  };
  root.addEventListener('click', event => {
    const button = event.target.closest('[data-go]');
    if (button) go(+button.dataset.go);
  });
  $('prev').onclick = () => go(index - 1);
  $('next').onclick = () => go(index + 1);
  const menu = $('menu');
  menu.querySelector('.inside').innerHTML = titleList.map((title, slide) =>
    `<button data-go="${slide}">${slide + 1}. ${title}</button>`).join('');
  menu.addEventListener('click', event => {
    if (event.target.closest('[data-go]')) panels.close(menu);
  });
  $('full').onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else status('Полноэкранный режим недоступен в этом браузере.');
    } catch { status('Полноэкранный режим недоступен в этом браузере.'); }
  };
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { panels.escape(); return; }
    if (event.target.closest('input,textarea,select,button,a,[contenteditable],.lesson-panel,.interactive') || event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      go(index + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  let swipe;
  $('slide').addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || event.target.closest('canvas,.interactive,input,button,label,select,table,a')) return;
    swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  $('slide').addEventListener('pointercancel', () => { swipe = null; });
  $('slide').addEventListener('pointerup', event => {
    if (!swipe || swipe.id !== event.pointerId) return;
    const x = event.clientX - swipe.x, y = event.clientY - swipe.y;
    swipe = null;
    if (Math.abs(x) > 70 && Math.abs(x) > 2 * Math.abs(y)) go(index + (x < 0 ? 1 : -1));
  });

  const progressMenu = $('progress-menu').querySelector('.inside');
  progressMenu.innerHTML = `<div class="lesson-row"><button id="report">Скачать JSON</button><button id="import">Загрузить JSON</button>
    <input id="report-file" type="file" accept=".json,application/json" hidden></div>
    <div class="lesson-row"><label>Печать слайда <select id="slide-size"><option>A4</option><option>A5</option></select></label>
    <button id="reset">Начать заново</button></div>`;
  $('report').onclick = () => download(new Blob([JSON.stringify(storage.report(), null, 2)], { type: 'application/json' }), config.slug + '-progress.json');
  $('import').onclick = () => $('report-file').click();
  $('report-file').onchange = async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Файл больше 20 МБ.');
      const raw = JSON.parse(await file.text());
      if (!confirm('Заменить текущий прогресс данными из файла?')) return;
      finishWriting();
      storage.restore(raw, config.legacySource);
      mode = Object.hasOwn(modes, state().mode) ? state().mode : 'study';
      index = clamp(state().i);
      annotations.clearHistory();
      notebook.clearHistory();
      render();
      status('Прогресс восстановлен.');
    } catch (error) { status(error instanceof SyntaxError ? 'Файл не содержит корректный JSON.' : error.message); }
  };
  $('reset').onclick = () => {
    if (!confirm('Сбросить ответы и записи во всех режимах урока?')) return;
    finishWriting();
    storage.reset();
    mode = 'study';
    index = 0;
    annotations.clearHistory();
    notebook.clearHistory();
    render();
  };
  $('snap').onclick = async () => {
    try { download(await capture($('slide')), `${config.slug}-slide-${index + 1}.png`); }
    catch { status('Не удалось сделать снимок слайда.'); }
  };
  $('print-slide').onclick = async () => {
    const button = $('print-slide');
    button.disabled = true;
    let url;
    try {
      url = URL.createObjectURL(await capture($('slide')));
      const image = document.createElement('img');
      image.src = url;
      image.alt = config.shortTitle + ' · ' + titleList[index];
      image.className = 'lesson-print-screenshot';
      await image.decode();
      window.addEventListener('afterprint', () => URL.revokeObjectURL(url), { once: true });
      preparePrint([image], { size: $('slide-size').value, slide: true });
    } catch {
      if (url) URL.revokeObjectURL(url);
      status('Не удалось подготовить снимок. Для печати используйте меню браузера.');
    } finally { button.disabled = false; }
  };

  render();
}
