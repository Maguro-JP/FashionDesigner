import type { GarmentSpec, Garment } from "../schema.js";
import { renderFlatSvg } from "./flat.js";

/** Self-contained HTML tech pack: flats + colours + BOM + POM + construction. */
const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const table = (head: string[], rows: unknown[][]) =>
  rows.length === 0
    ? `<p class="empty">-</p>`
    : `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>`;

function garmentSection(g: Garment): string {
  return `<section class="garment" id="${esc(g.id)}">
<h2>${esc(g.name)} <small>${esc(g.category)} / ${esc(g.flat.template)} / confidence ${Math.round(g.confidence * 100)}%</small></h2>
<p>${esc(g.description)}</p>
<div class="flats">${renderFlatSvg(g, "front")}${renderFlatSvg(g, "back")}</div>
<h3>Colors</h3><div class="swatches">${g.colors.map((c) => `<span><i style="background:${/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "#fff"}"></i>${esc(c.name)} ${esc(c.hex)}</span>`).join("")}</div>
<h3>Flat parameters</h3>${table(["key", "value"], Object.entries(g.flat))}
<h3>Materials</h3>${table(["id", "role", "name", "composition", "weight", "finish", "color"], g.materials.map((m) => [m.id, m.role, m.name, m.composition, m.weight, m.finish, m.color.name]))}
<h3>Components (BOM)</h3>${table(["name", "kind", "qty", "material", "notes"], g.components.map((c) => [c.name, c.kind, c.quantity, c.material, c.notes]))}
<h3>Measurements (est., size M)</h3>${table(["point", "cm", "± cm"], g.measurements.map((m) => [m.point, m.valueCm, m.tolerance]))}
<h3>Construction</h3>${table(["#", "operation", "seam", "stitch"], [...g.construction].sort((a, b) => a.order - b.order).map((s) => [s.order, s.operation, s.seam, s.stitch]))}
<h3>Details</h3><ul>${g.details.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
</section>`;
}

export function renderTechPack(spec: GarmentSpec): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(spec.title)}</title>
<style>
:root{--fg:#111;--bg:#fff;--muted:#666;--accent:#d33a1f;--line:#ddd}
body{font-family:system-ui,sans-serif;color:var(--fg);background:var(--bg);margin:0 auto;max-width:960px;padding:16px}
h1{border-bottom:3px solid var(--accent)}h2 small{color:var(--muted);font-weight:normal;font-size:.6em}
.flats{display:flex;flex-wrap:wrap;gap:8px}.flats svg{max-width:100%;height:auto;border:1px solid var(--line);background:#fff}
table{border-collapse:collapse;width:100%;font-size:.9em}th,td{border:1px solid var(--line);padding:4px 6px;text-align:left}th{background:#f5f5f5}
.swatches span{display:inline-flex;align-items:center;gap:4px;margin-right:12px}.swatches i{width:18px;height:18px;border:1px solid #999;display:inline-block}
section.garment{page-break-after:always;margin-bottom:40px}
</style></head><body>
<h1>${esc(spec.title)}</h1>
<p>source: ${esc(spec.source.kind)} - ${esc(spec.source.ref)} / ${spec.items.length} item(s)</p>
${spec.notes.length ? `<h3>Notes</h3><ul>${spec.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
${spec.items.map(garmentSection).join("\n")}
</body></html>`;
}
