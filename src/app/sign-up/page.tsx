"use client";

import { useActionState } from "react";
import { signUp } from "@/app/actions/auth";
import Link from "next/link";

export default function SignUpPage() {
  const [state, formAction, isPending] = useActionState(signUp as any, { error: "" });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2" style={{ background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Create an Account
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Get started with Linkr</p>
        </div>
        
        <div className="glass-panel p-6 sm:p-8">
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-secondary">Full Name</label>
              <input type="text" name="name" required className="input-field" placeholder="Jane Doe" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-secondary">Email Address</label>
              <input type="email" name="email" required className="input-field" placeholder="you@example.com" />
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-secondary">Password</label>
              <input type="password" name="password" required minLength={6} className="input-field" placeholder="••••••••" />
            </div>

            {state?.error && (
              <div className="text-error text-sm p-4" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)' }}>
                {state.error}
              </div>
            )}

            <button type="submit" disabled={isPending} className="btn-primary mt-2">
              {isPending ? "Creating account..." : "Sign Up"}
            </button>
          </form>
          
          <div className="mt-6 text-center text-sm text-secondary">
            Already have an account? <Link href="/sign-in" style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
