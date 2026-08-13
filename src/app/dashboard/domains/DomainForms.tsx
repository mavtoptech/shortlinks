'use client';

import { useState } from 'react';
import { addWorkspaceDomain, deleteWorkspaceDomain } from '@/app/actions/workspace';

export function AddDomainForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAdd(formData: FormData) {
    setLoading(true);
    setError('');
    try {
      await addWorkspaceDomain(formData);
      // Reset form on success is handled if we use uncontrolled, but let's just reload or let Server Action revalidate
    } catch (err: any) {
      setError(err.message || 'Failed to add domain');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleAdd} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <input 
          type="text" 
          name="domain" 
          placeholder="e.g. link.mybrand.com" 
          className="input-field" 
          required 
          disabled={loading}
          style={{ minWidth: '250px' }}
        />
        {error && <span className="text-error text-sm mt-1">{error}</span>}
      </div>
      <button type="submit" className="btn-primary" disabled={loading} style={{ alignSelf: 'flex-start' }}>
        {loading ? 'Adding...' : 'Add Domain'}
      </button>
    </form>
  );
}

export function DeleteDomainForm({ domainId }: { domainId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDelete(formData: FormData) {
    if (!confirm('Are you sure you want to remove this domain?')) return;
    setLoading(true);
    try {
      await deleteWorkspaceDomain(formData);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  return (
    <form action={handleDelete}>
      <input type="hidden" name="domainId" value={domainId} />
      <button type="submit" className="text-error" disabled={loading} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        {loading ? 'Removing...' : 'Remove'}
      </button>
    </form>
  );
}
