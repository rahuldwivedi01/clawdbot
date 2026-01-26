import type { LocationConfig, PlatformScraper, ProductResult } from "../types.js";

const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

interface ZeptoSearchResponse {
  products?: Array<{
    sku?: string;
    name?: string;
    productName?: string;
    brand?: string;
    brandName?: string;
    sellingPrice?: number;
    mrp?: number;
    discount?: number;
    discountPercent?: number;
    quantity?: string;
    packSize?: string;
    unit?: string;
    image?: string;
    imageUrl?: string;
    inStock?: boolean;
    available?: boolean;
  }>;
  data?: {
    products?: Array<{
      sku?: string;
      name?: string;
      productName?: string;
      brand?: string;
      brandName?: string;
      sellingPrice?: number;
      mrp?: number;
      discount?: number;
      discountPercent?: number;
      quantity?: string;
      packSize?: string;
      unit?: string;
      image?: string;
      imageUrl?: string;
      inStock?: boolean;
      available?: boolean;
    }>;
  };
}

export function createZepto(): PlatformScraper {
  return {
    platform: "zepto",
    displayName: "Zepto",

    async search(query: string, location: LocationConfig): Promise<ProductResult | null> {
      const lat = location.lat ?? 12.9716;
      const lng = location.lng ?? 77.5946;

      const searchUrl = new URL("https://api.zeptonow.com/api/v3/search");
      searchUrl.searchParams.set("query", query);
      searchUrl.searchParams.set("lat", String(lat));
      searchUrl.searchParams.set("lng", String(lng));
      searchUrl.searchParams.set("page_number", "0");
      searchUrl.searchParams.set("page_size", "10");

      try {
        const response = await fetch(searchUrl.toString(), {
          method: "GET",
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            Referer: "https://www.zeptonow.com/",
            Origin: "https://www.zeptonow.com",
            "Content-Type": "application/json",
            "x-app-version": "12.82.0",
            "x-device-id": `web-${Date.now()}`,
            latitude: String(lat),
            longitude: String(lng),
            platform: "web",
          },
        });

        if (!response.ok) {
          console.error(`Zepto API error: ${response.status}`);
          return null;
        }

        const data = (await response.json()) as ZeptoSearchResponse;

        // Try direct products array
        const products = data.products ?? data.data?.products ?? [];
        if (products.length > 0) {
          const product = products[0];
          if (product) {
            return parseZeptoProduct(product, query);
          }
        }

        return null;
      } catch (err) {
        console.error("Zepto scraper error:", err);
        return null;
      }
    },
  };
}

function parseZeptoProduct(
  product: NonNullable<ZeptoSearchResponse["products"]>[number],
  query: string
): ProductResult {
  const price = product.sellingPrice ?? 0;
  const mrp = product.mrp;
  const discountPct = product.discountPercent ?? product.discount;

  return {
    name: product.name ?? product.productName ?? query,
    brand: product.brand ?? product.brandName,
    price,
    originalPrice: mrp !== price ? mrp : undefined,
    discount: discountPct ? `${discountPct}% off` : undefined,
    quantity: product.quantity ?? product.packSize ?? product.unit ?? "1 unit",
    imageUrl: product.image ?? product.imageUrl,
    available: product.inStock ?? product.available ?? true,
    productId: product.sku ?? "",
  };
}
