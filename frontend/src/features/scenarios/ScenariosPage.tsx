import { useState, useMemo, useCallback } from 'react';
import { useStore } from '../../services/store';
import { predictionService } from '../../services/prediction';
import { SCENARIO_EDITABLE_FIELDS, FEATURE_DEFINITIONS, ROUTES } from '../../config';
import EmptyWorkspace from '../../components/ui/EmptyWorkspace';
import type { StudentProfile, EvaluationResult } from '../../types';
import { RotateCcw, Save, ListChecks, ArrowRight, AlertTriangle } from 'lucide-react';
import CounterfactualOptimizer from './CounterfactualOptimizer';
import './ScenariosPage.css';

export default function ScenariosPage() {
  const latestAssessment = useStore((s) => s.getLatestAssessment());
  const saveScenario = useStore((s) => s.saveScenario);
  const addTask = useStore((s) => s.addTask);
  const hasTask = useStore((s) => s.hasTask);

  const [hypothetical, setHypothetical] = useState<Partial<StudentProfile>>({});
  const [hypotheticalResult, setHypotheticalResult] = useState<EvaluationResult | null>(null);
  const [scenarioName, setScenarioName] = useState('');
  const [saved, setSaved] = useState(false);

  const baseProfile = latestAssessment?.profile;
  const baseResult = latestAssessment?.evaluation;

  // Merged profile
  const mergedProfile = useMemo(() => {
    if (!baseProfile) return null;
    return { ...baseProfile, ...hypothetical };
  }, [baseProfile, hypothetical]);

  // Evaluate hypothetical
  const evaluate = useCallback(async () => {
    if (!mergedProfile) return;
    const result = await predictionService.evaluate(mergedProfile as StudentProfile);
    setHypotheticalResult(result);
  }, [mergedProfile]);

  // Auto-evaluate on change
  useMemo(() => {
    if (mergedProfile && Object.keys(hypothetical).length > 0) {
      predictionService.evaluate(mergedProfile as StudentProfile).then(setHypotheticalResult);
    } else {
      setHypotheticalResult(null);
    }
  }, [mergedProfile, hypothetical]);

  const handleFieldChange = useCallback(
    (key: string, value: string) => {
      if (value === '' || value === String((baseProfile as unknown as Record<string, unknown>)?.[key])) {
        setHypothetical((prev) => {
          const next = { ...prev };
          delete (next as unknown as Record<string, unknown>)[key];
          return next;
        });
      } else {
        setHypothetical((prev) => ({ ...prev, [key]: parseFloat(value) }));
      }
      setSaved(false);
    },
    [baseProfile]
  );

  const handleReset = useCallback(() => {
    setHypothetical({});
    setHypotheticalResult(null);
    setSaved(false);
    setScenarioName('');
  }, []);

  const handleSave = useCallback(() => {
    if (!latestAssessment) return;
    saveScenario({
      name: scenarioName || `Scenario ${new Date().toLocaleDateString()}`,
      baseAssessmentId: latestAssessment.id,
      hypotheticalProfile: hypothetical,
      evaluation: hypotheticalResult ?? undefined,
    });
    setSaved(true);
  }, [latestAssessment, hypothetical, hypotheticalResult, scenarioName, saveScenario]);

  const handleAddChangesToPlan = useCallback(() => {
    for (const key of Object.keys(hypothetical)) {
      const def = FEATURE_DEFINITIONS.find((f) => f.key === key);
      if (!def || hasTask(key, `Improve ${def.label}`)) continue;
      const targetVal = (hypothetical as unknown as Record<string, unknown>)[key];
      addTask({
        title: `Improve ${def.label}`,
        rationale: `Target value from scenario: ${targetVal}. Current: ${(baseProfile as unknown as Record<string, unknown>)?.[key]}`,
        priority: 'medium',
        effort: 'medium',
        feature: key,
        category: def.category === 'supplementary' ? 'skill' : def.category,
      });
    }
  }, [hypothetical, baseProfile, addTask, hasTask]);

  if (!latestAssessment || !baseProfile || !baseResult) {
    return <EmptyWorkspace />;
  }

  const changedFields = Object.keys(hypothetical);
  const scoreDelta = hypotheticalResult
    ? hypotheticalResult.illustrativeReadinessScore - baseResult.illustrativeReadinessScore
    : 0;

  return (
    <div className="scenarios-page">
      <div className="notice notice-warning" style={{ marginBottom: 16 }}>
        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          Illustrative scenario — not a prediction of the effect of an intervention.
          Changes here do not modify your saved assessment.
        </span>
      </div>

      {/* Prescriptive Counterfactual Optimizer */}
      <CounterfactualOptimizer
        baseProfile={baseProfile}
        currentScore={baseResult.illustrativeReadinessScore}
        onApplyToSimulator={(hyp) => setHypothetical(hyp)}
      />

      <div className="scenario-workspace">
        {/* Current */}
        <div className="scenario-panel">
          <h3 className="scenario-panel-title">
            <span>Current assessment</span>
            <span className="badge badge-neutral font-mono">saved</span>
          </h3>
          <div className="scenario-score-box">
            <span className="font-mono" style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>
              Readiness
            </span>
            <span className="font-serif" style={{ fontSize: '2.5rem', lineHeight: 1 }}>
              {baseResult.illustrativeReadinessScore}
            </span>
          </div>
          <div className="scenario-fields-list">
            {SCENARIO_EDITABLE_FIELDS.map((key) => {
              const def = FEATURE_DEFINITIONS.find((f) => f.key === key);
              if (!def) return null;
              const value = (baseProfile as unknown as Record<string, unknown>)[key];
              return (
                <div key={key} className="scenario-field-row">
                  <span className="scenario-field-label">{def.shortLabel}</span>
                  <span className="scenario-field-value font-mono">
                    {value !== undefined ? String(value) : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Arrow */}
        <div className="scenario-arrow-col">
          <ArrowRight size={24} />
        </div>

        {/* Hypothetical */}
        <div className="scenario-panel scenario-panel-hyp">
          <h3 className="scenario-panel-title">
            <span>Hypothetical profile</span>
            {changedFields.length > 0 && (
              <span className="badge badge-primary font-mono">{changedFields.length} changed</span>
            )}
          </h3>

          <div className="scenario-score-box">
            <span className="font-mono" style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>
              Readiness
            </span>
            <span
              className="font-serif"
              style={{
                fontSize: '2.5rem',
                lineHeight: 1,
                color: hypotheticalResult
                  ? scoreDelta > 0
                    ? 'var(--color-success)'
                    : scoreDelta < 0
                    ? 'var(--color-error)'
                    : undefined
                  : undefined,
              }}
            >
              {hypotheticalResult?.illustrativeReadinessScore ?? baseResult.illustrativeReadinessScore}
            </span>
            {hypotheticalResult && scoreDelta !== 0 && (
              <span
                className="font-mono"
                style={{
                  fontSize: '0.8125rem',
                  color: scoreDelta > 0 ? 'var(--color-success)' : 'var(--color-error)',
                }}
              >
                {scoreDelta > 0 ? '+' : ''}{scoreDelta}
              </span>
            )}
          </div>

          <div className="scenario-fields-list">
            {SCENARIO_EDITABLE_FIELDS.map((key) => {
              const def = FEATURE_DEFINITIONS.find((f) => f.key === key);
              if (!def) return null;
              const baseValue = (baseProfile as unknown as Record<string, unknown>)[key];
              const hypValue = (hypothetical as unknown as Record<string, unknown>)[key];
              const isChanged = hypValue !== undefined;

              return (
                <div key={key} className={`scenario-field-row ${isChanged ? 'changed' : ''}`}>
                  <span className="scenario-field-label">{def.shortLabel}</span>
                  <input
                    type="number"
                    className="form-input scenario-field-input"
                    value={isChanged ? String(hypValue) : (baseValue !== undefined ? String(baseValue) : '')}
                    onChange={(e) => handleFieldChange(key, e.target.value)}
                    min={def.min}
                    max={def.max}
                    step={def.step}
                    aria-label={`Hypothetical ${def.label}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="scenario-actions">
        <button className="btn btn-secondary" onClick={handleReset} disabled={changedFields.length === 0}>
          <RotateCcw size={14} />
          Reset scenario
        </button>

        <div className="scenario-save-group">
          <input
            type="text"
            className="form-input"
            placeholder="Scenario name (optional)"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            style={{ width: 200 }}
          />
          <button
            className="btn btn-secondary"
            onClick={handleSave}
            disabled={changedFields.length === 0 || saved}
          >
            <Save size={14} />
            {saved ? 'Saved' : 'Save scenario'}
          </button>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleAddChangesToPlan}
          disabled={changedFields.length === 0}
        >
          <ListChecks size={14} />
          Add changes to plan
        </button>
      </div>
    </div>
  );
}
