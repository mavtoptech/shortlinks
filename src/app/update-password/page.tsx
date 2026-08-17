"use client";

import { useActionState, useState } from "react";
import { updatePasswordAction } from "@/app/actions/auth";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

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

export default function UpdatePasswordPage() {
  const [state, formAction, isPending] = useActionState(updatePasswordAction as any, { error: "" });
  const [showPassword, setShowPassword] = useState(false);

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
            Set New Password
          </h1>
          <p style={{ textAlign: "center", fontSize: "15px", color: "#64748b", margin: "0 0 32px", lineHeight: 1.6 }}>
            Please enter your new password below to update your credentials.
          </p>

          <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

            <div style={{ position: "relative" }}>
              <svg style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", width: "18px", height: "18px", color: "#94a3b8", pointerEvents: "none" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                required
                placeholder="New password"
                style={{
                  width: "100%", height: "56px", borderRadius: "16px", background: "#f1f5f9",
                  border: "none", paddingLeft: "48px", paddingRight: "48px", fontSize: "15px",
                  color: "#0f172a", outline: "none", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.06)",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0, display: "flex" }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff style={{ width: "18px", height: "18px" }} /> : <Eye style={{ width: "18px", height: "18px" }} />}
              </button>
            </div>

            <p style={{ fontSize: "12px", color: "#94a3b8", margin: "2px 0 8px 4px" }}>Must be at least 8 characters</p>

            {state?.error && (
              <div style={{ background: "#fef2f2", color: "#dc2626", padding: "12px 16px", borderRadius: "12px", fontSize: "14px", textAlign: "center", border: "1px solid #fee2e2" }}>
                {state.error}
              </div>
            )}

            <button type="submit" disabled={isPending} style={{ ...btnStyle, opacity: isPending ? 0.7 : 1 }}>
              {isPending ? "Updating..." : "Update Password"}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
