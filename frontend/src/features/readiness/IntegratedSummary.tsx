import { Link } from 'react-router-dom';
import type { IntegratedAssessment } from '../../services/readinessApi';
import './ReadinessPage.css';
import './Unified.css';
export default function IntegratedSummary({record}:{record:IntegratedAssessment}) {
 const c=record.result.composite;
 return <section className="readiness-card integrated-summary">
 <span className="workspace-kicker">{record.demo?'DEMO · FICTIONAL CANDIDATE':'SAVED CANDIDATE ASSESSMENT'}</span>
 <h2>{record.candidateSnapshot?.name||record.demo?.name||'Your placement assessment'}</h2>
 <p>{record.interview?'Interview evaluation completed':'Assessment in progress'} · {new Date(record.createdAt).toLocaleString()}</p>
 <h3>Integrated Placement Readiness Score</h3><div className="readiness-number">{c?`${c.value}/100`:'Pending'}</div>
 <p>{c?'Decision-support readiness estimate, not a calibrated hiring probability.':record.result.explanation}</p>
 {record.demo&&<p className="summary-notice">Demo · Fictional inputs and offline practice scoring.</p>}
 <div className="unified-grid"><div><h3>Baseline ML · {record.policy.baselineWeight*100}%</h3><strong>{record.baseline?`${record.baseline.score.toFixed(2)}/100`:'Not available'}</strong><p>{record.baseline?.predictedClass}</p></div><div><h3>Interview · {record.policy.interviewWeight*100}%</h3><strong>{record.interview?`${record.interview.score}/100`:'Not completed'}</strong><p>Evidence-based rubric performance.</p></div></div>
 <details className="summary-method"><summary>How this score is calculated</summary>{c&&<p>{c.baselineScore.toFixed(2)} × {c.baselineWeight} + {c.interviewScore.toFixed(2)} × {c.interviewWeight} = {c.value} (rounded).</p>}<p>Policy {record.policy.version}. Baseline class probability is not calibrated for hiring. Interview scores reflect rubric evidence.</p></details>
 {record.result.reviewNeeded&&<p>Provisional result · some answer evidence needs review.</p>}
 <div className="readiness-links"><Link to={`/app/readiness?assessment=${record.id}`}>Calculation & evidence</Link>{record.interview?<Link to={`/app/interviews?assessment=${record.id}&report=${record.interview.reportId}`}>Full report</Link>:<Link to={`/assessment?session=${record.sessionId}`}>Continue assessment</Link>}<Link to={`/app/plan?assessment=${record.id}`}>Preparation roadmap</Link></div>
 </section>;
}
