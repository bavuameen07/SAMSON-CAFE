/**
 * Guards the promise that two different product names never share an image.
 *
 * Signatures are what decide which photo a product gets, so a collision in the
 * dish table would quietly give two products the same picture. Run this after
 * editing lib/product-image-prompts.ts:
 *
 *   npm run images:check
 */
const { describeProduct } = await import("../lib/product-image-prompts.ts");
const { generatorUrl } = await import("../lib/image-generator.ts");

/**
 * Current sheet, the examples from the brief, and likely future additions.
 * These have to be genuinely different products: two names for the same drink
 * ("cold coffee" and "iced coffee") are meant to share a picture, so including
 * both here would fail the collision check for the wrong reason.
 */
const NAMES = [
  "Cappuccino", "Espresso", "Americano", "Latte", "Iced Latte", "Mocha", "Cold Coffee",
  "Vanilla Latte", "Burger", "Pizza", "Brownie", "Chai Latte", "Matcha Latte",
  "Iced Americano", "Hot Chocolate", "Cold Coffee With Ice Cream", "Strawberry Smoothie",
  "Lemon Iced Tea", "Blueberry Cheesecake", "Chocolate Croissant", "Club Sandwich",
  "Cold Mocha", "Filter Coffee", "Espresso Doppio", "Chicken 65", "Pesto Pasta",
  "Waffles With Strawberries", "  ",
];

const generator = {
  endpoint: "https://image.pollinations.ai/prompt/{prompt}",
  model: "flux",
  width: 1024,
  height: 1024,
};

const signatureOwner = new Map();
const problems = [];

for (const name of NAMES) {
  const plan = describeProduct(name);
  if (!plan) {
    if (name.trim()) problems.push(`${JSON.stringify(name)} resolved to nothing`);
    continue;
  }
  if (!plan.alt.trim()) problems.push(`${name} has no alt text`);
  if (signatureOwner.has(plan.signature)) {
    const other = signatureOwner.get(plan.signature);
    problems.push(`${name} and ${other} both resolve to "${plan.signature}"`);
  }
  signatureOwner.set(plan.signature, name);
}

// The URL is the picture, so an unstable one means a different image per visit.
for (const name of ["Burger", "Cold Coffee"]) {
  const first = generatorUrl(describeProduct(name), generator);
  const second = generatorUrl(describeProduct(name), generator);
  if (first !== second) problems.push(`${name} does not resolve to a stable URL`);
}

if (problems.length) {
  for (const problem of problems) process.stdout.write(`x ${problem}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `ok ${signatureOwner.size} distinct images for ${NAMES.length - 1} names, all stable\n`,
  );
}