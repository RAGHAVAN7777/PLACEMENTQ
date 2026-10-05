import { Link } from 'react-router-dom';
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
  description = 'Complete an interview to see your actual score, evidence and preparation plan.',
}: EmptyWorkspaceProps) {

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
          Meet your interviewer
        </Link>
        <Link className="btn btn-secondary" to={ROUTES.placementAssessment}>Placement predictor</Link>
      </div>
    </div>
  );
}
