---
name: grocery-bot
description: Compare grocery prices across Swiggy Instamart, Blinkit, and Zepto in India. Returns prices, totals, and recommendations for the cheapest platform.
metadata: {"clawdbot":{"emoji":"🛒","requires":{"plugins":["grocery-bot"]}}}
---

# Grocery Price Comparison

Compare grocery prices across Indian quick-commerce platforms: Swiggy Instamart, Blinkit, and Zepto.

## When to Use

Use the `grocery_compare` tool when users:
- Ask about grocery prices
- Want to compare prices across platforms
- Ask "which is cheaper" for groceries
- Send a list of items like "rice, tomato, onion"
- Ask where to buy groceries

## Tool: grocery_compare

**Purpose**: Search and compare grocery prices across platforms.

**Parameters**:
- `items` (required): Array of grocery items to search, e.g., `["rice", "tomato", "onion"]`
- `location` (optional): Object with `lat`, `lng`, `city`, `pincode` for location-based pricing
- `platforms` (optional): Array to filter platforms, e.g., `["swiggy", "blinkit"]`

**Examples**:

Simple comparison:
```json
{
  "items": ["rice", "tomato", "onion", "milk"]
}
```

With location:
```json
{
  "items": ["basmati rice 1kg", "amul butter"],
  "location": {
    "city": "Mumbai",
    "lat": 19.076,
    "lng": 72.8777
  }
}
```

Specific platforms:
```json
{
  "items": ["eggs", "bread"],
  "platforms": ["blinkit", "zepto"]
}
```

## Response Format

The tool returns:
1. **Per-platform breakdown**: Item name, price, discount, quantity, availability
2. **Platform totals**: Sum of all items found on each platform
3. **Recommendation**: Which platform is cheapest and potential savings

Example response format:
```
Grocery Price Comparison
Location: Bengaluru
Items: rice, tomato, onion

Swiggy Instamart
──────────────────────────────
  rice: India Gate Basmati Rice
    Rs 299 (15% off) - 1 kg
  tomato: Fresh Tomato
    Rs 35 - 500 g
  onion: Fresh Onion
    Rs 40 - 1 kg
  ────────────
  Total: Rs 374 (3 items)

Blinkit
──────────────────────────────
  rice: Daawat Basmati Rice
    Rs 279 (10% off) - 1 kg
  tomato: Tomato
    Rs 32 - 500 g
  onion: Onion
    Rs 38 - 1 kg
  ────────────
  Total: Rs 349 (3 items)

Zepto
──────────────────────────────
  rice: Fortune Basmati Rice
    Rs 289 - 1 kg
  tomato: Tomato
    Rs 30 - 500 g
  onion: Onion
    Rs 42 - 1 kg
  ────────────
  Total: Rs 361 (3 items)

RECOMMENDATION
──────────────────────────────
Blinkit is cheapest! Save Rs 25 compared to Swiggy Instamart.
```

## Tool: grocery_cache_clear

Use this to clear cached prices and fetch fresh data:
```json
{}
```

## Tips for Best Results

1. **Be specific**: "basmati rice 1kg" works better than just "rice"
2. **Include brand**: "amul milk 1L" for specific products
3. **Quantity matters**: Search terms like "eggs 12" or "bread 400g"
4. **Common items**: The tool works best for everyday grocery items

## Handling Edge Cases

- **Item not found**: The tool will show "Not found" for unavailable items
- **Out of stock**: Items show `[Out of stock]` status
- **API issues**: If a platform fails, it will show an error but continue with others
- **Cache**: Results are cached for 30 minutes by default

## Example Conversations

User: "Compare rice, tomato, and onion prices"
Agent: Uses `grocery_compare` with `items: ["rice", "tomato", "onion"]`

User: "Which app has cheaper milk?"
Agent: Uses `grocery_compare` with `items: ["milk"]`

User: "I need to buy groceries. Check prices for dal, rice, oil, and salt"
Agent: Uses `grocery_compare` with `items: ["dal", "rice", "oil", "salt"]`

User: "Get fresh prices for eggs"
Agent: First uses `grocery_cache_clear`, then `grocery_compare` with `items: ["eggs"]`
