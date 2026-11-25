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
  let frame = 0;
  const history = new Map();
  const input = name => toolbar.querySelector(`[data-ink-${name}]`);
  const entry = () => {
    const id = key();
    if (!history.has(id)) history.set(id, { undo: [], redo: [] });
    return history.get(id);
  };
  function redraw() {
    cancelAnimationFrame(frame);
    frame = 0;
    drawStrokes(canvas, strokes());
  }
  function queueDraw() {
    if (!frame) frame = requestAnimationFrame(redraw);
  }
  function fit() {
    if (!canvas.clientWidth || !canvas.clientHeight) return;
    const ratio = Math.min(devicePixelRatio, 4096 / Math.max(canvas.clientWidth, canvas.clientHeight));
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    redraw();
  }
  function syncButtons() {
    const edits = entry();
    input('undo').disabled = !edits.undo.length && !strokes().length;
    input('redo').disabled = !edits.redo.length;
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
  function remember(edit) {
    const edits = entry();
    edits.redo.length = 0;
    edits.undo.push(edit);
    if (edits.undo.length > 60) edits.undo.shift();
  }
  function point(event, bounds) {
    return [(event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height];
  }
  function sample(event) {
    if (!active || event.pointerId !== owner) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const events = event.getCoalescedEvents?.() || [];
    for (const sampleEvent of [...events, event]) {
      const next = point(sampleEvent, bounds);
      const previous = active.points.at(-1);
      if (active.points.length < 100000 && (previous[0] !== next[0] || previous[1] !== next[1])) active.points.push(next);
    }
  }
  canvas.addEventListener('pointerdown', event => {
    if (mode === 'scroll' || owner !== null || event.button !== 0) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    event.preventDefault();
    owner = event.pointerId;
    canvas.setPointerCapture(owner);
    const width = +(input(mode === 'erase' ? 'eraser' : 'width').value);
    active = { mode, color: input('color').value, width, points: [point(event, bounds)] };
    strokes().push(active);
    queueDraw();
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== owner || !active) return;
    sample(event);
    queueDraw();
  });
  function stop(event) {
    if (event && event.pointerId !== owner) return;
    if (!active) return;
    if (event?.type === 'pointerup') sample(event);
    remember({ drawn: active });
    active = null;
    const pointer = owner;
    owner = null;
    if (canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
    change();
  }
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, stop);

  toolbar.querySelectorAll('[data-ink-mode]').forEach(button => {
    button.addEventListener('click', () => {
      stop();
      mode = button.dataset.inkMode;
      syncButtons();
    });
  });
  input('undo').onclick = () => {
    stop();
    const edits = entry();
    const list = strokes();
    const edit = edits.undo.pop() || (list.length ? { drawn: list.at(-1) } : null);
    if (!edit) return;
    if (edit.cleared) list.push(...edit.cleared);
    else list.pop();
    edits.redo.push(edit);
    change();
  };
  input('redo').onclick = () => {
    stop();
    const edits = entry();
    const edit = edits.redo.pop();
    if (!edit) return;
    if (edit.cleared) strokes().length = 0;
    else strokes().push(edit.drawn);
    edits.undo.push(edit);
    change();
  };
  input('clear').onclick = () => {
    stop();
    if (!strokes().length || !confirm('Очистить записи на этой странице?')) return;
    remember({ cleared: strokes().splice(0) });
    change();
  };
  new ResizeObserver(fit).observe(canvas);
  return {
    fit, stop, refresh() { syncButtons(); fit(); },
    clearHistory: () => history.clear(),
    scaleY(factor) {
      stop();
      const edits = entry();
      const affected = new Set(strokes());
      for (const edit of [...edits.undo, ...edits.redo]) {
        if (edit.drawn) affected.add(edit.drawn);
        else for (const stroke of edit.cleared) affected.add(stroke);
      }
      for (const stroke of affected) for (const point of stroke.points) point[1] *= factor;
    },
  };
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
