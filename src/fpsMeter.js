export function createFPSMeter({ onFps }) {
  let frameCount = 0;
  let lastTime = performance.now();
  let rafId = null;

  function tick() {
    rafId = requestAnimationFrame(tick);
    frameCount += 1;

    const now = performance.now();
    if (now - lastTime < 500) {
      return;
    }

    const fps = Math.round(frameCount / ((now - lastTime) / 1000));
    onFps(fps);
    frameCount = 0;
    lastTime = now;
  }

  return {
    start() {
      if (rafId) return;
      frameCount = 0;
      lastTime = performance.now();
      tick();
    },
    stop() {
      if (!rafId) return;
      cancelAnimationFrame(rafId);
      rafId = null;
    },
  };
}
