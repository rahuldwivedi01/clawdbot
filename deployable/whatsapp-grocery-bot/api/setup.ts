import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Setup and status endpoint - shows Molt Bot configuration status
 * and provides setup instructions.
 */

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const gatewayUrl = process.env.MOLTBOT_GATEWAY_URL ?? "";
  const hasToken = Boolean(process.env.MOLTBOT_API_TOKEN);

  const configured = Boolean(gatewayUrl);

  let gatewayReachable = false;
  if (configured) {
    try {
      const healthUrl = `${gatewayUrl.replace(/\/$/, "")}/v1/models`;
      const r = await fetch(healthUrl, {
        signal: AbortSignal.timeout(5000),
        headers: hasToken ? { Authorization: `Bearer ${process.env.MOLTBOT_API_TOKEN!}` } : {},
      });
      gatewayReachable = r.ok;
    } catch {
      gatewayReachable = false;
    }
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.status(200).json({
    status: configured && gatewayReachable ? "ready" : configured ? "configured_not_reachable" : "not_configured",
    gateway: {
      url: gatewayUrl ? `${gatewayUrl.substring(0, 20)}...` : null,
      configured,
      reachable: gatewayReachable,
      hasToken,
    },
    modes: {
      demo: "Always available - uses estimated prices based on market data",
      live: configured && gatewayReachable
        ? "Available - Molt Bot will browse platforms for real-time prices"
        : "Not available - requires Molt Bot gateway setup",
    },
    setup: {
      steps: [
        "1. Install Clawdbot (Molt Bot): npm install -g clawdbot",
        "2. Run: clawdbot config set browser.enabled true",
        "3. Start gateway: clawdbot gateway run --bind lan --port 18789",
        "4. Expose gateway publicly (tunnel): npx cloudflared tunnel --url http://localhost:18789",
        "5. Set Vercel env vars: MOLTBOT_GATEWAY_URL=https://your-tunnel-url",
        "6. (Optional) Set MOLTBOT_API_TOKEN if gateway auth is enabled",
      ],
      docs: "https://docs.clawd.bot/tools/browser",
    },
  });
}
