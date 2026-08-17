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

  const handleCopy = (e: React.MouseEvent, text: string, field: string) => {
    e.preventDefault();
    e.stopPropagation();
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
          <h3 className="text-lg font-bold text-primary">{domain.domain}</h3>
          
          {isPending || error ? (
            <span className="badge" style={{ backgroundColor: 'rgba(247,144,9,0.1)', color: 'var(--warning)' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--warning)', marginRight: '6px' }}></div> 
              Invalid Configuration
            </span>
          ) : (
            <span className="badge" style={{ backgroundColor: 'rgba(11,158,105,0.1)', color: 'var(--success)' }}>
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

      {/* Configuration Instructions or Success Messages */}
      {(success || isPending || error) && (
        <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-secondary)' }}>
          {success && (
            <div style={{ marginBottom: isPending || error ? '1rem' : '0', padding: '1rem', backgroundColor: 'rgba(11,158,105,0.1)', border: '1px solid var(--success)', color: 'var(--success)', borderRadius: '6px', fontSize: '0.9rem', lineHeight: '1.5' }}>
              <strong>🎉 Domain Verified & Routing Configured!</strong>
              <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                We've successfully verified your DNS records and are now automatically provisioning a Let's Encrypt SSL certificate for your domain. 
                <strong> This process takes about 30-60 seconds.</strong> If your domain shows a "No available server" or SSL error, please wait a moment and refresh.
              </p>
            </div>
          )}

          {error && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'rgba(217,45,32,0.1)', color: 'var(--error)', borderRadius: '6px', fontSize: '0.875rem', fontWeight: '500' }}>
              <strong>Error:</strong> {error}
            </div>
          )}
          
          {!success && (isPending || error) && (
            <>
              <div className="mb-4">
                <h4 className="font-semibold text-primary mb-1">How to configure your domain</h4>
                <p className="text-secondary text-sm">
                  Log in to your domain registrar (e.g., GoDaddy, Cloudflare, Namecheap) and navigate to the DNS settings. 
                  Add a new <strong>CNAME</strong> record using the exact values below. Once added, click "Verify Status" above.
                </p>
              </div>
              
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-primary)' }}>
                <table className="data-table" style={{ margin: 0, width: '100%', textAlign: 'left' }}>
                  <thead>
                    <tr>
                      <th style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.75rem 1rem' }}>Type</th>
                      <th style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.75rem 1rem' }}>Name / Host</th>
                      <th style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.75rem 1rem' }}>Value / Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td data-label="Type" style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
                        <div className="flex items-center gap-2">
                          <span style={{ fontFamily: 'monospace', fontWeight: '500', color: 'var(--text-primary)' }}>CNAME</span>
                        </div>
                      </td>
                      <td data-label="Name / Host" style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
                        <div className="flex items-center justify-between gap-4">
                          <span style={{ fontFamily: 'monospace', fontWeight: '500', color: 'var(--text-primary)' }}>{cnameName}</span>
                          <button 
                            onClick={(e) => handleCopy(e, cnameName, 'name')}
                            style={{ background: 'rgba(0,130,243,0.1)', color: 'var(--accent-primary)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}
                          >
                            {copied === 'name' ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </td>
                      <td data-label="Value / Target" style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
                        <div className="flex items-center justify-between gap-4">
                          <span style={{ fontFamily: 'monospace', fontWeight: '500', color: 'var(--text-primary)' }}>{CNAME_TARGET}</span>
                          <button 
                            onClick={(e) => handleCopy(e, CNAME_TARGET, 'value')}
                            style={{ background: 'rgba(0,130,243,0.1)', color: 'var(--accent-primary)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}
                          >
                            {copied === 'value' ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
