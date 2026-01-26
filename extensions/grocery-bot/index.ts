import { Type } from "@sinclair/typebox";

import type { ClawdbotPluginApi } from "../../src/plugins/types.js";
import { GroceryComparison, type ComparisonConfig } from "./src/comparison.js";

interface GroceryBotConfig {
  enabled?: boolean;
  location?: {
    lat?: number;
    lng?: number;
    city?: string;
    pincode?: string;
  };
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

const groceryBotConfigSchema = {
  parse(value: unknown): GroceryBotConfig {
    const raw =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

    const enabled = typeof raw.enabled === "boolean" ? raw.enabled : true;

    const locationRaw = raw.location as Record<string, unknown> | undefined;
    const location = locationRaw
      ? {
          lat: typeof locationRaw.lat === "number" ? locationRaw.lat : undefined,
          lng: typeof locationRaw.lng === "number" ? locationRaw.lng : undefined,
          city: typeof locationRaw.city === "string" ? locationRaw.city : undefined,
          pincode: typeof locationRaw.pincode === "string" ? locationRaw.pincode : undefined,
        }
      : undefined;

    const cacheRaw = raw.cache as Record<string, unknown> | undefined;
    const cache = cacheRaw
      ? {
          enabled: typeof cacheRaw.enabled === "boolean" ? cacheRaw.enabled : true,
          ttlMinutes: typeof cacheRaw.ttlMinutes === "number" ? cacheRaw.ttlMinutes : 30,
        }
      : { enabled: true, ttlMinutes: 30 };

    const rateLimitRaw = raw.rateLimit as Record<string, unknown> | undefined;
    const rateLimit = rateLimitRaw
      ? {
          requestsPerMinute:
            typeof rateLimitRaw.requestsPerMinute === "number"
              ? rateLimitRaw.requestsPerMinute
              : 10,
        }
      : { requestsPerMinute: 10 };

    const platformsRaw = raw.platforms as Record<string, unknown> | undefined;
    const platforms = platformsRaw
      ? {
          swiggy: typeof platformsRaw.swiggy === "boolean" ? platformsRaw.swiggy : true,
          blinkit: typeof platformsRaw.blinkit === "boolean" ? platformsRaw.blinkit : true,
          zepto: typeof platformsRaw.zepto === "boolean" ? platformsRaw.zepto : true,
        }
      : { swiggy: true, blinkit: true, zepto: true };

    return { enabled, location, cache, rateLimit, platforms };
  },
};

const GroceryCompareToolSchema = Type.Object({
  items: Type.Array(Type.String({ description: "Grocery item to search for" }), {
    description:
      "List of grocery items to compare prices for (e.g., ['rice', 'tomato', 'onion'])",
    minItems: 1,
    maxItems: 20,
  }),
  location: Type.Optional(
    Type.Object({
      lat: Type.Optional(Type.Number({ description: "Latitude" })),
      lng: Type.Optional(Type.Number({ description: "Longitude" })),
      city: Type.Optional(Type.String({ description: "City name" })),
      pincode: Type.Optional(Type.String({ description: "Pincode" })),
    }),
  ),
  platforms: Type.Optional(
    Type.Array(
      Type.String({
        description: "Platform to include",
      }),
      { description: "Platforms to compare (swiggy, blinkit, zepto)" },
    ),
  ),
});

const groceryBotPlugin = {
  id: "grocery-bot",
  name: "Grocery Bot",
  description:
    "Compare grocery prices across Swiggy Instamart, Blinkit, and Zepto in India",
  configSchema: groceryBotConfigSchema,
  register(api: ClawdbotPluginApi) {
    const cfg = groceryBotConfigSchema.parse(api.pluginConfig);

    if (!cfg.enabled) {
      api.logger.info("[grocery-bot] Plugin disabled in config");
      return;
    }

    // Default location: Bengaluru, Karnataka
    const defaultLocation = cfg.location ?? {
      lat: 12.9716,
      lng: 77.5946,
      city: "Bengaluru",
    };

    api.registerTool({
      name: "grocery_compare",
      label: "Grocery Price Compare",
      description:
        "Compare grocery prices across Swiggy Instamart, Blinkit, and Zepto. Returns prices for each item on each platform, totals, and a recommendation for the cheapest option.",
      parameters: GroceryCompareToolSchema,
      async execute(_toolCallId, params) {
        const json = (payload: unknown) => ({
          content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
          details: payload,
        });

        try {
          const items = Array.isArray(params?.items) ? params.items : [];
          if (items.length === 0) {
            throw new Error("At least one grocery item is required");
          }

          // Merge location from params and config
          const locationParam = params?.location as Record<string, unknown> | undefined;
          const location = {
            lat:
              (typeof locationParam?.lat === "number" ? locationParam.lat : undefined) ??
              defaultLocation.lat,
            lng:
              (typeof locationParam?.lng === "number" ? locationParam.lng : undefined) ??
              defaultLocation.lng,
            city:
              (typeof locationParam?.city === "string" ? locationParam.city : undefined) ??
              defaultLocation.city,
            pincode:
              (typeof locationParam?.pincode === "string" ? locationParam.pincode : undefined) ??
              defaultLocation.pincode,
          };

          // Platform filter from params
          const platformFilter = Array.isArray(params?.platforms)
            ? params.platforms.map((p: unknown) => String(p).toLowerCase())
            : null;

          const platforms = platformFilter
            ? {
                swiggy: platformFilter.includes("swiggy"),
                blinkit: platformFilter.includes("blinkit"),
                zepto: platformFilter.includes("zepto"),
              }
            : cfg.platforms;

          const comparisonConfig: ComparisonConfig = {
            location,
            cache: cfg.cache,
            rateLimit: cfg.rateLimit,
            platforms,
          };

          const comparison = new GroceryComparison(comparisonConfig);
          const result = await comparison.compare(items);

          // Return both structured data and formatted text
          return {
            content: [
              { type: "text" as const, text: comparison.formatResponse(result) },
            ],
            details: result,
          };
        } catch (err) {
          return json({
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    });

    // Register a cache management tool
    api.registerTool({
      name: "grocery_cache_clear",
      label: "Clear Grocery Cache",
      description: "Clear the grocery price cache to fetch fresh prices",
      parameters: Type.Object({}),
      async execute() {
        try {
          const comparison = new GroceryComparison({
            location: defaultLocation,
            cache: cfg.cache,
          });
          await comparison.clearCache();
          return {
            content: [{ type: "text" as const, text: "Grocery price cache cleared successfully." }],
            details: { cleared: true },
          };
        } catch (err) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Failed to clear cache: ${err instanceof Error ? err.message : String(err)}`,
              },
            ],
            details: { error: err instanceof Error ? err.message : String(err) },
          };
        }
      },
    });

    api.logger.info(
      `[grocery-bot] Registered grocery comparison tool for ${defaultLocation.city}`,
    );
  },
};

export default groceryBotPlugin;
