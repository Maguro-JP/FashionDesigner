import { z } from "zod";

/**
 * GarmentSpec: the interchange format shared with Atelier / CharacterDesigner.
 * Everything downstream (flat drawings, tech packs) is derived from this JSON,
 * so other tools only need to read/write this one shape.
 */
export const SCHEMA_ID = "fashion-designer/garment-spec@1";

const Fit = z.enum(["slim", "regular", "relaxed", "oversized"]);
const SleeveLength = z.enum(["none", "cap", "short", "elbow", "three-quarter", "long"]);
const Neckline = z.enum(["crew", "v", "scoop", "square", "turtle", "shirt-collar", "hood", "lapel", "off-shoulder"]);
const Closure = z.enum(["none", "buttons", "zip", "snaps", "toggle", "wrap", "lace-up", "hook"]);

export const TopFlat = z.object({
  template: z.literal("top"),
  sleeve: SleeveLength,
  neckline: Neckline,
  length: z.enum(["cropped", "waist", "hip", "thigh", "knee"]),
  fit: Fit,
  closure: Closure,
  chestPockets: z.number().int().describe("0-2"),
  sidePockets: z.number().int().describe("0-2"),
  cuffs: z.boolean(),
  hemBand: z.boolean().describe("ribbed or banded hem"),
  shoulder: z.enum(["set-in", "drop", "raglan"]).optional().describe("shoulder construction; defaults to set-in"),
  pocketStyle: z.enum(["welt", "patch", "kangaroo"]).optional().describe("style of side pockets"),
});

export const BottomFlat = z.object({
  template: z.literal("bottom"),
  type: z.enum(["pants", "shorts", "skirt"]),
  length: z.enum(["mini", "short", "knee", "midi", "ankle", "floor"]),
  fit: Fit,
  legShape: z.enum(["straight", "tapered", "wide", "flared", "a-line", "pencil", "pleated"]),
  waistband: z.enum(["fitted", "elastic", "drawstring", "high-rise"]),
  fly: z.boolean(),
  frontPockets: z.number().int().describe("0-2"),
  backPockets: z.number().int().describe("0-2"),
  beltLoops: z.boolean(),
});

export const DressFlat = z.object({
  template: z.literal("dress"),
  sleeve: SleeveLength,
  neckline: Neckline,
  length: z.enum(["mini", "knee", "midi", "ankle", "floor"]),
  skirtShape: z.enum(["straight", "a-line", "flared", "pleated", "mermaid"]),
  waistSeam: z.boolean(),
  closure: Closure,
});

export const FootwearFlat = z.object({
  template: z.literal("footwear"),
  type: z.enum(["sneaker", "boot", "loafer", "pump", "sandal", "oxford", "mule"]),
  shaft: z.enum(["low", "ankle", "mid-calf", "knee"]),
  heel: z.enum(["flat", "low", "mid", "high"]),
  closure: Closure,
  toe: z.enum(["round", "pointed", "square", "open"]),
});

export const BagFlat = z.object({
  template: z.literal("bag"),
  type: z.enum(["tote", "shoulder", "crossbody", "backpack", "clutch", "duffel", "pouch"]),
  closure: Closure,
  handles: z.number().int().describe("0-2 top handles"),
  strap: z.boolean().describe("long shoulder/cross strap"),
  frontPockets: z.number().int(),
});

export const AccessoryFlat = z.object({
  template: z.literal("accessory"),
  type: z.enum(["hat", "cap", "belt", "scarf", "gloves", "necklace", "earrings", "bracelet", "ring", "glasses", "watch", "apron", "other"]),
  description: z.string().describe("shape notes for drawing"),
});

export const FlatParams = z.discriminatedUnion("template", [TopFlat, BottomFlat, DressFlat, FootwearFlat, BagFlat, AccessoryFlat]);

export const Color = z.object({ name: z.string(), hex: z.string().describe("#RRGGBB") });

export const Component = z.object({
  name: z.string().describe("e.g. front panel, collar, cuff, patch pocket"),
  kind: z.enum(["panel", "collar", "sleeve", "cuff", "pocket", "closure", "trim", "lining", "hardware", "sole", "strap", "other"]),
  quantity: z.number().int(),
  material: z.string().describe("refers to materials[].id"),
  notes: z.string(),
});

export const Material = z.object({
  id: z.string(),
  role: z.enum(["shell", "lining", "interfacing", "rib", "trim", "hardware", "thread", "sole", "other"]),
  name: z.string().describe("e.g. cotton twill"),
  composition: z.string().describe("e.g. 100% cotton; 'unknown' if unsure"),
  weight: z.string().describe("e.g. 280 gsm / 10 oz; 'unknown' if unsure"),
  finish: z.string(),
  color: Color,
});

export const Measurement = z.object({
  point: z.string().describe("POM, e.g. body length HPS"),
  valueCm: z.number(),
  tolerance: z.number(),
});

export const ConstructionStep = z.object({
  order: z.number().int(),
  operation: z.string(),
  seam: z.string().describe("e.g. 1cm plain seam, overlocked"),
  stitch: z.string().describe("e.g. 301 lockstitch 3mm, double-needle topstitch"),
});

export const Garment = z.object({
  id: z.string().describe("kebab-case unique id"),
  name: z.string(),
  category: z.enum(["top", "bottom", "dress", "outerwear", "footwear", "bag", "headwear", "accessory"]),
  description: z.string(),
  colors: z.array(Color),
  flat: FlatParams,
  components: z.array(Component),
  materials: z.array(Material),
  measurements: z.array(Measurement).describe("estimated, base size M"),
  construction: z.array(ConstructionStep),
  details: z.array(z.string()).describe("design details: topstitching, logos, prints"),
  confidence: z.number().describe("0-1, how certain the decomposition is"),
});

export const GarmentSpec = z.object({
  schema: z.literal(SCHEMA_ID),
  title: z.string(),
  source: z.object({
    kind: z.enum(["image", "brief", "character"]),
    ref: z.string().describe("file name, brief text, or external id"),
  }),
  items: z.array(Garment),
  notes: z.array(z.string()).describe("assumptions and things not visible in the source"),
});

export type GarmentSpec = z.infer<typeof GarmentSpec>;
export type Garment = z.infer<typeof Garment>;
export type FlatParams = z.infer<typeof FlatParams>;

/** Model output omits the constant schema id; we stamp it ourselves. */
export const GarmentSpecModelOutput = GarmentSpec.omit({ schema: true });
