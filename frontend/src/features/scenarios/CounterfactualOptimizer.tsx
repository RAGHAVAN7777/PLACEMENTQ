import { useState, useMemo } from 'react';
import type { StudentProfile, CounterfactualPath } from '../../types';
import { generateCounterfactualPaths } from '../../services/counterfactual';
import { COUNTERFACTUAL_TARGETS } from '../../config';
import { useStore } from '../../services/store';
import {
  Compass, Zap, Code2, Layers, Check, ArrowRight,
  TrendingUp, ListPlus, Sparkles, Clock
} from 'lucide-react';
import './CounterfactualOptimizer.css';

interface CounterfactualOptimizerProps {
  baseProfile: StudentProfile;
  currentScore: number;
  onApplyToSimulator: (hypothetical: Partial<StudentProfile>) => void;
}

export default function CounterfactualOptimizer({
  baseProfile,
  currentScore,
  onApplyToSimulator,
}: CounterfactualOptimizerProps) {
  // Default target: next tier above current score, or at least 80
  const defaultTarget = currentScore < 70 ? 75 : currentScore < 80 ? 82 : Math.min(95, currentScore + 10);
  const [targetScore, setTargetScore] = useState<number>(defaultTarget);
  const [selectedPathId, setSelectedPathId] = useState<string>('quick-wins');
  const [appliedPathId, setAppliedPathId] = useState<string | null>(null);
  const [addedTasksPathId, setAddedTasksPathId] = useState<string | null>(null);

  const addTask = useStore((s) => s.addTask);
  const hasTask = useStore((s) => s.hasTask);

  // Calculate paths
  const paths = useMemo(() => {
    return generateCounterfactualPaths(baseProfile, targetScore);
  }, [baseProfile, targetScore]);

  const activePath = paths.find((p) => p.id === selectedPathId) ?? paths[0];

  const handleApply = (path: CounterfactualPath) => {
    onApplyToSimulator(path.hypotheticalProfile);
    setAppliedPathId(path.id);
    setTimeout(() => setAppliedPathId(null), 2500);
  };

  const handleAddToPlan = (path: CounterfactualPath) => {
    for (const change of path.changes) {
      const taskTitle = change.feature === 'backlogs'
        ? 'Clear All Active Backlogs'
        : `Improve ${change.label} to ${change.recommendedValue}`;

      if (hasTask(change.feature, taskTitle)) continue;

      addTask({
        title: taskTitle,
        rationale: change.rationale,
        priority: change.roiScore >= 8.5 ? 'high' : 'medium',
        effort: change.delta > 15 ? 'large' : 'medium',
        feature: change.feature,
        category: change.feature === 'backlogs' ? 'academic' : 'skill',
      });
    }

    setAddedTasksPathId(path.id);
    setTimeout(() => setAddedTasksPathId(null), 3000);
  };

  return (
    <div className="counterfactual-optimizer card">
      {/* Header */}
      <div className="cf-header">
        <div className="cf-header-title-box">
          <div className="cf-icon">
            <Compass size={20} />
          </div>
          <div>
            <div className="cf-badge-row">
              <h3 className="cf-title">Prescriptive Counterfactual Optimizer</h3>
              <span className="badge badge-primary font-mono">Inverse ML Optimizer</span>
            </div>
            <p className="cf-subtitle">
              Calculates the minimal, highest-ROI changes required to reach your desired placement readiness bar.
            </p>
          </div>
        </div>

        {/* Target Selector */}
        <div className="cf-target-selector">
          <span className="cf-target-label font-mono">Target Score:</span>
          <div className="cf-target-presets">
            {COUNTERFACTUAL_TARGETS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`btn btn-sm ${targetScore === t.targetScore ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setTargetScore(t.targetScore)}
              >
                {t.targetScore} ({t.label.split(' ')[0]})
              </button>
            ))}
            <div className="cf-custom-target">
              <input
                type="number"
                min={Math.min(95, currentScore + 1)}
                max={98}
                value={targetScore}
                onChange={(e) => setTargetScore(Number(e.target.value) || defaultTarget)}
                className="input input-sm font-mono cf-target-input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Path Tabs */}
      <div className="cf-path-tabs">
        {paths.map((p) => {
          const isSelected = p.id === selectedPathId;
          const icon = p.id === 'quick-wins' ? <Zap size={16} /> : p.id === 'technical-mastery' ? <Code2 size={16} /> : <Layers size={16} />;
          return (
            <button
              key={p.id}
              type="button"
              className={`cf-path-tab ${isSelected ? 'active' : ''}`}
              onClick={() => setSelectedPathId(p.id)}
            >
              <div className="cf-tab-top">
                <span className="cf-tab-icon">{icon}</span>
                <span className="cf-tab-name font-sans">{p.name.split(':')[0]}</span>
              </div>
              <div className="cf-tab-bottom font-mono">
                <span className="cf-tab-gain text-success">+{p.scoreDelta} pts</span>
                <span className="cf-tab-weeks text-tertiary">· {p.estimatedWeeks.split(' ')[0]} wks</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Path Details Box */}
      <div className="cf-path-details">
        <div className="cf-details-header">
          <div>
            <h4 className="cf-path-heading">{activePath.name}</h4>
            <p className="cf-path-tagline text-secondary">{activePath.tagline}</p>
          </div>

          <div className="cf-projection-badge">
            <div className="cf-proj-item">
              <span className="cf-proj-label font-mono">Current</span>
              <span className="cf-proj-val font-serif">{currentScore}</span>
            </div>
            <ArrowRight size={16} className="text-secondary" />
            <div className="cf-proj-item">
              <span className="cf-proj-label font-mono">Projected</span>
              <span className="cf-proj-val font-serif text-success font-bold">{activePath.projectedScore}</span>
            </div>
            <div className="cf-gain-pill font-mono">
              +{activePath.scoreDelta} pts
            </div>
          </div>
        </div>

        {/* Change breakdown */}
        <div className="cf-changes-container">
          <div className="cf-changes-title-row">
            <span className="font-mono text-secondary" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
              Prescribed Actionable Levers ({activePath.changes.length} adjustments)
            </span>
            <span className="cf-effort-tag font-mono">
              <Clock size={12} style={{ marginRight: 4 }} />
              Estimated Turnaround: {activePath.estimatedWeeks}
            </span>
          </div>

          <div className="cf-changes-grid">
            {activePath.changes.map((c) => (
              <div key={c.feature} className="cf-change-card">
                <div className="cf-change-card-header">
                  <span className="cf-change-label font-sans font-bold">{c.label}</span>
                  <span className="badge badge-neutral font-mono text-success">
                    ROI {c.roiScore}/10
                  </span>
                </div>

                <div className="cf-change-values-row font-mono">
                  <span className="cf-val-current">{c.currentValue}</span>
                  <ArrowRight size={13} className="text-secondary" />
                  <span className="cf-val-target font-bold text-primary">{c.recommendedValue}</span>
                  <span className="cf-val-delta">
                    ({c.feature === 'backlogs' ? `-${c.delta}` : `+${c.delta}`} {c.unit})
                  </span>
                </div>

                <p className="cf-change-rationale text-secondary font-sans">
                  {c.rationale}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="cf-footer-actions">
          <div className="cf-footer-summary font-mono text-secondary">
            {activePath.summary}
          </div>

          <div className="cf-action-buttons">
            <button
              type="button"
              className="btn btn-outline btn-sm font-sans"
              onClick={() => handleAddToPlan(activePath)}
            >
              {addedTasksPathId === activePath.id ? (
                <>
                  <Check size={14} className="text-success" />
                  Added to Action Plan!
                </>
              ) : (
                <>
                  <ListPlus size={14} />
                  Add All to 90-Day Plan
                </>
              )}
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm font-sans"
              onClick={() => handleApply(activePath)}
            >
              {appliedPathId === activePath.id ? (
                <>
                  <Check size={14} />
                  Applied to Simulator!
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Apply This Path to Simulator
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
