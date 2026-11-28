import { describe, it, expect } from "vitest";
import { readFileSync, mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GarmentSpec, GarmentSpecModelOutput, FlatParams } from "../src/schema.js";
import { renderFlatSvg, flatPaths, VIEW_W, VIEW_H } from "../src/render/flat.js";
import { renderTechPack } from "../src/render/techpack.js";
import { writeOutputs } from "../src/output.js";

const spec = GarmentSpec.parse(JSON.parse(readFileSync("fixtures/street-outfit.spec.json", "utf8")));

/** Every option of every template, so no parameter combination can emit NaN or off-canvas paths. */
function allFlatVariants(): FlatParams[] {
  const out: FlatParams[] = [];
  for (const option of FlatParams.options) {
    const shape = option.shape as Record<string, any>;
    const base: Record<string, unknown> = {};
    const enums: [string, string[]][] = [];
    for (const [k, raw] of Object.entries(shape)) {
      const optional = raw.type === "optional";
      const v = optional ? raw.unwrap() : raw;
      if (optional) { if (v.options) enums.push([k, v.options]); continue; }
      if (v.options && Array.isArray(v.options)) { enums.push([k, v.options]); base[k] = v.options[0]; }
      else if (v.value !== undefined) base[k] = v.value;
      else if (v.type === "number") base[k] = 2;
      else if (v.type === "boolean") base[k] = true;
      else base[k] = "x";
    }
    for (const [k, values] of enums) for (const val of values) out.push(FlatParams.parse({ ...base, [k]: val }));
  }
  return out;
}

describe("flat renderer", () => {
  const variants = allFlatVariants();
  it("covers every template", () => {
    expect(new Set(variants.map((v) => v.template)).size).toBe(6);
  });
  it.each(variants.map((v, i) => [i, v] as const))("variant %i renders finite in-bounds geometry", (_i, flat) => {
    for (const view of ["front", "back"] as const) {
      const { outline } = flatPaths(flat, view);
      expect(outline.length).toBeGreaterThan(0);
      const p = flatPaths(flat, view);
      const all = [...outline, ...p.detail, ...(p.stroke ?? []), ...(p.rib ?? [])].join(" ");
      expect(all).not.toMatch(/NaN|undefined|Infinity/);
      // absolute coordinates (M/L/Q/C pairs) stay on the canvas
      for (const m of all.matchAll(/[MLQC]\s*(-?[\d.]+),(-?[\d.]+)/g)) {
        expect(Number(m[1])).toBeGreaterThanOrEqual(-1);
        expect(Number(m[1])).toBeLessThanOrEqual(VIEW_W + 1);
        expect(Number(m[2])).toBeGreaterThanOrEqual(-1);
        expect(Number(m[2])).toBeLessThanOrEqual(VIEW_H + 1);
      }
    }
  });
  it("draws tops to the garment's measurements", () => {
    const g = spec.items[0]!;
    const widthOf = (cm: number) => {
      const d = flatPaths(g.flat, "front", { measurements: [{ point: "身幅", valueCm: cm, tolerance: 1 }, { point: "着丈", valueCm: 68, tolerance: 1 }] }).outline[0]!;
      const xs = [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => Number(m[1]));
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(widthOf(62)).toBeGreaterThan(widthOf(48) * 1.15);
  });
  it("front and back differ for a zip hoodie", () => {
    const g = spec.items[0]!;
    expect(renderFlatSvg(g, "front")).not.toBe(renderFlatSvg(g, "back"));
  });
  it("rejects unsafe colour values", () => {
    const g = { ...spec.items[0]!, colors: [{ name: "x", hex: "red\" onload=\"x" }] };
    expect(renderFlatSvg(g, "front")).toContain('fill="#ffffff"');
  });
});

describe("tech pack", () => {
  it("escapes user text", () => {
    const evil = GarmentSpec.parse({ ...spec, title: "<script>alert(1)</script>" });
    const html = renderTechPack(evil);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
  it("includes one section per item with two flats each", () => {
    const html = renderTechPack(spec);
    expect(html.match(/<section class="garment"/g)?.length).toBe(spec.items.length);
    expect(html.match(/<svg /g)?.length).toBe(spec.items.length * 2);
  });
});

describe("schema / io", () => {
  it("builds a structured-output format for the model schema", () => {
    expect(() => zodOutputFormat(GarmentSpecModelOutput)).not.toThrow();
  });
  it("rejects a spec with the wrong schema id", () => {
    expect(GarmentSpec.safeParse({ ...spec, schema: "other@1" }).success).toBe(false);
  });
  it("writes spec, svgs and techpack", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fd-"));
    await writeOutputs(spec, dir);
    expect(existsSync(join(dir, "spec.json"))).toBe(true);
    expect(existsSync(join(dir, "techpack.html"))).toBe(true);
    for (const g of spec.items) expect(existsSync(join(dir, `${g.id}-front.svg`))).toBe(true);
    expect(GarmentSpec.parse(JSON.parse(readFileSync(join(dir, "spec.json"), "utf8")))).toEqual(spec);
  });
});
