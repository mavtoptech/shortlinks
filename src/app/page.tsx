import Link from "next/link";

export default function Home() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem', textAlign: 'center' }}>
      <h1 className="text-4xl font-bold mb-4 text-primary">
        ShortLinks
      </h1>
      <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '3rem', maxWidth: '600px' }}>
        The premium URL shortener that gives you full control. Bring your own domain and track your links with ease.
      </p>
      
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Link href="/login" className="btn-primary">
          Get Started
        </Link>
        <Link href="/dashboard" className="btn-secondary">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
