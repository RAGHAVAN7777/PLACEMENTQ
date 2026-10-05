import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { readinessApi, type IntegratedAssessment } from '../../services/readinessApi';
import { interviewApi, type InterviewReport } from '../../services/interviewApi';
import './ReadinessPage.css';

export default function ReadinessPage() {
  const [params] = useSearchParams();
  const [records, setRecords] = useState<IntegratedAssessment[]>([]);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const selectedId = params.get('assessment');
  const selectedSession = params.get('session');
  const history = params.get('history') === '1';
  const record = selectedId ? records.find(item => item.id === selectedId) : selectedSession ? records.find(item => item.sessionId === selectedSession) : records[0];
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    readinessApi.list().then(data => {if(active)setRecords(data.assessments);}).catch(err => {if(active)setError(err.message);}).finally(() => {if(active)setLoading(false);});
    return () => {active=false;};
  }, [revision, selectedId, selectedSession]);
  useEffect(() => {
    let active = true; setReport(null);
    if (record?.interview) interviewApi.report(record.interview.reportId).then(data => {if(active)setReport(data.report);}).catch(err => {if(active)setError(err.message);});
    return () => {active=false;};
  }, [record?.interview?.reportId]);
  async function prepare() {
    if(!record)return;setBusy(true);setError('');
    try {const {assessment}=await readinessApi.prepare(record.id);setRecords(items=>items.map(item=>item.id===assessment.id?assessment:item));}
    catch(err){setError(err instanceof Error?err.message:'Could not save the preparation plan.');}
    finally{setBusy(false);}
  }
  if(loading)return <p role="status">Reading your saved assessments…</p>;
  return <div className="readiness-page">
    <header className="readiness-heading"><div><span className="workspace-kicker">YOUR NEXT CHAPTER</span><h1>{history?'Assessment history':'Your integrated readiness'}</h1><p>Historical profile evidence and current interview performance, clearly separated.</p></div><Link className="btn btn-secondary" to="/placement-assessment">Start reassessment</Link></header>
    {error&&<p role="alert">{error} <button onClick={()=>setRevision(n=>n+1)}>Retry</button></p>}
    {history ? <section className="readiness-card"><h2>Previous assessments</h2>{!records.length&&<p>No saved assessments yet.</p>}{records.map(item=><Link className="readiness-history" key={item.id} to={`/app/readiness?assessment=${item.id}`}><strong>{new Date(item.createdAt).toLocaleString()}</strong><span>Baseline {item.baseline?.score.toFixed(2)??'pending'} · Interview {item.interview?.score??'pending'}</span><span>{item.result.category} →</span></Link>)}</section> : !record ? <section className="readiness-card"><h2>{selectedId||selectedSession?'Assessment not available':'Start with your baseline'}</h2><p>{selectedId||selectedSession?'No saved integrated assessment matches this link for this browser.':'Confirm the model inputs, save your baseline estimate, then meet Aria.'}</p><Link className="btn btn-primary" to="/placement-assessment">Complete baseline assessment</Link></section> : <>
      <div className="readiness-results">
        <section className="readiness-card"><span className="workspace-kicker">HISTORICAL ML MODEL</span><h2>Baseline Placement Estimate</h2><p>Output from the historical dataset-trained ML model.</p>{record.baseline?<><div className="readiness-number">{record.baseline.score.toFixed(2)}<small>/100</small></div><p>Model placement probability: {(record.baseline.probability*100).toFixed(2)}%. Predicted class: <strong>{record.baseline.predictedClass}</strong>.</p><small>{record.baseline.modelName} · {new Date(record.baseline.timestamp).toLocaleString()}</small></>:<><p>Not assessed</p><Link className="btn btn-primary" to={`/placement-assessment?session=${record.sessionId}`}>Complete missing baseline</Link></>}</section>
        <section className="readiness-card"><span className="workspace-kicker">LIVE AGENT ASSESSMENT</span><h2>Verified Interview Performance</h2><p>Current skill performance demonstrated during the agent interview.</p>{record.interview?<><div className="readiness-number">{record.interview.score}<small>/100</small></div><p>Rubric marks from your answers—not a placement probability.</p><small>{record.interview.provenance.model.used||record.interview.provenance.model.requested} · rubric {record.interview.provenance.versions.scoring}</small>{record.result.reviewNeeded&&<p>Provisional interpretation: some answers need review.</p>}</>:<><p>Interview not completed. Your baseline remains saved.</p><Link className="btn btn-primary" to={`/assessment?session=${record.sessionId}`}>Continue to robot interview</Link></>}</section>
      </div>
      <section className="readiness-card"><span className="workspace-kicker">READINESS MATRIX</span><h2>{record.result.category}</h2><p>{record.result.explanation}</p><p className="readiness-policy">Thresholds used: baseline ≥ {record.policy.baselineThreshold}/100 · interview ≥ {record.policy.interviewThreshold}/100. Policy {record.policy.version}.</p><details><summary>How the four categories work</summary><ul><li>High baseline + high interview: Placement Ready</li><li>High baseline + low interview: Profile Strong, Interview Preparation Required</li><li>Low baseline + high interview: Demonstrated Skill Strong, Profile Improvement Required</li><li>Low baseline + low interview: Structured Readiness Development Required</li></ul></details></section>
      {record.interview&&<section className="readiness-card"><h2>Demonstrated skills</h2>{record.interview.skills.map(skill=><div className="readiness-skill" key={skill.skill}><span>{skill.skill}{skill.reviewNeeded?' · review needed':''}</span><progress max={100} value={skill.score??0} aria-label={`${skill.skill}: ${skill.score??'insufficient evidence'}`} /><strong>{skill.score??'Not assessed'}</strong></div>)}<Link to={`/app/interviews?report=${record.interview.reportId}`}>Open full interview report and conversation →</Link></section>}
      {record.result.action&&<section className="readiness-card"><span className="workspace-kicker">AGENT-SELECTED NEXT ACTION</span><h2>{record.result.action.title}</h2><p>{record.result.action.reason}</p><ol>{record.result.action.steps.map(step=><li key={step}>{step}</li>)}</ol><button className="btn btn-primary" disabled={busy||!!record.preparation} onClick={prepare}>{record.preparation?'Preparation plan started':busy?'Saving plan…':'Start recommended preparation plan'}</button>{record.preparation&&<p role="status">Saved {new Date(record.preparation.startedAt!).toLocaleString()}. Your plan stays linked to this assessment.</p>}</section>}
      {record.result.composite&&<section className="readiness-card"><h2>Composite Placement Readiness Index</h2><p><strong>{record.result.composite.value}/100</strong> · Decision-support index, not a placement probability.</p><p>{record.policy.baselineWeight} × {record.result.composite.baselineScore.toFixed(4)} + {record.policy.interviewWeight} × {record.result.composite.interviewScore} = {record.result.composite.value} (rounded)</p><small>{record.policy.weightStatus}. These weights are saved with this assessment.</small></section>}
      {record.baseline&&<details className="readiness-card"><summary>Confirmed inputs and model provenance</summary><p>Model artifact version: <code>{record.baseline.modelVersion}</code></p><dl className="baseline-review">{Object.entries(record.baseline.inputs).map(([key,value])=><div key={key}><dt>{key.replaceAll('_',' ')}</dt><dd>{value} · {record.baseline!.sources[key]?.source}{record.baseline!.sources[key]?.corrected?' (corrected)':''}</dd></div>)}</dl><p>Feature order: {record.baseline.featureOrder.join(', ')}</p></details>}
      {report&&<details className="readiness-card"><summary>Answer evidence and rubric marks</summary>{report.questions.map(answer=><article className="readiness-evidence" key={answer.id}><h3>{answer.question}</h3><p>{answer.answer||'Skipped'}</p><p>{answer.grade.awardedPoints}/{answer.grade.maxPoints} · uncertainty: {answer.grade.uncertainty}{answer.grade.reviewNeeded?' · faculty review requested':''}</p>{answer.grade.criteria.map(criterion=><p key={criterion.criterionId}><strong>{criterion.label}: {criterion.points}/{criterion.maxPoints}</strong> — {criterion.explanation}{criterion.evidenceExcerpt&&<q>{criterion.evidenceExcerpt}</q>}</p>)}</article>)}</details>}
      <section className="readiness-card"><h2>Agent activity</h2><p>A transparent policy comparison of saved results; no new placement model is trained here.</p><ol>{record.timeline.map((event,index)=><li key={index}><strong>{event.stage.replaceAll('-',' ')}:</strong> {event.message} <small>{new Date(event.timestamp).toLocaleString()}</small></li>)}</ol></section>
    </>}
    <footer className="readiness-links"><Link to="/app/readiness?history=1">Previous assessment history</Link><Link to="/placement-assessment">Start a new reassessment</Link><Link to="/app/interviews">Saved interviews</Link></footer>
  </div>;
}
