import { NextResponse } from "next/server";

/**
 * ZeptoMail Webhook Handler Route
 * Endpoint: POST /api/webhooks/zeptomail
 *
 * Handles real-time email delivery events from ZeptoMail by Zoho:
 * - delivered
 * - softbounce
 * - hardbounce
 * - feedback_loop
 *
 * Must ALWAYS return HTTP 200 status as required by ZeptoMail.
 */
export async function POST(request: Request) {
  try {
    // Optional Authorization header check
    const authHeader = request.headers.get("authorization");
    const webhookSecret = process.env.ZEPTOMAIL_WEBHOOK_SECRET;

    if (webhookSecret && authHeader && authHeader !== webhookSecret) {
      console.warn("[ZeptoMail Webhook] Unauthorized webhook attempt.");
      // Note: ZeptoMail requires HTTP 200, so we return 200 with an error status in payload if secret fails
      return NextResponse.json(
        { status: "error", message: "Unauthorized token" },
        { status: 200 }
      );
    }

    const payload = await request.json();

    // ZeptoMail webhook structure extract
    const eventNameArray = payload?.event_name || [];
    const eventName = Array.isArray(eventNameArray) ? eventNameArray[0] : eventNameArray;
    const eventMessages = payload?.event_message || [];

    console.log(`[ZeptoMail Webhook] Received Event: "${eventName}"`);

    if (Array.isArray(eventMessages)) {
      for (const msg of eventMessages) {
        const emailInfo = msg?.email_info || {};
        const recipient = emailInfo?.to?.[0]?.email_address?.address || emailInfo?.to?.[0]?.address || "unknown";
        const subject = msg?.subject || emailInfo?.subject || "N/A";

        switch (eventName) {
          case "delivered":
            console.log(`[ZeptoMail Webhook] ✅ Email DELIVERED to ${recipient} (Subject: "${subject}")`);
            break;
          case "hardbounce":
            console.error(`[ZeptoMail Webhook] ❌ HARD BOUNCE for ${recipient} (Subject: "${subject}"). Reason:`, msg?.bounce_reason || "Unknown");
            break;
          case "softbounce":
            console.warn(`[ZeptoMail Webhook] ⚠️ SOFT BOUNCE for ${recipient} (Subject: "${subject}"). Reason:`, msg?.bounce_reason || "Unknown");
            break;
          case "feedback_loop":
            console.warn(`[ZeptoMail Webhook] 🛑 COMPLAINT / FEEDBACK LOOP for ${recipient}`);
            break;
          default:
            console.log(`[ZeptoMail Webhook] Event "${eventName}" for recipient ${recipient}`);
            break;
        }
      }
    }

    return NextResponse.json({ status: "success", received: true }, { status: 200 });
  } catch (err: any) {
    console.error("[ZeptoMail Webhook] Error processing payload:", err?.message || err);
    // Always return HTTP 200 as required by ZeptoMail
    return NextResponse.json({ status: "error", message: "Processed with error" }, { status: 200 });
  }
}

// Allow OPTIONS preflight for webhook verification
export async function OPTIONS() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
