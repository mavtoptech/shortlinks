"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { useState } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="dashboard-layout">
      {/* Mobile Header */}
      <div className="mobile-header">
        <Link href="/dashboard" className="text-xl font-bold text-gradient">
          ShortLinks
        </Link>
        <button className="hamburger-btn" onClick={() => setIsSidebarOpen(true)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="dashboard-logo" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Link href="/dashboard" className="text-2xl font-bold text-gradient" onClick={() => setIsSidebarOpen(false)}>
            ShortLinks
          </Link>
          <button className="close-sidebar-btn md:hidden" onClick={() => setIsSidebarOpen(false)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <nav className="dashboard-nav">
          <Link 
            href="/dashboard" 
            className={`dashboard-nav-item ${pathname === '/dashboard' ? 'active' : ''}`}
            onClick={() => setIsSidebarOpen(false)}
          >
            Dashboard
          </Link>
          <Link 
            href="/dashboard/domains" 
            className={`dashboard-nav-item ${pathname?.startsWith('/dashboard/domains') ? 'active' : ''}`}
            onClick={() => setIsSidebarOpen(false)}
          >
            Custom Domains
          </Link>
          <Link 
            href="/dashboard/settings" 
            className={`dashboard-nav-item ${pathname?.startsWith('/dashboard/settings') ? 'active' : ''}`}
            onClick={() => setIsSidebarOpen(false)}
          >
            Settings
          </Link>
        </nav>
        <div className="dashboard-profile">
          <div className="flex items-center gap-3">
            <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '0.875rem' }}>
              U
            </div>
            <span className="text-sm font-medium text-primary block">My Account</span>
          </div>
          <button 
            onClick={() => signOut()}
            className="text-xs text-secondary hover:text-error p-2 font-medium"
            style={{ transition: 'color var(--transition-fast)' }}
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
