"use client";

import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";
import Link from "next/link";

export default function SignInPage() {
  const [state, formAction, isPending] = useActionState(signIn as any, { error: "" });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8" style={{ background: 'var(--bg-secondary)' }}>
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-10 text-center">
          <Link href="/" className="text-2xl font-bold" style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'inline-block', marginBottom: '2rem' }}>
            ShortLinks
          </Link>
          <h1 className="text-3xl font-bold mb-3 text-primary">
            Welcome back
          </h1>
          <p className="text-secondary text-lg">Sign in to manage your links</p>
        </div>
        
        <div className="glass-panel p-8 sm:p-10" style={{ backgroundColor: 'var(--bg-primary)', boxShadow: 'var(--shadow-md)' }}>
          <form action={formAction} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-primary">Email Address</label>
              <input type="email" name="email" required className="input-field" placeholder="you@example.com" />
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-primary">Password</label>
              <input type="password" name="password" required className="input-field" placeholder="••••••••" />
            </div>

            {state?.error && (
              <div className="text-error text-sm p-4" style={{ backgroundColor: 'rgba(217,45,32,0.1)', borderRadius: 'var(--radius-sm)', fontWeight: '500' }}>
                {state.error}
              </div>
            )}

            <button type="submit" disabled={isPending} className="btn-primary mt-2" style={{ width: '100%', padding: '1rem' }}>
              {isPending ? "Signing in..." : "Sign In"}
            </button>
          </form>
          
          <div className="mt-8 text-center text-sm text-secondary">
            Don't have an account? <Link href="/sign-up" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Sign Up</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
