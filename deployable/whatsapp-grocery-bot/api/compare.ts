import type { VercelRequest, VercelResponse } from "@vercel/node";

// ============================================
// Types
// ============================================

interface ProductResult {
  name: string;
  brand?: string;
  price: number;
  originalPrice?: number;
  discount?: string;
  quantity: string;
  available: boolean;
}

interface PlatformResult {
  platform: string;
  displayName: string;
  items: Array<{ query: string; product: ProductResult | null; error?: string }>;
  total: number;
  itemCount: number;
}

interface LocationConfig {
  lat: number;
  lng: number;
  city: string;
  pincode?: string;
}

// ============================================
// City coordinates lookup
// ============================================

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  delhi: { lat: 28.6139, lng: 77.209 },
  "new delhi": { lat: 28.6139, lng: 77.209 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  pune: { lat: 18.5204, lng: 73.8567 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  lucknow: { lat: 26.8467, lng: 80.9462 },
  gurgaon: { lat: 28.4595, lng: 77.0266 },
  gurugram: { lat: 28.4595, lng: 77.0266 },
  noida: { lat: 28.5355, lng: 77.391 },
  chandigarh: { lat: 30.7333, lng: 76.7794 },
  indore: { lat: 22.7196, lng: 75.8577 },
  kochi: { lat: 9.9312, lng: 76.2673 },
};

function getLocationFromCity(city: string): { lat: number; lng: number } {
  return CITY_COORDS[city.toLowerCase().trim()] ?? CITY_COORDS.bengaluru;
}

// ============================================
// Scrapers (all self-contained, no external imports)
// ============================================

const UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

async function searchSwiggy(query: string, loc: LocationConfig): Promise<ProductResult | null> {
  const url = new URL("https://www.swiggy.com/api/instamart/search");
  url.searchParams.set("query", query);
  url.searchParams.set("lat", String(loc.lat));
  url.searchParams.set("lng", String(loc.lng));
  url.searchParams.set("pageNumber", "0");
  url.searchParams.set("limit", "5");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        Referer: "https://www.swiggy.com/instamart",
        Origin: "https://www.swiggy.com",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const widgets = data?.data?.widgets ?? [];
    for (const w of widgets) {
      const products = w?.data ?? [];
      if (products.length > 0) {
        const p = products[0];
        const price = p?.price?.offer_price ?? p?.price?.marked_price ?? 0;
        const mrp = p?.price?.marked_price;
        const disc = p?.price?.discount_percentage;
        return {
          name: p?.display_name ?? query,
          brand: p?.brand,
          price,
          originalPrice: mrp !== price ? mrp : undefined,
          discount: disc ? `${disc}% off` : undefined,
          quantity: p?.quantity ?? "1 unit",
          available: p?.inventory?.in_stock ?? true,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function searchBlinkit(query: string, loc: LocationConfig): Promise<ProductResult | null> {
  const url = new URL("https://blinkit.com/v2/search");
  url.searchParams.set("q", query);
  url.searchParams.set("lat", String(loc.lat));
  url.searchParams.set("lon", String(loc.lng));

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        Referer: "https://blinkit.com/",
        Origin: "https://blinkit.com",
        lat: String(loc.lat),
        lon: String(loc.lng),
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const products = data?.products ?? [];
    const snippets = data?.snippets ?? [];

    let p = products[0];
    if (!p) {
      for (const s of snippets) {
        const sp = s?.data?.products ?? [];
        if (sp.length > 0) { p = sp[0]; break; }
      }
    }
    if (!p) return null;

    const price = p.price ?? 0;
    return {
      name: p.name ?? query,
      brand: p.brand,
      price,
      originalPrice: p.mrp !== price ? p.mrp : undefined,
      discount: p.discount_tag ?? undefined,
      quantity: p.quantity ?? p.unit ?? "1 unit",
      available: p.is_available ?? true,
    };
  } catch {
    return null;
  }
}

async function searchZepto(query: string, loc: LocationConfig): Promise<ProductResult | null> {
  const url = new URL("https://api.zeptonow.com/api/v3/search");
  url.searchParams.set("query", query);
  url.searchParams.set("lat", String(loc.lat));
  url.searchParams.set("lng", String(loc.lng));

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        Referer: "https://www.zeptonow.com/",
        Origin: "https://www.zeptonow.com",
        latitude: String(loc.lat),
        longitude: String(loc.lng),
        platform: "web",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const products = data?.products ?? data?.data?.products ?? [];
    const p = products[0];
    if (!p) return null;

    const price = p.sellingPrice ?? 0;
    const mrp = p.mrp;
    const disc = p.discountPercent ?? p.discount;
    return {
      name: p.name ?? p.productName ?? query,
      brand: p.brand ?? p.brandName,
      price,
      originalPrice: mrp !== price ? mrp : undefined,
      discount: disc ? `${disc}% off` : undefined,
      quantity: p.quantity ?? p.packSize ?? p.unit ?? "1 unit",
      available: p.inStock ?? p.available ?? true,
    };
  } catch {
    return null;
  }
}

// ============================================
// Platform search orchestration
// ============================================

type Scraper = {
  platform: string;
  displayName: string;
  search: (q: string, loc: LocationConfig) => Promise<ProductResult | null>;
};

const SCRAPERS: Scraper[] = [
  { platform: "swiggy", displayName: "Swiggy Instamart", search: searchSwiggy },
  { platform: "blinkit", displayName: "Blinkit", search: searchBlinkit },
  { platform: "zepto", displayName: "Zepto", search: searchZepto },
];

async function searchPlatform(scraper: Scraper, queries: string[], loc: LocationConfig): Promise<PlatformResult> {
  const items: PlatformResult["items"] = [];
  let total = 0;
  let itemCount = 0;

  for (const query of queries) {
    try {
      const product = await scraper.search(query, loc);
      items.push({ query, product });
      if (product?.available && product.price > 0) {
        total += product.price;
        itemCount++;
      }
    } catch (err) {
      items.push({ query, product: null, error: String(err) });
    }
  }

  return { platform: scraper.platform, displayName: scraper.displayName, items, total, itemCount };
}

// ============================================
// API handler
// ============================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const itemsParam = req.query.items;
  if (!itemsParam) {
    return res.status(400).json({ error: "Missing 'items' query parameter. Example: /api/compare?items=rice,dal,milk" });
  }

  const items = (typeof itemsParam === "string" ? itemsParam : itemsParam.join(","))
    .split(",")
    .map((i) => i.trim())
    .filter((i) => i.length > 0);

  if (items.length === 0) return res.status(400).json({ error: "No valid items provided." });
  if (items.length > 10) return res.status(400).json({ error: "Maximum 10 items allowed." });

  const city = (typeof req.query.city === "string" ? req.query.city : "Bengaluru").trim();
  const pincode = typeof req.query.pincode === "string" ? req.query.pincode.trim() : undefined;
  const coords = getLocationFromCity(city);
  const location: LocationConfig = { ...coords, city, pincode };

  // Fetch from all platforms in parallel
  const platforms = await Promise.all(SCRAPERS.map((s) => searchPlatform(s, items, location)));

  // Calculate recommendation
  const valid = platforms.filter((p) => p.items.some((i) => i.product !== null));
  let recommendation = null;

  if (valid.length > 0) {
    const sorted = [...valid].sort((a, b) => a.total - b.total);
    const cheapest = sorted[0];
    const expensive = sorted[sorted.length - 1];
    if (cheapest && expensive && cheapest.total > 0) {
      const savings = expensive.total - cheapest.total;
      recommendation = {
        platform: cheapest.displayName,
        total: cheapest.total,
        savings,
        message:
          savings > 0
            ? `Save \u20B9${savings.toFixed(0)} compared to ${expensive.displayName}`
            : "All platforms have similar prices.",
      };
    }
  }

  return res.status(200).json({
    query: items,
    location: { city, pincode },
    platforms,
    recommendation,
    timestamp: new Date().toISOString(),
  });
}
