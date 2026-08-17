"use client";

import { useActionState, useState } from "react";
import { signIn } from "@/app/actions/auth";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: "56px",
  borderRadius: "16px",
  background: "#f1f5f9",
  border: "none",
  paddingLeft: "48px",
  paddingRight: "16px",
  fontSize: "15px",
  color: "#0f172a",
  outline: "none",
  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.06)",
  boxSizing: "border-box",
};

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

const iconStyle: React.CSSProperties = {
  position: "absolute",
  left: "16px",
  top: "50%",
  transform: "translateY(-50%)",
  width: "18px",
  height: "18px",
  color: "#94a3b8",
  pointerEvents: "none",
};

export default function SignInPage() {
  const [state, formAction, isPending] = useActionState(signIn as any, { error: "" });
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
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(24px)",
          borderRadius: "40px",
          padding: "40px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
          border: "1px solid rgba(255,255,255,0.6)",
        }}>

          {/* Site Branding */}
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <Link href="/" style={{ textDecoration: "none" }}>
              <span style={{ fontSize: "32px", fontWeight: 800, color: "#0f172a", letterSpacing: "-1px" }}>
                ShortLinks
              </span>
            </Link>
          </div>

          <h1 style={{ textAlign: "center", fontSize: "24px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px", letterSpacing: "-0.5px" }}>
            Sign in with email
          </h1>
          <p style={{ textAlign: "center", fontSize: "15px", color: "#64748b", margin: "0 0 28px", lineHeight: 1.6 }}>
            Sign in to your account to securely manage your links.
          </p>

          <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

            {/* Email */}
            <div style={{ position: "relative" }}>
              <svg style={iconStyle} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <input id="email" type="email" name="email" required placeholder="Email" style={inputStyle} />
            </div>

            {/* Password */}
            <div style={{ position: "relative" }}>
              <svg style={iconStyle} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                required
                placeholder="Password"
                style={{ ...inputStyle, paddingRight: "48px" }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0, display: "flex" }}>
                {showPassword ? <EyeOff style={{ width: "18px", height: "18px" }} /> : <Eye style={{ width: "18px", height: "18px" }} />}
              </button>
            </div>

            <div style={{ textAlign: "right" }}>
              <Link href="/forgot-password" style={{ fontSize: "14px", fontWeight: 500, color: "#475569", textDecoration: "none" }}>
                Forgot password?
              </Link>
            </div>

            {state?.error && (
              <div style={{ background: "#fef2f2", color: "#dc2626", padding: "12px 16px", borderRadius: "12px", fontSize: "14px", textAlign: "center", border: "1px solid #fee2e2" }}>
                {state.error}
              </div>
            )}

            <button type="submit" disabled={isPending} style={{ ...btnStyle, opacity: isPending ? 0.7 : 1 }}>
              {isPending ? "Signing in..." : "Get Started"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: "24px", fontSize: "15px", color: "#64748b" }}>
            Don&apos;t have an account?{" "}
            <Link href="/sign-up" style={{ color: "#0f172a", fontWeight: 700, textDecoration: "none" }}>
              Sign up
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}
