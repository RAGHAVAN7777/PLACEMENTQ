import { useMemo, useCallback } from 'react';
import { useStore } from '../../services/store';
import { computeSkillGaps } from '../../services/prediction';
import { FEATURE_DEFINITIONS, ROUTES } from '../../config';
import EmptyWorkspace from '../../components/ui/EmptyWorkspace';
import { Plus, Check, Info } from 'lucide-react';
import './SkillsPage.css';

export default function SkillsPage() {
  const latestAssessment = useStore((s) => s.getLatestAssessment());
  const addTask = useStore((s) => s.addTask);
  const hasTask = useStore((s) => s.hasTask);

  const gaps = useMemo(() => {
    if (!latestAssessment) return [];
    return computeSkillGaps(latestAssessment.profile);
  }, [latestAssessment]);

  const categories = useMemo(() => {
    const cats: Record<string, typeof gaps> = {};
    for (const g of gaps) {
      if (!cats[g.category]) cats[g.category] = [];
      cats[g.category].push(g);
    }
    return cats;
  }, [gaps]);

  const handleAddToPlan = useCallback(
    (gap: typeof gaps[0]) => {
      addTask({
        title: `Improve ${gap.label}`,
        rationale: gap.suggestedAction,
        priority: gap.gap / Math.max(gap.target, 1) > 0.3 ? 'high' : gap.gap > 0 ? 'medium' : 'low',
        effort: 'medium',
        feature: gap.feature,
        category: gap.category,
      });
    },
    [addTask]
  );

  if (!latestAssessment) {
    return <EmptyWorkspace />;
  }

  const catLabels: Record<string, string> = {
    academic: 'Academic Metrics',
    skill: 'Skill Scores',
    experience: 'Experience',
    activity: 'Activities',
  };

  return (
    <div className="skills-page">
      <div className="skills-intro">
        <p className="text-secondary">
          Compare your profile against illustrative preparation benchmarks. Targets are product-defined benchmarks, not industry standards.
        </p>
      </div>

      {Object.entries(categories).map(([cat, items]) => (
        <div key={cat} className="skills-category">
          <h3 className="skills-category-title">{catLabels[cat] ?? cat}</h3>

          <div className="table-container">
            <table className="skills-table" role="table" aria-label={`${catLabels[cat] ?? cat} skill analysis`}>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th className="table-num">Current</th>
                  <th className="table-num">Target</th>
                  <th className="table-num">Gap</th>
                  <th style={{ minWidth: 200 }}>Bar</th>
                  <th>Suggested action</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((gap) => {
                  const pct = gap.target > 0 ? Math.min(100, (gap.currentValue / gap.target) * 100) : 100;
                  const onTarget = gap.gap <= 0;
                  const alreadyAdded = hasTask(gap.feature, `Improve ${gap.label}`);

                  return (
                    <tr key={gap.feature}>
                      <td>
                        <span className="skill-name">{gap.label}</span>
                        <span className="skill-unit font-mono">{gap.unit}</span>
                      </td>
                      <td className="table-num">{gap.currentValue}</td>
                      <td className="table-num">{gap.target}</td>
                      <td className="table-num">
                        {gap.gap > 0 ? (
                          <span style={{ color: 'var(--color-error)' }}>-{gap.gap}</span>
                        ) : (
                          <span style={{ color: 'var(--color-success)' }}>0</span>
                        )}
                      </td>
                      <td>
                        <div className="score-bar">
                          <div className="score-bar-track">
                            <div
                              className="score-bar-fill"
                              style={{
                                width: `${pct}%`,
                                background: onTarget ? 'var(--color-success)' : 'var(--color-primary)',
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="skill-action-text">{gap.suggestedAction}</span>
                      </td>
                      <td>
                        {gap.gap > 0 && (
                          <button
                            className={`btn btn-sm ${alreadyAdded ? 'btn-ghost' : 'btn-secondary'}`}
                            onClick={() => handleAddToPlan(gap)}
                            disabled={alreadyAdded}
                            title={alreadyAdded ? 'Already in plan' : 'Add to action plan'}
                          >
                            {alreadyAdded ? <Check size={14} /> : <Plus size={14} />}
                            {alreadyAdded ? 'Added' : 'Plan'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="notice notice-info" style={{ marginTop: 16 }}>
        <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Future: model-based explanations</strong>
          <p style={{ marginTop: 4 }}>
            When a trained model is integrated, this section will show per-student feature contributions
            (local explanations) alongside global feature importance. Current recommendations are
            rule-based product logic derived from profile gaps, not SHAP or model explanations.
          </p>
        </div>
      </div>
    </div>
  );
}
