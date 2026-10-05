import type { ImagePlan } from "./product-image-prompts";

/**
 * Pure helpers for talking to an image generator from a prompt.
 *
 * Like `product-image-prompts`, this module is import-free and not marked
 * `server-only`, so the offline tool in `scripts/generate-menu-images.mjs` and
 * the running app build byte-identical URLs. That is what keeps a picture
 * stable: the same product name always produces the same request.
 */

/**
 * Generators return square images, so ask for square. The browser crops to the
 * shape the layout needs.
 */
export const GENERATED_IMAGE_SIZE = { width: 1024, height: 1024 } as const;

/** Committed assets are 4:3, matching the crop the menu cards use. */
export const MENU_IMAGE_SIZE = { width: 1024, height: 768 } as const;

/**
 * FNV-1a over the dish signature. The same dish always gets the same seed, so
 * the generator returns the same picture instead of a new one on every visit.
 */
export function seedFor(signature: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 2_147_483_647;
}

export type GeneratorOptions = {
  /** Endpoint containing the literal `{prompt}` placeholder. */
  endpoint: string;
  model: string;
  width: number;
  height: number;
};

/** Builds the request URL that renders `plan`. */
export function generatorUrl(plan: ImagePlan, options: GeneratorOptions): string {
  const { endpoint, model, width, height } = options;
  const base = endpoint.replace("{prompt}", encodeURIComponent(plan.prompt));
  const query = new URLSearchParams({
    width: String(width),
    height: String(height),
    seed: String(seedFor(plan.signature)),
    model,
    nologo: "true",
    private: "true",
  });
  return `${base}?${query.toString()}`;
}