import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../services/store';
import { ROUTES, READINESS_THRESHOLDS, FEATURE_DEFINITIONS } from '../../config';
import { computeSkillGaps } from '../../services/prediction';
import EmptyWorkspace from '../../components/ui/EmptyWorkspace';
import { BarChart3, FlaskConical, ListChecks, ArrowRight, Info } from 'lucide-react';
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

  if (!latestAssessment) {
    return <EmptyWorkspace />;
  }

  const { evaluation, profile } = latestAssessment;
  const bandStyle = getBandStyle(evaluation.readinessBand);

  return (
    <div className="overview">
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
