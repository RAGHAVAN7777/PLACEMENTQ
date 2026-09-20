import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../config';
import { ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  useEffect(() => {
    document.title = 'Page Not Found — PlacementIQ';
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      textAlign: 'center',
      padding: '24px',
    }}>
      <span className="font-serif" style={{ fontSize: '6rem', lineHeight: 1, color: 'var(--color-text-tertiary)', opacity: 0.3 }}>
        404
      </span>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginTop: '16px', marginBottom: '8px' }}>
        Page not found
      </h1>
      <p className="text-secondary" style={{ marginBottom: '24px', maxWidth: 400 }}>
        The page you're looking for doesn't exist. It may have been moved or the URL may be incorrect.
      </p>
      <div style={{ display: 'flex', gap: '12px' }}>
        <Link to={ROUTES.home} className="btn btn-primary">
          <ArrowLeft size={16} />
          Back to home
        </Link>
        <Link to={ROUTES.overview} className="btn btn-secondary">
          Open workspace
        </Link>
      </div>
    </div>
  );
}
