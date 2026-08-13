import { requireAuth } from "@/lib/auth";
import { getOrCreateWorkspace, getWorkspaceDomains } from "@/app/actions/workspace";
import { AddDomainForm } from "./DomainForms";
import { DomainCard } from "./DomainCard";

export default async function DomainsPage() {
  const userId = await requireAuth();

  // Fetch real data from Supabase
  const workspace = await getOrCreateWorkspace();
  const domains = await getWorkspaceDomains(workspace.id);

  return (
    <div style={{ maxWidth: '64rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="text-3xl font-bold mb-2">Custom Domains</h1>
          <p className="text-secondary">Connect your own domains to brand your short links.</p>
        </div>
        <AddDomainForm />
      </div>

      <div>
        {domains.map((domain) => (
          <DomainCard key={domain.id} domain={domain} />
        ))}
        
        {domains.length === 0 && (
          <div className="glass-panel p-12 text-center text-secondary">
            No custom domains connected yet. Add one above!
          </div>
        )}
      </div>
    </div>
  );
}
