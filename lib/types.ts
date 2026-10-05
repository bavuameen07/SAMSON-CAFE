export type OrderStatus = "Pending" | "Paid";

export type OrderType = "Pickup" | "Delivery";

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

export type Customer = {
  name: string;
  phone: string;
  email: string;
  address: string;
  landmark: string;
  pincode: string;
  note: string;
};

export type DisplaySettings = {
  currency: string;
  timezone: string;
  lowStockThreshold: number;
  fallbackImage: string;
};

export const emptyCustomer: Customer = {
  name: "",
  phone: "",
  email: "",
  address: "",
  landmark: "",
  pincode: "",
  note: "",
};

export type ProductDraft = {
  name: string;
  image: string;
  stock: number;
  price: number;
};
