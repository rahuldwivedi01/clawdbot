import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { WhatsAppWebhookPayload } from "../lib/types.js";
import {
  extractMessages,
  sendWhatsAppMessage,
  markMessageAsRead,
  getVerifyToken,
  splitMessage,
} from "../lib/whatsapp.js";
import {
  compareGroceryPrices,
  formatComparisonResponse,
  parseGroceryItems,
  isGroceryQuery,
} from "../lib/comparison.js";

// Default location: Bengaluru, Karnataka, India
const DEFAULT_LOCATION = {
  lat: parseFloat(process.env.DEFAULT_LAT ?? "12.9716"),
  lng: parseFloat(process.env.DEFAULT_LNG ?? "77.5946"),
  city: process.env.DEFAULT_CITY ?? "Bengaluru",
};

// Track processed message IDs to avoid duplicates (simple in-memory for serverless)
const processedMessages = new Set<string>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET request = webhook verification
  if (req.method === "GET") {
    return handleVerification(req, res);
  }

  // POST request = incoming message
  if (req.method === "POST") {
    return handleWebhook(req, res);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

function handleVerification(req: VercelRequest, res: VercelResponse) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const verifyToken = getVerifyToken();

  // Debug: log what we're comparing
  console.log(`Verification attempt: mode=${mode}, token=${token}, expected=${verifyToken}, challenge=${challenge}`);

  if (mode === "subscribe" && token === verifyToken) {
    console.log("Webhook verified successfully");
    return res.status(200).send(challenge);
  }

  console.error(`Webhook verification failed: mode=${mode}, tokenMatch=${token === verifyToken}, hasVerifyToken=${!!verifyToken}`);
  return res.status(403).json({
    error: "Verification failed",
    debug: {
      modeOk: mode === "subscribe",
      tokenConfigured: !!verifyToken,
      tokenLength: verifyToken?.length ?? 0
    }
  });
}

async function handleWebhook(req: VercelRequest, res: VercelResponse) {
  // Respond quickly to avoid timeout
  res.status(200).json({ status: "received" });

  try {
    const payload = req.body as WhatsAppWebhookPayload;

    if (payload.object !== "whatsapp_business_account") {
      return;
    }

    const messages = extractMessages(payload);

    for (const message of messages) {
      // Skip if already processed (deduplication)
      if (processedMessages.has(message.id)) {
        continue;
      }
      processedMessages.add(message.id);

      // Clean up old message IDs (keep last 1000)
      if (processedMessages.size > 1000) {
        const first = processedMessages.values().next().value;
        if (first) processedMessages.delete(first);
      }

      await processMessage(message.from, message.text, message.id);
    }
  } catch (err) {
    console.error("Webhook processing error:", err);
  }
}

async function processMessage(from: string, text: string, messageId: string) {
  console.log(`Processing message from ${from}: ${text}`);

  // Mark as read
  await markMessageAsRead(messageId);

  // Check for help command
  const lowerText = text.toLowerCase().trim();
  if (lowerText === "help" || lowerText === "/help" || lowerText === "hi" || lowerText === "hello") {
    const helpMessage = `👋 *Welcome to Grocery Price Bot!*

I compare grocery prices across:
🟠 Swiggy Instamart
🟡 Blinkit
🟣 Zepto

*How to use:*
Simply send me a list of grocery items, and I'll find the best prices!

*Examples:*
• rice, dal, oil
• milk, bread, eggs, butter
• tomato, onion, potato

*Commands:*
• Send items separated by commas
• Type "help" for this message

📍 Location: ${DEFAULT_LOCATION.city}`;

    await sendWhatsAppMessage(from, helpMessage);
    return;
  }

  // Check if it's a grocery query
  if (!isGroceryQuery(text)) {
    // Try to be helpful
    const items = parseGroceryItems(text);
    if (items.length === 0) {
      await sendWhatsAppMessage(
        from,
        `I'm a grocery price comparison bot! 🛒

Send me items like:
• rice, dal, oil
• milk, bread, eggs

Type "help" for more info.`
      );
      return;
    }
  }

  // Parse items
  const items = parseGroceryItems(text);

  if (items.length === 0) {
    await sendWhatsAppMessage(
      from,
      `I couldn't find any grocery items in your message. Please send items separated by commas.

Example: rice, dal, milk, bread`
    );
    return;
  }

  if (items.length > 10) {
    await sendWhatsAppMessage(
      from,
      `Please send 10 items or fewer at a time for accurate comparison.`
    );
    return;
  }

  // Send "processing" message
  await sendWhatsAppMessage(
    from,
    `🔍 Searching for prices of: ${items.join(", ")}...

Please wait a moment while I check all platforms.`
  );

  try {
    // Compare prices
    const result = await compareGroceryPrices(items, {
      location: DEFAULT_LOCATION,
    });

    // Format response
    const response = formatComparisonResponse(result);

    // Split if too long and send
    const chunks = splitMessage(response);
    for (const chunk of chunks) {
      await sendWhatsAppMessage(from, chunk);
      // Small delay between chunks
      if (chunks.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  } catch (err) {
    console.error("Price comparison error:", err);
    await sendWhatsAppMessage(
      from,
      `❌ Sorry, I encountered an error while fetching prices. Please try again in a few moments.`
    );
  }
}
