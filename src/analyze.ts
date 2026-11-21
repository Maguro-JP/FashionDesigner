import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { readFile } from "node:fs/promises";
import { extname, basename } from "node:path";
import { GarmentSpec, GarmentSpecModelOutput, SCHEMA_ID } from "./schema.js";

export const MODEL = process.env.FASHION_MODEL ?? "claude-opus-5-5";

const SYSTEM = `You are a senior technical fashion designer and pattern maker.
Decompose the outfit into separate items (garments, footwear, bags, accessories), one entry per physical item.
For each item, choose the flat template and parameters that best match what you see, list materials with
likely composition and weight, components (bill of materials), estimated points of measure for size M,
and an ordered construction (sewing/assembly) sequence a factory could follow.
If something is not visible (back side, inner lining), make a reasonable assumption and record it in notes.
Write free-text fields in Japanese. Keep enum values exactly as defined.`;

const MEDIA: Record<string, "image/png" | "image/jpeg" | "image/webp" | "image/gif"> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
};

async function run(content: Anthropic.ContentBlockParam[], source: GarmentSpec["source"], client: Anthropic): Promise<GarmentSpec> {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "high", format: zodOutputFormat(GarmentSpecModelOutput) },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal") throw new Error("The model declined this request.");
  if (response.stop_reason === "max_tokens") throw new Error("Output was cut off (max_tokens). Try an image with fewer items.");
  if (!response.parsed_output) throw new Error("Model output did not match the GarmentSpec schema.");
  return GarmentSpec.parse({ ...response.parsed_output, schema: SCHEMA_ID, source });
}

/** Image -> GarmentSpec (decomposition). */
export async function analyzeImage(path: string, opts: { hint?: string; client?: Anthropic } = {}): Promise<GarmentSpec> {
  const media = MEDIA[extname(path).toLowerCase()];
  if (!media) throw new Error(`Unsupported image type: ${path} (png/jpg/webp/gif)`);
  const data = (await readFile(path)).toString("base64");
  return run(
    [
      { type: "image", source: { type: "base64", media_type: media, data } },
      { type: "text", text: `Decompose every item worn or carried in this image into a GarmentSpec.${opts.hint ? `\nUser note: ${opts.hint}` : ""}` },
    ],
    { kind: "image", ref: basename(path) },
    opts.client ?? new Anthropic(),
  );
}

/** Brief text -> new design as GarmentSpec. */
export async function designFromBrief(brief: string, opts: { client?: Anthropic } = {}): Promise<GarmentSpec> {
  return run([{ type: "text", text: `Design a new outfit/item for this brief and output it as a GarmentSpec:\n${brief}` }], { kind: "brief", ref: brief.slice(0, 200) }, opts.client ?? new Anthropic());
}
