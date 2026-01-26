import type {
  ComparisonResult,
  LocationConfig,
  PlatformResult,
  PlatformScraper,
} from "./types.js";
import { createSwiggyInstamart, createBlinkit, createZepto } from "./scrapers/index.js";

// Simple in-memory cache for serverless (resets on cold start)
const priceCache = new Map<string, { result: unknown; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getCacheKey(platform: string, query: string, location: LocationConfig): string {
  const locationKey = [location.lat?.toFixed(2), location.lng?.toFixed(2), location.city]
    .filter(Boolean)
    .join("-");
  return `${platform}:${query.toLowerCase().trim()}:${locationKey}`;
}

function getFromCache<T>(key: string): T | undefined {
  const entry = priceCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    priceCache.delete(key);
    return undefined;
  }
  return entry.result as T;
}

function setCache(key: string, result: unknown): void {
  // Limit cache size to prevent memory issues
  if (priceCache.size > 500) {
    const oldestKey = priceCache.keys().next().value;
    if (oldestKey) priceCache.delete(oldestKey);
  }
  priceCache.set(key, { result, timestamp: Date.now() });
}

export interface ComparisonConfig {
  location: LocationConfig;
  platforms?: {
    swiggy?: boolean;
    blinkit?: boolean;
    zepto?: boolean;
  };
}

export async function compareGroceryPrices(
  items: string[],
  config: ComparisonConfig
): Promise<ComparisonResult> {
  const queries = items.map((item) => item.trim()).filter(Boolean);
  const location = config.location;

  // Initialize scrapers
  const scrapers: PlatformScraper[] = [];
  const platforms = config.platforms ?? {};

  if (platforms.swiggy !== false) {
    scrapers.push(createSwiggyInstamart());
  }
  if (platforms.blinkit !== false) {
    scrapers.push(createBlinkit());
  }
  if (platforms.zepto !== false) {
    scrapers.push(createZepto());
  }

  // Fetch prices from all platforms in parallel
  const platformResults = await Promise.all(
    scrapers.map((scraper) => searchPlatform(scraper, queries, location))
  );

  // Calculate recommendation
  const validResults = platformResults.filter(
    (r) => !r.error && r.items.some((i) => i.product !== null)
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

async function searchPlatform(
  scraper: PlatformScraper,
  queries: string[],
  location: LocationConfig
): Promise<PlatformResult> {
  const items: PlatformResult["items"] = [];
  let total = 0;
  let itemCount = 0;

  // Process queries sequentially to avoid rate limiting
  for (const query of queries) {
    try {
      // Check cache first
      const cacheKey = getCacheKey(scraper.platform, query, location);
      const cached = getFromCache<PlatformResult["items"][0]["product"]>(cacheKey);

      if (cached !== undefined) {
        items.push({ query, product: cached });
        if (cached?.available && cached.price > 0) {
          total += cached.price;
          itemCount++;
        }
        continue;
      }

      // Search with small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
      const product = await scraper.search(query, location);

      // Cache result
      setCache(cacheKey, product);

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

export function formatComparisonResponse(result: ComparisonResult): string {
  const lines: string[] = [];

  lines.push(`🛒 *Grocery Price Comparison*`);
  lines.push(`📍 Location: ${result.location.city}`);
  lines.push(`🔍 Items: ${result.query.join(", ")}`);
  lines.push("");

  for (const platform of result.platforms) {
    const emoji =
      platform.platform === "swiggy" ? "🟠" : platform.platform === "blinkit" ? "🟡" : "🟣";

    lines.push(`${emoji} *${platform.displayName}*`);

    if (platform.error) {
      lines.push(`   ❌ Error: ${platform.error}`);
      lines.push("");
      continue;
    }

    for (const item of platform.items) {
      if (item.product) {
        const p = item.product;
        const priceStr = `₹${p.price}`;
        const discountStr = p.discount ? ` (${p.discount})` : "";
        const availStr = p.available ? "" : " ❌";
        lines.push(`   • ${item.query}: ${priceStr}${discountStr}${availStr}`);
        lines.push(`     _${p.name} - ${p.quantity}_`);
      } else {
        lines.push(`   • ${item.query}: Not found`);
      }
    }

    lines.push(`   ─────────────`);
    lines.push(`   *Total: ₹${platform.total.toFixed(0)}* (${platform.itemCount} items)`);
    lines.push("");
  }

  if (result.recommendation) {
    lines.push(`💡 *RECOMMENDATION*`);
    lines.push(result.recommendation.message);
  } else {
    lines.push(`⚠️ Could not determine a recommendation.`);
  }

  return lines.join("\n");
}

// Parse grocery items from user message
export function parseGroceryItems(message: string): string[] {
  // Remove common phrases
  const cleaned = message
    .toLowerCase()
    .replace(/compare\s*(prices?\s*(for|of)?)?/gi, "")
    .replace(/check\s*(prices?\s*(for|of)?)?/gi, "")
    .replace(/price\s*(of|for)?/gi, "")
    .replace(/how\s*much\s*(is|are|for)?/gi, "")
    .replace(/what('s| is| are)?\s*(the\s*)?price/gi, "")
    .replace(/get\s*(me\s*)?/gi, "")
    .replace(/find\s*/gi, "")
    .replace(/search\s*(for)?/gi, "")
    .trim();

  // Split by common delimiters
  const items = cleaned
    .split(/[,\n]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length < 100);

  // Also try splitting by "and"
  const expanded: string[] = [];
  for (const item of items) {
    if (item.includes(" and ")) {
      expanded.push(...item.split(" and ").map((i) => i.trim()));
    } else {
      expanded.push(item);
    }
  }

  return expanded.filter((item) => item.length > 0);
}

// Check if message is a grocery query
export function isGroceryQuery(message: string): boolean {
  const lower = message.toLowerCase();

  // Check for explicit price comparison keywords
  const priceKeywords = [
    "price",
    "compare",
    "cheapest",
    "cheaper",
    "cost",
    "how much",
    "grocery",
    "groceries",
    "swiggy",
    "blinkit",
    "zepto",
    "instamart",
  ];

  if (priceKeywords.some((kw) => lower.includes(kw))) {
    return true;
  }

  // Check if it looks like a list of items (comma-separated or with "and")
  const hasCommas = message.includes(",");
  const hasAnd = lower.includes(" and ");
  const hasMultipleWords = message.trim().split(/\s+/).length >= 2;

  // Common grocery items (basic check)
  const groceryItems = [
    "rice",
    "dal",
    "atta",
    "flour",
    "milk",
    "bread",
    "egg",
    "oil",
    "sugar",
    "salt",
    "tomato",
    "onion",
    "potato",
    "vegetable",
    "fruit",
    "chicken",
    "paneer",
    "curd",
    "butter",
    "ghee",
  ];

  const mentionsGrocery = groceryItems.some((item) => lower.includes(item));

  return (hasCommas || hasAnd) && (mentionsGrocery || hasMultipleWords);
}
