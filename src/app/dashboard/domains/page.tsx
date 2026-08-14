import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getWorkspaceDomains } from "../../actions/workspace";
import { DomainCard } from "./DomainCard";
import { AddDomainForm } from "./DomainForms";

export default async function DomainsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Get user's workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_id', user.id)
    .single();

  if (!workspace) {
    return <div>No workspace found. Create one first.</div>;
  }

  const domains = await getWorkspaceDomains(workspace.id);

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Custom Domains</h1>
          <p className="text-secondary">Connect your own domains to use for short links.</p>
        </div>
      </div>

      <div className="glass-panel p-6 sm:p-8">
        <h2 className="text-xl font-bold mb-4 text-gray-200">Add a Domain</h2>
        <p className="text-sm text-secondary mb-6">
          Enter the domain you want to connect. For subdomains (like link.yourdomain.com), you'll need to configure a CNAME record. For root domains (like yourdomain.com), you'll need an A record.
        </p>
        
        <AddDomainForm />
      </div>

      <div className="glass-panel p-6 sm:p-8 mt-4">
        <h2 className="text-xl font-bold mb-6 text-gray-200">Your Domains</h2>
        
        {domains.length === 0 ? (
          <div className="text-center py-10 bg-white/5 rounded-lg border border-white/10">
            <p className="text-secondary mb-2">You haven't added any custom domains yet.</p>
            <p className="text-sm text-gray-500">Add one above to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {domains.map((domain) => (
              <DomainCard key={domain.id} domain={domain} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
