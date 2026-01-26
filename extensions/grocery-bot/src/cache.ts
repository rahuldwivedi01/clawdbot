import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import type { CacheEntry, LocationConfig, ProductResult } from "./types.js";

const CACHE_DIR = path.join(os.homedir(), ".clawdbot", "grocery-cache");

interface CacheStore {
  entries: Record<string, CacheEntry>;
}

export class PriceCache {
  private ttlMs: number;
  private enabled: boolean;
  private cacheFile: string;
  private store: CacheStore | null = null;

  constructor(options: { ttlMinutes?: number; enabled?: boolean } = {}) {
    this.ttlMs = (options.ttlMinutes ?? 30) * 60 * 1000;
    this.enabled = options.enabled ?? true;
    this.cacheFile = path.join(CACHE_DIR, "prices.json");
  }

  private getCacheKey(platform: string, query: string, location: LocationConfig): string {
    const locationKey = [
      location.lat?.toFixed(2),
      location.lng?.toFixed(2),
      location.city,
      location.pincode,
    ]
      .filter(Boolean)
      .join("-");
    return `${platform}:${query.toLowerCase().trim()}:${locationKey}`;
  }

  private async loadStore(): Promise<CacheStore> {
    if (this.store) return this.store;

    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      const content = await fs.readFile(this.cacheFile, "utf-8");
      this.store = JSON.parse(content) as CacheStore;
    } catch {
      this.store = { entries: {} };
    }

    return this.store;
  }

  private async saveStore(): Promise<void> {
    if (!this.store) return;
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.writeFile(this.cacheFile, JSON.stringify(this.store, null, 2));
    } catch {
      // Ignore save errors
    }
  }

  async get(
    platform: string,
    query: string,
    location: LocationConfig,
  ): Promise<ProductResult | null | undefined> {
    if (!this.enabled) return undefined;

    const store = await this.loadStore();
    const key = this.getCacheKey(platform, query, location);
    const entry = store.entries[key];

    if (!entry) return undefined;

    const age = Date.now() - entry.timestamp;
    if (age > this.ttlMs) {
      // Expired
      delete store.entries[key];
      await this.saveStore();
      return undefined;
    }

    return entry.result;
  }

  async set(
    platform: string,
    query: string,
    location: LocationConfig,
    result: ProductResult | null,
  ): Promise<void> {
    if (!this.enabled) return;

    const store = await this.loadStore();
    const key = this.getCacheKey(platform, query, location);

    store.entries[key] = {
      result,
      timestamp: Date.now(),
      location,
    };

    // Clean up old entries (keep max 1000)
    const keys = Object.keys(store.entries);
    if (keys.length > 1000) {
      const sorted = keys.sort((a, b) => {
        const aTime = store.entries[a]?.timestamp ?? 0;
        const bTime = store.entries[b]?.timestamp ?? 0;
        return aTime - bTime;
      });
      for (const oldKey of sorted.slice(0, keys.length - 1000)) {
        delete store.entries[oldKey];
      }
    }

    await this.saveStore();
  }

  async clear(): Promise<void> {
    this.store = { entries: {} };
    await this.saveStore();
  }

  async stats(): Promise<{ entries: number; oldestMs: number; newestMs: number }> {
    const store = await this.loadStore();
    const entries = Object.values(store.entries);
    const timestamps = entries.map((e) => e.timestamp);

    return {
      entries: entries.length,
      oldestMs: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestMs: timestamps.length > 0 ? Math.max(...timestamps) : 0,
    };
  }
}
