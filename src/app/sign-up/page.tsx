"use client";

import { useActionState, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signUp } from "@/app/actions/auth";
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

function SignUpForm() {
  const searchParams = useSearchParams();
  const defaultEmail = searchParams?.get("email") || "";
  const notice = searchParams?.get("notice") || "";

  const [state, formAction, isPending] = useActionState(signUp as any, { error: "" });
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
            Create an account
          </h1>
          <p style={{ textAlign: "center", fontSize: "15px", color: "#64748b", margin: "0 0 28px", lineHeight: 1.6 }}>
            Enter your details to get started with ShortLinks.
          </p>

          {notice && (
            <div style={{ background: "#eff6ff", color: "#1d4ed8", padding: "12px 16px", borderRadius: "12px", fontSize: "14px", textAlign: "center", border: "1px solid #bfdbfe", marginBottom: "16px" }}>
              {notice}
            </div>
          )}

          <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

            {/* Full Name */}
            <div style={{ position: "relative" }}>
              <svg style={iconStyle} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <input id="name" type="text" name="name" required placeholder="Full name" style={inputStyle} />
            </div>

            {/* Email */}
            <div style={{ position: "relative" }}>
              <svg style={iconStyle} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <input id="email" type="email" name="email" defaultValue={defaultEmail} required placeholder="Email address" style={inputStyle} />
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
                placeholder="Create password"
                style={{ ...inputStyle, paddingRight: "48px" }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0, display: "flex" }}>
                {showPassword ? <EyeOff style={{ width: "18px", height: "18px" }} /> : <Eye style={{ width: "18px", height: "18px" }} />}
              </button>
            </div>

            <p style={{ fontSize: "12px", color: "#94a3b8", margin: "0 0 4px 4px" }}>Must be at least 6 characters</p>

            {state?.error && (
              <div style={{ background: "#fef2f2", color: "#dc2626", padding: "12px 16px", borderRadius: "12px", fontSize: "14px", textAlign: "center", border: "1px solid #fee2e2" }}>
                {state.error}
              </div>
            )}

            <button type="submit" disabled={isPending} style={{ ...btnStyle, opacity: isPending ? 0.7 : 1 }}>
              {isPending ? "Creating account..." : "Sign up"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: "24px", fontSize: "15px", color: "#64748b" }}>
            Already have an account?{" "}
            <Link href="/sign-in" style={{ color: "#0f172a", fontWeight: 700, textDecoration: "none" }}>
              Sign in
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div />}>
      <SignUpForm />
    </Suspense>
  );
}
