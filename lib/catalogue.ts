export type Category = "upper_body" | "lower_body" | "full_body";
export type Currency = "INR" | "USD" | "EUR" | "GBP" | "AED";
export const currencies: Currency[] = ["INR", "USD", "EUR", "GBP", "AED"];
export const categoryLabels: Record<Category, string> = {
  upper_body: "Tops & shirts", lower_body: "Trousers & skirts", full_body: "Dresses & outfits",
};
export type Shop = { id: string; owner_id: string; name: string; slug: string; currency: Currency };
export type Product = {
  id: string; owner_id: string; shop_id: string; name: string; price: number;
  currency: Currency; image: string; storage_path: string; category: Category; active: boolean;
};
export function formatPrice(price: number, currency: string) {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency", currency, maximumFractionDigits: 2,
  }).format(price);
}
export const productColumns = "id,owner_id,shop_id,name,price,currency,image,storage_path,category,active";
