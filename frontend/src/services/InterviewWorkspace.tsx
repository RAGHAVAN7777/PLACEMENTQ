import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import { interviewApi, type InterviewReport } from './interviewApi';

import { readinessApi, type IntegratedAssessment } from './readinessApi';

type Workspace = { assessments:IntegratedAssessment[];assessment?:IntegratedAssessment; reports: InterviewReport[]; report?: InterviewReport; loading: boolean; error: string; retry: () => void };
const Context = createContext<Workspace | null>(null);

export function InterviewWorkspaceProvider({ children }: { children: ReactNode }) {
  const [assessments,setAssessments]=useState<IntegratedAssessment[]>([]);
  const [reports, setReports] = useState<InterviewReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [params] = useSearchParams();
  const location=useLocation();
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([interviewApi.reports(),readinessApi.list()]).then(async ([r,a]) => {
      const id=params.get('assessment');
      if(id&&!a.assessments.some(x=>x.id===id)) {
        const extra=(await readinessApi.get(id)).assessment;a.assessments.unshift(extra);
        if(extra.interview&&!r.reports.some(x=>x.id===extra.interview!.reportId))r.reports.unshift((await interviewApi.report(extra.interview.reportId)).report);
      }
      if(active){setReports(r.reports);setAssessments(a.assessments);}
    })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Could not load your interview.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision,params.get('assessment'),params.get('session'),location.pathname]);
  const selected = params.get('report');
  const assessment=params.get('assessment')?assessments.find(x=>x.id===params.get('assessment')):params.get('session')?assessments.find(x=>x.sessionId===params.get('session')):selected?assessments.find(x=>x.interview?.reportId===selected):assessments.find(x=>x.interview)||assessments[0];
  const report = selected ? reports.find((item) => item.id === selected) : assessment?reports.find(x=>x.id===assessment.interview?.reportId):reports[0];
  return <Context.Provider value={{ assessments,assessment,reports, report, loading, error: error || (!loading && selected && !report ? 'This report is unavailable for this browser. Open your saved interviews to choose another.' : ''), retry: () => setRevision((value) => value + 1) }}>{children}</Context.Provider>;
}

export function useInterviewWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error('Interview workspace provider is missing.');
  return value;
}

export function InterviewWorkspaceStatus() {
  const { loading, error, retry } = useInterviewWorkspace();
  return <section className="workspace-state" role={error ? 'alert' : 'status'}><span className="workspace-kicker">YOUR INTERVIEW</span><h2>{loading ? 'Opening your results…' : 'We couldn’t open your results.'}</h2><p>{loading ? 'Reading your saved assessment from the local service.' : /502|503|Failed to fetch/i.test(error) ? 'The local service is unavailable. Start PlacementIQ’s backend, then try again.' : error}</p>{error && <div><button className="btn btn-primary" onClick={retry}>Try again</button><Link className="btn btn-secondary" to="/app/interviews">Saved interviews</Link></div>}</section>;
}
