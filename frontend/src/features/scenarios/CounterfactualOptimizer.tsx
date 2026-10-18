import { useEffect, useState } from 'react';
import type { StudentProfile } from '../../types';
import { readinessApi, type CounterfactualPlan } from '../../services/readinessApi';
import { useStore } from '../../services/store';
import { ArrowRight, Check, Compass, ListPlus, Loader2 } from 'lucide-react';
import './CounterfactualOptimizer.css';

interface Props {
  baseProfile: StudentProfile;
  onApplyToSimulator: (hypothetical: Partial<StudentProfile>) => void;
}

export default function CounterfactualOptimizer({ baseProfile, onApplyToSimulator }: Props) {
  const [target, setTarget] = useState(85);
  const [plan, setPlan] = useState<CounterfactualPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [added, setAdded] = useState(false);
  const addTask = useStore(s => s.addTask);
  const hasTask = useStore(s => s.hasTask);

  useEffect(() => {
    let active = true;
    setPlan(null); setAdded(false); setError('');
    if (!Number.isFinite(target) || target < 5 || target > 98) {
      setError('Choose a target from 5% to 98%.'); setLoading(false); return;
    }
    setLoading(true);
    // Debounce typing so expensive Python searches do not queue per keystroke.
    const timer = setTimeout(() => {
      readinessApi.counterfactual(baseProfile as unknown as Record<string, string | number>, target / 100)
        .then(({ plan }) => { if (active) setPlan(plan); })
        .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Model scenario unavailable.'); })
        .finally(() => { if (active) setLoading(false); });
    }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [baseProfile, target, revision]);

  function addActions() {
    if (!plan) return;
    for (const action of plan.recommendedActions) {
      const title = `${action.label}: ${action.from} → ${action.to}`;
      if (hasTask(action.feature, title)) continue;
      addTask({ title, rationale: action.rationale, feature: action.feature,
        priority: action.priority === 'critical' ? 'high' : action.priority,
        effort: action.difficulty === 'High' ? 'large' : action.difficulty === 'Low' ? 'small' : 'medium',
        category: action.feature === 'backlogs' ? 'academic' : 'skill' });
    }
    setAdded(true);
  }

  return <section className="counterfactual-optimizer card">
    <div className="cf-header">
      <div className="cf-header-title-box"><Compass size={22} /><div>
        <h3 className="cf-title">Historical-model scenario search</h3>
        <p className="cf-subtitle">Searches bounded input changes using the saved model. This is a hypothetical estimate, not a guarantee or a proven minimum-effort plan.</p>
      </div></div>
      <label className="cf-target-selector">Target probability (%)
        <input aria-label="Target model probability" type="number" min={5} max={98} step={1} value={target}
          onChange={event => setTarget(Number(event.target.value))} className="form-input cf-target-input" />
      </label>
    </div>
    {loading && <p role="status"><Loader2 className="spin" size={16} /> Searching the saved model…</p>}
    {error && <p role="alert">{error} <button className="btn btn-secondary btn-sm" onClick={() => setRevision(n => n + 1)}>Retry</button></p>}
    {plan && <div className="cf-path-details">
      <div className="cf-details-header"><div><h4>Model probability</h4>
        <p>{plan.targetReached ? 'Target reached in this model scenario.' : 'Target was not reached within the search limits.'}</p></div>
        <div className="cf-projection-badge"><strong>{plan.currentProbability.toFixed(1)}%</strong><ArrowRight size={16} /><strong>{plan.achievedProbability.toFixed(1)}%</strong></div>
      </div>
      <div className="cf-changes-grid">{plan.recommendedActions.map(action => <article className="cf-change-card" key={action.feature}>
        <h4>{action.label}</h4><p>{action.from} → {action.to} ({action.delta > 0 ? '+' : ''}{action.delta})</p>
        <p>{action.rationale}</p><small>Effort assumption: {action.difficulty}</small>
      </article>)}</div>
      {!plan.recommendedActions.length && <p>{plan.targetReached ? 'Your current model estimate already meets this target.' : 'No improving change was found within the search limits.'}</p>}
      <div className="cf-footer-actions"><p className="text-secondary">The simulator below uses a separate illustrative readiness score; its points are not model probabilities.</p>
        <button className="btn btn-secondary btn-sm" disabled={!plan.recommendedActions.length || added} onClick={addActions}>{added ? <Check size={14} /> : <ListPlus size={14} />}{added ? 'Added to plan' : 'Add actions to plan'}</button>
        <button className="btn btn-primary btn-sm" disabled={!plan.recommendedActions.length} onClick={() => onApplyToSimulator(Object.fromEntries(plan.recommendedActions.map(action => [action.feature, action.to])))}>Apply inputs to illustrative simulator</button>
      </div>
    </div>}
  </section>;
}
