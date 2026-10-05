/**
 * Turns a menu item name into an image plan.
 *
 * This module is deliberately pure: no I/O, no config, no `server-only`, and no
 * imports. That lets the Next.js server (`lib/product-images.ts`) and the
 * offline tool (`scripts/generate-menu-images.mjs`) derive byte-identical
 * prompts, so an image generated on a laptop is the same image the site
 * resolves later.
 *
 * The pipeline is:
 *
 *   product name -> words -> dish + modifiers -> signature
 *                              -> subject -> prompt (generates the picture)
 *                                          -> alt   (describes it in the DOM)
 *
 * `signature` is the stable identity of a dish. It keys the generated asset on
 * disk and seeds the remote generator, so the same name always resolves to the
 * same picture, and a renamed product resolves to a new, matching one.
 */

/** Shared photography look, so every menu image reads as one shoot. */
export const PHOTO_STYLE =
  "Professional realistic cafe food photography, soft warm natural window light, " +
  "shallow depth of field, 50mm lens, appetising, high detail, styled on a ceramic " +
  "plate or wooden board, no people, no text, no logo, no watermark.";

export type ImagePlan = {
  /** The product name the plan was built from. */
  name: string;
  /** Stable, URL-safe identity of the dish, e.g. `vanilla-latte`. */
  signature: string;
  /** The dish described in photography terms. */
  subject: string;
  /** Full generation prompt. */
  prompt: string;
  /** Alt text, derived from the product name. */
  alt: string;
};

type Dish = {
  /** Slug fragment for the signature. */
  key: string;
  /** Lower-case word sequences that identify this dish, e.g. `["iced","latte"]`. */
  words: string[][];
  /** The dish described in photography terms. */
  subject: string;
};

type Modifier = {
  /** Slug fragment for the signature. */
  token: string;
  /** Any one of these word sequences in the name enables it. */
  any: string[][];
  /** Photography detail appended to the subject. */
  clause: string;
  /** Words that mean the subject already covers this modifier, so skip it. */
  mentions?: string[];
};

/**
 * Dish table. Longer phrases match first, so `iced latte` wins over `latte` and
 * `cold brew` wins over `brew`. Names missing from this table still resolve: the
 * name itself becomes the subject, so new sheet rows get a matching picture.
 */
const DISHES: Dish[] = [
  // Coffee, served hot -------------------------------------------------------
  {
    key: "espresso",
    words: [["espresso"]],
    subject:
      "a single shot of freshly pulled espresso with a rich dark hazelnut crema, " +
      "in a small white ceramic espresso cup on a saucer",
  },
  {
    key: "doppio",
    words: [["doppio"], ["double", "shot"]],
    subject: "a double shot of espresso under a thick golden crema in a small ceramic cup",
  },
  {
    key: "cortado",
    words: [["cortado"]],
    subject: "a cortado, equal parts espresso and warm steamed milk in a small glass",
  },
  {
    key: "macchiato",
    words: [["macchiato"]],
    subject:
      "an espresso macchiato, a shot of espresso marked with a spoonful of dense " +
      "milk foam, in a small white ceramic cup",
  },
  {
    key: "americano",
    words: [["americano"]],
    subject:
      "an americano, espresso lengthened with hot water into deep black coffee, " +
      "served in a white ceramic cup",
  },
  {
    key: "cappuccino",
    words: [["cappuccino"], ["capp"]],
    subject:
      "a cappuccino, a thick cap of velvety milk microfoam lightly dusted with " +
      "cocoa, in a white ceramic cup on a saucer",
  },
  {
    key: "flat-white",
    words: [["flat", "white"]],
    subject:
      "a flat white, espresso under a thin layer of glossy microfoam finished " +
      "with a heart latte art, in a small ceramic cup",
  },
  {
    key: "latte",
    words: [["latte"], ["caffelatte"]],
    subject:
      "a latte, silky steamed milk with a rosetta latte art on the foam, " +
      "served in a white ceramic cup on a saucer",
  },
  {
    key: "mocha",
    words: [["mocha", "latte"], ["mocha"]],
    subject:
      "a mocha, espresso stirred through rich dark chocolate and steamed milk, " +
      "dusted with cocoa, in a tall ceramic mug",
  },
  {
    key: "chai",
    words: [["chai", "latte"], ["chai"]],
    subject:
      "a spiced chai latte, frothy steamed milk scented with cinnamon, " +
      "cardamom and clove, in a ceramic mug",
  },
  {
    key: "matcha",
    words: [["matcha", "latte"], ["matcha"]],
    subject: "a matcha latte, vivid green tea whisked into steamed milk, in a ceramic cup",
  },
  {
    key: "hot-chocolate",
    words: [["hot", "chocolate"], ["hot", "cocoa"]],
    subject:
      "a mug of hot chocolate, thick and glossy, topped with whipped cream " +
      "and chocolate shavings",
  },
  {
    key: "affogato",
    words: [["affogato"]],
    subject:
      "an affogato, a scoop of vanilla gelato drowned in a hot shot of espresso " +
      "in a small glass",
  },
  {
    key: "tea",
    words: [["tea"]],
    subject: "a freshly brewed cup of tea with its colour glowing through the liquid",
  },

  // Coffee, served cold ------------------------------------------------------
  {
    key: "iced-latte",
    words: [["iced", "latte"], ["cold", "latte"]],
    subject:
      "an iced latte, cold milk poured over ice in a tall glass under a cap of " +
      "fresh foam, beaded with condensation",
  },
  {
    key: "cold-brew",
    words: [["cold", "brew"], ["nitro", "coffee"]],
    subject:
      "a tall glass of cold brew coffee over ice with a velvety cream swirl, " +
      "beaded with condensation",
  },
  {
    key: "iced-coffee",
    words: [["iced", "coffee"], ["cold", "coffee"], ["ice", "coffee"]],
    subject:
      "a tall glass of chilled iced coffee over ice with milk swirling through " +
      "the dark coffee, beaded with condensation",
  },
  {
    key: "iced-americano",
    words: [["iced", "americano"], ["cold", "americano"]],
    subject:
      "an iced americano, espresso served over ice in a tall glass " +
      "with an orange slice",
  },
  {
    key: "frappe",
    words: [["frappe"], ["blended", "coffee"]],
    subject:
      "a blended iced coffee frappe in a tall glass, topped with whipped cream " +
      "and a chocolate drizzle",
  },
  {
    key: "milkshake",
    words: [["milkshake"], ["shake"]],
    subject: "a thick creamy milkshake in a tall glass with a striped straw",
  },
  {
    key: "smoothie",
    words: [["smoothie"]],
    subject: "a thick fruit smoothie in a tall glass, garnished with fresh fruit",
  },
  {
    key: "lemonade",
    words: [["lemonade"], ["limeade"], ["sherbet"], ["slush"]],
    subject:
      "a tall glass of fresh lemonade packed with ice, lemon slices and mint leaves",
  },
  {
    key: "juice",
    words: [["juice"]],
    subject: "a tall glass of freshly squeezed juice with ice and a citrus slice",
  },

  // Savoury ------------------------------------------------------------------
  {
    key: "burger",
    words: [["cheeseburger"], ["hamburger"], ["burger"]],
    subject:
      "a premium cafe burger in a toasted brioche bun with melted cheese, fresh " +
      "lettuce and tomato, resting on parchment paper",
  },
  {
    key: "sandwich",
    words: [
      ["club", "sandwich"],
      ["grilled", "cheese"],
      ["grilled", "sandwich"],
      ["panini"],
      ["toastie"],
      ["sandwich"],
      ["wrap"],
      ["sub"],
    ],
    subject:
      "a toasted sandwich cut diagonally, golden crisp bread with the filling " +
      "showing, served on a wooden board",
  },
  {
    key: "toast",
    words: [["avocado", "toast"], ["toast"]],
    subject:
      "thick-cut sourdough toast topped generously and served on a ceramic plate",
  },
  {
    key: "fries",
    words: [["french", "fries"], ["loaded", "fries"], ["chips"], ["fries"]],
    subject:
      "a portion of golden crisp French fries in a paper-lined basket, lightly " +
      "salted, with a small pot of dip",
  },
  {
    key: "onion-rings",
    words: [["onion", "rings"]],
    subject: "a stack of crunchy golden battered onion rings on a ceramic plate",
  },
  {
    key: "nachos",
    words: [["nachos"]],
    subject:
      "a plate of loaded nachos under melted cheese and salsa, " +
      "with jalapeno slices",
  },
  {
    key: "pizza",
    words: [["pizza"]],
    subject:
      "a freshly baked pizza with bubbling mozzarella, blistered char spots and " +
      "fresh basil, sliced on a wooden peel",
  },
  {
    key: "quesadilla",
    words: [["quesadilla"]],
    subject:
      "a golden quesadilla cut into wedges with melted cheese spilling out, " +
      "on a ceramic plate",
  },
  {
    key: "salad",
    words: [["salad"]],
    subject: "a fresh garden salad in a bowl of crisp leaves and colourful vegetables",
  },
  {
    key: "soup",
    words: [["soup"]],
    subject: "a bowl of hot soup with steam rising, served with a slice of bread",
  },
  {
    key: "pasta",
    words: [["pasta"], ["spaghetti"], ["penne"], ["lasagne"]],
    subject:
      "a bowl of pasta with rich sauce, finished with grated parmesan and " +
      "fresh basil",
  },

  // Sweet --------------------------------------------------------------------
  {
    key: "brownie",
    words: [["brownie"], ["brownies"]],
    subject:
      "a fudgy chocolate brownie with a crackled glossy top, one square lifted " +
      "to reveal a gooey molten centre",
  },
  {
    key: "cookie",
    words: [["cookie"], ["cookies"], ["biscotti"], ["biscuit"]],
    subject:
      "a stack of soft-baked chocolate chip cookies with crisp caramelised edges " +
      "on a ceramic plate",
  },
  {
    key: "cheesecake",
    words: [["cheesecake"]],
    subject:
      "a slice of creamy cheesecake with a pale set filling and a golden crumb " +
      "crust, plated with berry coulis",
  },
  {
    key: "cake",
    words: [["cake"], ["cakes"]],
    subject:
      "a slice of moist cake with a thick glossy ganache topping, " +
      "plated on a ceramic dish",
  },
  {
    key: "cupcake",
    words: [["cupcake"], ["fairy", "cake"]],
    subject:
      "a cupcake with a tall swirl of buttercream frosting and sprinkles, " +
      "in a paper case",
  },
  {
    key: "muffin",
    words: [["muffin"], ["muffins"]],
    subject: "a domed golden-topped muffin in a paper case, with berries in the crumb",
  },
  {
    key: "croissant",
    words: [["croissant"], ["pain", "au", "chocolat"]],
    subject: "a golden flaky butter croissant with crisp separated layers",
  },
  {
    key: "donut",
    words: [["donut"], ["doughnut"]],
    subject: "a glazed ring doughnut with sugar crystals and sprinkles",
  },
  {
    key: "pastry",
    words: [["pastry"], ["strudel"], ["turnover"], ["danish"]],
    subject: "a flaky golden pastry with a glossy sugar glaze, on a ceramic plate",
  },
  {
    key: "scone",
    words: [["scone"], ["scones"]],
    subject:
      "a warm scone dusted with sugar on a plate with clotted cream and " +
      "strawberry jam",
  },
  {
    key: "waffle",
    words: [["waffle"], ["waffles"]],
    subject: "a golden Belgian waffle topped with fresh berries and a drizzle of syrup",
  },
  {
    key: "pancake",
    words: [["pancake"], ["pancakes"]],
    subject:
      "a stack of fluffy pancakes with a melting pat of butter and maple syrup " +
      "running down the sides",
  },
  {
    key: "tiramisu",
    words: [["tiramisu"]],
    subject:
      "a portion of tiramisu in a glass, dusted with cocoa powder and layered " +
      "with mascarpone",
  },
  {
    key: "gelato",
    words: [["gelato"], ["ice", "cream"]],
    subject: "a scoop of artisanal gelato in a small ceramic bowl",
  },
  {
    key: "sundae",
    words: [["sundae"]],
    subject:
      "an ice cream sundae in a tall glass with chocolate sauce, chopped nuts " +
      "and a wafer stick",
  },
  {
    key: "parfait",
    words: [["parfait"]],
    subject: "a layered yogurt parfait in a tall glass with fresh fruit on top",
  },
  {
    key: "macaron",
    words: [["macaron"], ["macarons"]],
    subject: "a small stack of pastel French macarons on a ceramic plate",
  },
  {
    key: "fudge",
    words: [["fudge"], ["chocolate", "bar"]],
    subject: "a glossy slab of chocolate fudge cut into squares, dusted with nuts",
  },

  // Breakfast and everyday ----------------------------------------------------
  {
    key: "eggs",
    words: [["omelette"], ["omelet"], ["scrambled", "eggs"], ["fried", "eggs"], ["eggs"]],
    subject: "a plate of softly scrambled golden eggs served with toast",
  },
];

/**
 * Modifiers add a flavour or serving style to the base dish. They always
 * contribute to the signature, so `Chocolate Brownie` and `Brownie` remain
 * separate products even when the subject already names the flavour.
 */
const MODIFIERS: Modifier[] = [
  {
    token: "iced",
    any: [["iced"], ["cold"], ["chilled"], ["on", "ice"]],
    mentions: ["ice", "iced", "chilled", "condensation"],
    clause: "served chilled in a tall glass filled with ice cubes",
  },
  {
    token: "vanilla",
    any: [["vanilla"]],
    mentions: ["vanilla"],
    clause: "made with real vanilla syrup",
  },
  {
    token: "caramel",
    any: [["salted", "caramel"], ["caramel"]],
    mentions: ["caramel"],
    clause: "drizzled with a salted caramel sauce",
  },
  {
    token: "hazelnut",
    any: [["hazelnut"]],
    mentions: ["hazelnut"],
    clause: "flavoured with hazelnut syrup and toasted hazelnuts",
  },
  {
    token: "cinnamon",
    any: [["cinnamon"], ["spiced"]],
    mentions: ["cinnamon", "cardamom", "clove", "spice"],
    clause: "dusted with ground cinnamon",
  },
  {
    token: "chocolate",
    any: [["chocolate"], ["cocoa"]],
    mentions: ["chocolate", "cocoa", "ganache"],
    clause: "made with rich dark chocolate",
  },
  {
    token: "mint",
    any: [["mint"]],
    mentions: ["mint"],
    clause: "garnished with fresh mint leaves",
  },
  {
    token: "berry",
    any: [["berry"], ["berries"], ["blueberry"], ["strawberry"], ["raspberry"]],
    mentions: ["berry", "berries", "strawberr", "blueberr", "raspberr", "coulis"],
    clause: "topped with fresh berries",
  },
  {
    token: "mango",
    any: [["mango"], ["passion", "fruit"]],
    mentions: ["mango", "passion"],
    clause: "with fresh mango chunks",
  },
  {
    token: "coconut",
    any: [["coconut"]],
    mentions: ["coconut"],
    clause: "made with creamy coconut",
  },
  {
    token: "citrus",
    any: [["lemon"], ["lime"], ["orange"]],
    mentions: ["citrus", "lemon", "lime", "orange"],
    clause: "garnished with a fresh citrus slice",
  },
  {
    token: "decaf",
    any: [["decaf"]],
    mentions: ["decaf"],
    clause: "brewed from decaf beans",
  },
  {
    token: "oat",
    any: [["oat", "milk"]],
    mentions: ["oat"],
    clause: "made with creamy oat milk",
  },
  {
    token: "cream",
    any: [["whipped", "cream"], ["cream"]],
    mentions: ["cream", "microfoam", "foam"],
    clause: "topped with whipped cream",
  },
];

/** Words that carry no photographic meaning. */
const NOISE = new Set([
  "a",
  "an",
  "and",
  "cafe",
  "coffeehouse",
  "extra",
  "fresh",
  "homemade",
  "house",
  "large",
  "medium",
  "menu",
  "our",
  "plain",
  "regular",
  "samson",
  "small",
  "special",
  "speciality",
  "specialty",
  "the",
]);

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Lower-cases, strips punctuation and splits a name into comparable words. */
function words(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** Longest phrase first, so specific dishes win over generic ones. */
const DISHES_BY_PHRASE_LENGTH = [...DISHES].sort((a, b) => {
  const longest = (dish: Dish) => dish.words.reduce((max, phrase) => Math.max(max, phrase.length), 0);
  return longest(b) - longest(a);
});

/** True when `phrase` appears as consecutive words inside `tokens`. */
function containsPhrase(tokens: string[], phrase: string[]): boolean {
  return tokens.some((_, index) => phrase.every((word, offset) => tokens[index + offset] === word));
}

/** The longest phrase of `options` present in `tokens`, if any. */
function matchPhrase(tokens: string[], options: string[][]): string[] | null {
  const hits = options
    .filter((phrase) => containsPhrase(tokens, phrase))
    .sort((a, b) => b.length - a.length);
  return hits.at(0) ?? null;
}

function appendClause(subject: string, clause: string): string {
  return subject.includes(clause) ? subject : `${subject}, ${clause}`;
}

/**
 * Describes any menu item. Never throws and never returns null for a non-empty
 * name: an unrecognised dish is described using the name itself, so a brand new
 * sheet row still gets a matching picture instead of a generic one.
 */
export function describeProduct(name: string): ImagePlan | null {
  const cleanName = name.replace(/\s+/g, " ").trim();
  const tokens = words(cleanName);
  if (tokens.length === 0) return null;

  const dish = DISHES_BY_PHRASE_LENGTH.map((candidate) => ({
    candidate,
    phrase: matchPhrase(tokens, candidate.words),
  })).find((entry) => entry.phrase !== null);

  let subject: string;
  let dishKey: string;
  // Words the dish already accounts for, so a modifier does not repeat them.
  let described: Set<string>;

  if (dish) {
    subject = dish.candidate.subject;
    dishKey = dish.candidate.key;
    described = new Set(dish.phrase);
  } else {
    const leftover = tokens.filter((token) => !NOISE.has(token));
    const leftoverWords = leftover.length > 0 ? leftover : tokens;
    dishKey = slug(leftoverWords.join("-")) || "cafe-special";
    subject = `a freshly prepared ${leftoverWords.join(" ")} from the Samson Cafe kitchen`;
    described = new Set(leftoverWords);
  }

  const flavours: string[] = [];
  const spoken = subject.toLowerCase();
  for (const modifier of MODIFIERS) {
    const hit = matchPhrase(tokens, modifier.any);
    if (!hit) continue;
    flavours.push(modifier.token);
    const alreadyDescribed =
      hit.some((word) => described.has(word)) ||
      (modifier.mentions ?? []).some((word) => spoken.includes(word));
    if (alreadyDescribed) continue;
    subject = appendClause(subject, modifier.clause);
  }

  // A dish key such as `iced-latte` already carries the modifier, so do not
  // repeat it in the signature.
  const extra = flavours.filter((token) => !slug(dishKey).includes(token));
  const signature = slug([...extra, dishKey].join("-")) || "cafe-special";

  return {
    name: cleanName,
    signature,
    subject,
    prompt: `Professional realistic cafe food photography of ${subject}. ${PHOTO_STYLE}`,
    alt: `${cleanName} at Samson Cafe`,
  };
}