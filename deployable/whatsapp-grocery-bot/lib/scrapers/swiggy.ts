import type { LocationConfig, PlatformScraper, ProductResult } from "../types.js";

const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

interface SwiggySearchResponse {
  statusCode?: number;
  data?: {
    widgets?: Array<{
      data?: Array<{
        id?: string | number;
        display_name?: string;
        brand?: string;
        price?: {
          offer_price?: number;
          marked_price?: number;
          offer_applied?: boolean;
          discount_percentage?: number;
        };
        quantity?: string;
        images?: string[];
        inventory?: {
          in_stock?: boolean;
        };
      }>;
    }>;
  };
}

export function createSwiggyInstamart(): PlatformScraper {
  return {
    platform: "swiggy",
    displayName: "Swiggy Instamart",

    async search(query: string, location: LocationConfig): Promise<ProductResult | null> {
      const lat = location.lat ?? 12.9716;
      const lng = location.lng ?? 77.5946;

      const searchUrl = new URL("https://www.swiggy.com/api/instamart/search");
      searchUrl.searchParams.set("query", query);
      searchUrl.searchParams.set("lat", String(lat));
      searchUrl.searchParams.set("lng", String(lng));
      searchUrl.searchParams.set("pageNumber", "0");
      searchUrl.searchParams.set("sortAttribute", "relevance");
      searchUrl.searchParams.set("limit", "10");

      try {
        const response = await fetch(searchUrl.toString(), {
          method: "GET",
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            Referer: "https://www.swiggy.com/instamart",
            Origin: "https://www.swiggy.com",
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          console.error(`Swiggy API error: ${response.status}`);
          return null;
        }

        const data = (await response.json()) as SwiggySearchResponse;

        // Find products in the response
        const widgets = data.data?.widgets ?? [];
        for (const widget of widgets) {
          const products = widget.data ?? [];
          if (products.length > 0) {
            const product = products[0];
            if (!product) continue;

            const price = product.price?.offer_price ?? product.price?.marked_price ?? 0;
            const originalPrice = product.price?.marked_price;
            const discountPct = product.price?.discount_percentage;

            return {
              name: product.display_name ?? query,
              brand: product.brand,
              price,
              originalPrice: originalPrice !== price ? originalPrice : undefined,
              discount: discountPct ? `${discountPct}% off` : undefined,
              quantity: product.quantity ?? "1 unit",
              imageUrl: product.images?.[0],
              available: product.inventory?.in_stock ?? true,
              productId: String(product.id ?? ""),
            };
          }
        }

        return null;
      } catch (err) {
        console.error("Swiggy scraper error:", err);
        return null;
      }
    },
  };
}
