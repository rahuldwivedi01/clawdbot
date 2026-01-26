import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const status = {
    status: "ok",
    service: "WhatsApp Grocery Price Bot",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    endpoints: {
      webhook: "/webhook (GET for verification, POST for messages)",
      health: "/ or /api/health",
      test: "/api/test?items=rice,dal,milk",
    },
    platforms: ["Swiggy Instamart", "Blinkit", "Zepto"],
    location: process.env.DEFAULT_CITY ?? "Bengaluru",
  };

  res.status(200).json(status);
}
