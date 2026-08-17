"use client";

import { useActionState } from "react";
import { verifyOtpAction, resendOtpAction } from "@/app/actions/auth";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

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

interface ResendState {
  error?: string;
  success?: boolean;
  message?: string;
}

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [state, formAction, isPending] = useActionState(verifyOtpAction as any, { error: "" });
  const [resendState, resendAction, isResendPending] = useActionState<ResendState | null, FormData>(
    resendOtpAction as any,
    null
  );

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
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(24px)",
          borderRadius: "40px",
          padding: "40px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
          border: "1px solid rgba(255,255,255,0.5)",
        }}>

          {/* Site Name */}
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <Link href="/" style={{ textDecoration: "none" }}>
              <span style={{ fontSize: "32px", fontWeight: 800, color: "#0f172a", letterSpacing: "-1px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
                ShortLinks
              </span>
            </Link>
          </div>

          <h1 style={{ textAlign: "center", fontSize: "26px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px", letterSpacing: "-0.5px" }}>
            Check your email
          </h1>
          <p style={{ textAlign: "center", fontSize: "15px", color: "#64748b", margin: "0 0 32px", lineHeight: 1.6 }}>
            We sent a 6-digit code to <strong style={{ color: "#0f172a" }}>{email}</strong>
          </p>

          <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input type="hidden" name="email" value={email} />

            <input
              id="code"
              type="text"
              name="code"
              required
              maxLength={6}
              placeholder="1 2 3 4 5 6"
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
              }}
            />

            {state?.error && (
              <div style={{ background: "#fef2f2", color: "#dc2626", padding: "12px 16px", borderRadius: "12px", fontSize: "14px", textAlign: "center", border: "1px solid #fee2e2" }}>
                {state.error}
              </div>
            )}

            {resendState?.error && (
              <div style={{ background: "#fef2f2", color: "#dc2626", padding: "12px 16px", borderRadius: "12px", fontSize: "14px", textAlign: "center", border: "1px solid #fee2e2" }}>
                {resendState.error}
              </div>
            )}

            {resendState?.success && (
              <div style={{ background: "#f0fdf4", color: "#16a34a", padding: "12px 16px", borderRadius: "12px", fontSize: "14px", textAlign: "center", border: "1px solid #bbf7d0" }}>
                {resendState.message}
              </div>
            )}

            <button type="submit" disabled={isPending} style={{ ...btnStyle, opacity: isPending ? 0.7 : 1 }}>
              {isPending ? "Verifying..." : "Verify Email"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: "24px" }}>
            <form action={resendAction}>
              <input type="hidden" name="email" value={email} />
              <button
                type="submit"
                disabled={isResendPending}
                style={{
                  background: "none",
                  border: "none",
                  color: "#2563eb",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                {isResendPending ? "Resending..." : "Resend 6-digit Code"}
              </button>
            </form>
          </div>

          <p style={{ textAlign: "center", marginTop: "20px", fontSize: "14px", color: "#64748b" }}>
            Need to change email?{" "}
            <Link href="/sign-up" style={{ color: "#0f172a", fontWeight: 700, textDecoration: "none" }}>
              Sign up again
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        Loading...
      </div>
    }>
      <VerifyEmailForm />
    </Suspense>
  );
}
