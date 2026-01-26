// ============================================
// Grocery Types
// ============================================

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

export interface PlatformScraper {
  platform: "swiggy" | "blinkit" | "zepto";
  displayName: string;
  search(query: string, location: LocationConfig): Promise<ProductResult | null>;
}

// ============================================
// WhatsApp Cloud API Types
// ============================================

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: {
            name: string;
          };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          text?: {
            body: string;
          };
          type: string;
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  text: string;
  name: string;
}

export interface WhatsAppSendMessagePayload {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "text";
  text: {
    preview_url: boolean;
    body: string;
  };
}
