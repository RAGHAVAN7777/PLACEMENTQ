import { useMemo } from 'react';
import { useStore } from '../../services/store';
import { FEATURE_DEFINITIONS } from '../../config';
import EmptyWorkspace from '../../components/ui/EmptyWorkspace';
import { TrendingUp, Clock, BarChart3 } from 'lucide-react';
import './ProgressPage.css';
import { useInterviewWorkspace, InterviewWorkspaceStatus } from '../../services/InterviewWorkspace';
import { Link } from 'react-router-dom';

export default function ProgressPage() {
  const { reports, report, loading, error } = useInterviewWorkspace();
  if (loading || error) return <InterviewWorkspaceStatus />;
  if (!report) return <NumericProgressPage />;
  return <div className="progress-page"><section className="result-paper"><span className="workspace-kicker">YOUR INTERVIEW JOURNEY</span><div className="result-section-heading"><h2>Every conversation is a new step.</h2><Link to="/assessment?new=1">Start reassessment</Link></div><div className="table-container"><table className="interview-history-table"><thead><tr><th>Date</th><th>Starting domain</th><th>Interview score</th><th>Evidence</th></tr></thead><tbody>{reports.map((item)=><tr key={item.id}><td>{new Date(item.createdAt).toLocaleDateString()}</td><td>{item.selectedDomain}</td><td>{item.assessment.score}/100</td><td><Link to={`/app/interviews?report=${item.id}`}>View report</Link></td></tr>)}</tbody></table></div><p className="result-footnote">Your recorded scores, without sample profiles. Different question paths are not calibrated comparisons.</p></section>{report.comparison.length>0 && <section className="result-paper"><div className="result-section-heading"><h2>Since your last comparable interview</h2></div>{report.comparison.map((item)=><p className="comparison-row" key={item.skill}><span>{item.skill}</span><span>{item.previousScore ?? 'Not assessed'} → {item.currentScore ?? 'Not assessed'}</span><b>{item.change == null ? '—' : `${item.change>0?'+':''}${item.change}`}</b></p>)}</section>}</div>;
}

function NumericProgressPage() {
  const storedAssessments = useStore((s) => s.assessments);
  const assessments = useMemo(() => storedAssessments.filter((item) => !item.id.startsWith('sample-') && item.label !== 'Sample Profile'), [storedAssessments]);
  const tasks = useStore((s) => s.tasks);

  const taskStats = useMemo(() => ({
    total: tasks.length,
    completed: tasks.filter((t) => t.status === 'completed').length,
  }), [tasks]);

  const comparisons = useMemo(() => {
    if (assessments.length < 2) return null;
    const prev = assessments[assessments.length - 2];
    const curr = assessments[assessments.length - 1];

    const diffs = FEATURE_DEFINITIONS
      .filter((f) => f.type === 'number' && f.category !== 'supplementary')
      .map((f) => {
        const prevVal = Number((prev.profile as unknown as Record<string, unknown>)[f.key] ?? 0);
        const currVal = Number((curr.profile as unknown as Record<string, unknown>)[f.key] ?? 0);
        return {
          label: f.shortLabel,
          previous: prevVal,
          current: currVal,
          change: +(currVal - prevVal).toFixed(2),
        };
      })
      .filter((d) => d.change !== 0);

    return {
      prev,
      curr,
      scoreDelta: curr.evaluation.illustrativeReadinessScore - prev.evaluation.illustrativeReadinessScore,
      diffs,
    };
  }, [assessments]);

  if (assessments.length === 0) {
    return (
      <EmptyWorkspace
        icon={<TrendingUp size={48} />}
        title="No progress yet"
        description="Complete your first assessment to start tracking progress. Comparisons require at least two assessments."
      />
    );
  }

  return (
    <div className="progress-page">
      {/* Assessment History */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Assessment history</h3>
          <span className="badge badge-neutral font-mono">{assessments.length} snapshot{assessments.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="table-container">
          <table aria-label="Assessment history">
            <thead>
              <tr>
                <th>Date</th>
                <th>Label</th>
                <th className="table-num">Readiness</th>
                <th className="table-num">Band</th>
                <th className="table-num">CGPA</th>
                <th className="table-num">Coding</th>
                <th className="table-num">Aptitude</th>
              </tr>
            </thead>
            <tbody>
              {[...assessments].reverse().map((a) => (
                <tr key={a.id}>
                  <td className="font-mono">{new Date(a.timestamp).toLocaleDateString()}</td>
                  <td>{a.label || '—'}</td>
                  <td className="table-num font-mono">{a.evaluation.illustrativeReadinessScore}</td>
                  <td className="table-num">
                    <span className={`badge badge-${
                      a.evaluation.readinessBand === 'well-prepared' ? 'success' :
                      a.evaluation.readinessBand === 'developing' ? 'warning' : 'error'
                    }`}>
                      {a.evaluation.readinessBand === 'well-prepared' ? 'Well prepared' :
                       a.evaluation.readinessBand === 'developing' ? 'Developing' : 'Needs prep'}
                    </span>
                  </td>
                  <td className="table-num font-mono">{a.profile.cgpa}</td>
                  <td className="table-num font-mono">{a.profile.coding_skill_score}</td>
                  <td className="table-num font-mono">{a.profile.aptitude_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comparison */}
      {comparisons ? (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Latest comparison</h3>
            <span className="font-mono text-tertiary" style={{ fontSize: '0.75rem' }}>
              {new Date(comparisons.prev.timestamp).toLocaleDateString()} →{' '}
              {new Date(comparisons.curr.timestamp).toLocaleDateString()}
            </span>
          </div>

          <div className="progress-comparison-score">
            <div className="progress-delta">
              <span className="progress-delta-label font-mono">Readiness change</span>
              <span
                className="progress-delta-value font-serif"
                style={{
                  color: comparisons.scoreDelta > 0
                    ? 'var(--color-success)'
                    : comparisons.scoreDelta < 0
                    ? 'var(--color-error)'
                    : 'var(--color-text)',
                }}
              >
                {comparisons.scoreDelta > 0 ? '+' : ''}{comparisons.scoreDelta}
              </span>
            </div>
          </div>

          {comparisons.diffs.length > 0 && (
            <div className="progress-diffs">
              <h4 style={{ fontSize: '0.875rem', marginBottom: 12 }}>Changed inputs</h4>
              <div className="progress-diffs-grid">
                {comparisons.diffs.map((d) => (
                  <div key={d.label} className="progress-diff-item">
                    <span className="progress-diff-label">{d.label}</span>
                    <div className="progress-diff-values font-mono">
                      <span className="text-tertiary">{d.previous}</span>
                      <span>→</span>
                      <span style={{
                        color: d.change > 0 ? 'var(--color-success)' : 'var(--color-error)',
                      }}>
                        {d.current} ({d.change > 0 ? '+' : ''}{d.change})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="notice notice-info">
          <BarChart3 size={16} style={{ flexShrink: 0 }} />
          <span>
            Complete a second assessment to see comparisons and readiness trend.
          </span>
        </div>
      )}

      {/* Plan completion */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Action plan completion</h3>
        </div>
        {taskStats.total === 0 ? (
          <p className="text-secondary" style={{ fontSize: '0.875rem' }}>No tasks in the action plan yet.</p>
        ) : (
          <div className="plan-completion">
            <div className="plan-completion-bar">
              <div className="score-bar-track" style={{ height: 10, borderRadius: 5 }}>
                <div
                  className="score-bar-fill"
                  style={{
                    width: `${(taskStats.completed / taskStats.total) * 100}%`,
                    background: 'var(--color-success)',
                    borderRadius: 5,
                  }}
                />
              </div>
            </div>
            <div className="plan-completion-stats font-mono">
              <span>{taskStats.completed} / {taskStats.total} tasks completed</span>
              <span>{Math.round((taskStats.completed / taskStats.total) * 100)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
