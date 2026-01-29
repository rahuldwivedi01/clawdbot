---
name: grocery-prices
description: Browse Swiggy Instamart, Blinkit, Zepto, and BigBasket to compare grocery prices. Uses browser tool to visit each platform, search for items, and extract live pricing. Triggers when users ask about grocery prices, comparisons, or send a list of items.
metadata: {"clawdbot":{"emoji":"🛒","requires":{"config":["browser.enabled"]}}}
---

# Grocery Price Comparison (Browser-based)

Browse Indian quick-commerce platforms to compare grocery prices in real time using the browser tool.

## Supported Platforms

| Platform | URL | Color |
|----------|-----|-------|
| Swiggy Instamart | https://www.swiggy.com/instamart | Orange |
| Blinkit | https://blinkit.com | Yellow |
| Zepto | https://www.zeptonow.com | Purple |
| BigBasket | https://www.bigbasket.com | Green |

## When to Use

Activate this skill when users:
- Ask about grocery prices in India
- Want to compare prices across platforms ("which is cheaper")
- Send a grocery list like "rice, dal, onion, tomato"
- Ask "where should I buy groceries" or "best price for milk"
- Mention Swiggy Instamart, Blinkit, Zepto, or BigBasket

## How to Browse Each Platform

For each item in the grocery list, visit each platform and search for the item. Follow these steps per platform:

### Swiggy Instamart

1. Navigate to `https://www.swiggy.com/instamart`
2. Take a snapshot to find the search bar
3. Click the search input and type the item name (e.g., "rice")
4. Wait 2 seconds for results to load
5. Take a snapshot to read search results
6. Extract from the first relevant result: **product name**, **brand**, **price** (look for offer/selling price), **original price** (MRP), **quantity/weight**, **availability**
7. If location prompt appears, set city to the user's city first

### Blinkit

1. Navigate to `https://blinkit.com`
2. Take a snapshot to find the search bar
3. Click the search input and type the item name
4. Wait 2 seconds for results
5. Take a snapshot to read product cards
6. Extract: **product name**, **brand**, **price**, **MRP**, **discount**, **quantity**, **availability**
7. If location picker appears, enter the user's pincode or allow location

### Zepto

1. Navigate to `https://www.zeptonow.com/search?query=ITEM` (replace ITEM with the search term)
2. Wait 2 seconds for page load
3. Take a snapshot to read product listings
4. Extract: **product name**, **brand**, **selling price**, **MRP**, **discount**, **pack size**, **availability**
5. If address/location needed, enter pincode first

### BigBasket

1. Navigate to `https://www.bigbasket.com/ps/?q=ITEM` (replace ITEM with the search term)
2. Wait 2 seconds for page load
3. Take a snapshot to read product listings
4. Extract: **product name**, **brand**, **sale price**, **MRP**, **discount text**, **weight/quantity**, **availability**

## Browsing Tips

- Use `snapshot` with `snapshotFormat: "ai"` for cleaner extraction
- If a page requires location first, handle location setup before searching
- If products don't load, try `screenshot` to see what's on screen
- Some platforms may show a login wall - skip those and note the platform couldn't be checked
- Keep searches fast: only extract the first 1-2 results per item per platform
- Between platforms, open a new tab rather than navigating in the same tab

## Output Format

After browsing all platforms, compile results as a comparison table:

```
Grocery Price Comparison
Location: {city}
Items: {item1}, {item2}, ...

{Platform Name}
──────────────────────────────
  {item}: {Product Name}
    Rs {price} ({discount}% off, MRP Rs {mrp}) - {quantity}
  ...
  ────────────
  Total: Rs {sum} ({count} items)

... (repeat for each platform)

RECOMMENDATION
──────────────────────────────
{Cheapest platform} is cheapest! Save Rs {amount} compared to {most expensive}.
```

## Structured JSON Output

When called via the agent API (not conversational), return results as JSON:

```json
{
  "query": ["rice", "dal"],
  "location": {"city": "Bengaluru"},
  "platforms": [
    {
      "platform": "swiggy",
      "displayName": "Swiggy Instamart",
      "items": [
        {
          "query": "rice",
          "product": {
            "name": "India Gate Basmati Rice",
            "brand": "India Gate",
            "price": 199,
            "originalPrice": 225,
            "discount": "12% off",
            "quantity": "1 kg",
            "available": true
          }
        }
      ],
      "total": 199,
      "itemCount": 1
    }
  ],
  "recommendation": {
    "platform": "Blinkit",
    "total": 189,
    "savings": 10,
    "message": "Save Rs 10 compared to Swiggy Instamart"
  },
  "dataSource": "live"
}
```

## Performance Notes

- Browsing 4 platforms for 5 items takes roughly 2-3 minutes
- For faster results, browse platforms in parallel if multiple browser tabs are supported
- Cache results mentally within the same session to avoid re-browsing
- If a platform is slow or unresponsive, skip it and note it as unavailable

## Example Conversations

User: "Compare rice and dal prices"
Agent: Opens browser, visits all 4 platforms, searches for "rice" and "dal" on each, extracts prices, compiles comparison.

User: "Which app has the cheapest milk in Mumbai?"
Agent: Sets location to Mumbai, browses all platforms for "milk", compares prices.

User: "I need to buy eggs, bread, butter, and milk. What's the best deal?"
Agent: Browses all platforms for each item, calculates totals, recommends the cheapest platform.
