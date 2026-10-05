import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ClipboardList, Download, GraduationCap, RefreshCw } from 'lucide-react';
import { ROUTES } from '../../config';
import { interviewApi, type InterviewReport } from '../../services/interviewApi';
import ReportView from './ReportView';
import '../interview/InterviewPage.css';
import './ReportsPage.css';

export default function ReportsPage({ faculty = false }: { faculty?: boolean }) {
  const [reports, setReports] = useState<InterviewReport[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = searchParams.get('report');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    document.title = `${faculty ? 'Faculty evidence view' : 'Interview reports'} — PlacementIQ`;
    let active = true;
    setLoading(true);
    setError('');
    interviewApi.reports().then(({ reports }) => {
      if (active) setReports(reports);
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : 'Could not load interview reports.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [faculty, reload]);

  const current = reports.find((item) => item.id === selected) || (selected ? undefined : reports[0]);
  const exportReport = () => {
    if (!current) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(current, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `placementiq-interview-${current.id}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="reports-page page-container">
    <div className="page-header reports-header"><div><span className="eyebrow">{faculty ? 'LOCAL FACULTY REVIEW' : 'INTERVIEW HISTORY'}</span><h2>{faculty ? 'Evidence behind every score' : 'Saved interview assessments'}</h2><p className="text-secondary">{faculty ? 'This view is limited to reports owned by this local browser identity; no cross-student admin account exists in the original project.' : 'Persistent reports remain separate from the placement-prediction snapshots.'}</p></div><Link to={`${ROUTES.assessment}?new=1`} className="btn btn-primary">Start reassessment <ArrowRight size={15} /></Link></div>
    {loading && <div className="notice notice-info" role="status"><RefreshCw size={16} /> Loading saved interviews…</div>}
    {error && <div className="notice notice-error" role="alert"><span>{error} Start the local API and retry.</span><button className="btn btn-secondary btn-sm" onClick={() => setReload((value) => value + 1)}>Retry</button></div>}
    {!loading && !reports.length && !error ? <div className="empty-state report-empty-state">{faculty ? <GraduationCap size={28} /> : <ClipboardList size={28} />}<h3>No interview reports yet</h3><p>Complete the evidence interview to create a reviewable assessment.</p><Link to={ROUTES.assessment} className="btn btn-primary">Meet your interviewer</Link></div> : !loading && !error && <div className="reports-layout">
      <aside className="report-index" aria-label="Saved interviews">{reports.map((report) => <button key={report.id} onClick={() => setSearchParams({ report: report.id })} className={current?.id === report.id ? 'active' : ''} aria-pressed={current?.id === report.id}><span>{new Date(report.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span><strong>{report.selectedDomain}</strong><b>{report.assessment.score}</b></button>)}</aside>
      {current ? <div className="report-document"><div className="report-document-actions"><span>Saved {new Date(current.createdAt).toLocaleString()}</span><button className="btn btn-secondary btn-sm" onClick={exportReport}><Download size={14} /> Export report</button></div><ReportView report={current} /></div> : <div className="notice notice-warning">This report is unavailable for this browser identity. Select a saved interview.</div>}
    </div>}
  </div>;
}
