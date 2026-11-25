export const fmt = (value, digits = 3) => Number(value.toFixed(digits)).toLocaleString('ru-RU', { maximumFractionDigits: digits });
export const mark = ([b, p, n]) => `${b}/${p} R${n}`;
export function dimensions([b, p, n]) {
  const h = b * p / 100;
  const disc = 25.4 * n;
  const diameter = disc + 2 * h;
  return { b, p, n, h, disc, diameter, radius: diameter / 2, roll: Math.PI * diameter };
}

const gold = '#9c6619';
const blue = '#1a7196';
const svg = (height, inner, label, extra = '') =>
  `<svg class="tire-model ${extra}" viewBox="0 0 540 ${height}" role="img" aria-label="${label}">${inner}</svg>`;

function tyreArt(x, y, radius, rim, rotation = 0) {
  const tread = Array.from({ length: 36 }, (_, j) =>
    `<path transform="rotate(${j * 10})" d="M0 ${-radius * .99} l${radius * .04} ${radius * .072}" stroke="#6b7376" stroke-width="${radius * .018}"/>`).join('');
  const spokes = Array.from({ length: 8 }, (_, j) =>
    `<path transform="rotate(${j * 45})" d="M${-.1 * rim} 0 L${-.15 * rim} ${-.85 * rim} L${.04 * rim} ${-.87 * rim} L${.12 * rim} 0 Z" fill="#e4e9e5" stroke="#727e80"/>`).join('');
  return `<g transform="translate(${x} ${y}) rotate(${rotation})">
    <circle r="${radius}" fill="#262c30"/>
    <circle r="${radius * .93}" fill="none" stroke="#454e51" stroke-width="${radius * .035}"/>
    ${tread}<circle r="${rim}" fill="#879699" stroke="#d1d9d8" stroke-width="1.5"/>
    <circle r="${rim * .85}" fill="#485459"/>${spokes}
    <circle r="${rim * .23}" fill="#a0adae" stroke="#49575b"/><circle r="${rim * .095}" fill="#3b474b"/>
    <path d="M0 ${-radius * .82} v${radius * .09}" stroke="#f2c46f" stroke-width="3" stroke-linecap="round"/>
  </g>`;
}

function face(tire, x, y, scale, rotation) {
  const d = dimensions(tire);
  return tyreArt(x, y, d.radius * scale, d.disc * scale / 2, rotation);
}

function label(x, y, text) {
  return `<g><rect class="dim-plate" x="${x - 14}" y="${y - 13}" width="28" height="26" rx="5"/>
    <text class="dimension-label" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central">${text}</text></g>`;
}

function vertical(x, y1, y2, from, text, labelX = x + 18) {
  return `<path class="ticks" d="M${from} ${y1} H${x + 4} M${from} ${y2} H${x + 4} M${x} ${y1} V${y2}"/>
    ${label(labelX, (y1 + y2) / 2, text)}`;
}

function horizontal(x1, x2, y, from, text) {
  return `<path class="ticks" d="M${x1} ${from} V${y + 4} M${x2} ${from} V${y + 4} M${x1} ${y} H${x2}"/>
    ${label((x1 + x2) / 2, y + 18, text)}`;
}

export function dimensionDiagram(tire, show = ['H', 'B', 'd', 'D']) {
  const { b, h, disc, radius } = dimensions(tire);
  const scale = .285, x = 135, sectionX = 435, y = 171;
  const r = radius * scale;
  const rim = disc * scale / 2;
  const side = h * scale;
  const width = b * scale;
  const left = sectionX - width / 2;
  const rounding = Math.min(9, side / 3);
  const tyreSection = `<rect x="${left}" y="${y-r}" width="${width}" height="${side}" rx="${rounding}" fill="#262c30"/>
    <rect x="${left}" y="${y+rim}" width="${width}" height="${side}" rx="${rounding}" fill="#262c30"/>
    <rect x="${left+width*.08}" y="${y-rim}" width="${width*.84}" height="${rim*2}" rx="3" fill="#a0adae" stroke="#546764"/>
    <path d="M${left} ${y} h${width}" stroke="#5b6d68" stroke-dasharray="4 3"/>`;
  return svg(344, `<text x="${x}" y="23" text-anchor="middle" class="wheel-caption">Вид спереди</text>
    <text x="${sectionX}" y="23" text-anchor="middle" class="wheel-caption">Поперечный разрез</text>
    ${face(tire, x, y, scale)}${tyreSection}
    ${show.includes('D') ? vertical(331, y - r, y + r, x, 'D') : ''}
    ${show.includes('d') ? vertical(284, y - rim, y + rim, x, 'd') : ''}
    ${show.includes('H') ? vertical(258, y - r, y - rim, x, 'H') : ''}
    ${show.includes('B') ? horizontal(left, left + width, 308, y + r, 'B') : ''}`,
    'Вид колеса спереди и поперечный разрез с размерными линиями', 'dimension-diagram');
}

export function tableModel(columns, rows) {
  return (root, { condition }) => {
    root.innerHTML = `<h3>Исследуй таблицу</h3>
      <p>Выбери диаметр диска и отмечай допустимые сочетания в таблице. Отмеченные ширины появятся ниже.</p>
      <div class="lesson-row" data-columns></div><output aria-live="polite"></output>`;
    const table = condition.querySelector('table');
    const cells = [...table.rows].map(row => [...row.cells]);
    const output = root.querySelector('output');
    let column = -1;
    const picked = new Set();
    const buttons = columns.map((value, index) => {
      const button = document.createElement('button');
      button.textContent = value + '″';
      button.setAttribute('aria-pressed', 'false');
      button.onclick = () => {
        column = index;
        picked.clear();
        update();
      };
      root.querySelector('[data-columns]').append(button);
      return button;
    });
    const choices = rows.map((row, i) => columns.map((_, j) => {
      if (!row[j + 1]) return null;
      const cell = cells[i + 1][j + 1];
      const button = document.createElement('button');
      button.textContent = row[j + 1];
      button.setAttribute('aria-label', `${row[j + 1]}, диск ${columns[j]} дюймов`);
      button.onclick = () => {
        if (j !== column) return;
        if (picked.has(i)) picked.delete(i);
        else picked.add(i);
        update();
      };
      cell.replaceChildren(button);
      return button;
    }));
    function update() {
      buttons.forEach((button, j) => button.setAttribute('aria-pressed', j === column));
      cells.forEach((row, i) => row.forEach((cell, j) => {
        cell.classList.toggle('table-active', j > 0 && j - 1 === column);
        cell.classList.toggle('table-picked', i > 0 && j > 0 && j - 1 === column && picked.has(i - 1));
      }));
      choices.forEach((row, i) => row.forEach((button, j) => {
        if (!button) return;
        button.disabled = j !== column;
        button.setAttribute('aria-pressed', j === column && picked.has(i));
      }));
      output.textContent = picked.size
        ? 'Отмеченные ширины: ' + rows.filter((_, i) => picked.has(i)).map(row => row[0]).join(', ') + ' мм.'
        : 'Ширины пока не отмечены.';
    }
    update();
  };
}

export function profileModel(tire) {
  return (root, { reveal, onReveal }) => {
    const [b, p, n] = tire;
    root.innerHTML = `<h3>Как меняется колесо</h3><p>Меняй ширину и профиль при фиксированном диске ${n}″. Масштаб двух видов совпадает.</p>
      <div class="lesson-row tire-controls"><label>Ширина B, мм <strong data-b></strong><input aria-label="Ширина B" type="range" min="125" max="295" step="5" value="${b}"></label>
      <label>Профиль p, % <strong data-p></strong><input aria-label="Профиль p" type="range" min="30" max="85" step="5" value="${p}"></label></div>
      <div data-visual></div><div class="lesson-row"><button data-reset>Исходная маркировка</button>
      ${reveal ? '<button data-measure aria-pressed="false">Показать расчёт</button>' : ''}</div><output aria-live="polite"></output>`;
    const [width, profile] = root.querySelectorAll('input');
    const output = root.querySelector('output');
    const measure = root.querySelector('[data-measure]');
    let shown = false;
    function render() {
      const current = [+width.value, +profile.value, n];
      root.querySelector('[data-b]').textContent = current[0];
      root.querySelector('[data-p]').textContent = current[1];
      root.querySelector('[data-visual]').innerHTML = dimensionDiagram(current);
      output.textContent = shown ? `H = ${current[0]} × ${current[1]} ÷ 100 = ${fmt(dimensions(current).h)} мм.` : '';
    }
    root.querySelector('[data-reset]').onclick = () => { width.value = b; profile.value = p; render(); };
    if (measure) measure.onclick = () => {
      shown = !shown;
      if (shown) onReveal();
      measure.setAttribute('aria-pressed', shown);
      measure.textContent = shown ? 'Скрыть расчёт' : 'Показать расчёт';
      render();
    };
    width.oninput = profile.oninput = render;
    render();
  };
}

export function diameterModel(tire) {
  return (root, { reveal, onReveal }) => {
    const { h, disc, diameter, radius } = dimensions(tire);
    const scale = .3, x = 183, y = 160;
    const segments = [
      { text: 'Верхняя боковина', symbol: 'H', from: y-radius*scale, to: y-disc*scale/2 },
      { text: 'Диск', symbol: 'd', from: y-disc*scale/2, to: y+disc*scale/2 },
      { text: 'Нижняя боковина', symbol: 'H', from: y+disc*scale/2, to: y+radius*scale },
    ];
    root.innerHTML = `<h3>Собери диаметр</h3><p>Отметь части, через которые проходит диаметр колеса.</p>
      <div data-visual></div><div class="lesson-row" data-parts></div>
      ${reveal ? '<button data-measure>Показать расчёт</button><output aria-live="polite"></output>' : ''}`;
    const selected = new Set();
    const buttons = root.querySelector('[data-parts]');
    const output = root.querySelector('output');
    function render() {
      root.querySelector('[data-visual]').innerHTML = svg(320, face(tire, x, y, scale) +
        segments.map((s, j) => `<g class="${selected.has(j) ? '' : 'faded'}">${vertical(348, s.from, s.to, x, s.symbol)}</g>`).join('')
        + vertical(440, y - radius * scale, y + radius * scale, 390, 'D'), 'Три части диаметра колеса');
      if (output) output.textContent = '';
    }
    segments.forEach((s, j) => {
      const button = document.createElement('button');
      button.textContent = s.text;
      button.setAttribute('aria-pressed', 'false');
      button.onclick = () => {
        if (selected.has(j)) selected.delete(j); else selected.add(j);
        button.setAttribute('aria-pressed', selected.has(j));
        render();
      };
      buttons.append(button);
    });
    if (reveal) root.querySelector('[data-measure]').onclick = () => {
      onReveal();
      output.textContent = `D = ${fmt(h)} + ${fmt(disc)} + ${fmt(h)} = ${fmt(diameter)} мм.`;
    };
    render();
  };
}

export function compareModel(before, after, radiusTask) {
  return (root, { reveal, onReveal }) => {
    const a = dimensions(before);
    const b = dimensions(after);
    const scale = .28, y = 153;
    const difference = Math.abs(b.diameter - a.diameter);
    const radiusGap = difference / 2;
    const magnification = Math.min(40, Math.floor(85 / (radiusGap * scale)));
    root.innerHTML = `<h3>Сравни ${radiusTask ? 'радиусы' : 'диаметры'}</h3><p>Совмести центры колёс. Оба вида построены в одном масштабе.</p>
      <div class="lesson-row"><button data-toggle aria-pressed="false">Наложить контуры</button>
        ${reveal ? '<button data-measure>Показать вычисление</button>' : ''}</div>
      <div data-visual></div><div data-zoom hidden></div><output></output>`;
    let over = false;
    const toggle = root.querySelector('[data-toggle]');
    function render() {
      const outline = (x, r, color, dash = '') => `<circle cx="${x}" cy="${y}" r="${r * scale}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="${dash}"/>`;
      const caption = (x, val, color) => `<text class="wheel-caption" x="${x}" y="297" text-anchor="middle"><tspan fill="${color}">●</tspan> ${mark(val)}</text>`;
      const left = over ? 270 : 135, right = over ? 270 : 405;
      const wheels = over ? face(a.radius > b.radius ? before : after, 270, y, scale)
        : face(before, left, y, scale) + face(after, right, y, scale);
      root.querySelector('[data-visual]').innerHTML = svg(310, wheels
        + outline(left, a.radius, blue, '5 3') + outline(right, b.radius, gold)
        + caption(135, before, blue) + caption(405, after, gold), 'Сравнение размеров колёс');
      const zoom = root.querySelector('[data-zoom]');
      zoom.hidden = !over;
      const gap = radiusGap * scale * magnification;
      const aY = a.radius < b.radius ? 28 + gap : 28;
      const bY = b.radius < a.radius ? 28 + gap : 28;
      zoom.innerHTML = `<div class="tire-detail"><strong>Верхние точки контуров · увеличение ×${magnification}</strong>
        <p>${radiusTask ? 'Промежуток между линиями равен разности радиусов.' : 'Разность диаметров вдвое больше этого промежутка.'}</p></div>`
        + svg(128, `<path d="M35 ${aY} H490" stroke="${blue}" stroke-dasharray="5 3" stroke-width="3"/>
          <path d="M35 ${bY} H490" stroke="${gold}" stroke-width="3"/>${vertical(500, 28, 28 + gap, 492, 'Δ', 518)}`, 'Увеличенный промежуток между контурами');
    }
    toggle.onclick = () => {
      over = !over;
      toggle.setAttribute('aria-pressed', over);
      toggle.textContent = over ? 'Разместить рядом' : 'Наложить контуры';
      render();
    };
    if (reveal) root.querySelector('[data-measure]').onclick = () => {
      onReveal();
      const first = radiusTask ? a.radius : a.diameter;
      const second = radiusTask ? b.radius : b.diameter;
      root.querySelector('output').textContent = `${fmt(Math.max(first, second))} − ${fmt(Math.min(first, second))} = ${fmt(Math.abs(first-second))} мм.`;
    };
    render();
  };
}

export function rollingModel(before, after) {
  return (root, { reveal, onReveal }) => {
    const a = dimensions(before);
    const b = dimensions(after);
    const scale = .15, origin = 72;
    const factor = Math.min(20, Math.floor(220 / (Math.abs(b.roll - a.roll) * scale)));
    root.innerHTML = `<h3>Путь за один оборот</h3><p>Каждое колесо делает полный оборот без проскальзывания. Счётчики измеряют путь от одной линии старта.</p>
      <div class="lesson-row"><button data-roll>Запустить оборот</button><button data-reset>Сбросить</button>
      ${reveal ? '<button data-measure>Показать вычисление</button>' : ''}</div>
      <div data-visual></div><div data-finish hidden></div><output></output>`;
    const visual = root.querySelector('[data-visual]');
    const finish = root.querySelector('[data-finish]');
    let animation = 0;
    function draw(progress) {
      const lane = (tire, d, ground, color) => {
        const x = origin + d.roll * scale * progress;
        return `<text class="lane-caption" x="12" y="${ground - 127}"><tspan fill="${color}">●</tspan> ${mark(tire)} · ${fmt(d.roll * progress, 1)} мм</text>
          <path d="M${origin} ${ground} H520" stroke="#a0b7a6"/>
          <path d="M${origin} ${ground} H${x}" stroke="${color}" stroke-width="3"/>
          <path d="M${origin} ${ground-12} V${ground+7} M${x} ${ground} V${ground+10}" stroke="${color}" stroke-width="2"/>
          ${face(tire, x, ground - d.radius*scale, scale, progress * 360)}`;
      };
      visual.innerHTML = svg(304, lane(before, a, 150, blue) + lane(after, b, 293, gold), 'Качение двух колёс и счётчики расстояния');
      finish.hidden = progress < 1;
      if (progress < 1) return;
      const gap = Math.abs(a.roll - b.roll) * scale * factor;
      const x1 = 155 + (a.roll > b.roll ? gap : 0);
      const x2 = 155 + (b.roll > a.roll ? gap : 0);
      finish.innerHTML = `<div class="tire-detail"><strong>Участок финиша · увеличение ×${factor}</strong></div>`
        + svg(116, `<path d="M30 34 H${x1}" stroke="${blue}" stroke-width="4"/>
          <path d="M30 62 H${x2}" stroke="${gold}" stroke-width="4"/>
          <path d="M${x1} 20 V97 M${x2} 20 V97" stroke="#52645c" stroke-dasharray="4 3"/>
          ${horizontal(Math.min(x1, x2), Math.max(x1, x2), 83, 72, 'Δ')}`, 'Сравнение линий финиша');
    }
    root.querySelector('[data-roll]').onclick = () => {
      const token = ++animation;
      const start = performance.now();
      function tick(now) {
        if (token !== animation || !root.isConnected) return;
        const progress = Math.min(1, (now - start) / 2900);
        draw(progress);
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    };
    root.querySelector('[data-reset]').onclick = () => { animation++; draw(0); root.querySelector('output').textContent = ''; };
    if (reveal) root.querySelector('[data-measure]').onclick = () => {
      onReveal();
      root.querySelector('output').textContent = `Пути за оборот: ${fmt(a.roll)} мм и ${fmt(b.roll)} мм. Разность: ${fmt(Math.abs(a.roll-b.roll))} мм.`;
    };
    draw(0);
  };
}
