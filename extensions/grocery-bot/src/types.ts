export interface GroceryItem {
  name: string;
  searchQuery: string;
  quantity?: string;
}

export interface ProductResult {
  name: string;
  brand?: string;
  price: number;
  originalPrice?: number;
  discount?: string;
  quantity: string;
  unit?: string;
  imageUrl?: string;
  available: boolean;
  productId?: string;
}

export interface PlatformResult {
  platform: "swiggy" | "blinkit" | "zepto";
  displayName: string;
  items: Array<{
    query: string;
    product: ProductResult | null;
    error?: string;
  }>;
  total: number;
  itemCount: number;
  deliveryFee?: number;
  estimatedDelivery?: string;
  error?: string;
}

export interface ComparisonResult {
  query: string[];
  location: {
    city: string;
    lat?: number;
    lng?: number;
    pincode?: string;
  };
  platforms: PlatformResult[];
  recommendation: {
    platform: string;
    total: number;
    savings: number;
    message: string;
  } | null;
  timestamp: string;
}

export interface LocationConfig {
  lat?: number;
  lng?: number;
  city?: string;
  pincode?: string;
}

export interface CacheEntry {
  result: ProductResult | null;
  timestamp: number;
  location: LocationConfig;
}

export interface PlatformScraper {
  platform: "swiggy" | "blinkit" | "zepto";
  displayName: string;
  search(query: string, location: LocationConfig): Promise<ProductResult | null>;
}
