import { useState } from 'react';
import type { PolicyMode } from '../../types';
import { ASSESSMENT_POLICIES } from '../../config';
import { Shield, Sparkles, AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import './PolicySwitcher.css';

interface PolicySwitcherProps {
  currentScore: number;
  activePolicy: PolicyMode;
  onPolicyChange: (policy: PolicyMode) => void;
  showExplanationDefault?: boolean;
}

export default function PolicySwitcher({
  currentScore,
  activePolicy,
  onPolicyChange,
  showExplanationDefault = false,
}: PolicySwitcherProps) {
  const [showDetails, setShowDetails] = useState(showExplanationDefault);
  const policy = ASSESSMENT_POLICIES[activePolicy];

  // In our calibrated model, score directly correlates with placement probability
  // Score 50 ~= cutoff 0.50, Score 39 ~= cutoff 0.39
  const isPlacedUnderStandard = currentScore >= 50;
  const isPlacedUnderHighRecall = currentScore >= 39;
  const isRescuedCandidate = !isPlacedUnderStandard && isPlacedUnderHighRecall;

  const currentVerdict = activePolicy === 'standard'
    ? (isPlacedUnderStandard ? 'placed' : 'needs-prep')
    : (isPlacedUnderHighRecall ? (isRescuedCandidate ? 'rescued-placed' : 'placed') : 'needs-prep');

  return (
    <div className="policy-switcher-card">
      <div className="policy-switcher-header">
        <div className="policy-header-left">
          <div className="policy-icon-badge">
            <Shield size={18} />
          </div>
          <div>
            <div className="policy-title-row">
              <h4 className="policy-title">Recruitment Decision Policy</h4>
              <span className="badge badge-primary font-mono">{policy.shortName}</span>
            </div>
            <p className="policy-subtitle font-mono">
              Institutional Cutoff Strategy: {policy.tagline}
            </p>
          </div>
        </div>

        {/* Toggle Pills */}
        <div className="policy-toggle-group">
          <button
            type="button"
            className={`policy-toggle-btn ${activePolicy === 'standard' ? 'active' : ''}`}
            onClick={() => onPolicyChange('standard')}
          >
            Standard (0.50)
          </button>
          <button
            type="button"
            className={`policy-toggle-btn ${activePolicy === 'high-recall' ? 'active' : ''}`}
            onClick={() => onPolicyChange('high-recall')}
          >
            <Sparkles size={13} style={{ marginRight: 4 }} />
            Early Discovery (0.39)
          </button>
        </div>
      </div>

      {/* Dynamic Policy Outcome Ribbon */}
      <div className={`policy-verdict-ribbon verdict-${currentVerdict}`}>
        <div className="verdict-content">
          {currentVerdict === 'rescued-placed' && (
            <div className="verdict-badge-box">
              <Sparkles size={16} className="text-success animate-pulse" />
              <span className="verdict-label text-success font-mono font-bold">
                RESCUED BORDERLINE CANDIDATE
              </span>
            </div>
          )}
          {currentVerdict === 'placed' && (
            <div className="verdict-badge-box">
              <span className="verdict-label text-success font-mono font-bold">
                PLACEMENT ELIGIBLE (QUALIFIED)
              </span>
            </div>
          )}
          {currentVerdict === 'needs-prep' && (
            <div className="verdict-badge-box">
              <AlertCircle size={16} className="text-warning" />
              <span className="verdict-label text-warning font-mono font-bold">
                BELOW POLICY CUTOFF (NEEDS PREPARATION)
              </span>
            </div>
          )}

          <p className="verdict-description">
            {activePolicy === 'standard' ? (
              isPlacedUnderStandard ? (
                `Student score (${currentScore}/100) satisfies the standard corporate 0.50 cutoff bar.`
              ) : (
                `Score (${currentScore}/100) falls below the strict 0.50 cutoff. (Switch to Early Discovery policy to evaluate sensitivity rescue).`
              )
            ) : (
              isRescuedCandidate ? (
                `Under the Early Discovery 0.39 policy, this student is successfully captured (+3.8% recall gain)! In a real campus drive, this student qualifies for prioritized counseling rather than being rejected.`
              ) : isPlacedUnderHighRecall ? (
                `Strongly qualifies under the 0.39 high-recall threshold with 92.04% institutional sensitivity.`
              ) : (
                `Student score (${currentScore}/100) requires structured preparation to cross the 0.39 threshold.`
              )
            )}
          </p>
        </div>

        <button
          type="button"
          className="policy-details-toggle btn btn-ghost btn-sm font-mono"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showDetails ? 'Hide Academic Rationale' : 'Why This Policy?'}
        </button>
      </div>

      {/* Expandable Academic Rationale */}
      {showDetails && (
        <div className="policy-details-drawer">
          <div className="policy-metrics-grid">
            <div className="policy-metric-item">
              <span className="pm-label font-mono">Cutoff Probability</span>
              <span className="pm-value font-mono font-bold">{policy.cutoff}</span>
            </div>
            <div className="policy-metric-item">
              <span className="pm-label font-mono">Placement Recall</span>
              <span className="pm-value font-mono font-bold text-success">{policy.recall}%</span>
            </div>
            <div className="policy-metric-item">
              <span className="pm-label font-mono">Precision</span>
              <span className="pm-value font-mono font-bold">{policy.precision}%</span>
            </div>
            <div className="policy-metric-item">
              <span className="pm-label font-mono">Rescued Students</span>
              <span className="pm-value font-mono font-bold text-primary">
                {activePolicy === 'high-recall' ? '418 Candidates' : '0 (Baseline)'}
              </span>
            </div>
          </div>
          <p className="policy-explainer-text">
            <strong>Academic Viva Note:</strong> Standard machine learning benchmarks assume equal loss for False Positives and False Negatives. In educational recruitment counseling, missing a placeable student (False Negative) deprives them of career opportunities. By lowering the cutoff to 0.39, the model achieves <strong>92.04% recall</strong>, capturing 418 additional students across the cohort while sacrificing under 0.47% in accuracy.
          </p>
        </div>
      )}
    </div>
  );
}
