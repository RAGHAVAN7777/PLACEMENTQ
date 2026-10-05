import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FEATURE_DEFINITIONS } from '../../config';
import { readinessApi, type BaselineField, type BaselineSource } from '../../services/readinessApi';
import { rememberSession } from '../../services/interviewApi';
import './AssessmentPage.css';
import '../readiness/ReadinessPage.css';

export default function AssessmentPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sessionId = params.get('session') || undefined;
  const [fields, setFields] = useState<BaselineField[]>([]);
  const [values, setValues] = useState<Record<string, string | number>>({});
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
      setFields(data.fields); setSources(data.prefill);
      setValues(Object.fromEntries(Object.entries(data.prefill).map(([key, source]) => [key, source.value!])));
      setError('');
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [sessionId, revision]);
  const category = (key: string) => FEATURE_DEFINITIONS.find(field => field.key === key)?.category || 'supplementary';
  const groups = [fields.filter(f => category(f.key) === 'academic'), fields.filter(f => ['experience','activity'].includes(category(f.key))), fields.filter(f => ['skill','supplementary'].includes(category(f.key)))];
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
      rememberSession(assessment.sessionId);
      navigate(`/app/readiness?assessment=${assessment.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Prediction failed. Your inputs are still here.'); }
    finally { setBusy(false); }
  }
  return <div className="assessment-page"><div className="assessment-container">
    <header className="assessment-header"><Link to="/app/overview" className="btn btn-ghost">← Workspace</Link><Link to="/app/readiness?history=1">Assessment history</Link></header>
    <h1 className="assessment-title">Baseline placement assessment</h1>
    <p className="assessment-subtitle text-secondary">First, your historical-model estimate. Then, a conversation with Aria to demonstrate your current skills.</p>
    <div className="stepper" aria-label="Assessment steps">{titles.map((title, i) => <span key={title} className={`stepper-step ${i === step ? 'active' : ''}`}><span className="stepper-number">{i + 1}</span><span className="stepper-label">{title}</span></span>)}</div>
    {error && <p role="alert" className="form-error">{error} {!fields.length && <button onClick={() => setRevision(n => n + 1)}>Retry model connection</button>}</p>}
    {!fields.length && !error && <p role="status">Loading the saved model’s input specification…</p>}
    {!!fields.length && <form onSubmit={submit} className="assessment-form"><h2 className="assessment-step-title">{titles[step]}</h2>
      {step < 3 ? <div className="assessment-fields-grid">{groups[step].map(field => <div className="form-group assessment-field" key={field.key}>
        <label className="form-label" htmlFor={`baseline-${field.key}`}>{field.key === 'mock_interview_score' ? 'Previous mock interview score' : FEATURE_DEFINITIONS.find(f => f.key === field.key)?.label || field.label} *</label>
        {field.type === 'select' ? <select id={`baseline-${field.key}`} className="form-select" required value={values[field.key] ?? ''} onChange={e => { setValues(v => ({...v,[field.key]:e.target.value}));setConfirmed(false); }}><option value="">Select…</option>{field.options?.map(option => <option key={option}>{option}</option>)}</select> : <input id={`baseline-${field.key}`} className="form-input" type="number" required min={field.min} max={field.max} step="any" value={values[field.key] ?? ''} onChange={e => {setValues(v => ({...v,[field.key]:e.target.value === '' ? '' : Number(e.target.value)}));setConfirmed(false);}} />}
        {sources[field.key] && <small>Suggested from {sources[field.key].source}: “{sources[field.key].passage}”. Confirm or correct this value.</small>}
        {field.key === 'mock_interview_score' && <small>Historical input from an earlier mock assessment. Aria’s new interview score is kept separate and never substituted here.</small>}
      </div>)}</div> : <><p>All {fields.length} original model inputs are required. Review your values; no interview score is inserted into these inputs.</p><dl className="baseline-review">{fields.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{values[field.key]} <small>{sources[field.key] ? `Résumé suggestion ${values[field.key] === sources[field.key].value ? 'confirmed' : 'corrected'}` : 'Student supplied'}</small></dd></div>)}</dl><label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I have checked and confirm these inputs, including any résumé suggestions.</label></>}
      <div className="assessment-actions">{step > 0 && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setStep(step - 1)}>Back</button>}<button className="btn btn-primary" disabled={busy || (step === 3 && !confirmed)}>{busy ? 'Running saved ML model…' : step < 3 ? 'Next' : 'Generate baseline estimate'}</button></div>
    </form>}
  </div></div>;
}
