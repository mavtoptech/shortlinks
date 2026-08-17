import nodemailer from "nodemailer";
import fs from "fs/promises";
import path from "path";

// Configuration for ZeptoMail by Zoho (or standard SMTP fallback)
const SMTP_HOST = process.env.ZEPTOMAIL_SMTP_HOST || process.env.SMTP_HOST || "smtp.zeptomail.in";
const SMTP_PORT = parseInt(process.env.ZEPTOMAIL_SMTP_PORT || process.env.SMTP_PORT || "465", 10);
const SMTP_USER = process.env.ZEPTOMAIL_SMTP_USER || process.env.SMTP_USER || "emailkey";
const SMTP_PASS = process.env.ZEPTOMAIL_SMTP_PASS || process.env.ZEPTOMAIL_SMTP_PASSWORD || process.env.SMTP_PASS || "";
const FROM_EMAIL = process.env.ZEPTOMAIL_FROM_ADDRESS || process.env.ZEPTOMAIL_FROM_EMAIL || process.env.SMTP_FROM || "noreply@shortlinks.fun";
const FROM_NAME = process.env.ZEPTOMAIL_FROM_NAME || "ShortLinks";


// Create reusable Nodemailer transporter instance
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true for 465, false for 587
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  // Security settings
  tls: {
    rejectUnauthorized: true, // Enforce strict TLS certificate check
  },
});

interface SendOtpEmailParams {
  to: string;
  otp: string;
  subject?: string;
  type?: "signup" | "recovery";
}

/**
 * Sends an OTP email using ZeptoMail by Zoho / Nodemailer.
 * Reads the HTML template from public/email/confirmation.html and injects the OTP token safely.
 */
export async function sendOtpEmail({
  to,
  otp,
  subject,
  type = "signup",
}: SendOtpEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    // Sanitize OTP input (must be digits only)
    const sanitizedOtp = otp.replace(/[^0-9]/g, "");
    if (!sanitizedOtp || sanitizedOtp.length !== 6) {
      throw new Error("Invalid OTP code generated");
    }

    // Default subject based on type
    const mailSubject =
      subject ||
      (type === "recovery"
        ? "Reset Your Password - ShortLinks"
        : "Confirm Your Email - ShortLinks");

    // Load template file
    let htmlContent = "";
    try {
      const templatePath = path.join(process.cwd(), "public", "email", "confirmation.html");
      htmlContent = await fs.readFile(templatePath, "utf-8");
    } catch (err) {
      console.warn("[Email] confirmation.html template not found on disk, using fallback HTML layout.");
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"/></head>
        <body style="font-family: sans-serif; padding: 20px; background: #f8fafc;">
          <div style="max-width: 500px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 12px;">
            <h2 style="color: #0f172a; text-align: center;">ShortLinks Verification</h2>
            <p style="text-align: center; color: #475569;">Your 6-digit confirmation code is:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; text-align: center; margin: 24px 0; color: #1e293b;">
              {{ .Token }}
            </div>
            <p style="font-size: 13px; color: #94a3b8; text-align: center;">If you did not request this, please ignore this email.</p>
          </div>
        </body>
        </html>
      `;
    }

    // Replace template tokens securely
    let compiledHtml = htmlContent
      .replace(/\{\{\s*\.Token\s*\}\}/g, sanitizedOtp)
      .replace(/\{\{\s*OTP_CODE\s*\}\}/g, sanitizedOtp);

    if (type === "recovery") {
      compiledHtml = compiledHtml
        .replace("Confirm your email address", "Reset your password")
        .replace(
          "Thank you for signing up! Please use the following 6-digit code to verify your email address and complete your registration.",
          "We received a request to reset your password. Please use the following 6-digit code to verify your request and update your password."
        );
    }

    // Send mail via ZeptoMail SMTP
    const info = await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject: mailSubject,
      html: compiledHtml,
      text: `Your ShortLinks verification code is: ${sanitizedOtp}. This code will expire shortly.`,
    });

    console.log(`[Email] OTP email sent successfully to ${to}. MessageId: ${info.messageId}`);
    return { success: true };
  } catch (err: any) {
    console.error("[Email] Failed to send OTP email via ZeptoMail:", err);
    return {
      success: false,
      error: "Failed to send verification email. Please check server email configurations.",
    };
  }
}
