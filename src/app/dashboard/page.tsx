import { requireAuth } from "@/lib/auth";
import { getOrCreateWorkspace, getWorkspaceDomains, getWorkspaceLinks } from "@/app/actions/workspace";
import { createShortLink } from "@/app/actions/link";
import { APP_DOMAIN } from "@/lib/constants";

export default async function DashboardPage() {
  const userId = await requireAuth();

  // Fetch real data from Supabase
  const workspace = await getOrCreateWorkspace();
  const domains = await getWorkspaceDomains(workspace.id);
  const links = await getWorkspaceLinks(workspace.id);

  return (
    <div style={{ maxWidth: '64rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 className="text-3xl font-bold mb-2">Welcome to Linkr</h1>
        <p className="text-secondary">Manage your short links and track their performance.</p>
      </div>

      {/* Create Link Section */}
      <div className="glass-panel p-6">
        <h2 className="text-xl font-semibold mb-4">Create New Link</h2>
        <form action={createShortLink} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <input 
            type="url" 
            name="originalUrl"
            placeholder="Paste your long URL here... (e.g., https://example.com/very/long/path)" 
            className="input-field flex-1"
            required
            style={{ minWidth: '250px' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select name="domainId" className="input-field" style={{ width: '200px', cursor: 'pointer' }}>
              <option value="default">{APP_DOMAIN} (Default)</option>
              {domains.filter(d => d.status === 'active').map(d => (
                <option key={d.id} value={d.id}>{d.domain}</option>
              ))}
            </select>
            <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
              Shorten URL
            </button>
          </div>
        </form>
      </div>

      {/* Links Table Section */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="text-xl font-semibold">Your Links</h2>
          <div className="text-sm text-secondary">Total Clicks: {links.reduce((acc, curr) => acc + curr.clicksCount, 0)}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Original URL</th>
                <th>Short Link</th>
                <th>Clicks</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => {
                const domainName = link.domain ? link.domain.domain : APP_DOMAIN;
                const fullShortUrl = `${domainName}/${link.shortCode}`;
                
                return (
                  <tr key={link.id}>
                    <td style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={link.originalUrl}>{link.originalUrl}</td>
                    <td>
                      <a href={`https://${fullShortUrl}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
                        {fullShortUrl}
                      </a>
                    </td>
                    <td>
                      <span className="badge badge-neutral">{link.clicksCount}</span>
                    </td>
                    <td className="text-right">
                      <button style={{ color: 'var(--text-secondary)', marginRight: '1rem' }}>Copy</button>
                      <button className="text-error">Delete</button>
                    </td>
                  </tr>
                );
              })}
              {links.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-secondary">
                    No links created yet. Create your first link above!
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
