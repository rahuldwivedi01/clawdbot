import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    status: "ok",
    service: "WhatsApp Grocery Price Bot",
    message: "Bot is running! Use /api/test?items=rice,dal to test price comparison.",
    timestamp: new Date().toISOString(),
  });
}
