export function interpolateCount(from: number, to: number, progress: number) {
  const remaining = 1 - Math.min(1, Math.max(0, progress));
  return Math.round(to + (from - to) * remaining ** 3);
}
