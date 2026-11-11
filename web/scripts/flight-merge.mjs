// Next streams its server payload as many tiny inline scripts of the form `self.__next_f.push(...)`. How many there are
// depends on the build machine (chunking differs between Node versions and hosts), and every one needs its own CSP hash.
// They only append to an array, in order, so merging them into the first one is equivalent and keeps the CSP small
// and the same everywhere. The initial `(self.__next_f=self.__next_f||[]).push([0])` script is left alone.
const FLIGHT = /<script>(self\.__next_f[\s\S]*?)<\/script>/g;

export function mergeFlightScripts(html) {
  const bodies = [...html.matchAll(FLIGHT)].map((m) => m[1]);
  if (bodies.length < 2) return html;
  const merged = `<script>${bodies.join(";")}</script>`;
  let n = 0;
  return html.replace(FLIGHT, () => (n++ === 0 ? merged : ""));
}
