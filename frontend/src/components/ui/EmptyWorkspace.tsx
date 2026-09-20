import { Link } from 'react-router-dom';
import { useStore } from '../../services/store';
import { ROUTES } from '../../config';
import { ClipboardList, BarChart3 } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyWorkspaceProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
}

export default function EmptyWorkspace({
  icon,
  title = 'No assessment yet',
  description = 'Complete an assessment to see your readiness profile, or load a sample to explore.',
}: EmptyWorkspaceProps) {
  const loadSampleProfile = useStore((s) => s.loadSampleProfile);

  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        {icon || <BarChart3 size={48} />}
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="empty-state-actions">
        <Link to={ROUTES.assessment} className="btn btn-primary">
          <ClipboardList size={16} />
          Start assessment
        </Link>
        <button className="btn btn-secondary" onClick={loadSampleProfile}>
          Load sample profile
        </button>
      </div>
    </div>
  );
}
