import { asterismFor, EXAMPLE_SEED } from "@/lib/asterism/preview";
import { CANVAS } from "@/lib/asterism/spec";

type Point = { x: number; y: number };

export function lensPosition(elapsed: number, period: number, width: number, height: number, fraction: number): Point {
  const angle = elapsed / period * 2 * Math.PI;
  return {
    x: width * fraction * (0.5 - Math.cos(angle) / 2),
    y: height * fraction * (0.5 - Math.cos(angle * 2) / 4),
  };
}

export function mountLens(canvas: HTMLCanvasElement, dprLimit: number) {
  const drawingContext = canvas.getContext("2d");
  if (!drawingContext) return;
  const context = drawingContext;
  const css = getComputedStyle(canvas);
  const ink = (name: string) => css.getPropertyValue(`--lens-${name}`).trim();
  const number = (name: string) => Number(ink(name));
  const colors = { grid: ink("grid"), edge: ink("edge"), star: ink("star"), scan: ink("scan") };
  const fraction = number("size");
  const period = number("period");
  const easePeriod = number("ease-period");
  const band = number("band");
  const radius = number("reticle-radius");
  const point = number("point");
  const pitch = number("pitch");
  const tick = number("tick");
  const ringPeriod = number("ring-period");
  const ringLimit = number("ring-limit");
  const geometry = asterismFor(EXAMPLE_SEED, 97);
  let width = 1;
  let height = 1;
  let stars: Point[] = [];
  let grid = new Path2D();
  let lines = new Path2D();
  let focus: Point | null = null;
  let target: Point | null = null;
  let ring: (Point & { start: number }) | null = null;
  let visible = false;

  function local(x: number, y: number) {
    const rect = canvas.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
    return { x: x - rect.left, y: y - rect.top };
  }

  function draw(elapsed: number, dt: number, animated: boolean) {
    if (animated && !visible) return;
    const automatic = lensPosition(elapsed, period, width, height, fraction);
    if (animated) {
      focus ??= automatic;
      const next = target ?? automatic;
      const ease = 1 - Math.exp(-dt / easePeriod);
      focus.x += (next.x - focus.x) * ease;
      focus.y += (next.y - focus.y) * ease;
    }
    const lens = animated ? focus! : lensPosition(period / 4, period, width, height, fraction);
    context.clearRect(0, 0, width, height);
    context.strokeStyle = colors.grid;
    context.stroke(grid);
    context.strokeStyle = colors.edge;
    context.stroke(lines);

    // Draw only the parts of the constellation under the optical aperture.
    context.save();
    context.beginPath();
    context.arc(lens.x, lens.y, band, 0, 2 * Math.PI);
    context.clip();
    context.strokeStyle = colors.scan;
    context.stroke(lines);
    context.restore();

    for (const [index, star] of stars.entries()) {
      const lit = Math.hypot(star.x - lens.x, star.y - lens.y) < band;
      context.fillStyle = lit ? colors.scan : colors.star;
      context.beginPath();
      context.arc(star.x, star.y, point * (1 + geometry.stars[index]!.b / 3), 0, 2 * Math.PI);
      context.fill();
    }

    context.strokeStyle = colors.scan;
    context.beginPath();
    for (let quadrant = 0; quadrant < 4; quadrant++) {
      const angle = quadrant * Math.PI / 2;
      context.moveTo(lens.x + Math.cos(angle + Math.PI / 12) * radius, lens.y + Math.sin(angle + Math.PI / 12) * radius);
      context.arc(lens.x, lens.y, radius, angle + Math.PI / 12, angle + 5 * Math.PI / 12);
      const x = Math.cos(angle);
      const y = Math.sin(angle);
      context.moveTo(lens.x + x * (radius - tick), lens.y + y * (radius - tick));
      context.lineTo(lens.x + x * (radius + tick), lens.y + y * (radius + tick));
    }
    context.stroke();

    if (animated && ring) {
      const progress = (elapsed - ring.start) / ringPeriod;
      if (progress >= 1) ring = null;
      else {
        context.beginPath();
        context.arc(ring.x, ring.y, Math.max(point, progress * ringLimit), 0, 2 * Math.PI);
        context.globalAlpha = 1 - progress;
        context.stroke();
        context.globalAlpha = 1;
      }
    }
  }

  function resize() {
    width = Math.max(1, canvas.clientWidth);
    height = Math.max(1, canvas.clientHeight);
    const dpr = Math.min(devicePixelRatio, dprLimit);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scale = Math.min(width, height) * fraction / CANVAS;
    stars = geometry.stars.map(({ x, y }) => ({ x: x * scale, y: y * scale }));
    lines = new Path2D();
    for (const [a, b] of geometry.edges) {
      lines.moveTo(stars[a]!.x, stars[a]!.y);
      lines.lineTo(stars[b]!.x, stars[b]!.y);
    }
    grid = new Path2D();
    for (let x = pitch / 2; x < width; x += pitch) {
      for (let y = pitch / 2; y < height; y += pitch) {
        grid.moveTo(x - tick, y);
        grid.lineTo(x + tick, y);
        grid.moveTo(x, y - tick);
        grid.lineTo(x, y + tick);
      }
    }
    focus = null;
    draw(0, 0, false);
  }

  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    if (visible) draw(0, 0, false);
  });
  const size = new ResizeObserver(resize);
  resize();
  visibility.observe(canvas);
  size.observe(canvas);
  return {
    draw,
    move(x: number, y: number) { target = visible ? local(x, y) : null; },
    leave() { target = null; },
    tap(x: number, y: number, elapsed: number) {
      const hit = visible ? local(x, y) : null;
      if (hit) ring = { ...hit, start: elapsed };
    },
    stop() {
      target = focus = ring = null;
      draw(0, 0, false);
    },
    dispose() {
      visibility.disconnect();
      size.disconnect();
    },
  };
}
