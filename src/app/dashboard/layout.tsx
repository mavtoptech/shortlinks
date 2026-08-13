"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <Link href="/dashboard" className="text-2xl font-bold text-gradient">
            Linkr
          </Link>
        </div>
        <nav style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Link 
            href="/dashboard" 
            className={`dashboard-nav-item ${pathname === '/dashboard' ? 'active' : ''}`}
          >
            Dashboard
          </Link>
          <Link 
            href="/dashboard/domains" 
            className={`dashboard-nav-item ${pathname?.startsWith('/dashboard/domains') ? 'active' : ''}`}
          >
            Custom Domains
          </Link>
          <Link 
            href="/dashboard/settings" 
            className={`dashboard-nav-item ${pathname?.startsWith('/dashboard/settings') ? 'active' : ''}`}
          >
            Settings
          </Link>
        </nav>
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
              U
            </div>
            <span className="text-sm text-secondary hidden sm:block">My Account</span>
          </div>
          <button 
            onClick={() => signOut()}
            className="text-xs text-error hover:text-red-400 p-2"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main animate-fade-in">
        {children}
      </main>
    </div>
  );
}
