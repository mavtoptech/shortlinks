import { NextResponse } from "next/server";

/**
 * ZeptoMail Webhook Handler Route
 * Endpoint: POST /api/webhooks/zeptomail
 *
 * Handles real-time email delivery & bounce events from ZeptoMail by Zoho:
 * - delivered
 * - softbounce
 * - hardbounce
 * - feedback_loop
 *
 * Requirements: Must ALWAYS return HTTP 200 status as required by ZeptoMail.
 */
export async function POST(request: Request) {
  try {
    // Optional Authorization header verification
    const authHeader =
      request.headers.get("authorization") ||
      request.headers.get("x-zeptomail-token") ||
      request.headers.get("x-authorization");

    const webhookSecret = process.env.ZEPTOMAIL_WEBHOOK_SECRET;

    if (webhookSecret && authHeader && authHeader !== webhookSecret) {
      console.warn("[ZeptoMail Webhook] Unauthorized webhook signature attempt.");
      // ZeptoMail requires HTTP 200 response
      return NextResponse.json(
        { status: "error", message: "Unauthorized token" },
        { status: 200 }
      );
    }

    const payload = await request.json();

    // ZeptoMail payload structure extraction
    const eventNameArray = payload?.event_name || [];
    const eventName = Array.isArray(eventNameArray) ? eventNameArray[0] : eventNameArray;
    const eventMessages = payload?.event_message || [];

    console.log(`[ZeptoMail Webhook] Event Received: "${eventName}"`);

    if (Array.isArray(eventMessages)) {
      for (const msg of eventMessages) {
        const emailInfo = msg?.email_info || {};
        const subject = emailInfo?.subject || msg?.subject || "N/A";
        
        // Extract recipients
        const toRecipients = (emailInfo?.to || [])
          .map((item: any) => item?.email_address?.address || item?.address)
          .filter(Boolean);
        const recipientList = toRecipients.length > 0 ? toRecipients.join(", ") : "Unknown recipient";

        // Extract bounce details if present
        const eventDataList = msg?.event_data || [];
        const firstDetail = eventDataList?.[0]?.details?.[0] || {};
        const bouncedRecipient = firstDetail?.bounced_recipient || recipientList;
        const reason = firstDetail?.reason || "N/A";
        const diagnosticMessage = firstDetail?.diagnostic_message || "N/A";

        switch (eventName) {
          case "delivered":
            console.log(`[ZeptoMail Webhook] ✅ DELIVERED to ${recipientList} (Subject: "${subject}")`);
            break;
          case "hardbounce":
            console.error(
              `[ZeptoMail Webhook] ❌ HARD BOUNCE for ${bouncedRecipient} (Reason: ${reason}, Diagnostic: ${diagnosticMessage})`
            );
            break;
          case "softbounce":
            console.warn(
              `[ZeptoMail Webhook] ⚠️ SOFT BOUNCE for ${bouncedRecipient} (Reason: ${reason}, Diagnostic: ${diagnosticMessage})`
            );
            break;
          case "feedback_loop":
            console.warn(`[ZeptoMail Webhook] 🛑 FEEDBACK LOOP / COMPLAINT for ${bouncedRecipient}`);
            break;
          default:
            console.log(`[ZeptoMail Webhook] Event "${eventName}" logged for ${recipientList}`);
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

// Support OPTIONS preflight request for ZeptoMail validation
export async function OPTIONS() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
