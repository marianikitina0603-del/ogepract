const mathNamespace = 'http://www.w3.org/1998/Math/MathML';

function mathElement(name, text) {
  const element = document.createElementNS(mathNamespace, name);
  if (text) element.textContent = text;
  return element;
}

function fallbackMath(tex) {
  const math = mathElement('math');
  const tokens = tex.replaceAll('{,}', ',').match(/\\[a-z]+|\\%|\d+(?:[,.]\d+)?|[^\s]/gi) || [];
  const commands = { '\\pi': 'π', '\\Delta': 'Δ', '\\cdot': '·', '\\approx': '≈', '\\times': '×', '\\%': '%' };
  let index = 0;
  function atom() {
    const token = tokens[index++];
    if (token === '{') return sequence('}');
    if (token === '\\frac') {
      const fraction = mathElement('mfrac');
      fraction.append(atom(), atom());
      return fraction;
    }
    if (token === '\\sqrt') {
      const root = mathElement('msqrt');
      root.append(atom());
      return root;
    }
    const value = commands[token] || token || '';
    return mathElement(/^\d/.test(value) ? 'mn' : /^[a-zπΔ]$/i.test(value) ? 'mi' : 'mo', value);
  }
  function sequence(end) {
    const row = mathElement('mrow');
    while (index < tokens.length && tokens[index] !== end) {
      const base = atom();
      const op = tokens[index];
      if (op === '_' || op === '^') {
        index++;
        const nested = mathElement(op === '_' ? 'msub' : 'msup');
        nested.append(base, atom());
        row.append(nested);
      } else {
        row.append(base);
      }
    }
    if (end) index++;
    return row;
  }
  math.append(sequence());
  return math;
}

function formula(element) {
  if (window.katex) {
    window.katex.render(element.dataset.tex, element, { throwOnError: false });
  } else {
    element.replaceChildren(fallbackMath(element.dataset.tex));
  }
}

export function typeset(element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const text = walker.currentNode;
    if (text.data.includes('$') && !text.parentElement.closest('[data-tex], input, textarea, script, style')) nodes.push(text);
  }
  for (const text of nodes) {
    const matches = text.data.split(/(\$[^$\n]+\$)/g);
    if (matches.length === 1) continue;
    text.replaceWith(...matches.map((fragment, index) => {
      if (index % 2 === 0) return fragment;
      const span = document.createElement('span');
      span.dataset.tex = fragment.slice(1, -1);
      return span;
    }));
  }
  element.querySelectorAll('[data-tex]').forEach(formula);
}

window.addEventListener('lesson:math-ready', () => typeset(document.body));

export function numberAnswer(raw) {
  const value = raw.trim().replaceAll('−', '-').replaceAll(',', '.').replace(/(?<=\d)[\u00a0\u202f](?=\d{3}(?:\D|$))/g, '');
  const decimal = '[+-]?(?:[0-9]+(?:\\.[0-9]+)?|\\.[0-9]+)';
  const parts = value.match(new RegExp(`^(${decimal})(?:\\s*/\\s*(${decimal}))?$`));
  if (!parts) return NaN;
  const result = Number(parts[1]) / Number(parts[2] ?? 1);
  return Number.isFinite(result) ? result : NaN;
}

export function setupKeyboard(input, toggle, keys, preview, { full = false } = {}) {
  const digits = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', ',', '−', '/'];
  const symbols = ['+', '×', '÷', '(', ')', '[', ']', '^', '√', 'π', '|', 'x', 'y', '=', '≠', '<', '>', '≤', '≥'];
  const layout = [...digits, '⌫', ...symbols];
  let expanded = full;
  const extraButtons = [];
  let start = 0;
  let end = 0;
  const selection = () => { start = input.selectionStart; end = input.selectionEnd; };
  for (const event of ['focus', 'click', 'keyup', 'input', 'select']) input.addEventListener(event, selection);
  input.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || keys.hidden) return;
    keys.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    event.stopPropagation();
  });
  toggle.onclick = () => {
    keys.hidden = !keys.hidden;
    toggle.setAttribute('aria-expanded', String(!keys.hidden));
    if (!keys.hidden) input.focus();
  };
  for (const symbol of layout) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = symbol;
    if (symbol === '⌫') button.setAttribute('aria-label', 'Удалить символ');
    button.onpointerdown = event => event.preventDefault();
    button.onclick = () => {
      const deletion = symbol === '⌫';
      const from = deletion && start === end ? Math.max(0, start - 1) : start;
      const insert = deletion ? '' : symbol;
      if (input.value.length - (end - from) + insert.length > input.maxLength) return;
      input.focus();
      input.setRangeText(insert, from, end, 'end');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    if (symbols.includes(symbol)) extraButtons.push(button);
    keys.append(button);
  }
  const switchLayout = document.createElement('button');
  switchLayout.type = 'button';
  function updateLayout() {
    for (const button of extraButtons) button.hidden = !expanded;
    switchLayout.textContent = expanded ? 'Только цифры и дроби' : 'Все знаки';
    switchLayout.setAttribute('aria-expanded', String(expanded));
  }
  switchLayout.onclick = () => { expanded = !expanded; updateLayout(); };
  keys.append(switchLayout);
  updateLayout();
  function renderPreview() {
    const parts = input.value.match(/^\s*([−+-]?[\d.,a-z]+)\s*\/\s*([−+-]?[\d.,a-z]+)\s*$/i);
    preview.replaceChildren();
    preview.hidden = !parts;
    if (!parts) return;
    if (window.katex) {
      window.katex.render(`\\frac{${parts[1].replace('−', '-')}}{${parts[2].replace('−', '-')}}`, preview);
      return;
    }
    const namespace = 'http://www.w3.org/1998/Math/MathML';
    const math = document.createElementNS(namespace, 'math');
    const fraction = document.createElementNS(namespace, 'mfrac');
    for (const part of parts.slice(1)) {
      const token = document.createElementNS(namespace, 'mtext');
      token.textContent = part;
      fraction.append(token);
    }
    math.append(fraction);
    preview.append(math);
  }
  input.addEventListener('input', renderPreview);
  renderPreview();
}
