// A tiny sumi brush: turns centre-line strokes into filled, tapered,
// pressure-varying shapes, rendered in headless Chromium.
//
// Each stroke is { d, w, taper: [in, out], swell, min, seed }:
//   d      – SVG path of the brush's centre line (in drawing units)
//   w      – the widest width
//   taper  – fraction of the length used to press in / lift off
//   swell  – extra width in the middle of the stroke (0..1)
//   min    – width at the very ends, as a fraction of w
//   wobble – slow random width change, like an uneven hand (0..1)

export async function strokesToPaths(page, strokes) {
  return page.evaluate((strokes) => {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    document.body.appendChild(svg);
    const smooth = (a, b, x) => {
      const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
      return t * t * (3 - 2 * t);
    };
    // deterministic pseudo-random per stroke
    const rand = (seed) => () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const out = strokes.map((s, index) => {
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", s.d);
      svg.appendChild(path);
      const total = path.getTotalLength();
      const steps = Math.max(8, Math.ceil(total / 1.2));
      const w = s.w ?? 6;
      const [tin, tout] = s.taper ?? [0.18, 0.3];
      const min = s.min ?? 0.12;
      const swell = s.swell ?? 0.25;
      const wobble = s.wobble ?? 0.12;
      const r = rand((s.seed ?? index + 1) * 9301 + 49297);
      const knots = Array.from({ length: 6 }, () => 1 + (r() - 0.5) * 2 * wobble);
      const noiseAt = (t) => {
        const x = t * (knots.length - 1);
        const i = Math.min(Math.floor(x), knots.length - 2);
        const f = x - i;
        const g = f * f * (3 - 2 * f);
        return knots[i] * (1 - g) + knots[i + 1] * g;
      };
      const left = [];
      const right = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const p = path.getPointAtLength(t * total);
        const a = path.getPointAtLength(Math.max(0, t * total - 0.8));
        const b = path.getPointAtLength(Math.min(total, t * total + 0.8));
        let tx = b.x - a.x;
        let ty = b.y - a.y;
        const len = Math.hypot(tx, ty) || 1;
        tx /= len;
        ty /= len;
        const press = Math.min(smooth(0, tin, t), 1 - smooth(1 - tout, 1, t));
        const width = w * (min + (1 - min) * press) * (1 + swell * Math.sin(Math.PI * t)) * noiseAt(t);
        const half = width / 2;
        left.push([p.x - ty * half, p.y + tx * half]);
        right.push([p.x + ty * half, p.y - tx * half]);
      }
      const pts = left.concat(right.reverse());
      return "M" + pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" L") + " Z";
    });
    svg.remove();
    return out;
  }, strokes);
}
