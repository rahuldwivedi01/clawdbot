import type {
  ComparisonResult,
  GroceryItem,
  LocationConfig,
  PlatformResult,
  PlatformScraper,
  ProductResult,
} from "./types.js";
import { PriceCache } from "./cache.js";
import { RateLimiter } from "./rate-limiter.js";
import { createSwiggyInstamart } from "./scrapers/swiggy.js";
import { createBlinkit } from "./scrapers/blinkit.js";
import { createZepto } from "./scrapers/zepto.js";

export interface ComparisonConfig {
  location: LocationConfig;
  cache?: {
    enabled?: boolean;
    ttlMinutes?: number;
  };
  rateLimit?: {
    requestsPerMinute?: number;
  };
  platforms?: {
    swiggy?: boolean;
    blinkit?: boolean;
    zepto?: boolean;
  };
}

export class GroceryComparison {
  private scrapers: PlatformScraper[] = [];
  private cache: PriceCache;
  private rateLimiter: RateLimiter;
  private config: ComparisonConfig;

  constructor(config: ComparisonConfig) {
    this.config = config;
    this.cache = new PriceCache(config.cache);
    this.rateLimiter = new RateLimiter(config.rateLimit);

    const platforms = config.platforms ?? {};

    if (platforms.swiggy !== false) {
      this.scrapers.push(createSwiggyInstamart());
    }
    if (platforms.blinkit !== false) {
      this.scrapers.push(createBlinkit());
    }
    if (platforms.zepto !== false) {
      this.scrapers.push(createZepto());
    }
  }

  async compare(items: string[] | GroceryItem[]): Promise<ComparisonResult> {
    const queries = items.map((item) =>
      typeof item === "string" ? item.trim() : item.searchQuery.trim(),
    );

    const location = this.config.location;
    const platformResults: PlatformResult[] = [];

    for (const scraper of this.scrapers) {
      const result = await this.searchPlatform(scraper, queries, location);
      platformResults.push(result);
    }

    // Calculate recommendation
    const validResults = platformResults.filter(
      (r) => !r.error && r.items.some((i) => i.product !== null),
    );

    let recommendation: ComparisonResult["recommendation"] = null;

    if (validResults.length > 0) {
      const sorted = [...validResults].sort((a, b) => a.total - b.total);
      const cheapest = sorted[0];
      const mostExpensive = sorted[sorted.length - 1];

      if (cheapest && mostExpensive && cheapest.total > 0) {
        const savings = mostExpensive.total - cheapest.total;
        recommendation = {
          platform: cheapest.displayName,
          total: cheapest.total,
          savings,
          message:
            savings > 0
              ? `${cheapest.displayName} is cheapest! Save Rs ${savings.toFixed(0)} compared to ${mostExpensive.displayName}.`
              : `All platforms have similar prices for these items.`,
        };
      }
    }

    return {
      query: queries,
      location: {
        city: location.city ?? "Bengaluru",
        lat: location.lat,
        lng: location.lng,
        pincode: location.pincode,
      },
      platforms: platformResults,
      recommendation,
      timestamp: new Date().toISOString(),
    };
  }

  private async searchPlatform(
    scraper: PlatformScraper,
    queries: string[],
    location: LocationConfig,
  ): Promise<PlatformResult> {
    const items: PlatformResult["items"] = [];
    let total = 0;
    let itemCount = 0;

    for (const query of queries) {
      try {
        // Check cache first
        const cached = await this.cache.get(scraper.platform, query, location);
        if (cached !== undefined) {
          items.push({ query, product: cached });
          if (cached?.available && cached.price > 0) {
            total += cached.price;
            itemCount++;
          }
          continue;
        }

        // Rate limit
        await this.rateLimiter.acquire();

        // Search
        const product = await scraper.search(query, location);

        // Cache result
        await this.cache.set(scraper.platform, query, location, product);

        items.push({ query, product });

        if (product?.available && product.price > 0) {
          total += product.price;
          itemCount++;
        }
      } catch (err) {
        items.push({
          query,
          product: null,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      platform: scraper.platform,
      displayName: scraper.displayName,
      items,
      total,
      itemCount,
    };
  }

  formatResponse(result: ComparisonResult): string {
    const lines: string[] = [];

    lines.push(`Grocery Price Comparison`);
    lines.push(`Location: ${result.location.city}`);
    lines.push(`Items: ${result.query.join(", ")}`);
    lines.push("");

    for (const platform of result.platforms) {
      lines.push(`${platform.displayName}`);
      lines.push("─".repeat(30));

      if (platform.error) {
        lines.push(`  Error: ${platform.error}`);
        lines.push("");
        continue;
      }

      for (const item of platform.items) {
        if (item.product) {
          const p = item.product;
          const priceStr = `Rs ${p.price}`;
          const discountStr = p.discount ? ` (${p.discount})` : "";
          const availStr = p.available ? "" : " [Out of stock]";
          lines.push(`  ${item.query}: ${p.name}`);
          lines.push(`    ${priceStr}${discountStr} - ${p.quantity}${availStr}`);
        } else {
          lines.push(`  ${item.query}: Not found`);
        }
      }

      lines.push(`  ────────────`);
      lines.push(`  Total: Rs ${platform.total.toFixed(0)} (${platform.itemCount} items)`);
      lines.push("");
    }

    if (result.recommendation) {
      lines.push("RECOMMENDATION");
      lines.push("─".repeat(30));
      lines.push(result.recommendation.message);
    }

    return lines.join("\n");
  }

  async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  async getCacheStats(): Promise<{ entries: number; oldestMs: number; newestMs: number }> {
    return this.cache.stats();
  }
}
