/**
 * Motion for the observatory sky: constellations drift, their stars are pulled toward the pointer on springs, the grid
 * crosses near the pointer swell, a click sends a ring across the field that pushes stars outward, and a slow ghost
 * pointer keeps things moving when nobody is touching the screen (and on touch devices, which have no hover).
 * All numbers come from the --sky-* tokens. Pure helpers are exported for tests; mountSky does the drawing.
 */
import { CANVAS } from "@/lib/asterism/spec";

import { GRID_PITCH } from "./grid";

export { GRID_PITCH };

export interface Vec {
  x: number;
  y: number;
}
export interface Spring extends Vec {
  vx: number;
  vy: number;
}

/** Semi-implicit Euler step of a damped spring toward (tx, ty). dt is in seconds. */
export function stepSpring(s: Spring, tx: number, ty: number, dt: number, stiffness: number, damping: number) {
  s.vx += (stiffness * (tx - s.x) - damping * s.vx) * dt;
  s.vy += (stiffness * (ty - s.y) - damping * s.vy) * dt;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
}

/** Offset that pulls `base` toward `cursor`: zero outside the radius, quadratic falloff inside, never longer than `cap`. */
export function pullOffset(base: Vec, cursor: Vec | null, radius: number, strength: number, cap: number): Vec {
  if (!cursor) return { x: 0, y: 0 };
  const dx = cursor.x - base.x;
  const dy = cursor.y - base.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || distance >= radius) return { x: 0, y: 0 };
  const weight = (1 - distance / radius) ** 2;
  let x = dx * weight * strength;
  let y = dy * weight * strength;
  const length = Math.hypot(x, y);
  if (length > cap) {
    x *= cap / length;
    y *= cap / length;
  }
  return { x, y };
}

/** 1 on the ring of the given radius, easing to 0 `width` away from it on either side. */
export function waveBand(distance: number, radius: number, width: number) {
  const edge = Math.abs(distance - radius) / width;
  return edge >= 1 ? 0 : (1 + Math.cos(Math.PI * edge)) / 2;
}

/** A slow looping path across the field for the ghost pointer. */
export function ghostPoint(elapsedMs: number, width: number, height: number, periodMs: number): Vec {
  const t = (elapsedMs / periodMs) * 2 * Math.PI;
  return { x: width * (0.5 + 0.38 * Math.sin(3 * t)), y: height * (0.5 + 0.34 * Math.sin(2 * t + 1)) };
}

interface Ripple extends Vec {
  start: number;
}
interface Body {
  svg: SVGSVGElement;
  base: Vec[];
  springs: Spring[];
  circles: { el: SVGCircleElement; star: number }[];
  lines: { el: SVGLineElement; a: number; b: number }[];
  settled: boolean;
}

export function mountSky(sky: HTMLElement, canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) return () => {};
  const ctx = context;
  const css = getComputedStyle(sky);
  const token = (name: string) => css.getPropertyValue(`--${name}`).trim();
  const number = (name: string) => Number(token(name));
  const radius = number("sky-radius");
  const pull = number("sky-pull");
  const cap = number("sky-cap");
  const stiffness = number("sky-stiffness");
  const damping = number("sky-damping");
  const trailLimit = number("sky-trail");
  const trailLife = number("sky-trail-life");
  const waveSpeed = number("sky-wave-speed");
  const waveLife = number("sky-wave-life");
  const waveWidth = number("sky-wave-width");
  const wavePush = number("sky-wave-push");
  const ghostDelay = number("sky-ghost-delay");
  const ghostPeriod = number("sky-ghost-period");
  const ghostWeight = number("sky-ghost-weight");
  const arm = number("sky-cross-arm");
  const armBoost = number("sky-cross-boost");
  const dprLimit = number("field-dpr-limit");
  const signal = token("lens-signal");
  const edge = token("lens-edge");
  const muted = token("text-muted");
  const mono = token("font-mono");

  const bodies: Body[] = [...sky.querySelectorAll<SVGSVGElement>("svg[data-sky-svg]")].map((svg) => {
    const base: Vec[] = [];
    const circles: Body["circles"] = [];
    for (const el of svg.querySelectorAll<SVGCircleElement>("circle[data-s]")) {
      const star = Number(el.dataset.s);
      base[star] ??= { x: Number(el.getAttribute("cx")), y: Number(el.getAttribute("cy")) };
      circles.push({ el, star });
    }
    const lines = [...svg.querySelectorAll<SVGLineElement>("line[data-a]")].map((el) => ({ el, a: Number(el.dataset.a), b: Number(el.dataset.b) }));
    return { svg, base, springs: base.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 })), circles, lines, settled: true };
  });

  let width = 1;
  let height = 1;
  let frame = 0;
  let previous = 0;
  let elapsed = 0;
  let onscreen = false;
  let pointer: (Vec & { at: number }) | null = null;
  let trail: (Vec & { at: number })[] = [];
  let ripples: Ripple[] = [];

  function resize() {
    const box = sky.getBoundingClientRect();
    width = Math.max(1, box.width);
    height = Math.max(1, box.height);
    const ratio = Math.min(devicePixelRatio, dprLimit);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function lightCross(cx: number, cy: number, level: number) {
    if (level <= 0.02) return;
    const length = arm + armBoost * level;
    ctx.globalAlpha = Math.min(1, 0.15 + level * 0.85);
    ctx.beginPath();
    ctx.moveTo(cx - length, cy);
    ctx.lineTo(cx + length, cy);
    ctx.moveTo(cx, cy - length);
    ctx.lineTo(cx, cy + length);
    ctx.stroke();
  }

  function draw(origin: { point: Vec; weight: number } | null) {
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1;
    ctx.strokeStyle = signal;
    const half = GRID_PITCH / 2;
    if (origin) {
      const { point, weight } = origin;
      const x0 = Math.max(0, Math.floor((point.x - radius - half) / GRID_PITCH));
      const x1 = Math.ceil((point.x + radius - half) / GRID_PITCH);
      const y0 = Math.max(0, Math.floor((point.y - radius - half) / GRID_PITCH));
      const y1 = Math.ceil((point.y + radius - half) / GRID_PITCH);
      for (let i = x0; i <= x1; i++) {
        for (let j = y0; j <= y1; j++) {
          const cx = i * GRID_PITCH + half;
          const cy = j * GRID_PITCH + half;
          const d = Math.hypot(cx - point.x, cy - point.y);
          if (d < radius) lightCross(cx, cy, (1 - d / radius) ** 2 * weight);
        }
      }
    }
    for (const ripple of ripples) {
      const age = elapsed - ripple.start;
      const r = (age / 1000) * waveSpeed;
      const fade = 1 - age / waveLife;
      const x0 = Math.max(0, Math.floor((ripple.x - r - waveWidth - half) / GRID_PITCH));
      const x1 = Math.ceil((ripple.x + r + waveWidth - half) / GRID_PITCH);
      const y0 = Math.max(0, Math.floor((ripple.y - r - waveWidth - half) / GRID_PITCH));
      const y1 = Math.ceil((ripple.y + r + waveWidth - half) / GRID_PITCH);
      for (let i = x0; i <= x1; i++) {
        for (let j = y0; j <= y1; j++) {
          const cx = i * GRID_PITCH + half;
          const cy = j * GRID_PITCH + half;
          const band = waveBand(Math.hypot(cx - ripple.x, cy - ripple.y), r, waveWidth);
          if (band > 0) lightCross(cx, cy, band * fade);
        }
      }
      ctx.globalAlpha = Math.max(0, fade) * 0.7;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, r, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (trail.length > 1) {
      ctx.strokeStyle = edge;
      for (let i = 1; i < trail.length; i++) {
        const life = 1 - (elapsed - trail[i]!.at) / trailLife;
        if (life <= 0) continue;
        ctx.globalAlpha = life * 0.6;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1]!.x, trail[i - 1]!.y);
        ctx.lineTo(trail[i]!.x, trail[i]!.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    if (pointer && origin && origin.weight === 1) {
      ctx.strokeStyle = signal;
      ctx.globalAlpha = 0.8;
      const { x, y } = pointer;
      ctx.beginPath();
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        ctx.moveTo(x + dx * 8, y + dy * 8);
        ctx.lineTo(x + dx * 14, y + dy * 14);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = muted;
      ctx.font = `11px ${mono}`;
      const text = `X ${String(Math.round(x)).padStart(4, "0")}  Y ${String(Math.round(y)).padStart(4, "0")}`;
      const flip = x > width - 130;
      ctx.textAlign = flip ? "right" : "left";
      ctx.fillText(text, x + (flip ? -18 : 18), y - 12);
    }
  }

  function move(dt: number, origin: { point: Vec; weight: number } | null, box: DOMRect) {
    // Reads first, then writes, so the five drawings cost one layout pass.
    const rects = bodies.map((body) => body.svg.getBoundingClientRect());
    bodies.forEach((body, n) => {
      const rect = rects[n]!;
      const scale = rect.width / CANVAS;
      if (scale === 0) return;
      const local = origin ? { x: (origin.point.x + box.left - rect.left) / scale, y: (origin.point.y + box.top - rect.top) / scale } : null;
      const centers = ripples.map((r) => ({ x: (r.x + box.left - rect.left) / scale, y: (r.y + box.top - rect.top) / scale, r: ((elapsed - r.start) / 1000) * waveSpeed / scale, fade: 1 - (elapsed - r.start) / waveLife }));
      let still = !local && !centers.length;
      for (let i = 0; i < body.base.length; i++) {
        const b = body.base[i];
        if (!b) continue;
        const target = pullOffset(b, local, radius / scale, pull * (origin?.weight ?? 0), cap);
        for (const c of centers) {
          const dx = b.x - c.x;
          const dy = b.y - c.y;
          const d = Math.hypot(dx, dy) || 1;
          const push = waveBand(d, c.r, waveWidth / scale) * wavePush * Math.max(0, c.fade);
          target.x += (dx / d) * push;
          target.y += (dy / d) * push;
        }
        const spring = body.springs[i]!;
        stepSpring(spring, target.x, target.y, dt, stiffness, damping);
        if (Math.abs(spring.x) > 0.01 || Math.abs(spring.y) > 0.01 || Math.abs(spring.vx) > 0.01 || Math.abs(spring.vy) > 0.01) still = false;
      }
      if (still && body.settled) return;
      body.settled = still;
      const at = (i: number) => {
        const b = body.base[i]!;
        const s = body.springs[i]!;
        return still ? b : { x: b.x + s.x, y: b.y + s.y };
      };
      for (const { el, star } of body.circles) {
        const p = at(star);
        el.setAttribute("cx", String(p.x));
        el.setAttribute("cy", String(p.y));
      }
      for (const { el, a, b } of body.lines) {
        const from = at(a);
        const to = at(b);
        el.setAttribute("x1", String(from.x));
        el.setAttribute("y1", String(from.y));
        el.setAttribute("x2", String(to.x));
        el.setAttribute("y2", String(to.y));
      }
    });
  }

  function tick(now: number) {
    const dt = previous ? Math.min((now - previous) / 1000, 1 / 30) : 0;
    previous = now;
    elapsed += dt * 1000;
    ripples = ripples.filter((r) => elapsed - r.start < waveLife);
    trail = trail.filter((p) => elapsed - p.at < trailLife);
    const box = sky.getBoundingClientRect();
    const live = pointer && elapsed - pointer.at < ghostDelay ? pointer : null;
    const origin = live
      ? { point: live as Vec, weight: 1 }
      : { point: ghostPoint(elapsed, width, height, ghostPeriod), weight: ghostWeight };
    move(dt, origin, box);
    draw(origin);
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    const run = onscreen && !document.hidden;
    if (run && !frame) frame = requestAnimationFrame(tick);
    if (!run && frame) {
      cancelAnimationFrame(frame);
      frame = previous = 0;
    }
  }

  function local(event: PointerEvent) {
    const box = sky.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }
  function onMove(event: PointerEvent) {
    if (event.pointerType === "touch") return;
    const p = local(event);
    pointer = { ...p, at: elapsed };
    trail.push({ ...p, at: elapsed });
    if (trail.length > trailLimit) trail.shift();
  }
  function onLeave() {
    pointer = null;
    trail = [];
  }
  function onDown(event: PointerEvent) {
    if (!event.isPrimary) return;
    ripples.push({ ...local(event), start: elapsed });
    if (ripples.length > 4) ripples.shift();
  }

  resize();
  const sizeObserver = new ResizeObserver(resize);
  sizeObserver.observe(sky);
  const observer = new IntersectionObserver(([entry]) => {
    onscreen = entry?.isIntersecting ?? false;
    sync();
  });
  observer.observe(sky);
  sky.addEventListener("pointermove", onMove, { passive: true });
  sky.addEventListener("pointerleave", onLeave);
  sky.addEventListener("pointerdown", onDown, { passive: true });
  document.addEventListener("visibilitychange", sync);
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    sizeObserver.disconnect();
    sky.removeEventListener("pointermove", onMove);
    sky.removeEventListener("pointerleave", onLeave);
    sky.removeEventListener("pointerdown", onDown);
    document.removeEventListener("visibilitychange", sync);
    for (const body of bodies) {
      for (const { el, star } of body.circles) {
        el.setAttribute("cx", String(body.base[star]!.x));
        el.setAttribute("cy", String(body.base[star]!.y));
      }
      for (const { el, a, b } of body.lines) {
        el.setAttribute("x1", String(body.base[a]!.x));
        el.setAttribute("y1", String(body.base[a]!.y));
        el.setAttribute("x2", String(body.base[b]!.x));
        el.setAttribute("y2", String(body.base[b]!.y));
      }
    }
  };
}
