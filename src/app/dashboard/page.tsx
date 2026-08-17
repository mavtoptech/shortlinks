import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { LinkActions } from "./LinkActions";
import { getOrCreateWorkspace, getWorkspaceDomains, getWorkspaceLinks } from "../actions/workspace";
import { createShortLink } from "../actions/link";
import { APP_DOMAIN } from "@/lib/constants";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const workspace = await getOrCreateWorkspace();
  const domains = await getWorkspaceDomains(workspace.id);
  const links = await getWorkspaceLinks(workspace.id);

  const totalClicks = links.reduce((sum, link) => sum + link.clicks_count, 0);

  return (
    <div style={{ maxWidth: '64rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '3rem' }}>
      
      {/* Bitly-Style Hero Quick Shortener */}
      <div className="glass-panel" style={{ padding: '2rem 1.5rem', textAlign: 'center', backgroundColor: '#ffffff' }}>
        <h1 className="text-3xl font-bold mb-3">Shorten a long link</h1>
        <p className="text-secondary text-base mb-6 max-w-xl mx-auto">
          No credit card required. Instantly create short links, custom domains, and track their performance.
        </p>
        <form action={createShortLink} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '48rem', margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', width: '100%' }}>
            <input 
              type="url" 
              name="originalUrl"
              placeholder="Paste your long URL here (https://...)" 
              className="input-field flex-1"
              required
              style={{ fontSize: '1.125rem', padding: '1rem 1.5rem' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '300px' }}>
              <span className="text-sm font-semibold text-secondary whitespace-nowrap">Domain:</span>
              <select name="domainId" className="input-field" style={{ cursor: 'pointer', padding: '0.75rem 1rem' }}>
                <option value="default">{APP_DOMAIN} (Default)</option>
                {domains.filter(d => d.status === 'active').map(d => (
                  <option key={d.id} value={d.id}>{d.domain}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-accent" style={{ padding: '0.85rem 2rem', fontSize: '1.125rem', minWidth: '200px' }}>
              Shorten URL
            </button>
          </div>
        </form>
      </div>

      {/* Links Table Section */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="text-xl font-bold">Your Links</h2>
          <div className="badge" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            Total Clicks: {totalClicks}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Original URL</th>
                <th>Short Link</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Clicks</th>
                <th className="text-right" style={{ width: '150px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => {
                const domainName = link.domain ? link.domain.domain : APP_DOMAIN;
                const fullShortUrl = `https://${domainName}/${link.short_code}`;
                
                return (
                  <tr key={link.id}>
                    <td data-label="Original URL" style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={link.original_url}>
                      {link.original_url}
                    </td>
                    <td data-label="Short Link">
                      <a href={fullShortUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', fontWeight: '500', textDecoration: 'none' }}>
                        {domainName}/{link.short_code}
                      </a>
                    </td>
                    <td data-label="Clicks" style={{ textAlign: 'center' }}>
                      <span className="badge" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                        {link.clicks_count}
                      </span>
                    </td>
                    <td data-label="Actions" className="text-right">
                      <LinkActions linkId={link.id} fullShortUrl={fullShortUrl} />
                    </td>
                  </tr>
                );
              })}
              {links.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-secondary" style={{ padding: '4rem 2rem' }}>
                    <div style={{ fontSize: '1.125rem', marginBottom: '0.5rem', color: 'var(--text-primary)', fontWeight: '600' }}>No links created yet</div>
                    Create your first short link using the field above!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
