import type { Garment, FlatParams } from "../schema.js";

/**
 * Parametric flat-sketch renderer.
 * Each template builds the right half of the outline and mirrors it around
 * the centre line, so front/back always stay symmetric and consistent.
 */
export const VIEW_W = 400;
export const VIEW_H = 480;
const CX = VIEW_W / 2;

type Pt = [number, number];
type View = "front" | "back";
type Paths = string[];

const fmt = (n: number) => Number(n.toFixed(1));
const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [CX - (x - CX), y] as Pt);
const poly = (pts: Pt[]) => "M" + pts.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(" L") + " Z";
const line = (a: Pt, b: Pt) => `M${fmt(a[0])},${fmt(a[1])} L${fmt(b[0])},${fmt(b[1])}`;
/** Symmetric closed outline from a right-half point list ordered top -> bottom. */
const symmetric = (rightHalf: Pt[]) => poly([...rightHalf, ...mirror(rightHalf).reverse()]);

const FIT_HALF_WIDTH = { slim: 68, regular: 78, relaxed: 88, oversized: 102 } as const;

// ---------- tops ----------
type TopLike = {
  sleeve: "none" | "cap" | "short" | "elbow" | "three-quarter" | "long";
  neckline: "crew" | "v" | "scoop" | "square" | "turtle" | "shirt-collar" | "hood" | "lapel" | "off-shoulder";
  fit: keyof typeof FIT_HALF_WIDTH;
  closure: string;
  cuffs?: boolean;
};

const SLEEVE_LEN = { none: 0, cap: 22, short: 70, elbow: 130, "three-quarter": 175, long: 235 } as const;

function bodice(p: TopLike, bottomY: number, view: View, out: { outline: Paths; detail: Paths }) {
  const bw = FIT_HALF_WIDTH[p.fit];
  const top = 60;
  const neckHalf = p.neckline === "off-shoulder" ? bw - 5 : p.neckline === "turtle" ? 26 : 32;
  const shoulder: Pt = [CX + bw + 10, top + 12];
  const armpit: Pt = [CX + bw, top + 85];
  const hem: Pt = [CX + bw + (p.fit === "oversized" ? 6 : 2), bottomY];
  out.outline.push(symmetric([[CX + neckHalf, top], shoulder, armpit, hem]));

  // sleeves: a quad hanging from the armhole, angled outward
  const len = SLEEVE_LEN[p.sleeve];
  if (len > 0) {
    // keep long sleeves of wide bodies on the canvas by steepening the angle
    const dx = Math.min(0.42, (VIEW_W - 8 - shoulder[0]) / len);
    const d: Pt = [dx, Math.sqrt(1 - dx * dx)];
    const s1 = shoulder;
    const s2 = armpit;
    const e1: Pt = [s1[0] + d[0] * len, s1[1] + d[1] * len];
    const taper = Math.min(len * 0.35, 28);
    const e2: Pt = [s2[0] + d[0] * Math.max(len - 55, 8) + taper * 0.3, s2[1] + d[1] * Math.max(len - 55, 8)];
    const right = poly([s1, e1, e2, s2]);
    out.outline.push(right, poly(mirror([s1, e1, e2, s2])));
    if (p.cuffs && len > 100) {
      const c1: Pt = [e1[0] - d[0] * 18, e1[1] - d[1] * 18];
      const c2: Pt = [e2[0] - d[0] * 18, e2[1] - d[1] * 18];
      out.detail.push(line(c1, c2), line(...(mirror([c1, c2]) as [Pt, Pt])));
    }
  }

  // neckline
  const nl = (x: number) => CX + x;
  if (view === "back") {
    out.detail.push(`M${nl(-neckHalf)},${top} Q${CX},${top + 10} ${nl(neckHalf)},${top}`);
    if (p.neckline === "hood") {
      out.outline.push(`M${nl(-neckHalf - 18)},${top + 10} C${nl(-90)},${top - 58} ${nl(90)},${top - 58} ${nl(neckHalf + 18)},${top + 10} Z`);
      out.detail.push(`M${CX},${top - 50} L${CX},${top + 6}`);
    }
    if (p.neckline === "turtle") out.outline.push(poly([[nl(-neckHalf), top - 30], [nl(neckHalf), top - 30], [nl(neckHalf), top], [nl(-neckHalf), top]]));
    if (p.neckline === "shirt-collar" || p.neckline === "lapel") out.outline.push(poly([[nl(-neckHalf - 4), top - 12], [nl(neckHalf + 4), top - 12], [nl(neckHalf + 10), top + 8], [nl(-neckHalf - 10), top + 8]]));
    return;
  }
  switch (p.neckline) {
    case "crew":
      out.detail.push(`M${nl(-neckHalf)},${top} Q${CX},${top + 32} ${nl(neckHalf)},${top}`);
      break;
    case "scoop":
      out.detail.push(`M${nl(-neckHalf)},${top} Q${CX},${top + 70} ${nl(neckHalf)},${top}`);
      break;
    case "v":
      out.detail.push(`M${nl(-neckHalf)},${top} L${CX},${top + 65} L${nl(neckHalf)},${top}`);
      break;
    case "square":
      out.detail.push(`M${nl(-neckHalf)},${top} L${nl(-neckHalf)},${top + 40} L${nl(neckHalf)},${top + 40} L${nl(neckHalf)},${top}`);
      break;
    case "off-shoulder":
      out.detail.push(`M${nl(-neckHalf)},${top} Q${CX},${top + 18} ${nl(neckHalf)},${top}`);
      break;
    case "turtle":
      out.outline.push(poly([[nl(-neckHalf), top - 30], [nl(neckHalf), top - 30], [nl(neckHalf), top], [nl(-neckHalf), top]]));
      out.detail.push(line([nl(-neckHalf), top - 22], [nl(neckHalf), top - 22]));
      break;
    case "hood":
      out.outline.push(`M${nl(-neckHalf - 18)},${top + 10} C${nl(-90)},${top - 58} ${nl(90)},${top - 58} ${nl(neckHalf + 18)},${top + 10} Q${CX},${top + 40} ${nl(-neckHalf - 18)},${top + 10} Z`);
      out.detail.push(`M${nl(-neckHalf + 4)},${top + 2} C${nl(-50)},${top - 50} ${nl(50)},${top - 50} ${nl(neckHalf - 4)},${top + 2}`);
      break;
    case "shirt-collar": {
      const r: Pt[] = [[CX, top + 22], [nl(neckHalf + 4), top - 10], [nl(neckHalf + 14), top + 10], [nl(10), top + 34]];
      out.outline.push(poly(r), poly(mirror(r)));
      break;
    }
    case "lapel": {
      const r: Pt[] = [[nl(neckHalf), top], [nl(neckHalf + 26), top + 40], [nl(12), top + 110], [CX, top + 120]];
      out.outline.push(poly(r), poly(mirror(r)));
      break;
    }
  }
}

function closureDetail(closure: string, fromY: number, toY: number, out: Paths) {
  if (closure === "none" || closure === "wrap") return;
  out.push(line([CX, fromY], [CX, toY]));
  if (closure === "buttons" || closure === "snaps" || closure === "toggle") {
    const n = Math.max(3, Math.round((toY - fromY) / 45));
    for (let i = 0; i < n; i++) {
      const y = fromY + 14 + ((toY - fromY - 28) * i) / Math.max(n - 1, 1);
      out.push(`M${CX + 9},${fmt(y)} a4,4 0 1,0 0.01,0`);
    }
  } else if (closure === "zip") {
    out.push(`M${CX - 3},${fromY} L${CX - 3},${toY} M${CX + 3},${fromY} L${CX + 3},${toY}`);
  }
}

const TOP_LEN = { cropped: 220, waist: 255, hip: 320, thigh: 380, knee: 440 } as const;

function renderTop(p: Extract<FlatParams, { template: "top" }>, view: View) {
  const out = { outline: [] as Paths, detail: [] as Paths };
  const bottom = TOP_LEN[p.length];
  bodice(p, bottom, view, out);
  const bw = FIT_HALF_WIDTH[p.fit];
  if (p.hemBand) out.detail.push(line([CX - bw - 2, bottom - 16], [CX + bw + 2, bottom - 16]));
  if (view === "front") {
    const start = p.neckline === "v" || p.neckline === "lapel" ? 130 : 90;
    closureDetail(p.closure, start, bottom, out.detail);
    for (let i = 0; i < Math.min(p.chestPockets, 2); i++) {
      const x = i === 0 ? CX + 22 : CX - 62;
      out.detail.push(poly([[x, 110], [x + 40, 110], [x + 40, 150], [x, 150]]));
    }
    if (p.sidePockets > 0) {
      const y = bottom - 90;
      out.detail.push(line([CX + bw - 30, y], [CX + bw - 8, y + 50]), line([CX - bw + 30, y], [CX - bw + 8, y + 50]));
    }
  } else {
    out.detail.push(line([CX - bw + 4, 95], [CX + bw - 4, 95])); // back yoke reference
  }
  return out;
}

// ---------- bottoms ----------
const BOTTOM_LEN = { mini: 200, short: 230, knee: 300, midi: 360, ankle: 440, floor: 462 } as const;
const LEG_HEM = { straight: 46, tapered: 32, wide: 66, flared: 82, "a-line": 120, pencil: 64, pleated: 130 } as const;

function renderBottom(p: Extract<FlatParams, { template: "bottom" }>, view: View) {
  const out = { outline: [] as Paths, detail: [] as Paths };
  const ww = FIT_HALF_WIDTH[p.fit] - 6;
  const waistTop = p.waistband === "high-rise" ? 40 : 60;
  const bandBottom = waistTop + 22;
  const end = BOTTOM_LEN[p.length];
  const hipW = ww + 14;
  if (p.type === "skirt") {
    const hemW = p.legShape === "pencil" ? hipW - 8 : Math.max(LEG_HEM[p.legShape], hipW + 10);
    out.outline.push(symmetric([[CX + ww, waistTop], [CX + hipW, 150], [CX + hemW, end]]));
    if (p.legShape === "pleated") for (let i = -3; i <= 3; i++) out.detail.push(line([CX + i * 16, bandBottom], [CX + i * 28, end]));
  } else {
    // skirt-only shapes (a-line, pleated) are clamped so trousers stay on the canvas
    const legHalf = Math.min(LEG_HEM[p.legShape], LEG_HEM.flared);
    const crotchY = 185;
    const outerHem: Pt = [CX + Math.max(hipW, legHalf * 2 + 4), end];
    const innerHem: Pt = [outerHem[0] - legHalf * 2, end];
    const right: Pt[] = [[CX + ww, waistTop], [CX + hipW, 150], outerHem, innerHem, [CX + 3, crotchY]];
    out.outline.push(poly([[CX, waistTop], ...right, [CX - 3, crotchY], ...mirror(right.slice(0, 4)).reverse(), [CX - ww, waistTop]]));
    if (view === "front") out.detail.push(line([CX, bandBottom], [CX, crotchY]));
    if (view === "front" && p.fly) out.detail.push(`M${CX + 18},${bandBottom} L${CX + 18},${crotchY - 25} Q${CX + 18},${crotchY - 8} ${CX},${crotchY - 6}`);
  }
  // waistband
  out.outline.push(poly([[CX - ww, waistTop], [CX + ww, waistTop], [CX + ww + 1, bandBottom], [CX - ww - 1, bandBottom]]));
  if (p.waistband === "elastic" || p.waistband === "drawstring") for (let x = -ww + 8; x < ww; x += 10) out.detail.push(line([CX + x, waistTop + 3], [CX + x, bandBottom - 3]));
  if (p.waistband === "drawstring" && view === "front") out.detail.push(`M${CX - 6},${bandBottom} l-8,40 M${CX + 6},${bandBottom} l8,40`);
  if (p.beltLoops) for (const x of [-ww + 10, -ww / 2, ww / 2, ww - 10]) out.detail.push(poly([[CX + x - 2, waistTop - 3], [CX + x + 2, waistTop - 3], [CX + x + 2, bandBottom + 3], [CX + x - 2, bandBottom + 3]]));
  if (view === "front" && p.frontPockets > 0) {
    out.detail.push(`M${CX + ww - 28},${bandBottom} Q${CX + ww - 22},${bandBottom + 34} ${CX + hipW - 2},${bandBottom + 44}`);
    if (p.frontPockets > 1) out.detail.push(`M${CX - ww + 28},${bandBottom} Q${CX - ww + 22},${bandBottom + 34} ${CX - hipW + 2},${bandBottom + 44}`);
  }
  if (view === "back") {
    for (let i = 0; i < Math.min(p.backPockets, 2); i++) {
      const x = i === 0 ? CX + 18 : CX - 58;
      out.detail.push(poly([[x, bandBottom + 18], [x + 40, bandBottom + 18], [x + 38, bandBottom + 60], [x + 20, bandBottom + 68], [x + 2, bandBottom + 60]]));
    }
    out.detail.push(line([CX, bandBottom], [CX, p.type === "skirt" ? bandBottom + 60 : 185]));
  }
  return out;
}

// ---------- dress ----------
function renderDress(p: Extract<FlatParams, { template: "dress" }>, view: View) {
  const out = { outline: [] as Paths, detail: [] as Paths };
  const waistY = 205;
  bodice({ ...p, fit: "slim" }, waistY, view, out);
  // dress hem is measured from a waist seam at y=205, so it needs its own scale
  const end = { mini: 290, knee: 335, midi: 390, ankle: 445, floor: 462 }[p.length];
  const hem = { straight: 82, "a-line": 120, flared: 150, pleated: 135, mermaid: 110 }[p.skirtShape];
  const skirt: Pt[] = p.skirtShape === "mermaid"
    ? [[CX + 70, waistY], [CX + 76, waistY + 80], [CX + 60, end - 70], [CX + hem, end]]
    : [[CX + 70, waistY], [CX + hem, end]];
  out.outline.push(symmetric(skirt));
  if (p.waistSeam) out.detail.push(line([CX - 70, waistY], [CX + 70, waistY]));
  if (p.skirtShape === "pleated" || p.skirtShape === "flared") for (let i = -2; i <= 2; i++) out.detail.push(line([CX + i * 22, waistY + 10], [CX + i * 40, end]));
  if ((view === "back" && p.closure === "zip") || (view === "front" && p.closure === "buttons")) closureDetail(p.closure, 70, waistY + 60, out.detail);
  return out;
}

// ---------- footwear (front = lateral side, back = top view) ----------
function renderFootwear(p: Extract<FlatParams, { template: "footwear" }>, view: View) {
  const out = { outline: [] as Paths, detail: [] as Paths };
  const heelH = { flat: 6, low: 22, mid: 45, high: 75 }[p.heel];
  const shaftTop = { low: 260, ankle: 215, "mid-calf": 140, knee: 60 }[p.shaft];
  const groundY = 400;
  if (view === "front") {
    const soleTop = groundY - 18;
    out.outline.push(`M60,${groundY} L60,${soleTop - heelH} L110,${soleTop - heelH} L${p.heel === "flat" ? 340 : 230},${soleTop} L345,${soleTop} Q365,${soleTop} 360,${groundY} Z`);
    out.outline.push(`M64,${soleTop - heelH} L70,${shaftTop} L150,${shaftTop} Q170,${shaftTop + 60} 210,${soleTop - 70 - heelH / 2} Q${p.toe === "pointed" ? 330 : 300},${soleTop - 50} ${p.toe === "pointed" ? 360 : 345},${soleTop} L110,${soleTop - heelH} Z`);
    if (p.closure === "lace-up") for (let i = 0; i < 5; i++) out.detail.push(line([150 + i * 12, shaftTop + 30 + i * 18], [170 + i * 12, shaftTop + 22 + i * 18]));
    if (p.closure === "zip") out.detail.push(line([90, shaftTop + 5], [92, soleTop - heelH - 10]));
    if (p.type === "sandal") out.detail.push(line([120, soleTop - 40], [300, soleTop - 30]));
    out.detail.push(line([60, groundY - 6], [360, groundY - 6]));
  } else {
    const toeW = p.toe === "pointed" ? 10 : p.toe === "square" ? 50 : 40;
    out.outline.push(`M200,60 C${200 + toeW + 30},60 ${255},150 250,250 C245,350 235,420 200,430 C165,420 155,350 150,250 C145,150 ${200 - toeW - 30},60 200,60 Z`);
    out.detail.push(`M170,250 Q200,${p.shaft === "low" ? 230 : 210} 230,250 Q232,330 200,340 Q168,330 170,250 Z`);
    if (p.closure === "lace-up") for (let i = 0; i < 5; i++) out.detail.push(line([180, 150 + i * 18], [220, 150 + i * 18]));
  }
  return out;
}

// ---------- bags ----------
function renderBag(p: Extract<FlatParams, { template: "bag" }>, view: View) {
  const out = { outline: [] as Paths, detail: [] as Paths, stroke: [] as Paths };
  const dims = { tote: [140, 150], shoulder: [120, 110], crossbody: [90, 80], backpack: [110, 160], clutch: [120, 60], duffel: [160, 90], pouch: [80, 70] }[p.type];
  const [hw, hh] = dims as [number, number];
  const top = 260 - hh;
  const bottom = 260 + hh;
  out.outline.push(poly([[CX - hw, top], [CX + hw, top], [CX + hw + (p.type === "tote" ? 10 : 0), bottom], [CX - hw - (p.type === "tote" ? 10 : 0), bottom]]));
  for (let i = 0; i < Math.min(p.handles, 2); i++) {
    const off = i === 0 ? 0 : 6;
    out.stroke.push(`M${CX - hw / 2 - off},${top} C${CX - hw / 2},${top - 90} ${CX + hw / 2},${top - 90} ${CX + hw / 2 + off},${top}`);
  }
  if (p.strap) out.stroke.push(`M${CX - hw},${top + 6} C${CX - hw - 40},${Math.max(top - 200, 4)} ${CX + hw + 40},${Math.max(top - 200, 4)} ${CX + hw},${top + 6}`);
  if (view === "front") {
    if (p.closure === "zip") out.detail.push(line([CX - hw + 10, top + 10], [CX + hw - 10, top + 10]));
    if (p.closure !== "zip" && p.closure !== "none") out.detail.push(`M${CX - hw},${top} L${CX - hw},${top + hh * 0.7} Q${CX},${top + hh * 0.9} ${CX + hw},${top + hh * 0.7} L${CX + hw},${top}`, `M${CX + 6},${fmt(top + hh * 0.78)} a6,6 0 1,0 0.01,0`);
    for (let i = 0; i < Math.min(p.frontPockets, 2); i++) {
      const x = i === 0 ? CX - hw * 0.6 : CX + 5;
      out.detail.push(poly([[x, bottom - hh * 0.8], [x + hw * 0.55, bottom - hh * 0.8], [x + hw * 0.55, bottom - 15], [x, bottom - 15]]));
    }
  } else if (p.type === "backpack") {
    out.detail.push(`M${CX - 40},${top + 10} Q${CX - 70},${CX} ${CX - 50},${bottom - 10}`, `M${CX + 40},${top + 10} Q${CX + 70},${CX} ${CX + 50},${bottom - 10}`);
  }
  return out;
}

// ---------- accessories ----------
function renderAccessory(p: Extract<FlatParams, { template: "accessory" }>, view: View) {
  const out = { outline: [] as Paths, detail: [] as Paths };
  switch (p.type) {
    case "hat":
      out.outline.push(`M70,300 Q200,330 330,300 Q300,280 270,280 L260,170 Q200,140 140,170 L130,280 Q100,280 70,300 Z`);
      out.detail.push(line([132, 262], [268, 262]));
      break;
    case "cap":
      out.outline.push(`M120,290 Q120,160 200,160 Q280,160 280,290 Z`, `M${view === "front" ? "120,290 Q200,330 280,290 Q200,300 120,290 Z" : "160,290 L240,290 L240,275 L160,275 Z"}`);
      out.detail.push(line([200, 160], [200, 290]));
      break;
    case "belt":
      out.outline.push(poly([[40, 230], [360, 230], [360, 256], [40, 256]]), poly([[70, 220], [110, 220], [110, 266], [70, 266]]));
      for (let x = 160; x < 340; x += 30) out.detail.push(`M${x},243 a3,3 0 1,0 0.01,0`);
      break;
    case "scarf":
      out.outline.push(poly([[120, 80], [280, 80], [280, 420], [120, 420]]));
      for (let x = 125; x < 280; x += 10) out.detail.push(line([x, 420], [x, 440]));
      break;
    case "glasses":
      out.outline.push(`M90,240 a50,40 0 1,0 100,0 a50,40 0 1,0 -100,0 Z`, `M210,240 a50,40 0 1,0 100,0 a50,40 0 1,0 -100,0 Z`);
      out.detail.push(`M190,235 Q200,225 210,235`, line([90, 232], [50, 225]), line([310, 232], [350, 225]));
      break;
    default:
      out.outline.push(`M200,240 m-90,0 a90,90 0 1,0 180,0 a90,90 0 1,0 -180,0`);
      out.detail.push(`M200,240 m-70,0 a70,70 0 1,0 140,0 a70,70 0 1,0 -140,0`);
  }
  return out;
}

export function flatPaths(flat: FlatParams, view: View) {
  switch (flat.template) {
    case "top": return renderTop(flat, view);
    case "bottom": return renderBottom(flat, view);
    case "dress": return renderDress(flat, view);
    case "footwear": return renderFootwear(flat, view);
    case "bag": return renderBag(flat, view);
    case "accessory": return renderAccessory(flat, view);
  }
}

const escapeXml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
const safeHex = (hex: string | undefined) => (hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#ffffff");

export function renderFlatSvg(g: Garment, view: View): string {
  const paths = flatPaths(g.flat, view);
  const { outline, detail } = paths;
  const stroke: Paths = "stroke" in paths ? (paths.stroke as Paths) : [];
  const fill = safeHex(g.colors[0]?.hex);
  const label = g.flat.template === "footwear" ? (view === "front" ? "SIDE" : "TOP") : view.toUpperCase();
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" width="${VIEW_W}" height="${VIEW_H}" data-garment="${escapeXml(g.id)}" data-view="${view}">`,
    `<title>${escapeXml(g.name)} - ${label}</title>`,
    `<g fill="${fill}" fill-opacity="0.35" stroke="#111" stroke-width="2" stroke-linejoin="round">`,
    ...outline.map((d) => `<path d="${d}"/>`),
    `</g>`,
    `<g fill="none" stroke="#111" stroke-width="2">`,
    ...stroke.map((d) => `<path d="${d}"/>`),
    `</g>`,
    `<g fill="none" stroke="#111" stroke-width="1.2" stroke-dasharray="4 3">`,
    ...detail.map((d) => `<path d="${d}"/>`),
    `</g>`,
    `<text x="12" y="${VIEW_H - 12}" font-family="sans-serif" font-size="12" fill="#555">${escapeXml(label)}</text>`,
    `</svg>`,
  ].join("\n");
}
