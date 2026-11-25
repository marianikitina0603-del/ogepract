const boardUrl = 'https://matematicheskaya-doska.marianikitina0603.chatgpt.site/?import=ogepract';
const boardOrigin = new URL(boardUrl).origin;
const windowName = 'mathBoardOgePract';
const sizeLimit = 8 * 1024 * 1024;

export function setupBoardTransfer({ status }) {
  let destination;
  let sending = false;

  function openBoard() {
    if (!destination || destination.closed) {
      destination = window.open('', windowName);
      if (!destination) throw new Error('Браузер заблокировал окно. Разреши всплывающие окна для практикума.');
      // An existing cross-origin window remains on the board with its current session.
      let blank = false;
      try { blank = destination.location.href === 'about:blank'; } catch {}
      if (blank) destination.location.replace(boardUrl);
    }
    destination.focus();
    return destination;
  }

  function transfer(target, id, image, kind) {
    return new Promise((resolve, reject) => {
      let probeTimer;
      let deadline;
      let sent = false;
      function finish(error) {
        clearTimeout(deadline);
        clearInterval(probeTimer);
        window.removeEventListener('message', receive);
        if (error) reject(new Error(error));
        else resolve();
      }
      function receive(event) {
        if (event.source !== target || event.origin !== boardOrigin || event.data?.id !== id) return;
        if (event.data.type === 'ogepract:ready' && !sent) {
          clearInterval(probeTimer);
          clearTimeout(deadline);
          sent = true;
          deadline = setTimeout(() => finish('Доска не подтвердила вставку. Проверь запись перед повторной отправкой.'), 30000);
          target.postMessage({ type: 'ogepract:import', id, image, kind }, boardOrigin);
        } else if (event.data.type === 'ogepract:result' && sent) {
          finish(typeof event.data.error === 'string' ? event.data.error : null);
        }
      }
      function probe() {
        if (target.closed) {
          finish('Окно доски закрыто.');
          return;
        }
        target.postMessage({ type: 'ogepract:probe', id }, boardOrigin);
      }
      window.addEventListener('message', receive);
      deadline = setTimeout(() => finish('Доска не ответила. Проверь, что открыто рабочее окно доски.'), 12000);
      probeTimer = setInterval(probe, 350);
      probe();
    });
  }

  return async function send(kind, capture) {
    if (sending) return;
    sending = true;
    try {
      const target = openBoard();
      status('Готовлю снимок для доски…');
      let image;
      try { image = await capture(); }
      catch { throw new Error('Не удалось подготовить снимок.'); }
      if (!(image instanceof Blob) || image.size > sizeLimit) throw new Error('Снимок больше 8 МБ. Для длинной записи сохрани PNG и загрузи его на доску.');
      await transfer(target, crypto.randomUUID(), image, kind);
      status('Материал добавлен на доску в «Запись решения».');
    } catch (error) {
      status(error.message || 'Не удалось передать материал на доску.');
    } finally {
      sending = false;
    }
  };
}
