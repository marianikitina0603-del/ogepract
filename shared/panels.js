export function setupPanels(container, splitBook) {
  const panels = [...container.querySelectorAll('.lesson-panel')];

  function constrain(panel) {
    if (panel.hidden || panel.classList.contains('max') || panel.classList.contains('docked')) return;
    const { left, top, width } = panel.getBoundingClientRect();
    panel.style.left = Math.max(0, Math.min(left, innerWidth - width)) + 'px';
    panel.style.top = Math.max(0, Math.min(top, innerHeight - 68)) + 'px';
    panel.style.right = 'auto';
  }

  const activate = panel => panels.forEach(item => item.classList.toggle('current', item === panel));
  function close(panel) {
    if (panel.classList.contains('docked')) splitBook(false);
    panel.hidden = true;
    panel.opener?.focus();
  }

  for (const panel of panels) {
    const bar = panel.querySelector('.panelbar');
    panel.querySelector('[data-close]').onclick = () => close(panel);
    panel.querySelector('[data-min]')?.addEventListener('click', () => {
      panel.classList.toggle('min');
      if (panel.classList.contains('docked')) splitBook(false);
    });
    panel.querySelector('[data-max]')?.addEventListener('click', () => {
      if (panel.classList.contains('docked')) splitBook(false);
      panel.classList.toggle('max');
      panel.classList.remove('min');
      constrain(panel);
    });
    panel.addEventListener('pointerdown', () => activate(panel));
    bar.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('button')
        || panel.classList.contains('max') || panel.classList.contains('docked')) return;
      const bounds = panel.getBoundingClientRect();
      const offsetX = event.clientX - bounds.left;
      const offsetY = event.clientY - bounds.top;
      bar.setPointerCapture(event.pointerId);
      bar.onpointermove = move => {
        panel.style.left = Math.max(0, Math.min(innerWidth - bounds.width, move.clientX - offsetX)) + 'px';
        panel.style.top = Math.max(0, Math.min(innerHeight - 68, move.clientY - offsetY)) + 'px';
        panel.style.right = 'auto';
      };
      bar.onlostpointercapture = () => { bar.onpointermove = null; };
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
