import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FEATURE_DEFINITIONS } from '../../config';
import { readinessApi, type BaselineField, type BaselineSource } from '../../services/readinessApi';
import { rememberSession } from '../../services/interviewApi';
import { useStore } from '../../services/store';
import type { StudentProfile } from '../../types';
import './AssessmentPage.css';
import '../readiness/ReadinessPage.css';

export default function AssessmentPage({session: suppliedSession,onComplete,embedded=false}:{session?:string;onComplete?:(assessment:import('../../services/readinessApi').IntegratedAssessment)=>void;embedded?:boolean}={}) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sessionId = suppliedSession || params.get('session') || undefined;
  const [fields, setFields] = useState<BaselineField[]>([]);
  const [values, setValues] = useState<Record<string, string | number>>({});
  const [conflicts,setConflicts]=useState<Array<{key:string;previous:BaselineSource;current:BaselineSource}>>([]);
  const [sources, setSources] = useState<Record<string, BaselineSource>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    readinessApi.schema(sessionId).then(data => {
      if (!active) return;
      setFields(data.fields); setSources(data.prefill);setConflicts(data.conflicts||[]);
      setValues(Object.fromEntries(Object.entries(data.prefill).map(([key, source]) => [key, source.value!])));
      setError('');
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [sessionId, revision]);
  const category = (key: string) => FEATURE_DEFINITIONS.find(field => field.key === key)?.category || 'supplementary';
  const missing=fields.filter(f=>!sources[f.key]);
  const groups = [missing.filter(f => category(f.key) === 'academic'), missing.filter(f => ['experience','activity'].includes(category(f.key))), missing.filter(f => ['skill','supplementary'].includes(category(f.key)))];
  const titles = ['Academic profile', 'Experience & activity', 'Skills & other model inputs', 'Confirm & predict'];
  const check = (list: BaselineField[]) => list.every(field => {
    const value = values[field.key];
    return field.type === 'select' ? field.options!.includes(String(value)) : typeof value === 'number' && Number.isFinite(value) && value >= field.min! && value <= field.max! && (!field.integer || Number.isInteger(value));
  });
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (step < 3) { if (!check(groups[step])) { setError('Complete every field in this step using valid values.'); return; } setStep(step + 1); return; }
    if (!confirmed || !check(fields)) { setError('Confirm or correct every required model input before prediction.'); return; }
    setBusy(true);
    try {
      const { assessment } = await readinessApi.predict(values, sessionId);
      if(sessionId)rememberSession(assessment.sessionId);
      if(onComplete)onComplete(assessment);else navigate(`/app/readiness?assessment=${assessment.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Prediction failed. Your inputs are still here.'); }
    finally { setBusy(false); }
  }
  return <div className={`assessment-page ${embedded?'assessment-embedded':''}`}><div className="assessment-container">
    {!embedded && <header className="assessment-header"><Link to="/app/overview" className="btn btn-ghost">← Workspace</Link><Link to="/app/readiness?history=1">Assessment history</Link></header>}
    <h1 className="assessment-title">{embedded?'Candidate Profile Verification':'Placement predictor · research'}</h1>
    <p className="assessment-subtitle text-secondary">Review extracted inputs and supply only missing model attributes. The saved ML prediction will remain linked to this assessment.</p>
    <div className="stepper" aria-label="Assessment steps">{titles.map((title, i) => <span key={title} className={`stepper-step ${i === step ? 'active' : ''}`}><span className="stepper-number">{i + 1}</span><span className="stepper-label">{title}</span></span>)}</div>
    {conflicts.length>0&&<div className="notice notice-warning"><strong>Conflicting sources need review</strong>{conflicts.map(c=><p key={c.key}>{c.key}: previously verified {c.previous.value}; new evidence {c.current.value} ({c.current.source}). Both sources are retained; confirm the correct current value.</p>)}</div>}
    {error && <p role="alert" className="form-error">{error} {!fields.length && <button onClick={() => setRevision(n => n + 1)}>Retry model connection</button>}</p>}
    {!fields.length && !error && <p role="status">Loading the saved model’s input specification…</p>}
    {!!fields.length && <form onSubmit={submit} className="assessment-form"><h2 className="assessment-step-title">{titles[step]}</h2>
      {step<3&&groups[step].length===0&&<p>These inputs are already populated. Review them in the final step.</p>}
      {step < 3 ? <div className="assessment-fields-grid">{groups[step].map(field => <div className="form-group assessment-field" key={field.key}>
        <label className="form-label" htmlFor={`baseline-${field.key}`}>{field.key === 'mock_interview_score' ? 'Previous mock interview score' : FEATURE_DEFINITIONS.find(f => f.key === field.key)?.label || field.label} *</label>
        {field.type === 'select' ? <select id={`baseline-${field.key}`} className="form-select" required value={values[field.key] ?? ''} onChange={e => { setValues(v => ({...v,[field.key]:e.target.value}));setConfirmed(false); }}><option value="">Select…</option>{field.options?.map(option => <option key={option}>{option}</option>)}</select> : <input id={`baseline-${field.key}`} className="form-input" type="number" required min={field.min} max={field.max} step="any" value={values[field.key] ?? ''} onChange={e => {setValues(v => ({...v,[field.key]:e.target.value === '' ? '' : Number(e.target.value)}));setConfirmed(false);}} />}
        {sources[field.key] && <small>Suggested from {sources[field.key].source}: “{sources[field.key].passage}”. Confirm or correct this value.</small>}
        {field.key === 'mock_interview_score' && <small>Historical input from an earlier mock assessment. Aria’s new interview score is kept separate and never substituted here.</small>}
      </div>)}</div> : <><p>All {fields.length} original model inputs are required. Review your values; no interview score is inserted into these inputs.</p><dl className="baseline-review">{fields.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{field.type==='select'?<select aria-label={`Review ${field.label}`} value={values[field.key]??''} onChange={e=>{setValues(v=>({...v,[field.key]:e.target.value}));setConfirmed(false);}}>{field.options?.map(o=><option key={o}>{o}</option>)}</select>:<input aria-label={`Review ${field.label}`} type="number" min={field.min} max={field.max} step={field.integer?1:0.01} value={values[field.key]??''} onChange={e=>{setValues(v=>({...v,[field.key]:e.target.value===''?'':Number(e.target.value)}));setConfirmed(false);}}/>} <small>{sources[field.key] ? `${sources[field.key].source}${values[field.key] === sources[field.key].value ? '' : ' (corrected)'}` : 'Student supplied'}</small></dd></div>)}</dl><label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I have checked and confirm these inputs, including any résumé suggestions.</label></>}
      <div className="assessment-actions">{step > 0 && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setStep(step - 1)}>Back</button>}<button className="btn btn-primary" disabled={busy || (step === 3 && !confirmed)}>{busy ? 'Running saved ML model…' : step < 3 ? 'Next' : embedded?'Continue to Assessment':'Generate baseline estimate'}</button></div>
    </form>}
  </div></div>;
}
