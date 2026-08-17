"use client";

import { useActionState } from "react";
import { sendPasswordReset, verifyResetCodeAction } from "@/app/actions/auth";
import Link from "next/link";

const btnStyle: React.CSSProperties = {
  width: "100%",
  height: "56px",
  borderRadius: "16px",
  border: "none",
  background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
  color: "#fff",
  fontSize: "16px",
  fontWeight: 600,
  cursor: "pointer",
  marginTop: "8px",
  boxShadow: "0 4px 14px rgba(15,23,42,0.25)",
};

function StepVerifyCode({ email }: { email: string }) {
  const [verifyState, verifyFormAction, isVerifyPending] = useActionState(verifyResetCodeAction as any, { error: "" });

  return (
    <form action={verifyFormAction} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <input type="hidden" name="email" value={email} />

      <div style={{ background: "#f0fdf4", color: "#16a34a", padding: "16px 20px", borderRadius: "16px", textAlign: "center", border: "1px solid #bbf7d0", marginBottom: "8px" }}>
        <p style={{ fontSize: "14px", margin: 0, lineHeight: 1.5, color: "#15803d" }}>
          If an account with this email exists, a 6-digit confirmation code has been sent to your inbox.
        </p>
      </div>

      <div style={{ position: "relative" }}>
        <input
          id="code"
          type="text"
          name="code"
          required
          maxLength={6}
          placeholder="123 456"
          style={{
            width: "100%",
            height: "64px",
            borderRadius: "16px",
            background: "#f1f5f9",
            border: "none",
            paddingLeft: "16px",
            paddingRight: "16px",
            fontSize: "24px",
            fontWeight: 600,
            letterSpacing: "0.4em",
            color: "#0f172a",
            outline: "none",
            textAlign: "center",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.06)",
            boxSizing: "border-box",
          }}
        />
      </div>

      {verifyState?.error && (
        <div style={{ background: "#fef2f2", color: "#dc2626", padding: "12px 16px", borderRadius: "12px", fontSize: "14px", textAlign: "center", border: "1px solid #fee2e2" }}>
          {verifyState.error}
        </div>
      )}

      <button type="submit" disabled={isVerifyPending} style={{ ...btnStyle, opacity: isVerifyPending ? 0.7 : 1 }}>
        {isVerifyPending ? "Verifying..." : "Verify Code"}
      </button>
    </form>
  );
}

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(sendPasswordReset as any, { error: "", success: false, email: "" });

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      background: "linear-gradient(135deg, #dbeafe 0%, #e0f2fe 40%, #e0e7ff 100%)",
    }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>
        <div style={{
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(24px)",
          borderRadius: "40px",
          padding: "40px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
          border: "1px solid rgba(255,255,255,0.6)",
        }}>

          {/* Site Name */}
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <Link href="/" style={{ textDecoration: "none" }}>
              <span style={{ fontSize: "32px", fontWeight: 800, color: "#0f172a", letterSpacing: "-1px" }}>
                ShortLinks
              </span>
            </Link>
          </div>

          <h1 style={{ textAlign: "center", fontSize: "24px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px", letterSpacing: "-0.5px" }}>
            Reset Password
          </h1>
          <p style={{ textAlign: "center", fontSize: "15px", color: "#64748b", margin: "0 0 28px", lineHeight: 1.6 }}>
            {state?.success ? "Enter the 6-digit code sent to your email." : "Enter your email to receive a 6-digit confirmation code."}
          </p>

          {state?.success ? (
            <StepVerifyCode email={state.email} />
          ) : (
            <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ position: "relative" }}>
                <svg style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", width: "18px", height: "18px", color: "#94a3b8", pointerEvents: "none" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <input
                  id="email"
                  type="email"
                  name="email"
                  required
                  placeholder="Email address"
                  style={{
                    width: "100%", height: "56px", borderRadius: "16px", background: "#f1f5f9",
                    border: "none", paddingLeft: "48px", paddingRight: "16px", fontSize: "15px",
                    color: "#0f172a", outline: "none", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.06)",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {state?.error && (
                <div style={{ background: "#fef2f2", color: "#dc2626", padding: "12px 16px", borderRadius: "12px", fontSize: "14px", textAlign: "center", border: "1px solid #fee2e2" }}>
                  {state.error}
                </div>
              )}

              <button type="submit" disabled={isPending} style={{ ...btnStyle, opacity: isPending ? 0.7 : 1 }}>
                {isPending ? "Sending..." : "Send Reset Code"}
              </button>
            </form>
          )}

          <p style={{ textAlign: "center", marginTop: "24px", fontSize: "15px", color: "#64748b" }}>
            Remember your password?{" "}
            <Link href="/sign-in" style={{ color: "#0f172a", fontWeight: 700, textDecoration: "none" }}>
              Sign in
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}
