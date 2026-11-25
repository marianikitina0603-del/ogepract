export function drawStrokes(canvas, strokes) {
  const { width, height } = canvas;
  const context = canvas.getContext('2d');
  const ratio = width / (canvas.clientWidth || width);
  context.clearRect(0, 0, width, height);
  for (const stroke of strokes) {
    context.globalCompositeOperation = stroke.mode === 'erase' ? 'destination-out' : 'source-over';
    context.globalAlpha = stroke.mode === 'marker' ? 0.27 : 1;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = stroke.width * ratio;
    context.strokeStyle = stroke.color;
    context.fillStyle = stroke.color;
    context.beginPath();
    const [[x, y], ...rest] = stroke.points;
    if (!rest.length) {
      context.arc(x * width, y * height, context.lineWidth / 2, 0, 2 * Math.PI);
      context.fill();
      continue;
    }
    context.moveTo(x * width, y * height);
    for (const [px, py] of rest) context.lineTo(px * width, py * height);
    context.stroke();
  }
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
}

export function createInk(canvas, toolbar, { strokes, key, save, onChange = () => {} }) {
  let owner = null;
  let active = null;
  let mode = 'pen';
  const redo = new Map();
  const input = name => toolbar.querySelector(`[data-ink-${name}]`);
  const redraw = () => drawStrokes(canvas, strokes());
  function fit() {
    if (!canvas.clientWidth || !canvas.clientHeight) return;
    // Limit the bitmap size of long notebook pages on high-density displays.
    const ratio = Math.min(devicePixelRatio, 4096 / Math.max(canvas.clientWidth, canvas.clientHeight));
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    redraw();
  }
  function syncButtons() {
    input('undo').disabled = !strokes().length;
    input('redo').disabled = !redo.get(key())?.length;
    toolbar.querySelectorAll('[data-ink-mode]').forEach(button =>
      button.setAttribute('aria-pressed', button.dataset.inkMode === mode));
    canvas.style.touchAction = mode === 'scroll' ? 'pan-x pan-y' : 'none';
    canvas.dataset.mode = mode;
  }
  function change() {
    syncButtons();
    save();
    fit();
    onChange();
  }
  function point(event) {
    const bounds = canvas.getBoundingClientRect();
    return [(event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height];
  }
  canvas.addEventListener('pointerdown', event => {
    if (mode === 'scroll' || owner !== null || event.button !== 0) return;
    event.preventDefault();
    owner = event.pointerId;
    canvas.setPointerCapture(owner);
    const width = +(input(mode === 'erase' ? 'eraser' : 'width').value);
    active = { mode, color: input('color').value, width, points: [point(event)] };
    strokes().push(active);
    redo.delete(key());
    redraw();
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== owner || !active) return;
    for (const sample of event.getCoalescedEvents?.() || []) active.points.push(point(sample));
    active.points.push(point(event));
    redraw();
  });
  function stop(event) {
    if (event && event.pointerId !== owner) return;
    if (!active) return;
    active = null;
    const pointer = owner;
    owner = null;
    if (canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
    change();
  }
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(name, stop);
  }
  toolbar.querySelectorAll('[data-ink-mode]').forEach(button => {
    button.addEventListener('click', () => {
      mode = button.dataset.inkMode;
      syncButtons();
    });
  });
  input('undo').onclick = () => {
    const previous = strokes().pop();
    if (!previous) return;
    if (!redo.has(key())) redo.set(key(), []);
    redo.get(key()).push(previous);
    change();
  };
  input('redo').onclick = () => {
    const next = redo.get(key())?.pop();
    if (!next) return;
    strokes().push(next);
    change();
  };
  input('clear').onclick = () => {
    if (!strokes().length || !confirm('Очистить записи на этой странице?')) return;
    redo.set(key(), strokes().splice(0).reverse());
    change();
  };
  new ResizeObserver(fit).observe(canvas);
  return { fit, stop, refresh() { syncButtons(); fit(); }, clearHistory: () => redo.clear() };
}

export function inkToolbar({ scroll = false } = {}) {
  return `<button type="button" data-ink-mode="pen">Перо</button>
    <button type="button" data-ink-mode="marker">Маркер</button>
    <button type="button" data-ink-mode="erase">Ластик</button>
    ${scroll ? '<button type="button" data-ink-mode="scroll">Прокрутка</button>' : ''}
    <label>Цвет <input data-ink-color type="color" value="#245c9b"></label>
    <label>Штрих <input data-ink-width type="range" min="1" max="24" value="3"></label>
    <label>Ластик <input data-ink-eraser type="range" min="6" max="60" value="24"></label>
    <button type="button" data-ink-undo aria-label="Отменить штрих">↶</button>
    <button type="button" data-ink-redo aria-label="Вернуть штрих">↷</button>
    <button type="button" data-ink-clear>Очистить</button>`;
}
