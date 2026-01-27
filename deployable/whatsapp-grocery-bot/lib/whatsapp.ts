import type { WhatsAppWebhookPayload, WhatsAppMessage, WhatsAppSendMessagePayload } from "./types.js";

// Read environment variables dynamically to ensure they're available at runtime
export function getVerifyToken(): string {
  return process.env.WHATSAPP_VERIFY_TOKEN ?? process.env.WEBHOOK_VERIFY_TOKEN ?? "";
}

function getWhatsAppToken(): string {
  return process.env.WHATSAPP_TOKEN ?? "";
}

function getPhoneNumberId(): string {
  return process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
}

export function extractMessages(payload: WhatsAppWebhookPayload): WhatsAppMessage[] {
  const messages: WhatsAppMessage[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;

      const value = change.value;
      if (!value.messages) continue;

      const contacts = value.contacts ?? [];

      for (const msg of value.messages) {
        if (msg.type !== "text" || !msg.text?.body) continue;

        const contact = contacts.find((c) => c.wa_id === msg.from);

        messages.push({
          from: msg.from,
          id: msg.id,
          timestamp: msg.timestamp,
          text: msg.text.body,
          name: contact?.profile?.name ?? "Unknown",
        });
      }
    }
  }

  return messages;
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<boolean> {
  const token = getWhatsAppToken();
  const phoneNumberId = getPhoneNumberId();

  if (!token || !phoneNumberId) {
    console.error("WhatsApp credentials not configured");
    return false;
  }

  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  const payload: WhatsAppSendMessagePayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      preview_url: false,
      body: text,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`WhatsApp API error: ${response.status} - ${errorText}`);
      return false;
    }

    console.log(`Message sent to ${to}`);
    return true;
  } catch (err) {
    console.error("Failed to send WhatsApp message:", err);
    return false;
  }
}

export async function markMessageAsRead(messageId: string): Promise<void> {
  const token = getWhatsAppToken();
  const phoneNumberId = getPhoneNumberId();

  if (!token || !phoneNumberId) return;

  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });
  } catch {
    // Ignore errors for read receipts
  }
}

// Split long messages for WhatsApp (max ~4096 chars)
export function splitMessage(text: string, maxLength = 4000): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find a good split point (newline or space)
    let splitIndex = remaining.lastIndexOf("\n", maxLength);
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trim();
  }

  return chunks;
}
