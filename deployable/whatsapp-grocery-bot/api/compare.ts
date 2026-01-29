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
  debug?: string;
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
// User-Agent and headers
// ============================================

const UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

// ============================================
// Swiggy Instamart scraper
// ============================================

async function searchSwiggy(query: string, loc: LocationConfig): Promise<{ product: ProductResult | null; debug: string }> {
  // Try the Instamart search API
  const url = `https://www.swiggy.com/api/instamart/search?pageNumber=0&searchResultsOffset=0&limit=5&query=${encodeURIComponent(query)}&ageConsent=false&layoutId=2839&pageType=INSTAMART_SEARCH_PAGE&isPreSearchTag=false`;

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

    if (!res.ok) {
      return { product: null, debug: `HTTP ${res.status}` };
    }

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
            price: price / 100, // Swiggy prices are often in paise
            originalPrice: mrp && mrp !== price ? mrp / 100 : undefined,
            discount: disc ? `${disc}% off` : undefined,
            quantity: p?.quantity ?? p?.weight ?? "1 unit",
            available: p?.inventory?.in_stock ?? p?.in_stock ?? true,
          },
          debug: "ok",
        };
      }
    }
    return { product: null, debug: `no products in ${widgets.length} widgets` };
  } catch (err) {
    return { product: null, debug: `error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ============================================
// Blinkit scraper
// ============================================

async function searchBlinkit(query: string, loc: LocationConfig): Promise<{ product: ProductResult | null; debug: string }> {
  const url = `https://blinkit.com/v6/search/products?start=0&size=5&search_type=keyword&q=${encodeURIComponent(query)}`;

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
        "app_client": "consumer_web",
        "web_app_version": "1008010",
        "rn_bundle_version": "1008010",
        access_token: "",
      },
    });

    if (!res.ok) {
      return { product: null, debug: `HTTP ${res.status}` };
    }

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
    if (!p) return { product: null, debug: `no products found (keys: ${Object.keys(data || {}).join(",")})` };

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
      },
      debug: "ok",
    };
  } catch (err) {
    return { product: null, debug: `error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ============================================
// Zepto scraper
// ============================================

async function searchZepto(query: string, loc: LocationConfig): Promise<{ product: ProductResult | null; debug: string }> {
  const url = `https://api.zeptonow.com/api/v3/search?query=${encodeURIComponent(query)}&pageNumber=0&mode=AUTOSUGGEST`;

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

    if (!res.ok) {
      return { product: null, debug: `HTTP ${res.status}` };
    }

    const data = await res.json();
    const items = data?.data?.items ?? data?.items ?? data?.products ?? data?.data?.products ?? [];
    let p: Record<string, unknown> | null = null;

    // Zepto nests products in layout items
    for (const item of items) {
      const products = (item as Record<string, unknown>)?.productResponse?.products ??
                       (item as Record<string, unknown>)?.products ?? [];
      if (Array.isArray(products) && products.length > 0) {
        p = products[0] as Record<string, unknown>;
        break;
      }
    }

    // Fallback: try direct product list
    if (!p && Array.isArray(items) && items.length > 0 && (items[0] as Record<string, unknown>)?.productId) {
      p = items[0] as Record<string, unknown>;
    }

    if (!p) return { product: null, debug: `no products (keys: ${Object.keys(data?.data || data || {}).join(",")})` };

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
      },
      debug: "ok",
    };
  } catch (err) {
    return { product: null, debug: `error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ============================================
// BigBasket scraper (additional platform)
// ============================================

async function searchBigBasket(query: string, _loc: LocationConfig): Promise<{ product: ProductResult | null; debug: string }> {
  const url = `https://www.bigbasket.com/listing-svc/v2/products?type=pc&slug=${encodeURIComponent(query)}&page=1`;

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
      // Try alternative search endpoint
      const altUrl = `https://www.bigbasket.com/custompage/getsearchdata/?slug=${encodeURIComponent(query)}&type=sk&page=1`;
      const altRes = await fetch(altUrl, {
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
          Referer: "https://www.bigbasket.com/",
        },
      });
      if (!altRes.ok) {
        return { product: null, debug: `HTTP ${res.status} / alt ${altRes.status}` };
      }
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
            },
            debug: "ok (alt)",
          };
        }
      }
      return { product: null, debug: "alt: no products" };
    }

    const data = await res.json();
    const products = data?.tabs?.[0]?.product_map?.all ?? data?.products ?? [];
    if (products.length === 0) {
      return { product: null, debug: `no products (keys: ${Object.keys(data || {}).join(",")})` };
    }

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
      },
      debug: "ok",
    };
  } catch (err) {
    return { product: null, debug: `error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ============================================
// Demo data (realistic prices for Indian grocery items)
// ============================================

const DEMO_PRICES: Record<string, Record<string, ProductResult>> = {
  swiggy: {
    rice: { name: "India Gate Basmati Rice", brand: "India Gate", price: 199, originalPrice: 225, discount: "12% off", quantity: "1 kg", available: true },
    dal: { name: "Toor Dal", brand: "Tata Sampann", price: 155, originalPrice: 175, discount: "11% off", quantity: "1 kg", available: true },
    milk: { name: "Nandini Toned Milk", brand: "Nandini", price: 27, quantity: "500 ml", available: true },
    bread: { name: "Harvest Gold White Bread", brand: "Harvest Gold", price: 40, quantity: "1 pack", available: true },
    eggs: { name: "Country Eggs", brand: "Fresh", price: 72, originalPrice: 85, discount: "15% off", quantity: "6 pcs", available: true },
    onion: { name: "Onion", brand: "Fresh", price: 35, quantity: "1 kg", available: true },
    tomato: { name: "Tomato (Hybrid)", brand: "Fresh", price: 28, quantity: "500 g", available: true },
    potato: { name: "Potato", brand: "Fresh", price: 32, quantity: "1 kg", available: true },
    oil: { name: "Fortune Sunflower Oil", brand: "Fortune", price: 145, originalPrice: 160, discount: "9% off", quantity: "1 L", available: true },
    sugar: { name: "Madhur Sugar", brand: "Madhur", price: 48, quantity: "1 kg", available: true },
    atta: { name: "Aashirvaad Atta", brand: "Aashirvaad", price: 235, originalPrice: 260, discount: "10% off", quantity: "5 kg", available: true },
    butter: { name: "Amul Butter", brand: "Amul", price: 57, quantity: "100 g", available: true },
    curd: { name: "Nandini Curd", brand: "Nandini", price: 30, quantity: "400 g", available: true },
    paneer: { name: "Amul Fresh Paneer", brand: "Amul", price: 90, quantity: "200 g", available: true },
    chicken: { name: "Chicken Curry Cut", brand: "FreshToHome", price: 199, quantity: "500 g", available: true },
    salt: { name: "Tata Salt", brand: "Tata", price: 24, quantity: "1 kg", available: true },
  },
  blinkit: {
    rice: { name: "Daawat Basmati Rice", brand: "Daawat", price: 189, originalPrice: 215, discount: "12% off", quantity: "1 kg", available: true },
    dal: { name: "Arhar/Toor Dal", brand: "bb Popular", price: 149, originalPrice: 169, discount: "12% off", quantity: "1 kg", available: true },
    milk: { name: "Amul Taaza Toned Milk", brand: "Amul", price: 31, quantity: "500 ml", available: true },
    bread: { name: "Modern White Bread", brand: "Modern", price: 38, quantity: "1 pack", available: true },
    eggs: { name: "White Eggs", brand: "Fresho", price: 68, originalPrice: 79, discount: "14% off", quantity: "6 pcs", available: true },
    onion: { name: "Onion", brand: "Fresh", price: 39, quantity: "1 kg", available: true },
    tomato: { name: "Tomato (Local)", brand: "Fresh", price: 25, quantity: "500 g", available: true },
    potato: { name: "Potato", brand: "Fresh", price: 29, quantity: "1 kg", available: true },
    oil: { name: "Fortune Sunflower Oil", brand: "Fortune", price: 139, originalPrice: 155, discount: "10% off", quantity: "1 L", available: true },
    sugar: { name: "Trust Classic Sugar", brand: "Trust", price: 45, quantity: "1 kg", available: true },
    atta: { name: "Aashirvaad Atta", brand: "Aashirvaad", price: 229, originalPrice: 255, discount: "10% off", quantity: "5 kg", available: true },
    butter: { name: "Amul Butter", brand: "Amul", price: 56, quantity: "100 g", available: true },
    curd: { name: "Amul Masti Dahi", brand: "Amul", price: 32, quantity: "400 g", available: true },
    paneer: { name: "Amul Paneer", brand: "Amul", price: 85, quantity: "200 g", available: true },
    chicken: { name: "Chicken Curry Cut", brand: "Licious", price: 209, quantity: "500 g", available: true },
    salt: { name: "Tata Salt", brand: "Tata", price: 24, quantity: "1 kg", available: true },
  },
  zepto: {
    rice: { name: "India Gate Basmati Rice", brand: "India Gate", price: 195, originalPrice: 220, discount: "11% off", quantity: "1 kg", available: true },
    dal: { name: "Toor Dal", brand: "Tata Sampann", price: 159, originalPrice: 179, discount: "11% off", quantity: "1 kg", available: true },
    milk: { name: "Amul Gold Milk", brand: "Amul", price: 35, quantity: "500 ml", available: true },
    bread: { name: "Harvest Gold Bread", brand: "Harvest Gold", price: 42, quantity: "1 pack", available: true },
    eggs: { name: "Farm Fresh Eggs", brand: "Zepto Fresh", price: 65, originalPrice: 78, discount: "17% off", quantity: "6 pcs", available: true },
    onion: { name: "Onion", brand: "Fresh", price: 37, quantity: "1 kg", available: true },
    tomato: { name: "Tomato", brand: "Fresh", price: 30, quantity: "500 g", available: true },
    potato: { name: "Potato", brand: "Fresh", price: 30, quantity: "1 kg", available: true },
    oil: { name: "Fortune Sunflower Oil", brand: "Fortune", price: 142, originalPrice: 160, discount: "11% off", quantity: "1 L", available: true },
    sugar: { name: "Sugar", brand: "Zepto Fresh", price: 46, quantity: "1 kg", available: true },
    atta: { name: "Aashirvaad Atta", brand: "Aashirvaad", price: 239, originalPrice: 265, discount: "10% off", quantity: "5 kg", available: true },
    butter: { name: "Amul Butter", brand: "Amul", price: 58, quantity: "100 g", available: true },
    curd: { name: "Fresh Curd", brand: "Zepto Fresh", price: 29, quantity: "400 g", available: true },
    paneer: { name: "Fresh Paneer", brand: "Zepto Fresh", price: 95, quantity: "200 g", available: true },
    chicken: { name: "Chicken Curry Cut", brand: "FreshToHome", price: 195, quantity: "500 g", available: true },
    salt: { name: "Tata Salt", brand: "Tata", price: 24, quantity: "1 kg", available: true },
  },
  bigbasket: {
    rice: { name: "India Gate Basmati Rice", brand: "India Gate", price: 205, originalPrice: 230, discount: "11% off", quantity: "1 kg", available: true },
    dal: { name: "Toor Dal", brand: "bb Popular", price: 145, originalPrice: 165, discount: "12% off", quantity: "1 kg", available: true },
    milk: { name: "Nandini Toned Milk", brand: "Nandini", price: 26, quantity: "500 ml", available: true },
    bread: { name: "Modern White Bread", brand: "Modern", price: 39, quantity: "1 pack", available: true },
    eggs: { name: "Fresho Farm Eggs", brand: "Fresho", price: 70, originalPrice: 82, discount: "15% off", quantity: "6 pcs", available: true },
    onion: { name: "Onion - Bangalore Rose", brand: "Fresho", price: 33, quantity: "1 kg", available: true },
    tomato: { name: "Tomato - Hybrid", brand: "Fresho", price: 26, quantity: "500 g", available: true },
    potato: { name: "Potato", brand: "Fresho", price: 31, quantity: "1 kg", available: true },
    oil: { name: "Fortune Sunlite Refined Oil", brand: "Fortune", price: 140, originalPrice: 158, discount: "11% off", quantity: "1 L", available: true },
    sugar: { name: "Sulphurless Sugar", brand: "bb Popular", price: 44, quantity: "1 kg", available: true },
    atta: { name: "Aashirvaad Atta", brand: "Aashirvaad", price: 232, originalPrice: 259, discount: "10% off", quantity: "5 kg", available: true },
    butter: { name: "Amul Pasteurised Butter", brand: "Amul", price: 55, quantity: "100 g", available: true },
    curd: { name: "Nandini Curd", brand: "Nandini", price: 28, quantity: "400 g", available: true },
    paneer: { name: "Amul Fresh Paneer", brand: "Amul", price: 88, quantity: "200 g", available: true },
    chicken: { name: "Chicken - Curry Cut", brand: "Fresho", price: 189, quantity: "500 g", available: true },
    salt: { name: "Tata Salt", brand: "Tata", price: 24, quantity: "1 kg", available: true },
  },
};

function getDemoProduct(platform: string, query: string): ProductResult | null {
  const key = query.toLowerCase().trim();
  const platformData = DEMO_PRICES[platform];
  if (!platformData) return null;

  // Direct match
  if (platformData[key]) return platformData[key];

  // Partial match
  for (const [k, v] of Object.entries(platformData)) {
    if (key.includes(k) || k.includes(key)) return v;
  }

  // Generate a reasonable price for unknown items
  const basePrice = 50 + Math.floor(query.length * 7.3) % 150;
  const variation = platform === "swiggy" ? 0 : platform === "blinkit" ? -5 : platform === "zepto" ? 3 : -2;
  return {
    name: query.charAt(0).toUpperCase() + query.slice(1),
    price: basePrice + variation,
    quantity: "1 unit",
    available: true,
  };
}

// ============================================
// Platform search orchestration
// ============================================

type Scraper = {
  platform: string;
  displayName: string;
  search: (q: string, loc: LocationConfig) => Promise<{ product: ProductResult | null; debug: string }>;
};

const SCRAPERS: Scraper[] = [
  { platform: "swiggy", displayName: "Swiggy Instamart", search: searchSwiggy },
  { platform: "blinkit", displayName: "Blinkit", search: searchBlinkit },
  { platform: "zepto", displayName: "Zepto", search: searchZepto },
  { platform: "bigbasket", displayName: "BigBasket", search: searchBigBasket },
];

async function searchPlatform(scraper: Scraper, queries: string[], loc: LocationConfig, useDemo: boolean): Promise<PlatformResult> {
  const items: PlatformResult["items"] = [];
  let total = 0;
  let itemCount = 0;
  const debugInfo: string[] = [];

  for (const query of queries) {
    let product: ProductResult | null = null;
    let error: string | undefined;

    if (!useDemo) {
      try {
        const result = await scraper.search(query, loc);
        product = result.product;
        debugInfo.push(`${query}: ${result.debug}`);
      } catch (err) {
        error = String(err);
        debugInfo.push(`${query}: exception ${error}`);
      }
    }

    // Fall back to demo data if live search failed
    if (!product) {
      product = getDemoProduct(scraper.platform, query);
      if (product && !useDemo) {
        debugInfo.push(`${query}: using demo fallback`);
      }
    }

    items.push({ query, product, error });
    if (product?.available && product.price > 0) {
      total += product.price;
      itemCount++;
    }
  }

  return {
    platform: scraper.platform,
    displayName: scraper.displayName,
    items,
    total,
    itemCount,
    debug: debugInfo.length > 0 ? debugInfo.join("; ") : undefined,
  };
}

// ============================================
// API handler
// ============================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
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

  // Demo mode: skip live API calls entirely
  const useDemo = req.query.demo === "true";

  // Fetch from all platforms in parallel
  const platforms = await Promise.all(SCRAPERS.map((s) => searchPlatform(s, items, location, useDemo)));

  // Check if any live results came back
  const hasLiveResults = platforms.some((p) =>
    p.items.some((i) => i.product !== null && !p.debug?.includes("demo fallback"))
  );

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
    dataSource: hasLiveResults ? "live" : "demo",
    timestamp: new Date().toISOString(),
  });
}
