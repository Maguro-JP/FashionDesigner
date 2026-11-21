import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { GarmentSpec } from "./schema.js";
import { renderFlatSvg } from "./render/flat.js";
import { renderTechPack } from "./render/techpack.js";

export async function writeOutputs(spec: GarmentSpec, outDir: string) {
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "spec.json"), JSON.stringify(spec, null, 2));
  for (const g of spec.items) {
    await writeFile(join(outDir, `${g.id}-front.svg`), renderFlatSvg(g, "front"));
    await writeFile(join(outDir, `${g.id}-back.svg`), renderFlatSvg(g, "back"));
  }
  await writeFile(join(outDir, "techpack.html"), renderTechPack(spec));
  return outDir;
}
