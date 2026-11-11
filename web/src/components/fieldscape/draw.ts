import { EXAMPLE_SEED } from "@/lib/asterism/preview";
import { fieldLayout, shouldAnimate } from "./layout";

export function mountField(canvas: HTMLCanvasElement, reticle: HTMLElement) {
  const drawingContext = canvas.getContext("2d");
  if (!drawingContext) return;
  const context = drawingContext;
  const css = getComputedStyle(canvas);
  const ink = (name: string) => css.getPropertyValue(`--field-${name}`).trim();
  const number = (name: string) => Number(ink(name));
  const pitch = number("grid-pitch");
  const cross = number("cross");
  const radius = number("radius");
  const pull = number("pull");
  const drift = number("drift");
  const period = number("drift-period");
  const ease = number("ease-period");
  const ringPeriod = number("ring-period");
  const ringLimit = number("ring-limit");
  const tapGap = number("tap-gap");
  const point = number("point");
  const hairline = number("hairline");
  const colors = { grid: ink("grid"), edge: ink("edge"), star: ink("star"), ring: ink("ring") };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  let width = 1;
  let height = 1;
  let stars: { x: number; y: number; b: number; dx: number; dy: number }[] = [];
  let edges: [number, number][] = [];
  let onscreen = false;
  let frame = 0;
  let previous = 0;
  let elapsed = 0;
  let pointer: { x: number; y: number } | null = null;
  let ring: { x: number; y: number; start: number } | null = null;
  let lastTap = -Infinity;
  let reticleX = 0;
  let reticleY = 0;
  let grid = new Path2D();

  function draw(ctx: CanvasRenderingContext2D, dt: number, animated: boolean) {
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = colors.grid;
    ctx.stroke(grid);
    const easing = 1 - Math.exp(-dt / ease);
    const time = elapsed * 2 * Math.PI / period;
    const cursor = animated ? pointer : null;

    ctx.beginPath();
    stars.forEach((star, i) => {
      const phase = i * 2.399963;
      const x = star.x + (animated ? Math.sin(time + phase) * drift : 0);
      const y = star.y + (animated ? Math.cos(time + phase) * drift : 0);
      const offsetX = cursor ? cursor.x - x : 0;
      const offsetY = cursor ? cursor.y - y : 0;
      const weight = cursor ? Math.max(0, 1 - Math.hypot(offsetX, offsetY) / radius) : 0;
      star.dx += (offsetX * weight * pull - star.dx) * easing;
      star.dy += (offsetY * weight * pull - star.dy) * easing;
      const position = positions[i]!;
      position.x = x + (animated ? star.dx : 0);
      position.y = y + (animated ? star.dy : 0);
      if (cursor && weight > 0) {
        ctx.moveTo(position.x, position.y);
        ctx.lineTo(cursor.x, cursor.y);
      }
    });
    for (const [a, b] of edges) {
      const from = positions[a]!;
      const to = positions[b]!;
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
    }
    ctx.strokeStyle = colors.edge;
    ctx.stroke();

    ctx.beginPath();
    stars.forEach((star, i) => {
      const { x, y } = positions[i]!;
      const size = point * (1 + star.b / 3);
      ctx.moveTo(x + size, y);
      ctx.arc(x, y, size, 0, 2 * Math.PI);
    });
    ctx.fillStyle = colors.star;
    ctx.fill();

    if (animated && ring) {
      const progress = (elapsed - ring.start) / ringPeriod;
      if (progress >= 1) ring = null;
      else {
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, Math.max(point, progress * ringLimit), 0, 2 * Math.PI);
        ctx.strokeStyle = colors.ring;
        ctx.globalAlpha = 1 - progress;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    if (cursor) {
      reticleX += (cursor.x - reticleX) * easing;
      reticleY += (cursor.y - reticleY) * easing;
      reticle.style.translate = `${reticleX}px ${reticleY}px`;
    }
  }

  let positions: { x: number; y: number }[] = [];
  function tick(now: number) {
    const dt = previous ? Math.min(now - previous, ease) : 0;
    previous = now;
    elapsed += dt;
    draw(context, dt, true);
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    if (shouldAnimate(reduced.matches, document.hidden, onscreen)) {
      if (!frame) frame = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(frame);
      frame = previous = 0;
      clearPointer();
      ring = null;
      if (onscreen && !document.hidden) draw(context, 0, false);
    }
  }

  function resize() {
    width = Math.max(1, canvas.clientWidth);
    height = Math.max(1, canvas.clientHeight);
    const ratio = Math.min(devicePixelRatio, number("dpr-limit"));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineWidth = hairline;

    const compact = width < number("compact-width") || (navigator.hardwareConcurrency || Infinity) <= number("compact-cores");
    const layout = fieldLayout(EXAMPLE_SEED, number(compact ? "compact-patches" : "full-patches"), width, height);
    stars = layout.stars.map((star) => ({ ...star, dx: 0, dy: 0 }));
    edges = layout.edges;
    positions = stars.map(({ x, y }) => ({ x, y }));
    grid = new Path2D();
    for (let x = pitch / 2; x < width; x += pitch) {
      for (let y = pitch / 2; y < height; y += pitch) {
        grid.moveTo(x - cross, y);
        grid.lineTo(x + cross, y);
        grid.moveTo(x, y - cross);
        grid.lineTo(x, y + cross);
      }
    }
    sync();
  }

  function clearPointer() {
    pointer = null;
    reticle.hidden = true;
  }

  function move(event: PointerEvent) {
    if (!frame || !fine.matches || event.pointerType === "touch") return clearPointer();
    if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable]")) return clearPointer();
    const { clientX: x, clientY: y } = event;
    if (!pointer) {
      reticleX = x;
      reticleY = y;
      reticle.style.translate = `${x}px ${y}px`;
    }
    pointer = { x, y };
    reticle.hidden = false;
  }

  function tap(event: PointerEvent) {
    if (!frame || !event.isPrimary || event.button !== 0 || elapsed - lastTap < tapGap) return;
    lastTap = elapsed;
    ring = { x: event.clientX, y: event.clientY, start: elapsed };
  }

  const observer = new IntersectionObserver(([entry]) => {
    onscreen = entry?.isIntersecting ?? false;
    sync();
  });
  resize();
  observer.observe(canvas);
  const sizeObserver = new ResizeObserver(resize);
  sizeObserver.observe(canvas);
  window.addEventListener("pointermove", move, { passive: true });
  window.addEventListener("pointerdown", tap, { passive: true });
  window.addEventListener("blur", clearPointer);
  document.documentElement.addEventListener("pointerleave", clearPointer);
  document.addEventListener("visibilitychange", sync);
  reduced.addEventListener("change", sync);
  fine.addEventListener("change", clearPointer);
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    sizeObserver.disconnect();
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerdown", tap);
    window.removeEventListener("blur", clearPointer);
    document.documentElement.removeEventListener("pointerleave", clearPointer);
    document.removeEventListener("visibilitychange", sync);
    reduced.removeEventListener("change", sync);
    fine.removeEventListener("change", clearPointer);
  };
}
