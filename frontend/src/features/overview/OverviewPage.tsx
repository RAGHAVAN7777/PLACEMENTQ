import EmptyWorkspace from '../../components/ui/EmptyWorkspace';
import InterviewOverview from './InterviewOverview';
import { useInterviewWorkspace, InterviewWorkspaceStatus } from '../../services/InterviewWorkspace';
import { Link, useSearchParams } from 'react-router-dom';
import ReadinessPage from '../readiness/ReadinessPage';

export default function OverviewPage() {
  const { report, loading, error } = useInterviewWorkspace();
  const [params] = useSearchParams();
  if (!params.get('report')) return <ReadinessPage />;
  if (loading || error) return <InterviewWorkspaceStatus />;
  if (report) return <><p><Link to={`/placement-assessment?session=${report.sessionId}`}>Add a baseline estimate for this interview</Link> · <Link to={`/app/readiness?session=${report.sessionId}`}>Integrated readiness</Link></p><InterviewOverview report={report} /></>;
  return <EmptyWorkspace title="Your story starts with a conversation." description="Complete your interview to see your actual score, evidence and next steps here." />;
}
