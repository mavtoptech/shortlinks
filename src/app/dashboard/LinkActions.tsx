'use client';

import { useState } from 'react';
import { deleteShortLink } from '@/app/actions/link';

interface LinkActionsProps {
  linkId: string;
  fullShortUrl: string;
}

export function LinkActions({ linkId, fullShortUrl }: LinkActionsProps) {
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullShortUrl);
      } else {
        // Fallback for non-HTTPS or legacy browser context
        const textArea = document.createElement('textarea');
        textArea.value = fullShortUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this short link?')) return;
    setDeleting(true);
    try {
      await deleteShortLink(linkId);
    } catch (err: any) {
      alert(err.message || 'Failed to delete link');
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: 'inline-flex', gap: '1rem', alignItems: 'center' }}>
      <button
        onClick={handleCopy}
        type="button"
        className="btn-text-action"
        style={{
          color: copied ? 'var(--success, #0b9e69)' : 'var(--accent-primary, #0082f3)',
          fontWeight: '600',
          cursor: 'pointer',
          border: 'none',
          background: 'transparent',
          fontSize: '0.875rem'
        }}
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
      <button
        onClick={handleDelete}
        disabled={deleting}
        type="button"
        className="text-error"
        style={{
          fontWeight: '500',
          cursor: deleting ? 'not-allowed' : 'pointer',
          border: 'none',
          background: 'transparent',
          fontSize: '0.875rem',
          opacity: deleting ? 0.5 : 1
        }}
      >
        {deleting ? 'Deleting...' : 'Delete'}
      </button>
    </div>
  );
}
