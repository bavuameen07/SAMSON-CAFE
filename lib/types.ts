export type OrderStatus = "Pending" | "Paid";

export type Product = {
  id: string;
  name: string;
  image: string;
  stock: number;
  price: number;
  enabled: boolean;
};

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
