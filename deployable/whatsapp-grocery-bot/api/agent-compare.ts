import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";

/**
 * API endpoint that calls Molt Bot (Clawdbot) agent to browse grocery platforms
 * and return live price comparisons.
 *
 * Requires env vars:
 *   MOLTBOT_GATEWAY_URL  - WebSocket or HTTP URL of the gateway (e.g. https://your-gateway.example.com)
 *   MOLTBOT_API_TOKEN    - Gateway API token (if auth is enabled)
 *
 * Usage: GET /api/agent-compare?items=rice,dal&city=Bengaluru
 */

const TIMEOUT_MS = 120_000; // 2 minutes max for browser-based scraping

function getGatewayUrl(): string {
  return process.env.MOLTBOT_GATEWAY_URL ?? "";
}

function getApiToken(): string {
  return process.env.MOLTBOT_API_TOKEN ?? "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const gatewayUrl = getGatewayUrl();
  if (!gatewayUrl) {
    return res.status(503).json({
      error: "Molt Bot gateway not configured",
      detail: "Set MOLTBOT_GATEWAY_URL environment variable in Vercel.",
      setup: "See /api/setup for instructions.",
    });
  }

  const itemsParam = req.query.items;
  if (!itemsParam) {
    return res.status(400).json({ error: "Missing 'items' query parameter." });
  }

  const items = (typeof itemsParam === "string" ? itemsParam : itemsParam.join(","))
    .split(",")
    .map((i) => i.trim())
    .filter((i) => i.length > 0);

  if (items.length === 0) return res.status(400).json({ error: "No valid items provided." });
  if (items.length > 10) return res.status(400).json({ error: "Maximum 10 items allowed." });

  const city = (typeof req.query.city === "string" ? req.query.city : "Bengaluru").trim();
  const pincode = typeof req.query.pincode === "string" ? req.query.pincode.trim() : "";

  // Build the agent message
  const message = buildAgentMessage(items, city, pincode);

  try {
    const result = await callMoltBotAgent(gatewayUrl, message);
    return res.status(200).json(result);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return res.status(502).json({
      error: "Failed to get response from Molt Bot",
      detail: errorMsg,
    });
  }
}

function buildAgentMessage(items: string[], city: string, pincode: string): string {
  const itemList = items.join(", ");
  const locationInfo = pincode ? `${city} (pincode: ${pincode})` : city;

  return [
    `Compare grocery prices for these items: ${itemList}`,
    `Location: ${locationInfo}`,
    "",
    "Browse Swiggy Instamart, Blinkit, Zepto, and BigBasket to find current prices.",
    "Return the results as JSON in the structured format from the grocery-prices skill.",
    "Include all 4 platforms. For each item, extract: name, brand, price, originalPrice, discount, quantity, available.",
    "Calculate totals and recommendation for cheapest platform.",
    'Set dataSource to "live" since you are browsing real platforms.',
  ].join("\n");
}

async function callMoltBotAgent(
  gatewayUrl: string,
  message: string,
): Promise<Record<string, unknown>> {
  const apiToken = getApiToken();

  // Use the HTTP Chat Completions endpoint (OpenAI-compatible)
  const httpUrl = gatewayUrl.replace(/\/$/, "");
  const url = `${httpUrl}/v1/chat/completions`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
      },
      body: JSON.stringify({
        model: "default",
        messages: [
          {
            role: "system",
            content:
              "You are a grocery price comparison agent. Use the browser tool to visit Swiggy Instamart, Blinkit, Zepto, and BigBasket. Search for the requested items and extract prices. Return results as a JSON object with platforms, items, totals, and recommendation. Always return valid JSON only - no markdown formatting.",
          },
          {
            role: "user",
            content: message,
          },
        ],
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gateway returned HTTP ${response.status}: ${text}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "";

    // Try to parse the agent's response as JSON
    return parseAgentResponse(content);
  } finally {
    clearTimeout(timeout);
  }
}

function parseAgentResponse(content: string): Record<string, unknown> {
  // Try direct JSON parse
  try {
    return JSON.parse(content);
  } catch {
    // noop
  }

  // Try extracting JSON from markdown code block
  const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {
      // noop
    }
  }

  // Try finding JSON object in the text
  const braceMatch = content.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch {
      // noop
    }
  }

  // Return raw text as fallback
  return {
    rawResponse: content,
    dataSource: "agent",
    error: "Could not parse agent response as JSON",
  };
}
