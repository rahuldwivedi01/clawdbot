# Grocery Price Checker

A web app that compares grocery prices across **Swiggy Instamart**, **Blinkit**, **Zepto**, and **BigBasket** in India. Optionally powered by **Molt Bot** (Clawdbot) for live browser-based price fetching.

## Features

- Compare prices across 4 major Indian quick-commerce platforms
- Location-based pricing (18 Indian cities supported)
- Cheapest platform recommendation with savings calculation
- Two modes: **Estimated** (instant) and **Live** (Molt Bot browser browsing)
- Dark theme UI, mobile-responsive
- Easy deployment to Vercel

## How It Works

### Mode 1: Estimated Prices (Default)

Works immediately, no setup needed. Shows realistic estimated prices based on recent market data. The API first attempts to call live platform APIs, and falls back to curated demo data when platforms block the request (common from datacenter IPs).

### Mode 2: Live Prices via Molt Bot

When configured, the app calls a Molt Bot (Clawdbot) agent that uses a real Chromium browser to visit each platform, search for items, and extract actual current prices. This bypasses API blocking because it renders pages like a real user.

## Quick Start

### 1. Deploy to Vercel (Estimated Mode)

```bash
# Clone the repo
git clone https://github.com/rahuldwivedi01/wa_pricechecker_bot.git
cd wa_pricechecker_bot

# Deploy to Vercel
npx vercel --prod
```

Or connect the GitHub repo to Vercel via the dashboard for auto-deploy.

That's it - the app works immediately with estimated prices.

### 2. Enable Live Prices (Optional - Molt Bot Setup)

To get real-time prices, set up Molt Bot with browser capabilities:

#### Step 1: Install Molt Bot

```bash
npm install -g clawdbot
```

#### Step 2: Configure Browser

```bash
clawdbot config set browser.enabled true
```

#### Step 3: Start the Gateway

```bash
clawdbot gateway run --bind lan --port 18789
```

#### Step 4: Expose Gateway Publicly

Use Cloudflare Tunnel (free) to make the gateway reachable from Vercel:

```bash
npx cloudflared tunnel --url http://localhost:18789
```

This gives you a public URL like `https://abc123.trycloudflare.com`.

#### Step 5: Set Vercel Environment Variables

In the Vercel dashboard (Project Settings > Environment Variables):

| Variable | Value |
|----------|-------|
| `MOLTBOT_GATEWAY_URL` | `https://abc123.trycloudflare.com` |
| `MOLTBOT_API_TOKEN` | _(optional, if gateway auth is enabled)_ |

#### Step 6: Redeploy

Trigger a redeploy in Vercel. The app will now try Molt Bot first for live prices, falling back to estimated prices if the agent is unavailable.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Web UI |
| `/api/compare?items=rice,dal&city=Bengaluru` | GET | Price comparison (estimated + scraper fallback) |
| `/api/agent-compare?items=rice,dal&city=Bengaluru` | GET | Price comparison via Molt Bot (live browsing) |
| `/api/setup` | GET | Check Molt Bot configuration status |
| `/api/health` | GET | Health check |

## Supported Cities

Bengaluru, Mumbai, Delhi, Chennai, Hyderabad, Pune, Kolkata, Ahmedabad, Jaipur, Lucknow, Gurgaon/Gurugram, Noida, Chandigarh, Indore, Kochi

## Project Structure

```
wa_pricechecker_bot/
├── api/
│   ├── compare.ts          # Price comparison (scrapers + demo fallback)
│   ├── agent-compare.ts    # Molt Bot agent bridge (live browsing)
│   ├── setup.ts            # Molt Bot setup status
│   ├── webhook.ts          # WhatsApp webhook (future)
│   ├── health.ts           # Health check
│   └── index.ts            # Root API handler
├── lib/
│   ├── types.ts            # TypeScript types
│   ├── comparison.ts       # Price comparison logic
│   ├── whatsapp.ts         # WhatsApp helpers
│   └── scrapers/           # Platform scrapers
├── public/
│   └── index.html          # Web UI
├── vercel.json             # Vercel config
├── package.json
└── tsconfig.json
```

## Architecture

```
User → Vercel Web App (index.html)
         ↓
       /api/agent-compare (tries Molt Bot first)
         ↓ (if available)
       Molt Bot Gateway → Browser Tool → Platform Websites
         ↓ (if not available, falls back to)
       /api/compare → Direct API scraping + demo data fallback
```

## Limitations

1. **Estimated mode**: Prices are realistic estimates, not live. They serve as a useful baseline but may differ from actual platform prices.
2. **Live mode**: Requires a server running Molt Bot with Chromium. Browser-based scraping takes 1-3 minutes for a full comparison.
3. **Platform APIs**: Direct API scraping is blocked by most platforms from datacenter IPs. This is why the Molt Bot browser approach exists.
4. **Location**: Prices vary by delivery location. Results are most accurate for the selected city center.

## License

MIT
