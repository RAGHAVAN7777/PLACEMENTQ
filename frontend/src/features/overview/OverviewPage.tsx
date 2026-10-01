import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../services/store';
import { ROUTES, READINESS_THRESHOLDS, FEATURE_DEFINITIONS } from '../../config';
import { computeSkillGaps } from '../../services/prediction';
import { generateCounterfactualPaths } from '../../services/counterfactual';
import type { PolicyMode } from '../../types';
import EmptyWorkspace from '../../components/ui/EmptyWorkspace';
import PolicySwitcher from '../../components/ui/PolicySwitcher';
import { BarChart3, FlaskConical, ListChecks, ArrowRight, Info, Compass, Sparkles, CheckCircle2 } from 'lucide-react';
import './OverviewPage.css';

function getBandStyle(band: string) {
  switch (band) {
    case 'well-prepared': return { color: READINESS_THRESHOLDS.wellPrepared.color, label: READINESS_THRESHOLDS.wellPrepared.label };
    case 'developing': return { color: READINESS_THRESHOLDS.developing.color, label: READINESS_THRESHOLDS.developing.label };
    default: return { color: READINESS_THRESHOLDS.needsPreparation.color, label: READINESS_THRESHOLDS.needsPreparation.label };
  }
}

export default function OverviewPage() {
  const latestAssessment = useStore((s) => s.getLatestAssessment());
  const [activePolicy, setActivePolicy] = useState<PolicyMode>('standard');

  const gaps = useMemo(() => {
    if (!latestAssessment) return [];
    return computeSkillGaps(latestAssessment.profile);
  }, [latestAssessment]);

  const topActions = useMemo(() => {
    return gaps.filter((g) => g.gap > 0).slice(0, 3);
  }, [gaps]);

  const skillScores = useMemo(() => {
    if (!latestAssessment) return [];
    const skills = FEATURE_DEFINITIONS.filter(
      (f) => f.category === 'skill' && f.type === 'number'
    );
    return skills.map((s) => {
      const value = (latestAssessment.profile as unknown as Record<string, unknown>)[s.key];
      return { ...s, value: Number(value ?? 0) };
    });
  }, [latestAssessment]);

  // Generate top counterfactual quick win path for the overview teaser
  const quickWinPath = useMemo(() => {
    if (!latestAssessment) return null;
    const target = latestAssessment.evaluation.illustrativeReadinessScore < 75 ? 80 : 88;
    const paths = generateCounterfactualPaths(latestAssessment.profile, target);
    return paths[0]; // Quick wins path
  }, [latestAssessment]);

  if (!latestAssessment) {
    return <EmptyWorkspace />;
  }

  const { evaluation, profile } = latestAssessment;
  const bandStyle = getBandStyle(evaluation.readinessBand);

  return (
    <div className="overview">
      {/* Policy Switcher Banner */}
      <PolicySwitcher
        currentScore={evaluation.illustrativeReadinessScore}
        activePolicy={activePolicy}
        onPolicyChange={setActivePolicy}
      />

      {/* Summary row */}
      <div className="overview-summary">
        <div className="overview-score-panel">
          <div className="overview-score-label font-mono">Illustrative readiness score</div>
          <div
            className="overview-score-value font-serif"
            style={{ color: bandStyle.color }}
          >
            {evaluation.illustrativeReadinessScore}
          </div>
          <div
            className="badge"
            style={{
              background: `${bandStyle.color}15`,
              color: bandStyle.color,
            }}
          >
            {bandStyle.label}
          </div>
          <p className="overview-score-note text-tertiary font-mono">
            Product-defined estimate · Not a model prediction
          </p>
        </div>

        <div className="overview-context">
          <h3 className="overview-context-title">Student profile</h3>
          <div className="overview-context-grid">
            <div className="ctx-item">
              <span className="ctx-label">CGPA</span>
              <span className="ctx-value font-mono">{profile.cgpa}</span>
            </div>
            <div className="ctx-item">
              <span className="ctx-label">Branch</span>
              <span className="ctx-value font-mono">{profile.branch}</span>
            </div>
            <div className="ctx-item">
              <span className="ctx-label">Tier</span>
              <span className="ctx-value font-mono">{profile.college_tier}</span>
            </div>
            <div className="ctx-item">
              <span className="ctx-label">Internships</span>
              <span className="ctx-value font-mono">{profile.internships_count}</span>
            </div>
            <div className="ctx-item">
              <span className="ctx-label">Projects</span>
              <span className="ctx-value font-mono">{profile.projects_count}</span>
            </div>
            <div className="ctx-item">
              <span className="ctx-label">Backlogs</span>
              <span className="ctx-value font-mono">{profile.backlogs}</span>
            </div>
          </div>
          {latestAssessment.label && (
            <div className="badge badge-primary" style={{ marginTop: 8 }}>
              {latestAssessment.label}
            </div>
          )}
        </div>
      </div>

      {/* Preparation chart */}
      <div className="overview-section">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Preparation profile</h3>
            <Link to={ROUTES.skills} className="btn btn-ghost btn-sm">
              Full analysis <ArrowRight size={14} />
            </Link>
          </div>
          <div className="prep-bars">
            {skillScores.map((s) => {
              const pct = Math.min(100, (s.value / 100) * 100);
              const targetPct = (s.target / 100) * 100;
              const onTarget = s.value >= s.target;
              return (
                <div key={s.key} className="score-bar" style={{ marginBottom: 10 }}>
                  <span className="prep-bar-label">{s.shortLabel}</span>
                  <div className="score-bar-track">
                    <div
                      className="score-bar-fill"
                      style={{
                        width: `${pct}%`,
                        background: onTarget ? 'var(--color-success)' : 'var(--color-primary)',
                      }}
                    />
                    <div className="score-bar-target" style={{ left: `${targetPct}%` }} title={`Target: ${s.target}`} />
                  </div>
                  <span className="score-bar-value">{s.value}</span>
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              <span className="font-mono text-tertiary" style={{ fontSize: '0.6875rem' }}>
                — Current value
              </span>
              <span className="font-mono text-tertiary" style={{ fontSize: '0.6875rem' }}>
                | Illustrative target
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Prescriptive Counterfactual Teaser */}
      {quickWinPath && (
        <div className="overview-section">
          <div className="card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Compass size={18} className="text-primary" />
                <h3 className="card-title">Easiest Path to Placement (Counterfactual Optimizer)</h3>
              </div>
              <Link to={ROUTES.scenarios} className="btn btn-primary btn-sm">
                Explore in Scenario Lab <ArrowRight size={14} />
              </Link>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
              <div>
                <p className="text-secondary" style={{ fontSize: '0.875rem', margin: 0 }}>
                  <strong>{quickWinPath.name}</strong>: {quickWinPath.tagline}
                </p>
                <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: '0.75rem' }} className="font-mono text-tertiary">
                  <span>Turnaround: {quickWinPath.estimatedWeeks}</span>
                  <span>·</span>
                  <span>Effort: {quickWinPath.effortTier.toUpperCase()}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-canvas)', padding: '6px 14px', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                <span className="font-mono" style={{ fontSize: '0.75rem' }}>Current {evaluation.illustrativeReadinessScore}</span>
                <ArrowRight size={14} />
                <span className="font-mono font-bold text-success" style={{ fontSize: '1.1rem' }}>Projected {quickWinPath.projectedScore}</span>
                <span className="badge badge-success font-mono">+{quickWinPath.scoreDelta} pts</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginTop: 8 }}>
              {quickWinPath.changes.slice(0, 3).map((ch) => (
                <div key={ch.feature} style={{ background: 'var(--color-canvas)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border-light)', fontSize: '0.75rem' }}>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{ch.label}</div>
                  <div className="font-mono text-secondary" style={{ marginTop: 2 }}>
                    {ch.currentValue} → <strong className="text-primary">{ch.recommendedValue}</strong> ({ch.feature === 'backlogs' ? `-${ch.delta}` : `+${ch.delta}`} {ch.unit})
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Priority actions */}
      <div className="overview-section">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Priority actions</h3>
            <Link to={ROUTES.plan} className="btn btn-ghost btn-sm">
              Action plan <ArrowRight size={14} />
            </Link>
          </div>
          {topActions.length === 0 ? (
            <p className="text-secondary" style={{ fontSize: '0.875rem' }}>
              Your profile meets all illustrative preparation benchmarks. Continue maintaining your skills.
            </p>
          ) : (
            <div className="priority-actions">
              {topActions.map((action, i) => (
                <div key={action.feature} className="priority-action">
                  <span className="priority-number font-mono">{String(i + 1).padStart(2, '0')}</span>
                  <div className="priority-content">
                    <h4 className="priority-title">Improve {action.label}</h4>
                    <p className="priority-desc text-secondary">{action.suggestedAction}</p>
                    <div className="priority-meta font-mono">
                      <span>Current: {action.currentValue}</span>
                      <span>Target: {action.target}</span>
                      <span>Gap: {action.gap}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Explanation */}
      <div className="overview-section">
        <div className="notice notice-info">
          <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>About this score</strong>
            <p style={{ marginTop: 4 }}>
              The illustrative readiness score is a weighted combination of your profile values
              against product-defined preparation benchmarks. Bands are:
              "Needs preparation" (0–{READINESS_THRESHOLDS.needsPreparation.max}),
              "Developing" ({READINESS_THRESHOLDS.needsPreparation.max + 1}–{READINESS_THRESHOLDS.developing.max}),
              "Well prepared" ({READINESS_THRESHOLDS.developing.max + 1}–100).
              This is not a placement probability from a trained model.
            </p>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="overview-links">
        <Link to={ROUTES.skills} className="overview-link-card">
          <BarChart3 size={20} />
          <div>
            <h4>Skill Analysis</h4>
            <p className="text-secondary">Detailed skill gaps and targets</p>
          </div>
          <ArrowRight size={16} className="text-tertiary" />
        </Link>
        <Link to={ROUTES.scenarios} className="overview-link-card">
          <FlaskConical size={20} />
          <div>
            <h4>Scenario Lab</h4>
            <p className="text-secondary">Explore hypothetical changes</p>
          </div>
          <ArrowRight size={16} className="text-tertiary" />
        </Link>
        <Link to={ROUTES.plan} className="overview-link-card">
          <ListChecks size={20} />
          <div>
            <h4>Action Plan</h4>
            <p className="text-secondary">Manage preparation tasks</p>
          </div>
          <ArrowRight size={16} className="text-tertiary" />
        </Link>
      </div>
    </div>
  );
}
