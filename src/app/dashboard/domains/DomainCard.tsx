'use client';

import { useState } from 'react';
import { verifyWorkspaceDomain } from '@/app/actions/workspace';
import { DeleteDomainForm } from './DomainForms';
import { CNAME_TARGET } from '@/lib/constants';

type Domain = {
  id: string;
  domain: string;
  status: string;
};

export function DomainCard({ domain }: { domain: Domain }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function handleVerify() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const res = await verifyWorkspaceDomain(domain.id);
      if (res.success) {
        setSuccess(res.message || "Valid Configuration");
      } else {
        setError(res.error || "Invalid Configuration");
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const isPending = domain.status === 'pending';
  // We only show CNAME instructions as per user request
  const cnameName = domain.domain.split('.').length === 2 ? 'www' : domain.domain.split('.')[0];

  return (
    <div className="glass-panel" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
      {/* Header section */}
      <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h3 className="text-lg font-bold">{domain.domain}</h3>
          
          {isPending || error ? (
            <span className="badge" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--warning)', marginRight: '6px' }}></div> 
              Invalid Configuration
            </span>
          ) : (
            <span className="badge" style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--success)', marginRight: '6px' }}></div> 
              Valid Configuration
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            onClick={handleVerify} 
            disabled={loading}
            className="btn-secondary" 
            style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
          >
            {loading ? 'Verifying...' : 'Verify Status'}
          </button>
          <DeleteDomainForm domainId={domain.id} />
        </div>
      </div>

      {/* Configuration Instructions */}
      {(isPending || error) && (
        <div style={{ padding: '1.5rem', backgroundColor: 'rgba(0,0,0,0.2)' }}>
          {error && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--error)', borderRadius: '6px', fontSize: '0.875rem' }}>
              <strong>Error:</strong> {error}
            </div>
          )}
          
          <div className="mb-4">
            <h4 className="font-semibold text-gray-200 mb-1">How to configure your domain</h4>
            <p className="text-secondary text-sm">
              Log in to your domain registrar (e.g., GoDaddy, Cloudflare, Namecheap) and navigate to the DNS settings. 
              Add a new <strong>CNAME</strong> record using the exact values below. Once added, click "Verify Status" above.
            </p>
          </div>
          
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <table className="data-table" style={{ margin: 0, width: '100%', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem' }}>Type</th>
                  <th style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem' }}>Name / Host</th>
                  <th style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem' }}>Value / Target</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
                    <div className="flex items-center gap-2">
                      <span style={{ fontFamily: 'monospace' }}>CNAME</span>
                    </div>
                  </td>
                  <td style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
                    <div className="flex items-center justify-between gap-4">
                      <span style={{ fontFamily: 'monospace' }}>{cnameName}</span>
                      <button 
                        onClick={() => handleCopy(cnameName, 'name')}
                        style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-primary)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}
                      >
                        {copied === 'name' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
                    <div className="flex items-center justify-between gap-4">
                      <span style={{ fontFamily: 'monospace' }}>{CNAME_TARGET}</span>
                      <button 
                        onClick={() => handleCopy(CNAME_TARGET, 'value')}
                        style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-primary)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}
                      >
                        {copied === 'value' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
