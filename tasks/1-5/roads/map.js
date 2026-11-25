const grid = 14;
const left = 78;
const top = 44;
const colors = ['#246e8e', '#9b5b14'];
const line = (a, b, attrs) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" ${attrs}/>`;
const format = number => number.toLocaleString('ru-RU', { maximumFractionDigits: 2 });

export function roadNetwork({ horizontal, vertical, upper, speed, numbers }) {
  const nodes = [
    [left, top + vertical * grid],
    [left, top + upper * grid],
    [left, top],
    [left + horizontal * grid, top],
  ];
  const edge = (a, b, highway) => {
    const km = Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1]) / grid;
    return { a, b, highway, km, minutes: 60 * km / speed[highway ? 0 : 1] };
  };
  const edges = [edge(0, 1, true), edge(1, 2, true), edge(2, 3, true), edge(0, 3, false), edge(1, 3, false)];
  return { nodes, edges, numbers, speed };
}

export function roadMap(network, { marked = [], labels = [], angle = false, dots = [], routes = [] } = {}) {
  const { nodes, edges, numbers } = network;
  const width = nodes[3][0] + 54;
  const height = nodes[0][1] + 35;
  const gridLines = [];
  for (let x = left - grid * 3; x <= width - 10; x += grid) gridLines.push(line([x, 16], [x, height - 7], ''));
  for (let y = top - grid * 2; y <= height - 7; y += grid) gridLines.push(line([left - grid * 3, y], [width - 9, y], ''));
  const pondX = left + (nodes[3][0] - left) * .42;
  const pondY = top + (nodes[1][1] - top) * .44;
  return `<svg viewBox="0 0 ${width} ${height}" class="road-map" role="img" aria-label="План сельской местности. Сторона каждой клетки 1 км">
    <g stroke="#d0dbcf" stroke-width="1">${gridLines.join('')}</g>
    <ellipse cx="${pondX}" cy="${pondY}" rx="27" ry="13" transform="rotate(-19 ${pondX} ${pondY})" fill="#b2dee6" stroke="#51808a"/>
    <path d="M${pondX-13} ${pondY+2} q12 -5 20 -2" fill="none" stroke="#51808a"/>
    ${edges.map((edge, i) => {
      const a = nodes[edge.a], b = nodes[edge.b];
      const primary = routes[0]?.edges.includes(i);
      const secondary = routes[1]?.edges.includes(i);
      const base = line(a, b, `class="road-${edge.highway ? 'highway' : 'path'}"`);
      const first = primary || marked.includes(i) ? line(a, b, `stroke="${primary ? colors[0] : '#c17826'}" stroke-width="6" stroke-linecap="round"`) : '';
      const second = secondary ? line(a, b, `stroke="${colors[1]}" stroke-width="${primary ? 3 : 6}" stroke-linecap="round" ${primary ? 'stroke-dasharray="5 8"' : ''}`) : '';
      return base + first + second;
    }).join('')}
    ${angle ? `<path d="M${left} ${top+15} h15 v-15" stroke="#325944" fill="none" stroke-width="2"/>` : ''}
    ${nodes.map(([x, y], j) => `<g><circle cx="${x}" cy="${y}" r="15" fill="#fffefa" stroke="#40554a" stroke-width="1.6"/>
      <text x="${x}" y="${y+7}" text-anchor="middle" class="village-number">${numbers[j]}</text>
      ${labels[j] ? `<text x="${j === 3 ? x - 23 : x + 23}" y="${y+5}" text-anchor="${j === 3 ? 'end' : 'start'}" class="village-name">${labels[j]}</text>` : ''}
    </g>`).join('')}
    ${dots.map(({ x, y, color }, i) => `<circle cx="${x}" cy="${y}" r="${i ? 7 : 11}" fill="${color}" class="road-mark"/>`).join('')}
    <g transform="translate(${width-68} ${height-39})"><rect x="-10" y="-9" width="58" height="33" rx="4" fill="#fffefa"/>
      <path d="M0 -4 V4 M0 0 h14 M14 -4 V4" stroke="#263b32"/><text x="7" y="18" text-anchor="middle">1 км</text></g>
    </svg>`;
}

export const legend = '<div class="map-legend"><span><i></i> Шоссе</span><span><i class="road-path"></i> Лесная дорога или тропинка</span><span><i class="pond"></i> Пруд</span></div>';

export function namesModel(network, names, requested) {
  return (root, { condition }) => {
    root.innerHTML = `<h3>Подпиши пункты на плане</h3><p>Выбери название рядом с цифрой. Названия появятся на карте.</p>
      <div data-map></div>${legend}<div class="road-picks" data-picks></div><button data-transfer>Перенести цифры в ответ</button>`;
    const map = root.querySelector('[data-map]');
    const options = names.map(name => `<option>${name}</option>`).join('');
    const picks = root.querySelector('[data-picks]');
    picks.innerHTML = network.numbers.map(number => `<label>Пункт ${number}<select aria-label="Пункт ${number}">
      <option value="">Выбери</option>${options}</select></label>`).join('');
    const selects = [...picks.querySelectorAll('select')];
    const transfer = root.querySelector('[data-transfer]');
    function render() {
      const labels = selects.map(select => select.value);
      map.innerHTML = roadMap(network, { labels });
      transfer.disabled = !requested.every(i => labels.includes(names[i]));
      selects.forEach(select => {
        [...select.options].forEach(option => {
          option.disabled = Boolean(option.value && option.value !== select.value && labels.includes(option.value));
        });
      });
    }
    picks.onchange = render;
    transfer.onclick = () => {
      const values = selects.map(select => select.value);
      const input = condition.querySelector('#answer');
      input.value = requested.map(i => network.numbers[values.indexOf(names[i])]).join('');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    };
    render();
  };
}

export function segmentModel(network, triangle = false) {
  return (root, { reveal, onReveal }) => {
    const segments = triangle ? network.edges : network.edges.slice(0, 3);
    root.innerHTML = `<h3>${triangle ? 'Построй прямоугольный треугольник' : 'Собери путь по шоссе'}</h3>
      <p>${triangle ? 'Отметь прямой путь и два катета по шоссе. Найди длины катетов по клеткам.' : 'Отметь участки маршрута и посчитай клетки вдоль шоссе.'}</p>
      <div data-map></div>${legend}<div data-edges class="lesson-row"></div>
      ${reveal ? '<button data-measure>Измерить отмеченные участки шоссе</button><output></output>' : ''}`;
    const selected = new Set();
    const strip = root.querySelector('[data-edges]');
    function render() {
      root.querySelector('[data-map]').innerHTML = roadMap(network, { marked: [...selected], angle: triangle });
    }
    segments.forEach(({ a, b }, i) => {
      const button = document.createElement('button');
      button.textContent = `${network.numbers[a]} → ${network.numbers[b]}`;
      button.setAttribute('aria-pressed', 'false');
      button.onclick = () => {
        if (selected.has(i)) selected.delete(i); else selected.add(i);
        button.setAttribute('aria-pressed', selected.has(i));
        if (reveal) root.querySelector('output').textContent = '';
        render();
      };
      strip.append(button);
    });
    if (reveal) root.querySelector('[data-measure]').onclick = () => {
      const chosen = [...selected].map(i => segments[i]).filter(edge => edge.highway);
      if (!chosen.length) {
        root.querySelector('output').textContent = 'Сначала отметь участки шоссе.';
        return;
      }
      onReveal();
      root.querySelector('output').textContent = chosen.map(({ a, b, km }) =>
        `${network.numbers[a]} → ${network.numbers[b]} · ${km} км`).join(', ');
    };
    render();
  };
}

const routes = [
  { name: 'Только шоссе', edges: [0, 1, 2] },
  { name: 'Прямая лесная дорога', edges: [3] },
  { name: 'Через пруд', edges: [0, 4] },
];

function position(network, path, elapsed, color) {
  let distance = 0, minutes = 0;
  let finish = network.nodes[0];
  for (const i of path.edges) {
    const e = network.edges[i], a = network.nodes[e.a], b = network.nodes[e.b];
    const dt = Math.max(0, Math.min(elapsed - minutes, e.minutes));
    const progress = dt / e.minutes;
    distance += e.km * progress;
    minutes += dt;
    finish = [a[0] + (b[0] - a[0]) * progress, a[1] + (b[1] - a[1]) * progress];
    if (dt < e.minutes) break;
  }
  return { x: finish[0], y: finish[1], color, distance, minutes };
}

export function rideModel(network) {
  return (root, { reveal, onReveal }) => {
    const options = routes.map((route, i) => `<option value="${i}">${route.name}</option>`).join('');
    root.innerHTML = `<h3>Сравни маршруты</h3><p>Скорость на шоссе ${network.speed[0]} км/ч, на лесных путях ${network.speed[1]} км/ч.</p>
      <div class="lesson-row route-controls"><label>Первый маршрут <select data-first>${options}</select></label>
      <label>Второй маршрут <select data-second><option value="">Один маршрут</option>${options}</select></label></div>
      <div data-map></div>${legend}
      ${reveal ? '<div class="lesson-row"><button data-start>Поехали</button><button data-reset>На старт</button></div><div class="route-readouts" data-readouts></div>' : ''}`;
    const first = root.querySelector('[data-first]');
    const second = root.querySelector('[data-second]');
    first.value = '1';
    let token = 0;
    const chosen = () => [routes[+first.value], second.value === '' ? null : routes[+second.value]].filter(Boolean);
    function render(elapsed) {
      const picked = chosen();
      const dots = picked.map((path, i) => position(network, path, elapsed, colors[i]));
      root.querySelector('[data-map]').innerHTML = roadMap(network, {
        routes: picked, dots,
      });
      if (reveal) root.querySelector('[data-readouts]').innerHTML = dots.map(({ distance, minutes }, i) =>
        `<output><strong>${picked[i].name}</strong><br>${format(distance)} км · ${format(minutes)} мин</output>`).join('');
    }
    function reset() { token++; render(0); }
    first.onchange = second.onchange = reset;
    if (reveal) {
      root.querySelector('[data-reset]').onclick = reset;
      root.querySelector('[data-start]').onclick = () => {
        onReveal();
        const longest = Math.max(...chosen().map(route => route.edges.reduce((sum, i) => sum + network.edges[i].minutes, 0)));
        const now = performance.now(), run = ++token;
        function frame(time) {
          if (run !== token || !root.isConnected) return;
          const completion = Math.min(1, (time - now) / 4900);
          render(longest * completion);
          if (completion < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      };
    }
    reset();
  };
}

export function shoppingModel(prices, products, shops) {
  return (root, { reveal, onReveal, condition }) => {
    const rows = [...condition.querySelectorAll('.shopping-table tbody tr')];
    root.innerHTML = `<h3>Собери корзину</h3><p>Отметь продукты из условия. Выбранные строки выделятся в таблице цен.</p>
      <div data-rows class="lesson-row"></div>
      ${reveal ? `<div data-quantities class="basket-quantities"></div><div class="lesson-row route-controls"><label>Магазин <select data-shop>
      ${shops.map(shop => `<option>${shop}</option>`).join('')}</select></label><button data-cost>Посчитать корзину</button></div><output aria-live="polite"></output>` : ''}`;
    const selected = new Set();
    const quantities = root.querySelector('[data-quantities]');
    const output = root.querySelector('output');
    const counts = new Map();
    function updateBasket() {
      if (!reveal) return;
      quantities.replaceChildren();
      for (const i of selected) {
        const field = document.createElement('label');
        field.textContent = products[i] + ' ';
        const input = document.createElement('input');
        input.type = 'number';
        input.min = 1;
        input.max = 100;
        input.value = counts.get(i) || 1;
        input.oninput = () => { counts.set(i, input.value); output.textContent = ''; };
        field.append(input);
        quantities.append(field);
      }
      output.textContent = '';
    }
    rows.forEach((row, i) => {
      const button = document.createElement('button');
      button.textContent = products[i];
      button.setAttribute('aria-pressed', 'false');
      button.onclick = () => {
        if (selected.has(i)) selected.delete(i); else selected.add(i);
        row.classList.toggle('picked', selected.has(i));
        button.setAttribute('aria-pressed', selected.has(i));
        updateBasket();
      };
      root.querySelector('[data-rows]').append(button);
    });
    if (!reveal) return;
    const shop = root.querySelector('[data-shop]');
    shop.onchange = () => { output.textContent = ''; };
    root.querySelector('[data-cost]').onclick = () => {
      if (!selected.size) { output.textContent = 'Сначала выбери товары.'; return; }
      const invalid = [...quantities.querySelectorAll('input')].find(input => !input.value || !input.validity.valid);
      if (invalid) { output.textContent = 'Укажи целое количество от 1 до 100.'; invalid.focus(); return; }
      const sum = [...selected].reduce((total, i) => total + prices[i][shop.selectedIndex] * Number(counts.get(i) || 1), 0);
      onReveal();
      output.textContent = `${shop.value} · ${format(sum)} руб.`;
    };
  };
}
