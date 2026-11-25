import { lessonStorage } from './storage.js?v=8';
import { createInk, inkToolbar } from './annotation.js?v=8';
import { setupPanels } from './panels.js?v=8';
import { setupNotebook } from './notebook.js?v=8';
import { setupBoardTransfer } from './board-bridge.js?v=4';
import { setupKeyboard, typeset } from './math-keyboard.js?v=8';
import { capture, download, preparePrint } from './export.js?v=8';

import { lessonLayout } from './lesson-config.js?v=8';
import { assistance, checkFinal, gradeTest, mountCheckpoints, taskFeedback } from './assessment.js?v=8';
import { renderTheory } from './theory.js?v=8';

const panel = (id, title, tools = true) => `<section class="lesson-panel" id="${id}" aria-label="${title}" hidden>
  <div class="panelbar"><strong>${title}</strong>
    ${tools ? '<button data-min aria-label="Свернуть">−</button><button data-max aria-label="Развернуть или восстановить">⛶</button>' : ''}
    <button data-close aria-label="Закрыть">×</button>
  </div><div class="inside"></div>${tools ? '<button class="panel-resize" data-resize-panel aria-label="Изменить размер окна стрелками">↘</button>' : ''}</section>`;

export function startLesson(config) {
  const root = document.querySelector('#lesson');
  let layout;
  try { layout = lessonLayout(config); }
  catch (error) {
    const message = document.createElement('p');
    message.setAttribute('role', 'alert');
    message.textContent = 'Урок не загрузился. ' + error.message;
    root.replaceChildren(message);
    console.error(error);
    return;
  }
  const { modes, titles: titleList, last } = layout;
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
      <button data-open="board-menu">На доску</button><button data-open="progress-menu">Прогресс</button>
    </footer>
    <p id="lesson-status" role="status" aria-live="polite"></p>
    ${panel('theory', 'Теория')}${panel('menu', 'Все слайды', false)}${panel('progress-menu', 'Прогресс', false)}${panel('board-menu', 'На математическую доску', false)}`;

  const $ = id => root.querySelector('#' + id);
  const storage = lessonStorage(config.key);
  const state = () => storage.state;
  let mode = Object.hasOwn(modes, state().mode) ? state().mode : 'study';
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
  function variantFor(slide, lessonMode = mode) {
    return layout.variantFor(lessonMode, state().selected[slide]);
  }
  function keyFor(slide, variant = variantFor(slide)) {
    return layout.keyFor(mode, slide, variant);
  }
  function taskPages(lessonMode = mode) {
    return config.sets[0].tasks.map((_, j) => {
      const slide = j + 2;
      const variant = variantFor(slide, lessonMode);
      return { slide, task: config.sets[variant].tasks[j], key: layout.keyFor(lessonMode, slide, variant) };
    });
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
        const variants = id === 'practice' ? config.sets.map((_, j) => j) : [modes[id].set];
        for (const variant of variants) {
          const key = layout.keyFor(id, slide, variant);
          const saved = state().notebook[key]?.length || state().paper[key] || state().heights[key];
          if (id !== mode && !saved) continue;
          if (id === mode && variant !== variantFor(slide, id) && !saved) continue;
          const task = config.sets[variant].tasks[slide - 2];
          pages.push({ key, html: `<h2>${task.title}</h2><p class="task-source">${task.source} · ${modes[id].label}</p>${task.notebookStatement ?? task.statement}${task.notebook ?? ''}` });
        }
      }
    }
    for (const id of Object.keys(modes)) {
      for (const slide of [0, 1, last]) {
        const key = layout.keyFor(id, slide, variantFor(slide, id));
        if (!state().notebook[key]?.length) continue;
        pages.push({ key, html: `<h2>${config.shortTitle} · ${titleList[slide]}</h2><p class="task-source">${modes[id].label}</p>` });
      }
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

  function helpCards(items, count) {
    return items.slice(0, count).map(item => `<p class="worked-step">${item}</p>`).join('');
  }

  function renderTask(task, variant) {
    const key = keyFor(index, variant);
    const { reveal } = modes[mode];
    const control = mode === 'test';
    const locked = control && state().completed.test;
    const content = $('content');
    content.innerHTML = `<p class="task-source">${task.source}</p><h2>${task.title}</h2>
      ${reveal && config.sets.length > 1 ? `<div class="lesson-row variant-row">
        <label>Задание <select id="variant">${config.sets.map((set, j) => `<option value="${j}">${set.label}</option>`).join('')}</select></label></div>` : ''}
      <div class="task-layout"><div id="condition">${task.statement}
        <form class="lesson-row answer-row" id="answer-form">
          <label class="sr-only" for="answer">Ответ</label><input id="answer" inputmode="${task.inputMode || (task.keyboard === 'full' ? 'text' : 'decimal')}" maxlength="512" autocomplete="off" placeholder="Ответ">
          <button type="submit" class="primary" id="check">${control ? 'Сохранить ответ' : 'Проверить'}</button>
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
    if (locked) {
      input.readOnly = true;
      if (model) model.inert = true;
      $('check').hidden = true;
      $('keyboard').hidden = true;
    }
    setupKeyboard(input, $('keyboard'), $('keys'), $('math-preview'), { full: task.keyboard === 'full' });
    if (reveal && task.checkpoints?.length) mountCheckpoints($('condition'), {
      task, key, state: state(), save,
    });

    function updateFeedback() {
      const correct = state().correct[key];
      feedback.className = (control && !locked) || correct === undefined ? '' : correct ? 'good' : 'bad';
      if (locked) {
        feedback.textContent = correct === undefined ? 'Ответ пропущен.' : correct ? 'Верно!' : 'Ответ неверный.';
      } else if (!control) {
        feedback.textContent = correct === undefined ? '' : correct ? 'Верно!' : taskFeedback(task, input.value);
      }
    }
    input.oninput = () => {
      if (locked) return;
      state().answers[key] = input.value;
      delete state().correct[key];
      delete state().solved[key];
      feedback.textContent = '';
      updateFeedback();
      save();
    };
    $('answer-form').onsubmit = event => {
      event.preventDefault();
      if (locked) return;
      if (!input.value.trim()) { feedback.textContent = 'Введите ответ.'; input.focus(); return; }
      if (control) feedback.textContent = 'Ответ записан. Проверка после завершения работы.';
      else checkFinal(state(), key, task, input.value);
      save();
      updateFeedback();
    };
    updateFeedback();

    if (reveal) {
      function updateHelp() {
        const hints = state().hints[key] || 0;
        const steps = state().revealed[key] === true ? 1 : state().revealed[key] || 0;
        $('hint-text').innerHTML = helpCards(task.hints || [], hints);
        $('steps').innerHTML = helpCards(task.steps || [], steps);
        $('hint').disabled = hints >= (task.hints?.length || 0);
        $('solution').disabled = steps >= (task.steps?.length || 0);
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
        if (mode === 'study' && value === variant) return;
        finishWriting();
        mode = 'practice';
        state().selected[index] = value;
        render();
      };
      $('variant').value = variant;
      $('variant').onchange = event => choose(+event.target.value);
      $('analog').onclick = () => {
        const base = modes.study.set;
        let next = (variant + 1) % config.sets.length;
        if (next === base) next = (next + 1) % config.sets.length;
        choose(next);
      };
    }
  }

  function renderResults() {
    const content = $('content');
    const tasks = taskPages();
    const answered = tasks.filter(({ key }) => state().answers[key]?.trim()).length;
    if (mode === 'test' && !state().completed.test) {
      content.innerHTML = `<h2>Завершение контрольной</h2><p>Ответы даны на ${answered} из ${tasks.length} заданий.</p>
        <p>После проверки изменить ответы в этой контрольной будет нельзя.</p>
        <ul class="result-list">${tasks.map(({ slide, key, task }) =>
          `<li><button data-go="${slide}">${task.title}</button> ${state().answers[key]?.trim() ? 'ответ записан' : 'без ответа'}</li>`).join('')}</ul>
        <button type="button" class="primary" id="finish-test">Завершить и проверить</button>`;
      $('finish-test').onclick = () => {
        gradeTest(state(), tasks);
        render();
      };
      return;
    }

    const counts = { independent: 0, hint: 0, solution: 0 };
    let correctCount = 0;
    const list = tasks.map(({ key, task, slide }) => {
      const correct = state().correct[key];
      if (correct) {
        correctCount++;
        counts[state().solved[key] || assistance(state(), key)]++;
      }
      const result = correct ? 'верно' : correct === false ? 'к повторению'
        : state().answers[key]?.trim() ? 'ответ не проверен' : 'нет ответа';
      return `<li><button data-go="${slide}">${task.title}</button> ${result}</li>`;
    }).join('');
    content.innerHTML = `<h2>Итоги · ${modes[mode].label}</h2><p>Верно решено ${correctCount} из ${tasks.length}.</p>
      <dl class="result-counts"><div><dt>Самостоятельно</dt><dd>${counts.independent}</dd></div><div><dt>С подсказкой</dt><dd>${counts.hint}</dd></div>
      <div><dt>После открытия решения</dt><dd>${counts.solution}</dd></div></dl>
      <ul class="result-list">${list}</ul>
      ${correctCount === tasks.length
        ? '<p>Закрепи способы решения на другом комплекте в режиме «Тренировка».</p>'
        : '<p>Вернись к заданиям на повторение. Разбор доступен в режиме «Обучение».</p>'}`;
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
    const taskButton = $('board-task');
    if (taskButton) taskButton.disabled = !task;
    const content = $('content');
    if (index === 0) {
      content.innerHTML = `<div class="lesson-intro"><p class="task-source">${config.section || 'ОГЭ №1–5 · Практико-ориентированные задачи'}</p>
        <h1>${config.title}</h1>${config.intro}<button class="primary" data-go="${reveal ? 1 : 2}">Начать урок →</button>
        <p class="task-source">${config.source}</p></div>`;
    } else if (index === 1) {
      content.innerHTML = reveal ? `<h2>${config.theoryTitle}</h2>` : '<h2>Перед началом</h2><p>Введи ответы на задания. Перейди на последний слайд, чтобы завершить работу и увидеть результаты.</p><button class="primary" data-go="2">Перейти к заданиям</button>';
      if (reveal) renderTheory(content, config);
    } else if (task) {
      renderTask(task, variant);
    } else {
      renderResults();
    }
    const theoryBody = theory.querySelector('.inside');
    theoryBody.replaceChildren();
    if (reveal) renderTheory(theoryBody, config, { context: task?.context, interactive: index !== 1 });
    typeset(content);
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
    if (event.defaultPrevented || event.target.closest?.('input,textarea,select,a,[contenteditable],.lesson-panel,.interactive,.kbd') || event.altKey || event.metaKey || event.ctrlKey) return;
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
  const boardMenu = $('board-menu');
  boardMenu.querySelector('.inside').innerHTML = `<div class="lesson-row">
    <button id="board-task">Задание</button>
    <button id="board-slide">Слайд с заметками</button>
    <button id="board-notebook">Текущую страницу тетради</button>
    </div><p class="task-source">Снимок появится в разделе «Запись решения».</p>`;
  const sendToBoard = setupBoardTransfer({ status });
  function bindBoardTransfer(id, kind, image) {
    const button = $(id);
    button.onclick = async () => {
      finishWriting();
      panels.close(boardMenu);
      await sendToBoard(kind, image);
    };
  }
  bindBoardTransfer('board-task', 'task', () => notebook.capturePage(pageFor(index), false));
  bindBoardTransfer('board-slide', 'slide', () => capture($('slide')));
  bindBoardTransfer('board-notebook', 'notebook', () => notebook.capturePage());

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
      await preparePrint([image], { size: $('slide-size').value, slide: true });
    } catch {
      if (url) URL.revokeObjectURL(url);
      status('Не удалось подготовить снимок. Для печати используйте меню браузера.');
    } finally { button.disabled = false; }
  };

  render();
  if (storage.repaired) status('Восстановлена доступная часть локального прогресса.');
}
