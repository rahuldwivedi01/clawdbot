export class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(options: { requestsPerMinute?: number } = {}) {
    this.maxRequests = options.requestsPerMinute ?? 10;
    this.windowMs = 60_000; // 1 minute
  }

  async acquire(): Promise<void> {
    const now = Date.now();

    // Remove old requests outside the window
    this.requests = this.requests.filter((t) => now - t < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      // Wait until the oldest request falls outside the window
      const oldestRequest = this.requests[0];
      if (oldestRequest) {
        const waitTime = this.windowMs - (now - oldestRequest) + 100;
        if (waitTime > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
      // Recursively check again
      return this.acquire();
    }

    this.requests.push(now);
  }

  reset(): void {
    this.requests = [];
  }

  get remaining(): number {
    const now = Date.now();
    const recentRequests = this.requests.filter((t) => now - t < this.windowMs);
    return Math.max(0, this.maxRequests - recentRequests.length);
  }
}
