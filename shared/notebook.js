import { createInk, drawStrokes, inkToolbar } from './annotation.js';
import { capture, download, pngArchive, preparePrint } from './export.js';
import { typeset } from './math-keyboard.js';

const defaultPaper = { kind: 'grid', cell: 20, zoom: 100 };
const defaultHeight = 420;

function stylePaper(paper, config) {
  paper.dataset.paper = config.kind;
  paper.style.setProperty('--cell', config.cell + 'px');
}

export function setupNotebook(panel, { current, pages, state, save, split, status, prefix }) {
  const inside = panel.querySelector('.inside');
  inside.innerHTML = `<div class="lesson-row" id="book-tools">${inkToolbar({ scroll: true })}</div>
    <div class="lesson-row book-options">
      <label>Бумага <select id="paper-kind"><option value="grid">Клетка</option><option value="lined">Линейка</option><option value="plain">Чистая</option></select></label>
      <label>Клетка <select id="paper-cell"><option>14</option><option>20</option><option>28</option></select></label>
      <label>Масштаб <select id="paper-zoom"><option value="75">75%</option><option value="100">100%</option><option value="125">125%</option><option value="150">150%</option></select></label>
      <button id="add-space">+ Место</button><button id="split-book" aria-pressed="false">Рядом с задачей</button>
    </div>
    <div class="book-viewport"><article id="paper" class="lesson-paper"><div id="book-question"></div><canvas id="book-canvas" aria-label="Поле для решения"></canvas></article></div>
    <div class="lesson-row book-export">
      <label>Сохранить <select id="book-scope"><option value="page">Эту страницу</option><option value="all">Всю тетрадь</option></select></label>
      <button id="book-png">PNG</button><label>Формат <select id="book-size"><option>A4</option><option>A5</option></select></label><button id="book-print">Печать / PDF</button>
    </div>`;
  const get = id => inside.querySelector('#' + id);
  const paper = get('paper');
  const question = get('book-question');
  const canvas = get('book-canvas');
  const strokes = (key = current().key) => (state().notebook[key] ??= []);
  const layout = key => state().paper[key] || defaultPaper;
  const height = key => state().heights[key] || defaultHeight;
  const drawing = createInk(canvas, get('book-tools'), { strokes, key: () => current().key, save });
  const settings = { kind: get('paper-kind'), cell: get('paper-cell'), zoom: get('paper-zoom') };

  function updatePaper() {
    const { key } = current();
    const config = layout(key);
    stylePaper(paper, config);
    for (const [name, select] of Object.entries(settings)) select.value = config[name];
    settings.cell.disabled = config.kind === 'plain';
    paper.style.width = config.zoom + '%';
    canvas.style.height = height(key) * config.zoom / 100 + 'px';
    get('add-space').disabled = height(key) >= 4800;
    drawing.refresh();
  }
  inside.querySelector('.book-options').addEventListener('change', () => {
    state().paper[current().key] = {
      kind: settings.kind.value, cell: +settings.cell.value, zoom: +settings.zoom.value,
    };
    save();
    updatePaper();
  });
  get('add-space').onclick = () => {
    const { key } = current();
    const before = height(key);
    const after = Math.min(4800, before + 240);
    for (const stroke of strokes(key)) {
      for (const point of stroke.points) point[1] *= before / after;
    }
    state().heights[key] = after;
    save();
    updatePaper();
  };
  get('split-book').onclick = () => split(!panel.classList.contains('docked'));

  function exportPage(page) {
    const article = document.createElement('article');
    article.className = 'lesson-paper notebook-export-page';
    stylePaper(article, layout(page.key));
    const statement = document.createElement('div');
    statement.innerHTML = page.html;
    typeset(statement);
    article.append(statement);
    const bitmap = document.createElement('canvas');
    bitmap.width = 760;
    bitmap.height = height(page.key);
    drawStrokes(bitmap, state().notebook[page.key] || []);
    const image = document.createElement('img');
    image.alt = 'Решение от руки';
    image.src = bitmap.toDataURL();
    article.append(image);
    return article;
  }

  const selection = () => get('book-scope').value === 'page' ? [current()] : pages();
  get('book-png').onclick = async () => {
    const button = get('book-png');
    const selected = selection();
    const stage = document.createElement('div');
    stage.className = 'capture-stage';
    document.body.append(stage);
    button.disabled = true;
    try {
      const files = [];
      for (const page of selected) {
        const node = exportPage(page);
        stage.replaceChildren(node);
        await node.querySelector('img').decode();
        files.push({ name: `${prefix}-${page.key}.png`, blob: await capture(node) });
      }
      if (files.length === 1) download(files[0].blob, files[0].name);
      else download(await pngArchive(files), prefix + '-notebook-png.zip');
      status('Тетрадь сохранена.');
    } catch {
      status('Не удалось сохранить PNG.');
    } finally {
      stage.remove();
      button.disabled = false;
    }
  };
  get('book-print').onclick = () => {
    const size = get('book-size').value;
    preparePrint(selection().map(page => {
      const article = exportPage(page);
      const image = article.querySelector('img');
      const heightLimit = size === 'A5' ? 740 : 1070;
      if (image.naturalHeight < heightLimit && height(page.key) <= heightLimit) return article;
      // Print a long solution in slices so no part is clipped at a page boundary.
      const bitmap = document.createElement('canvas');
      bitmap.width = 760;
      bitmap.height = height(page.key);
      drawStrokes(bitmap, state().notebook[page.key] || []);
      image.remove();
      for (let top = 0; top < bitmap.height; top += heightLimit) {
        const slice = document.createElement('canvas');
        slice.width = bitmap.width;
        slice.height = Math.min(heightLimit, bitmap.height - top);
        slice.getContext('2d').drawImage(bitmap, 0, -top);
        const piece = document.createElement('img');
        piece.alt = 'Решение от руки';
        piece.src = slice.toDataURL();
        article.append(piece);
      }
      return article;
    }), { size });
  };
  return {
    stop: drawing.stop,
    clearHistory: drawing.clearHistory,
    refresh() {
      question.innerHTML = current().html;
      typeset(question);
      updatePaper();
    },
  };
}
