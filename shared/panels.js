export function setupPanels(container, splitBook) {
  const panels = [...container.querySelectorAll('.lesson-panel')];
  const compact = () => innerWidth < 640;
  const limit = (value, min, max) => Math.max(min, Math.min(max, value));
  const floating = panel => !panel.classList.contains('max') && !panel.classList.contains('docked');

  function place(panel, left, top) {
    const { width, height } = panel.getBoundingClientRect();
    panel.style.left = limit(left, 0, innerWidth - width) + 'px';
    panel.style.top = limit(top, 0, innerHeight - height) + 'px';
    panel.style.right = 'auto';
  }
  function constrain(panel) {
    if (panel.hidden || !floating(panel)) return;
    if (compact()) {
      for (const property of ['left', 'right', 'top', 'width', 'height']) panel.style.removeProperty(property);
      return;
    }
    const { left, top } = panel.getBoundingClientRect();
    place(panel, left, top);
  }
  function changeSize(panel, width, height) {
    panel.style.width = limit(width, Math.min(295, innerWidth), innerWidth - panel.offsetLeft) + 'px';
    panel.style.height = limit(height, 150, innerHeight - panel.offsetTop) + 'px';
    constrain(panel);
  }
  function captureDrag(handle, canDrag, update) {
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !canDrag(event)) return;
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      const start = update(event);
      handle.onpointermove = move => start(move.clientX - event.clientX, move.clientY - event.clientY);
      handle.onlostpointercapture = () => { handle.onpointermove = null; };
    });
  }

  const activate = panel => panels.forEach(item => item.classList.toggle('current', item === panel));
  function close(panel) {
    if (panel.classList.contains('docked')) splitBook(false);
    panel.hidden = true;
    if (panel.opener?.isConnected) panel.opener.focus({ preventScroll: true });
  }

  for (const panel of panels) {
    const bar = panel.querySelector('.panelbar');
    panel.querySelector('[data-close]').onclick = () => close(panel);
    panel.querySelector('[data-min]')?.addEventListener('click', () => {
      panel.classList.toggle('min');
      if (panel.classList.contains('docked')) splitBook(false);
      constrain(panel);
    });
    panel.querySelector('[data-max]')?.addEventListener('click', () => {
      if (panel.classList.contains('docked')) splitBook(false);
      panel.classList.toggle('max');
      panel.classList.remove('min');
      constrain(panel);
    });
    panel.addEventListener('pointerdown', () => activate(panel));
    captureDrag(bar, event => floating(panel) && !compact() && !event.target.closest('button'), () => {
      const { left, top } = panel.getBoundingClientRect();
      return (dx, dy) => place(panel, left + dx, top + dy);
    });
    const handle = panel.querySelector('[data-resize-panel]');
    if (!handle) continue;
    captureDrag(handle, () => floating(panel) && !compact(), () => {
      const { width, height } = panel.getBoundingClientRect();
      return (dx, dy) => changeSize(panel, width + dx, height + dy);
    });
    handle.addEventListener('keydown', event => {
      const vector = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[event.key];
      if (!vector || !floating(panel) || compact()) return;
      event.preventDefault();
      const { width, height } = panel.getBoundingClientRect();
      changeSize(panel, width + vector[0] * 24, height + vector[1] * 24);
    });
  }
  window.addEventListener('resize', () => panels.forEach(constrain));
  return {
    close,
    open(id, opener) {
      const panel = container.querySelector('#' + id);
      if (!panel) return;
      panel.opener = opener;
      panel.hidden = false;
      panel.classList.remove('min');
      activate(panel);
      constrain(panel);
      panel.querySelector('[data-close]').focus({ preventScroll: true });
    },
    escape() {
      const panel = panels.find(item => !item.hidden && item.contains(document.activeElement))
        || panels.find(item => !item.hidden && item.classList.contains('current'));
      if (panel) close(panel);
    },
  };
}
