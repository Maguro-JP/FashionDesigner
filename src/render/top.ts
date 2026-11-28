import type { FlatParams, Garment } from "../schema.js";

/**
 * Measurement-driven flat for tops / outerwear.
 * Geometry is built in centimetres from the garment's points of measure
 * (body width, body length, sleeve length) and then scaled onto the canvas,
 * so the drawing keeps the real proportions of the item instead of a fixed silhouette.
 */
type Top = Extract<FlatParams, { template: "top" }>;
type View = "front" | "back";
type Pt = [number, number];
export type TopPaths = { outline: string[]; detail: string[]; stroke: string[]; rib: string[] };

const VIEW_W = 400;
const VIEW_H = 480;
const CX = VIEW_W / 2;

const DEFAULT_WIDTH_CM = { slim: 48, regular: 53, relaxed: 57, oversized: 62 } as const;
const DEFAULT_LENGTH_CM = { cropped: 48, waist: 55, hip: 68, thigh: 78, knee: 95 } as const;
const DEFAULT_SLEEVE_CM = { none: 0, cap: 8, short: 22, elbow: 34, "three-quarter": 45, long: 60 } as const;

/** Look up a point of measure by any of the given keywords (Japanese or English). */
export function findMeasurement(g: Pick<Garment, "measurements">, keywords: string[]): number | undefined {
  const hit = g.measurements.find((m) => keywords.some((k) => m.point.toLowerCase().includes(k)));
  return hit && Number.isFinite(hit.valueCm) && hit.valueCm > 0 ? hit.valueCm : undefined;
}

export function topDimensions(p: Top, g?: Pick<Garment, "measurements">) {
  const width = (g && findMeasurement(g, ["身幅", "chest", "body width", "bust"])) ?? DEFAULT_WIDTH_CM[p.fit];
  const length = (g && findMeasurement(g, ["着丈", "body length", "length hps"])) ?? DEFAULT_LENGTH_CM[p.length];
  const sleeve = p.sleeve === "none" ? 0 : (g && findMeasurement(g, ["袖丈", "sleeve"])) ?? DEFAULT_SLEEVE_CM[p.sleeve];
  // clamp to plausible garment ranges so bad input cannot blow up the drawing
  return {
    width: Math.min(Math.max(width, 30), 90),
    length: Math.min(Math.max(length, 30), 120),
    sleeve: Math.min(Math.max(sleeve, 0), 80),
  };
}

const f = (n: number) => Number(n.toFixed(1));
const P = ([x, y]: Pt) => `${f(x)},${f(y)}`;
const mx = ([x, y]: Pt): Pt => [2 * CX - x, y];

export function renderTopMeasured(p: Top, view: View, g?: Pick<Garment, "measurements">): TopPaths {
  const out: TopPaths = { outline: [], detail: [], stroke: [], rib: [] };
  const dim = topDimensions(p, g);
  const shoulderType = p.shoulder ?? "set-in";
  const knit = p.hemBand; // rib hem implies a knit / sweat garment

  // ---- body in cm (origin: centre front, HPS line y=0) ----
  const half = dim.width / 2;
  const neckHalf = p.neckline === "off-shoulder" ? half - 4 : p.neckline === "turtle" ? 7.5 : 9;
  const shoulderDrop = shoulderType === "drop" ? 7 : 0;
  const shoulderHalf = (shoulderType === "drop" ? half + shoulderDrop : half - 3.5);
  const slope = shoulderType === "drop" ? 3.5 : 4.5;
  const armholeDepth = shoulderType === "drop" ? 26 : 22;
  const sleeveAngle = shoulderType === "drop" ? 62 : 55; // degrees from horizontal

  // scale so sleeves and body fit the canvas
  const rad = (sleeveAngle * Math.PI) / 180;
  const spanCm = 2 * (shoulderHalf + Math.cos(rad) * dim.sleeve + 4);
  // collars that rise above the HPS line need head-room
  const rise = p.neckline === "hood" ? 25 : p.neckline === "turtle" ? 9 : 3;
  const s = Math.min(330 / Math.max(spanCm, dim.width + 8), 410 / (dim.length + rise + 8), 6);
  // centre the garment vertically (leave room for the view label at the bottom)
  const top = Math.max(12, (VIEW_H - 30 - (dim.length + rise) * s) / 2) + rise * s;
  const toPx = ([x, y]: Pt): Pt => [CX + x * s, top + y * s];

  const hpsR: Pt = [neckHalf, 0];
  const shoulderR: Pt = [shoulderHalf, slope];
  const underarmR: Pt = [half, armholeDepth];
  const hemR: Pt = [half + (p.fit === "oversized" ? 0.5 : 0), dim.length];
  const ribH = knit ? 6 : 0;

  // body outline: neck -> shoulder -> armhole curve -> side seam -> hem (mirrored)
  const [a, b, c, d] = [hpsR, shoulderR, underarmR, hemR].map(toPx) as [Pt, Pt, Pt, Pt];
  const armCtl1: Pt = toPx([shoulderType === "drop" ? shoulderHalf : shoulderHalf - 1.5, armholeDepth * 0.55]);
  const armCtl2: Pt = toPx([half + 0.5, armholeDepth - 3]);
  const right = `L${P(b)} C${P(armCtl1)} ${P(armCtl2)} ${P(c)} L${P(d)}`;
  const left = `L${P(mx(c))} C${P(mx(armCtl2))} ${P(mx(armCtl1))} ${P(mx(b))} L${P(mx(a))}`;
  const hemCurve = knit ? `L${P(mx(d))}` : `Q${f(CX)},${f(d[1] + 2.5 * s)} ${P(mx(d))}`;
  out.outline.push(`M${P(a)} ${right} ${hemCurve} ${left} Z`);

  // ---- sleeves ----
  if (dim.sleeve > 0) {
    const dir: Pt = [Math.cos(rad), Math.sin(rad)];
    const perp: Pt = [-dir[1], dir[0]];
    const bicep = shoulderType === "drop" ? 21 : 18; // sleeve width at the top, cm
    const cuffW = Math.max(knit ? 10 : 12, bicep * (dim.sleeve > 40 ? 0.55 : 0.85));
    const s0 = shoulderR;
    const s1: Pt = [s0[0] + perp[0] * bicep, s0[1] + perp[1] * bicep];
    // the underarm point of the sleeve meets the body underarm
    const e0: Pt = [s0[0] + dir[0] * dim.sleeve, s0[1] + dir[1] * dim.sleeve];
    const e1: Pt = [e0[0] + perp[0] * cuffW, e0[1] + perp[1] * cuffW];
    const sl = [s0, e0, e1, underarmR].map(toPx) as [Pt, Pt, Pt, Pt];
    const bend: Pt = toPx([(s1[0] + e1[0]) / 2 - perp[0] * 1.5, (s1[1] + e1[1]) / 2 - perp[1] * 1.5]);
    const r = `M${P(sl[0])} L${P(sl[1])} L${P(sl[2])} Q${P(bend)} ${P(sl[3])}`;
    const l = `M${P(mx(sl[0]))} L${P(mx(sl[1]))} L${P(mx(sl[2]))} Q${P(mx(bend))} ${P(mx(sl[3]))}`;
    out.outline.push(r + " Z", l + " Z");

    if (p.cuffs) {
      const cuffLen = knit ? 6 : 5;
      const c0: Pt = [e0[0] - dir[0] * cuffLen, e0[1] - dir[1] * cuffLen];
      const c1: Pt = [e1[0] - dir[0] * cuffLen, e1[1] - dir[1] * cuffLen];
      for (const fn of [(q: Pt) => q, mx]) {
        out.stroke.push(`M${P(fn(toPx(c0)))} L${P(fn(toPx(c1)))}`);
        if (knit) ribLines(toPx(c0), toPx(c1), toPx(e0), toPx(e1), fn, out.rib);
      }
    }
  }

  // ---- hem rib ----
  if (knit) {
    const y = dim.length - ribH;
    out.stroke.push(`M${P(toPx([-half, y]))} L${P(toPx([half, y]))}`);
    for (let x = -half + 1.2; x < half; x += 1.6) out.rib.push(`M${P(toPx([x, y + 0.6]))} L${P(toPx([x, dim.length - 0.6]))}`);
  }

  // ---- neckline ----
  const neckDepthFront = { crew: 8, v: dim.length * 0.42, scoop: 14, square: 12, turtle: 2, "shirt-collar": 7, hood: 9, lapel: 24, "off-shoulder": 3 }[p.neckline];
  const nd = view === "front" ? neckDepthFront : 2.5;
  const nL = toPx([-neckHalf, 0]);
  const nR = toPx([neckHalf, 0]);
  const nB = toPx([0, nd]);
  const opensFront = view === "front" && p.closure !== "none" && p.closure !== "wrap";

  if (view === "front" && (p.neckline === "v" || p.neckline === "lapel")) {
    out.stroke.push(`M${P(nL)} Q${P(toPx([-neckHalf * 0.3, nd * 0.55]))} ${P(nB)} Q${P(toPx([neckHalf * 0.3, nd * 0.55]))} ${P(nR)}`);
    if (knit && p.neckline === "v") {
      // knitted front band runs up the V and round the back neck
      const w = 3;
      out.detail.push(`M${P(toPx([-neckHalf - w, 0.5]))} Q${P(toPx([-neckHalf * 0.3 - w, nd * 0.55]))} ${P(toPx([-w * 0.5, nd + w]))}`, `M${P(toPx([neckHalf + w, 0.5]))} Q${P(toPx([neckHalf * 0.3 + w, nd * 0.55]))} ${P(toPx([w * 0.5, nd + w]))}`);
    }
  } else if (p.neckline === "shirt-collar") {
    const tip: Pt = [neckHalf + 4, 9];
    for (const fn of [(q: Pt) => q, mx]) {
      out.outline.push(`M${P(fn(toPx([0, view === "front" ? 6 : -1])))} L${P(fn(toPx([neckHalf + 0.5, -2.5])))} L${P(fn(toPx(tip)))} L${P(fn(toPx([1.5, view === "front" ? 9 : 4])))} Z`);
    }
    if (view === "back") out.stroke.push(`M${P(toPx([-neckHalf - 3, 4]))} L${P(toPx([neckHalf + 3, 4]))}`);
  } else if (p.neckline === "hood") {
    const hw = neckHalf + 5;
    if (view === "front") out.outline.push(`M${P(toPx([-hw, 2]))} C${P(toPx([-hw - 3, -22]))} ${P(toPx([hw + 3, -22]))} ${P(toPx([hw, 2]))} Q${P(toPx([0, 12]))} ${P(toPx([-hw, 2]))} Z`);
    else out.outline.push(`M${P(toPx([-hw, 2]))} C${P(toPx([-hw - 3, -24]))} ${P(toPx([hw + 3, -24]))} ${P(toPx([hw, 2]))} Z`);
  } else if (p.neckline === "turtle") {
    out.outline.push(`M${P(toPx([-neckHalf, 0]))} L${P(toPx([-neckHalf + 0.5, -8]))} L${P(toPx([neckHalf - 0.5, -8]))} L${P(toPx([neckHalf, 0]))} Z`);
    for (let x = -neckHalf + 1.2; x < neckHalf; x += 1.6) out.rib.push(`M${P(toPx([x, -7.4]))} L${P(toPx([x, -0.6]))}`);
  } else {
    out.stroke.push(`M${P(nL)} C${P(toPx([-neckHalf, nd * 0.8]))} ${P(toPx([neckHalf, nd * 0.8]))} ${P(nR)}`);
    if (knit && view === "front" && p.neckline === "crew") out.detail.push(`M${P(toPx([-neckHalf - 1.5, 0]))} C${P(toPx([-neckHalf - 1.5, nd + 2]))} ${P(toPx([neckHalf + 1.5, nd + 2]))} ${P(toPx([neckHalf + 1.5, 0]))}`);
  }

  // ---- front opening / placket ----
  if (opensFront) {
    const startY = p.neckline === "v" || p.neckline === "lapel" ? nd : 0;
    const band = knit ? 1.6 : 1.8; // half placket width, cm
    const endY = dim.length;
    out.stroke.push(`M${P(toPx([0, startY]))} L${P(toPx([0, endY]))}`);
    if (p.closure === "zip") {
      out.detail.push(`M${P(toPx([-0.5, startY]))} L${P(toPx([-0.5, endY]))} M${P(toPx([0.5, startY]))} L${P(toPx([0.5, endY]))}`);
    } else {
      out.detail.push(`M${P(toPx([-band, startY]))} L${P(toPx([-band, endY]))} M${P(toPx([band, startY]))} L${P(toPx([band, endY]))}`);
      const first = startY + 2.5;
      const last = endY - (knit ? ribH + 2.5 : 8);
      const n = Math.max(3, Math.round((last - first) / 9) + 1);
      for (let i = 0; i < n; i++) {
        const y = first + ((last - first) * i) / (n - 1);
        const [bx, by] = toPx([-band / 2 - 0.1, y]);
        out.stroke.push(`M${f(bx - 0.75 * s)},${f(by)} a${f(0.75 * s)},${f(0.75 * s)} 0 1,0 ${f(1.5 * s)},0 a${f(0.75 * s)},${f(0.75 * s)} 0 1,0 ${f(-1.5 * s)},0`);
      }
    }
  }

  // ---- pockets ----
  if (view === "front") {
    const style = p.pocketStyle ?? (knit ? "patch" : "welt");
    for (let i = 0; i < Math.min(p.chestPockets, 2); i++) {
      const sign = i === 0 ? 1 : -1;
      const x0 = sign * 5;
      const x1 = sign * 16;
      out.detail.push(`M${P(toPx([x0, armholeDepth - 6]))} L${P(toPx([x1, armholeDepth - 6]))} L${P(toPx([x1, armholeDepth + 6]))} L${P(toPx([x0, armholeDepth + 6]))} Z`);
    }
    if (p.sidePockets > 0) {
      const bottom = dim.length - ribH - 3;
      if (style === "kangaroo") {
        out.detail.push(`M${P(toPx([-14, bottom]))} L${P(toPx([-11, bottom - 18]))} L${P(toPx([11, bottom - 18]))} L${P(toPx([14, bottom]))} Z`);
      } else {
        for (const sign of [1, -1].slice(0, Math.min(p.sidePockets, 2))) {
          const x0 = sign * 5;
          const x1 = sign * Math.min(half - 4, 20);
          if (style === "patch") out.detail.push(`M${P(toPx([x0, bottom - 17]))} L${P(toPx([x1, bottom - 17]))} L${P(toPx([x1, bottom]))} L${P(toPx([x0, bottom]))} Z`);
          else out.stroke.push(`M${P(toPx([sign * (half - 9), bottom - 16]))} L${P(toPx([sign * (half - 3), bottom - 2]))}`);
        }
      }
    }
  } else {
    // centre back reference and back neck facing
    out.detail.push(`M${P(toPx([0, 2.5]))} L${P(toPx([0, dim.length - ribH]))}`);
    if (!knit) out.detail.push(`M${P(toPx([-shoulderHalf + 1, 9]))} L${P(toPx([shoulderHalf - 1, 9]))}`);
  }
  return out;
}

/** Vertical rib lines inside a sleeve cuff quad (c0,c1 = seam side; e0,e1 = sleeve end). */
function ribLines(c0: Pt, c1: Pt, e0: Pt, e1: Pt, fn: (q: Pt) => Pt, out: string[]) {
  const n = 7;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const a: Pt = [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t];
    const b: Pt = [e0[0] + (e1[0] - e0[0]) * t, e0[1] + (e1[1] - e0[1]) * t];
    out.push(`M${P(fn(a))} L${P(fn(b))}`);
  }
}
