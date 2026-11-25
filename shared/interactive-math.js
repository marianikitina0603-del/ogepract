export function magnifiedGap(length, ceiling, maximum) {
  const factor = length > 0 ? Math.max(1, Math.min(maximum, Math.floor(ceiling / length))) : maximum;
  return { factor, gap: length * factor };
}

export function createAnimation(root, render, duration) {
  let frame = 0;
  function cancel() {
    cancelAnimationFrame(frame);
    frame = 0;
  }
  return {
    start() {
      cancel();
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        render(1);
        return;
      }
      const started = performance.now();
      function tick(now) {
        if (!root.isConnected) return;
        const fraction = Math.min(1, Math.max(0, (now - started) / duration));
        render(fraction);
        if (fraction < 1) frame = requestAnimationFrame(tick);
      }
      frame = requestAnimationFrame(tick);
    },
    reset() { cancel(); render(0); },
  };
}
