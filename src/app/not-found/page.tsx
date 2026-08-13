import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '1rem',
      textAlign: 'center'
    }}>
      <div className="glass-panel p-12" style={{ maxWidth: '32rem', width: '100%' }}>
        <div style={{ 
          width: '80px', 
          height: '80px', 
          borderRadius: '50%', 
          background: 'rgba(239, 68, 68, 0.1)', 
          color: 'var(--error-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2.5rem',
          margin: '0 auto 1.5rem auto'
        }}>
          !
        </div>
        
        <h1 className="text-3xl font-bold mb-4">Link Not Found</h1>
        
        <p className="text-secondary mb-8 text-lg">
          We couldn't find the short link you were looking for. It may have been deleted, expired, or you might have a typo in the URL.
        </p>
        
        <Link href="/" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
          Return Home
        </Link>
      </div>
    </div>
  );
}
