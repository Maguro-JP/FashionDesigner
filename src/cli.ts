#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { GarmentSpec } from "./schema.js";
import { writeOutputs } from "./output.js";

const USAGE = `usage:
  fashion-designer decompose <image> [--hint "..."] [--out dir]   image -> spec.json + flats + techpack.html
  fashion-designer design "<brief>" [--out dir]                   brief -> new design
  fashion-designer render <spec.json> [--out dir]                 re-render from an (edited) spec`;

function arg(name: string, argv: string[]) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main(argv: string[]) {
  const [cmd, target] = argv;
  const out = arg("--out", argv) ?? "out";
  if (!cmd || !target) throw new Error(USAGE);
  let spec: GarmentSpec;
  if (cmd === "render") spec = GarmentSpec.parse(JSON.parse(await readFile(target, "utf8")));
  else if (cmd === "decompose") spec = await (await import("./analyze.js")).analyzeImage(target, { hint: arg("--hint", argv) });
  else if (cmd === "design") spec = await (await import("./analyze.js")).designFromBrief(target);
  else throw new Error(USAGE);
  await writeOutputs(spec, out);
  console.log(`${spec.items.length} item(s) -> ${out}/ (spec.json, *.svg, techpack.html)`);
}

main(process.argv.slice(2)).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
