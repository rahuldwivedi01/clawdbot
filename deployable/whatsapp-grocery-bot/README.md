# WhatsApp Grocery Price Comparison Bot

A WhatsApp bot that compares grocery prices across **Swiggy Instamart**, **Blinkit**, and **Zepto** in India. Users can send a list of grocery items and receive instant price comparisons with recommendations for the cheapest platform.

## Features

- Compare prices across 3 major Indian quick-commerce platforms
- Location-based pricing (default: Bengaluru)
- Automatic recommendation for the cheapest option
- Simple comma-separated item input
- Fast responses with price caching
- Easy deployment to Vercel

## Demo

Send a message like:
```
rice, dal, milk, bread
```

Get a response like:
```
🛒 Grocery Price Comparison
📍 Location: Bengaluru
🔍 Items: rice, dal, milk, bread

🟠 Swiggy Instamart
   • rice: ₹299 (15% off)
     India Gate Basmati Rice - 1 kg
   • dal: ₹145
     Toor Dal - 1 kg
   ...
   Total: ₹589 (4 items)

🟡 Blinkit
   ...
   Total: ₹549 (4 items)

🟣 Zepto
   ...
   Total: ₹565 (4 items)

💡 RECOMMENDATION
Blinkit is cheapest! Save ₹40 compared to Swiggy Instamart.
```

## Quick Start

### Prerequisites

- Node.js 18 or higher
- A Meta Developer account
- A WhatsApp Business account
- Vercel account (free tier works)

### 1. Clone and Setup

```bash
# Clone this repository
git clone https://github.com/YOUR_USERNAME/whatsapp-grocery-bot.git
cd whatsapp-grocery-bot

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 2. Set Up WhatsApp Cloud API

1. Go to [Meta Developer Portal](https://developers.facebook.com/)
2. Create a new app (Business type)
3. Add the WhatsApp product to your app
4. Go to WhatsApp → API Setup
5. Note down:
   - **Phone number ID** (under "From" section)
   - **Temporary access token** (click "Generate" - valid for 24 hours)

For production, create a permanent access token:
1. Go to Business Settings → System Users
2. Create a system user with admin access
3. Generate a token with `whatsapp_business_messaging` permission

### 3. Configure Environment Variables

Edit `.env` with your credentials:

```env
WHATSAPP_TOKEN=your_access_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_VERIFY_TOKEN=create_a_random_string_here
DEFAULT_CITY=Bengaluru
DEFAULT_LAT=12.9716
DEFAULT_LNG=77.5946
```

### 4. Deploy to Vercel

#### Option A: Deploy with Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables
vercel env add WHATSAPP_TOKEN
vercel env add WHATSAPP_PHONE_NUMBER_ID
vercel env add WHATSAPP_VERIFY_TOKEN
vercel env add DEFAULT_CITY
vercel env add DEFAULT_LAT
vercel env add DEFAULT_LNG

# Deploy to production
vercel --prod
```

#### Option B: Deploy via Vercel Dashboard

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Add environment variables in Project Settings → Environment Variables
5. Deploy

### 5. Configure WhatsApp Webhook

After deployment, configure the webhook in Meta Developer Portal:

1. Go to WhatsApp → Configuration
2. Click "Edit" next to Webhook
3. Enter:
   - **Callback URL**: `https://your-app.vercel.app/webhook`
   - **Verify token**: Same as your `WHATSAPP_VERIFY_TOKEN`
4. Click "Verify and Save"
5. Subscribe to `messages` webhook field

### 6. Test Your Bot

1. Add your phone number to the WhatsApp test numbers
2. Send a message to the WhatsApp Business number
3. Try: `rice, dal, milk`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check and status |
| `/webhook` | GET | WhatsApp webhook verification |
| `/webhook` | POST | Receive WhatsApp messages |
| `/api/test?items=rice,dal` | GET | Test price comparison without WhatsApp |

## Testing Without WhatsApp

You can test the price comparison directly:

```bash
# Test locally
npm run dev

# Then visit:
# http://localhost:3000/api/test?items=rice,dal,milk
```

Or after deployment:
```bash
curl "https://your-app.vercel.app/api/test?items=rice,dal,milk"
```

## Changing Location

To change the default location (city), update the environment variables:

```env
DEFAULT_CITY=Mumbai
DEFAULT_LAT=19.0760
DEFAULT_LNG=72.8777
```

Common Indian city coordinates:
- **Bengaluru**: 12.9716, 77.5946
- **Mumbai**: 19.0760, 72.8777
- **Delhi**: 28.6139, 77.2090
- **Chennai**: 13.0827, 80.2707
- **Hyderabad**: 17.3850, 78.4867
- **Pune**: 18.5204, 73.8567
- **Kolkata**: 22.5726, 88.3639

## Project Structure

```
whatsapp-grocery-bot/
├── api/
│   ├── webhook.ts      # WhatsApp webhook handler
│   ├── health.ts       # Health check endpoint
│   └── test.ts         # Test endpoint for price comparison
├── lib/
│   ├── types.ts        # TypeScript type definitions
│   ├── comparison.ts   # Price comparison logic
│   ├── whatsapp.ts     # WhatsApp API helpers
│   └── scrapers/
│       ├── index.ts    # Scraper exports
│       ├── swiggy.ts   # Swiggy Instamart scraper
│       ├── blinkit.ts  # Blinkit scraper
│       └── zepto.ts    # Zepto scraper
├── .env.example        # Environment variables template
├── vercel.json         # Vercel configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Limitations & Notes

1. **API Stability**: The scrapers use undocumented APIs from the platforms. They may break if the platforms change their APIs.

2. **Rate Limiting**: The bot includes basic rate limiting, but excessive usage may get blocked by the platforms.

3. **Caching**: Prices are cached for 30 minutes to reduce API calls. The cache resets on serverless cold starts.

4. **Location**: Prices vary by location. Ensure you set the correct coordinates for your area.

5. **WhatsApp Limits**: The free tier of WhatsApp Cloud API has conversation limits. Check Meta's documentation for current limits.

## Troubleshooting

### Webhook verification fails
- Ensure `WHATSAPP_VERIFY_TOKEN` matches exactly what you entered in Meta Developer Portal
- Check that your Vercel deployment is successful

### Not receiving messages
- Verify webhook subscription includes `messages`
- Check Vercel function logs for errors
- Ensure phone number is added to test numbers (for development)

### Prices not found
- The platforms may have changed their API structure
- Try different search terms (e.g., "toor dal" instead of "dal")
- Check if the platforms are available in your location

### Rate limited
- Wait a few minutes before retrying
- Consider implementing more aggressive caching

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this for personal or commercial projects.

## Disclaimer

This project is not affiliated with Swiggy, Blinkit, Zepto, Meta, or WhatsApp. It uses undocumented APIs which may break at any time. Use at your own risk.
