import { asterismFor, EXAMPLE_SEED } from "@/lib/asterism/preview";
import { CANVAS } from "@/lib/asterism/spec";

type Point = { x: number; y: number };
type Star = Point & { b: number; primary: boolean };
type Edge = { from: Star; to: Star };

const CLUSTERS = [
  { id: 97, x: 0.02, y: 0.06, size: 0.66 },
  { id: 142, x: 0.66, y: 0.05, size: 0.33 },
  { id: 38, x: 0.02, y: 0.64, size: 0.37 },
];

export function waveProgress(elapsed: number, duration: number, index: number, gap: number) {
  return elapsed / duration - index * gap;
}

export function lensScene(width: number, height: number) {
  return CLUSTERS.map(({ id, x, y, size }) => {
    const geometry = asterismFor(EXAMPLE_SEED, id);
    const scale = Math.min(width, height) * size / CANVAS;
    const stars = geometry.stars.map((star, index) => ({
      x: width * x + star.x * scale,
      y: height * y + star.y * scale,
      b: star.b,
      primary: index === geometry.primary,
    }));
    const edges = geometry.edges.map(([from, to]) => ({ from: stars[from]!, to: stars[to]! }));
    return { stars, edges };
  });
}

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
  const colors = {
    grid: ink("grid"), edge: ink("edge"), star: ink("star"), scan: ink("scan"),
    secondary: ink("secondary"), signal: ink("signal"), sweep: ink("sweep-ink"),
  };
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
  const sweepPeriod = number("sweep-period");
  const sweepWidth = number("sweep-width");
  const signalPeriod = number("signal-period");
  const signalRadius = number("signal-radius");
  const waveGap = number("wave-gap");
  const waveCount = number("wave-count");
  const waveWidth = number("wave-width");
  const guideOpacity = number("guide-opacity");
  const stationOffset = number("station-offset");
  const minorPitch = number("pitch-minor");
  let width = 1;
  let height = 1;
  let stars: Star[] = [];
  let edges: Edge[] = [];
  let grid = new Path2D();
  let lines = new Path2D();
  let secondaryLines = new Path2D();
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
    const phase = (animated ? elapsed : 0) + period / 6;
    const automatic = lensPosition(phase, period, width, height, fraction);
    if (animated) {
      focus ??= automatic;
      const next = target ?? automatic;
      const ease = 1 - Math.exp(-dt / easePeriod);
      focus.x += (next.x - focus.x) * ease;
      focus.y += (next.y - focus.y) * ease;
    }
    const lens = animated ? focus! : automatic;
    const sweep = height * (0.5 - Math.cos(phase * 2 * Math.PI / sweepPeriod) / 2);
    const tap = animated ? ring : null;

    context.clearRect(0, 0, width, height);
    context.strokeStyle = colors.grid;
    context.stroke(grid);
    context.strokeStyle = colors.secondary;
    context.stroke(secondaryLines);
    context.strokeStyle = colors.edge;
    context.stroke(lines);

    const traces = [lines, secondaryLines];
    context.save();
    context.beginPath();
    context.rect(0, sweep - sweepWidth, width, sweepWidth);
    context.clip();
    context.strokeStyle = colors.scan;
    context.globalAlpha = guideOpacity;
    for (const trace of traces) context.stroke(trace);
    context.restore();

    context.save();
    context.beginPath();
    context.arc(lens.x, lens.y, band, 0, 2 * Math.PI);
    context.clip();
    context.strokeStyle = colors.scan;
    for (const trace of traces) context.stroke(trace);
    context.restore();

    const waves: { radius: number; opacity: number }[] = [];
    if (tap) {
      for (let index = 0; index < waveCount; index++) {
        const progress = waveProgress(elapsed - tap.start, ringPeriod, index, waveGap);
        if (progress >= 0 && progress < 1) {
          waves.push({ radius: Math.max(point, progress * ringLimit), opacity: (1 - progress) * (1 - index * waveGap) });
        }
      }
      if (waveProgress(elapsed - tap.start, ringPeriod, waveCount - 1, waveGap) >= 1) ring = null;
    }

    for (const star of stars) {
      const distance = Math.hypot(star.x - lens.x, star.y - lens.y);
      const tapDistance = tap ? Math.hypot(star.x - tap.x, star.y - tap.y) : Infinity;
      const echo = waves.some((wave) => Math.abs(tapDistance - wave.radius) < waveWidth);
      const lit = echo || distance < band || (star.y < sweep && star.y > sweep - sweepWidth);
      context.fillStyle = lit ? colors.signal : colors.star;
      context.beginPath();
      context.arc(star.x, star.y, point * (1 + star.b / 3), 0, 2 * Math.PI);
      context.fill();
      if (star.primary) {
        context.strokeStyle = lit ? colors.scan : colors.edge;
        context.beginPath();
        context.arc(star.x, star.y, tick, 0, 2 * Math.PI);
        context.stroke();
      }
    }

    if (animated) {
      context.fillStyle = colors.signal;
      for (let index = 0; index < edges.length; index += 3) {
        const { from, to } = edges[index]!;
        const progress = (elapsed / signalPeriod + index / edges.length) % 1;
        const x = from.x + (to.x - from.x) * progress;
        const y = from.y + (to.y - from.y) * progress;
        context.globalAlpha = guideOpacity * Math.sin(progress * Math.PI);
        context.beginPath();
        context.arc(x, y, signalRadius, 0, 2 * Math.PI);
        context.fill();
      }
      context.globalAlpha = 1;
    }

    context.strokeStyle = colors.sweep;
    context.beginPath();
    context.moveTo(stationOffset, sweep);
    context.lineTo(width - stationOffset, sweep);
    context.moveTo(lens.x, stationOffset);
    context.lineTo(lens.x, height - stationOffset);
    context.setLineDash([tick, tick]);
    context.stroke();
    context.setLineDash([]);

    context.strokeStyle = colors.scan;
    context.beginPath();
    const rotation = (animated ? elapsed / sweepPeriod : 0) * 2 * Math.PI;
    for (let quadrant = 0; quadrant < 4; quadrant++) {
      const angle = quadrant * Math.PI / 2 + rotation;
      const start = angle + Math.PI / 12;
      context.moveTo(lens.x + Math.cos(start) * radius, lens.y + Math.sin(start) * radius);
      context.arc(lens.x, lens.y, radius, start, angle + 5 * Math.PI / 12);
      const x = Math.cos(angle);
      const y = Math.sin(angle);
      context.moveTo(lens.x + x * (radius - tick), lens.y + y * (radius - tick));
      context.lineTo(lens.x + x * (radius + tick), lens.y + y * (radius + tick));
    }
    context.stroke();

    if (tap) {
      for (const wave of waves) {
        context.globalAlpha = wave.opacity;
        context.beginPath();
        context.arc(tap.x, tap.y, wave.radius, 0, 2 * Math.PI);
        context.stroke();
      }
      context.globalAlpha = 1;
    }
  }

  function resize() {
    width = Math.max(1, canvas.clientWidth);
    height = Math.max(1, canvas.clientHeight);
    const dpr = Math.min(devicePixelRatio, dprLimit);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scene = lensScene(width, height);
    stars = scene.flatMap((cluster) => cluster.stars);
    edges = scene.flatMap((cluster) => cluster.edges);
    lines = new Path2D();
    secondaryLines = new Path2D();
    for (const [index, cluster] of scene.entries()) {
      const path = index === 0 ? lines : secondaryLines;
      for (const { from, to } of cluster.edges) {
        path.moveTo(from.x, from.y);
        path.lineTo(to.x, to.y);
      }
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
    for (let x = minorPitch; x < width; x += minorPitch) {
      const length = x % pitch ? tick : tick * 2;
      grid.moveTo(x, 0);
      grid.lineTo(x, length);
      grid.moveTo(x, height);
      grid.lineTo(x, height - length);
    }
    for (let y = minorPitch; y < height; y += minorPitch) {
      const length = y % pitch ? tick : tick * 2;
      grid.moveTo(0, y);
      grid.lineTo(length, y);
      grid.moveTo(width, y);
      grid.lineTo(width - length, y);
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
