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
  link: string;
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
// Search link builders (always available even if scraping fails)
// ============================================

function swiggySearchLink(query: string): string {
  return `https://www.swiggy.com/instamart/search?custom_back=true&query=${encodeURIComponent(query)}`;
}

function blinkitSearchLink(query: string): string {
  return `https://blinkit.com/s/?q=${encodeURIComponent(query)}`;
}

function zeptoSearchLink(query: string): string {
  return `https://www.zeptonow.com/search?query=${encodeURIComponent(query)}`;
}

function bigbasketSearchLink(query: string): string {
  return `https://www.bigbasket.com/ps/?q=${encodeURIComponent(query)}`;
}

// ============================================
// User-Agent and headers
// ============================================

const UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

// ============================================
// Swiggy Instamart scraper
// ============================================

async function searchSwiggy(query: string, loc: LocationConfig): Promise<{ product: ProductResult | null; error?: string }> {
  const url = `https://www.swiggy.com/api/instamart/search?pageNumber=0&searchResultsOffset=0&limit=5&query=${encodeURIComponent(query)}&ageConsent=false&layoutId=2839&pageType=INSTAMART_SEARCH_PAGE&isPreSearchTag=false`;
  const link = swiggySearchLink(query);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.swiggy.com/instamart",
        Origin: "https://www.swiggy.com",
        "Content-Type": "application/json",
        lat: String(loc.lat),
        lng: String(loc.lng),
      },
    });

    if (!res.ok) return { product: null, error: `HTTP ${res.status}` };

    const data = await res.json();
    const widgets = data?.data?.widgets ?? [];
    for (const w of widgets) {
      const products = w?.data ?? [];
      if (products.length > 0) {
        const p = products[0];
        const price = p?.price?.offer_price ?? p?.price?.marked_price ?? p?.offer_price ?? p?.mrp ?? 0;
        const mrp = p?.price?.marked_price ?? p?.mrp;
        const disc = p?.price?.discount_percentage ?? p?.discount;
        return {
          product: {
            name: p?.display_name ?? p?.name ?? query,
            brand: p?.brand,
            price: price / 100,
            originalPrice: mrp && mrp !== price ? mrp / 100 : undefined,
            discount: disc ? `${disc}% off` : undefined,
            quantity: p?.quantity ?? p?.weight ?? "1 unit",
            available: p?.inventory?.in_stock ?? p?.in_stock ?? true,
            link,
          },
        };
      }
    }
    return { product: null, error: "No results" };
  } catch (err) {
    return { product: null, error: err instanceof Error ? err.message : String(err) };
  }
}

// ============================================
// Blinkit scraper
// ============================================

async function searchBlinkit(query: string, loc: LocationConfig): Promise<{ product: ProductResult | null; error?: string }> {
  const url = `https://blinkit.com/v6/search/products?start=0&size=5&search_type=keyword&q=${encodeURIComponent(query)}`;
  const link = blinkitSearchLink(query);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://blinkit.com/",
        Origin: "https://blinkit.com",
        lat: String(loc.lat),
        lon: String(loc.lng),
        app_client: "consumer_web",
        web_app_version: "1008010",
        rn_bundle_version: "1008010",
        access_token: "",
      },
    });

    if (!res.ok) return { product: null, error: `HTTP ${res.status}` };

    const data = await res.json();
    const products = data?.products ?? data?.data?.products ?? [];
    const snippets = data?.snippets ?? [];

    let p = products[0];
    if (!p) {
      for (const s of snippets) {
        const sp = s?.data?.products ?? s?.products ?? [];
        if (sp.length > 0) { p = sp[0]; break; }
      }
    }
    if (!p) return { product: null, error: "No results" };

    const price = p.price ?? p.offer_price ?? 0;
    return {
      product: {
        name: p.name ?? p.product_name ?? query,
        brand: p.brand,
        price,
        originalPrice: p.mrp && p.mrp !== price ? p.mrp : undefined,
        discount: p.discount_tag ?? p.offer_text ?? undefined,
        quantity: p.quantity ?? p.unit ?? p.weight ?? "1 unit",
        available: p.is_available ?? p.in_stock ?? true,
        link,
      },
    };
  } catch (err) {
    return { product: null, error: err instanceof Error ? err.message : String(err) };
  }
}

// ============================================
// Zepto scraper
// ============================================

async function searchZepto(query: string, loc: LocationConfig): Promise<{ product: ProductResult | null; error?: string }> {
  const url = `https://api.zeptonow.com/api/v3/search?query=${encodeURIComponent(query)}&pageNumber=0&mode=AUTOSUGGEST`;
  const link = zeptoSearchLink(query);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.zeptonow.com/",
        Origin: "https://www.zeptonow.com",
        "X-Without-Bearer": "true",
        appVersion: "12.28.3",
        platform: "web",
        latitude: String(loc.lat),
        longitude: String(loc.lng),
        storeId: "",
      },
    });

    if (!res.ok) return { product: null, error: `HTTP ${res.status}` };

    const data = await res.json();
    const items = data?.data?.items ?? data?.items ?? data?.products ?? data?.data?.products ?? [];
    let p: Record<string, unknown> | null = null;

    for (const item of items) {
      const products = (item as Record<string, unknown>)?.productResponse?.products ??
                       (item as Record<string, unknown>)?.products ?? [];
      if (Array.isArray(products) && products.length > 0) {
        p = products[0] as Record<string, unknown>;
        break;
      }
    }

    if (!p && Array.isArray(items) && items.length > 0 && (items[0] as Record<string, unknown>)?.productId) {
      p = items[0] as Record<string, unknown>;
    }

    if (!p) return { product: null, error: "No results" };

    const price = Number(p.sellingPrice ?? p.mrp ?? p.price ?? 0);
    const mrp = Number(p.mrp ?? p.price ?? 0);
    const disc = p.discount ?? p.discountPercent;
    return {
      product: {
        name: String(p.name ?? p.productName ?? query),
        brand: p.brand ? String(p.brand) : p.brandName ? String(p.brandName) : undefined,
        price,
        originalPrice: mrp !== price ? mrp : undefined,
        discount: disc ? `${disc}% off` : undefined,
        quantity: String(p.quantity ?? p.packSize ?? p.unit ?? "1 unit"),
        available: Boolean(p.inStock ?? p.available ?? true),
        link,
      },
    };
  } catch (err) {
    return { product: null, error: err instanceof Error ? err.message : String(err) };
  }
}

// ============================================
// BigBasket scraper
// ============================================

async function searchBigBasket(query: string, _loc: LocationConfig): Promise<{ product: ProductResult | null; error?: string }> {
  const url = `https://www.bigbasket.com/listing-svc/v2/products?type=pc&slug=${encodeURIComponent(query)}&page=1`;
  const link = bigbasketSearchLink(query);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.bigbasket.com/",
        Origin: "https://www.bigbasket.com",
        "X-Channel": "BB-WEB",
      },
    });

    if (!res.ok) {
      const altUrl = `https://www.bigbasket.com/custompage/getsearchdata/?slug=${encodeURIComponent(query)}&type=sk&page=1`;
      const altRes = await fetch(altUrl, {
        headers: { "User-Agent": UA, Accept: "application/json", Referer: "https://www.bigbasket.com/" },
      });
      if (!altRes.ok) return { product: null, error: `HTTP ${res.status}` };

      const altData = await altRes.json();
      const tabs = altData?.tabs ?? [];
      for (const tab of tabs) {
        const products = tab?.product_info?.products ?? [];
        if (products.length > 0) {
          const p = products[0];
          return {
            product: {
              name: p.desc ?? p.product_name ?? query,
              brand: p.brand?.name ?? p.brand,
              price: p.pricing?.discount?.prim_val?.val ?? p.sp ?? 0,
              originalPrice: p.pricing?.mrp?.prim_val?.val ?? p.mrp,
              discount: p.pricing?.discount?.d_text,
              quantity: p.w ?? p.weight ?? "1 unit",
              available: p.availability?.is_available ?? true,
              link,
            },
          };
        }
      }
      return { product: null, error: "No results" };
    }

    const data = await res.json();
    const products = data?.tabs?.[0]?.product_map?.all ?? data?.products ?? [];
    if (products.length === 0) return { product: null, error: "No results" };

    const p = products[0];
    return {
      product: {
        name: p.desc ?? p.product_name ?? query,
        brand: p.brand?.name ?? p.brand,
        price: p.pricing?.discount?.prim_val?.val ?? p.sp ?? 0,
        originalPrice: p.pricing?.mrp?.prim_val?.val ?? p.mrp,
        discount: p.pricing?.discount?.d_text,
        quantity: p.w ?? p.weight ?? "1 unit",
        available: p.availability?.is_available ?? true,
        link,
      },
    };
  } catch (err) {
    return { product: null, error: err instanceof Error ? err.message : String(err) };
  }
}

// ============================================
// Platform search orchestration
// ============================================

interface Scraper {
  platform: string;
  displayName: string;
  search: (q: string, loc: LocationConfig) => Promise<{ product: ProductResult | null; error?: string }>;
  searchLink: (q: string) => string;
}

const SCRAPERS: Scraper[] = [
  { platform: "swiggy", displayName: "Swiggy Instamart", search: searchSwiggy, searchLink: swiggySearchLink },
  { platform: "blinkit", displayName: "Blinkit", search: searchBlinkit, searchLink: blinkitSearchLink },
  { platform: "zepto", displayName: "Zepto", search: searchZepto, searchLink: zeptoSearchLink },
  { platform: "bigbasket", displayName: "BigBasket", search: searchBigBasket, searchLink: bigbasketSearchLink },
];

async function searchPlatform(scraper: Scraper, queries: string[], loc: LocationConfig): Promise<PlatformResult> {
  const items: PlatformResult["items"] = [];
  let total = 0;
  let itemCount = 0;

  for (const query of queries) {
    const result = await scraper.search(query, loc);

    // Even if scraping failed, always include the search link
    if (!result.product) {
      items.push({
        query,
        product: null,
        error: result.error,
      });
    } else {
      items.push({ query, product: result.product });
      if (result.product.available && result.product.price > 0) {
        total += result.product.price;
        itemCount++;
      }
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

// ============================================
// API handler
// ============================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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

  // Check if ANY platform returned at least one product
  const anyResults = platforms.some((p) => p.items.some((i) => i.product !== null));

  // Build search links for each platform (always available for the UI)
  const searchLinks: Record<string, Record<string, string>> = {};
  for (const scraper of SCRAPERS) {
    searchLinks[scraper.platform] = {};
    for (const item of items) {
      searchLinks[scraper.platform][item] = scraper.searchLink(item);
    }
  }

  // Calculate recommendation (only if we have results)
  let recommendation = null;
  if (anyResults) {
    const valid = platforms.filter((p) => p.itemCount > 0);
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
  }

  return res.status(200).json({
    query: items,
    location: { city, pincode },
    platforms,
    searchLinks,
    recommendation,
    fetched: anyResults,
    timestamp: new Date().toISOString(),
  });
}
