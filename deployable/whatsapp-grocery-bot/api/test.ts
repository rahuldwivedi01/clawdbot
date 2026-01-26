import type { VercelRequest, VercelResponse } from "@vercel/node";
import { compareGroceryPrices, formatComparisonResponse } from "../lib/comparison.js";

// Default location: Bengaluru, Karnataka, India
const DEFAULT_LOCATION = {
  lat: parseFloat(process.env.DEFAULT_LAT ?? "12.9716"),
  lng: parseFloat(process.env.DEFAULT_LNG ?? "77.5946"),
  city: process.env.DEFAULT_CITY ?? "Bengaluru",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Get items from query parameter
  const itemsParam = req.query.items;

  if (!itemsParam) {
    return res.status(400).json({
      error: "Missing 'items' query parameter",
      example: "/api/test?items=rice,dal,milk",
    });
  }

  const items =
    typeof itemsParam === "string"
      ? itemsParam.split(",").map((i) => i.trim())
      : itemsParam.map((i) => i.trim());

  if (items.length === 0) {
    return res.status(400).json({
      error: "No items provided",
      example: "/api/test?items=rice,dal,milk",
    });
  }

  if (items.length > 10) {
    return res.status(400).json({
      error: "Maximum 10 items allowed",
    });
  }

  try {
    console.log(`Testing price comparison for: ${items.join(", ")}`);

    const result = await compareGroceryPrices(items, {
      location: DEFAULT_LOCATION,
    });

    // Return format based on Accept header
    const acceptHeader = req.headers.accept ?? "";

    if (acceptHeader.includes("text/plain")) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.status(200).send(formatComparisonResponse(result));
    }

    // Return both formatted and raw JSON
    return res.status(200).json({
      formatted: formatComparisonResponse(result),
      raw: result,
    });
  } catch (err) {
    console.error("Test endpoint error:", err);
    return res.status(500).json({
      error: "Price comparison failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
