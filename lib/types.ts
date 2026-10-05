export type OrderStatus = "Pending" | "Paid";

/** Where a product picture came from. See lib/product-images.ts. */
export type PictureOrigin = "sheet" | "asset" | "generated" | "fallback";

/**
 * A resolved product picture. `local` marks assets served from `public/menu`,
 * which can be optimised by next/image; remote URLs are rendered as plain
 * images so an arbitrary sheet URL never needs a `remotePatterns` entry.
 */
export type ProductPicture = {
  url: string;
  srcSet?: string;
  width?: number;
  height?: number;
  local: boolean;
  alt: string;
  origin: PictureOrigin;
};

export type Product = {
  id: string;
  name: string;
  image: string;
  stock: number;
  price: number;
  enabled: boolean;
};

/** A sheet row plus the picture resolved from its name. */
export type DisplayProduct = Product & { picture: ProductPicture };

export type Order = {
  id: string;
  itemId: string;
  itemName: string;
  image: string;
  quantity: number;
  total: number;
  date: string;
  status: OrderStatus;
};

export type DisplaySettings = {
  currency: string;
  timezone: string;
  lowStockThreshold: number;
  fallbackImage: string;
};

export type ProductDraft = {
  name: string;
  image: string;
  stock: number;
  price: number;
};
