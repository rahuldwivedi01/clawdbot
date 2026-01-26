import type { LocationConfig, PlatformScraper, ProductResult } from "../types.js";

const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

interface BlinkitSearchResponse {
  products?: Array<{
    product_id?: string | number;
    name?: string;
    brand?: string;
    price?: number;
    mrp?: number;
    unit?: string;
    quantity?: string;
    image_url?: string;
    is_available?: boolean;
    discount_tag?: string;
  }>;
  snippets?: Array<{
    data?: {
      products?: Array<{
        product_id?: string | number;
        name?: string;
        brand?: string;
        price?: number;
        mrp?: number;
        unit?: string;
        quantity?: string;
        image_url?: string;
        is_available?: boolean;
        discount_tag?: string;
      }>;
    };
  }>;
}

export function createBlinkit(): PlatformScraper {
  return {
    platform: "blinkit",
    displayName: "Blinkit",

    async search(query: string, location: LocationConfig): Promise<ProductResult | null> {
      const lat = location.lat ?? 12.9716;
      const lng = location.lng ?? 77.5946;

      const searchUrl = new URL("https://blinkit.com/v2/search");
      searchUrl.searchParams.set("q", query);
      searchUrl.searchParams.set("lat", String(lat));
      searchUrl.searchParams.set("lon", String(lng));
      searchUrl.searchParams.set("page", "0");

      try {
        const response = await fetch(searchUrl.toString(), {
          method: "GET",
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            Referer: "https://blinkit.com/",
            Origin: "https://blinkit.com",
            "app-version": "35241",
            "app-client": "consumer-web",
            "device-id": `web-${Date.now()}`,
            "session-id": `session-${Date.now()}`,
            "rn-bundle-version": "1010600",
            "web-client": "1",
            lat: String(lat),
            lon: String(lng),
          },
        });

        if (!response.ok) {
          console.error(`Blinkit API error: ${response.status}`);
          return null;
        }

        const data = (await response.json()) as BlinkitSearchResponse;

        // Try direct products array first
        const products = data.products ?? [];
        if (products.length > 0) {
          const product = products[0];
          if (product) {
            return parseBlinkitProduct(product, query);
          }
        }

        // Try snippets structure
        const snippets = data.snippets ?? [];
        for (const snippet of snippets) {
          const snippetProducts = snippet.data?.products ?? [];
          if (snippetProducts.length > 0) {
            const product = snippetProducts[0];
            if (product) {
              return parseBlinkitProduct(product, query);
            }
          }
        }

        return null;
      } catch (err) {
        console.error("Blinkit scraper error:", err);
        return null;
      }
    },
  };
}

function parseBlinkitProduct(
  product: NonNullable<BlinkitSearchResponse["products"]>[number],
  query: string
): ProductResult {
  const price = product.price ?? 0;
  const mrp = product.mrp;

  return {
    name: product.name ?? query,
    brand: product.brand,
    price,
    originalPrice: mrp !== price ? mrp : undefined,
    discount: product.discount_tag ?? undefined,
    quantity: product.quantity ?? product.unit ?? "1 unit",
    imageUrl: product.image_url,
    available: product.is_available ?? true,
    productId: String(product.product_id ?? ""),
  };
}
