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

  // Callers must supply the trained model probability on a 0–100 scale.
  // Illustrative readiness points and interview scores are not compatible.
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
              <h4 className="policy-title">Model Threshold Comparison</h4>
              <span className="badge badge-primary font-mono">{policy.shortName}</span>
            </div>
            <p className="policy-subtitle font-mono">
              Recorded test split: {policy.tagline}
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
                RECLASSIFIED AT LOWER THRESHOLD
              </span>
            </div>
          )}
          {currentVerdict === 'placed' && (
            <div className="verdict-badge-box">
              <span className="verdict-label text-success font-mono font-bold">
                ABOVE SELECTED MODEL THRESHOLD
              </span>
            </div>
          )}
          {currentVerdict === 'needs-prep' && (
            <div className="verdict-badge-box">
              <AlertCircle size={16} className="text-warning" />
              <span className="verdict-label text-warning font-mono font-bold">
                BELOW SELECTED MODEL THRESHOLD
              </span>
            </div>
          )}

          <p className="verdict-description">
            {activePolicy === 'standard' ? (
              isPlacedUnderStandard ? (
                `Model probability (${currentScore}%) meets the default 0.50 threshold. This does not establish hiring eligibility.`
              ) : (
                `Model probability (${currentScore}%) falls below the 0.50 threshold. Switch thresholds to inspect sensitivity.`
              )
            ) : (
              isRescuedCandidate ? (
                `This prediction changes class at 0.39. The lower threshold increases recall and false positives on the recorded test split; it does not establish hiring eligibility.`
              ) : isPlacedUnderHighRecall ? (
                `Model probability (${currentScore}%) meets the 0.39 threshold. Test-split recall is ${policy.recall}%; individual outcomes remain unverified.`
              ) : (
                `Model probability (${currentScore}%) is below the 0.39 threshold. This result is not a hiring decision.`
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
              <span className="pm-label font-mono">Fewer False Negatives</span>
              <span className="pm-value font-mono font-bold text-primary">
                {policy.rescuedCount} (vs. default)
              </span>
            </div>
          </div>
          <p className="policy-explainer-text">
            <strong>Test-split tradeoff:</strong> Lowering the cutoff from 0.50 to 0.39 raises measured recall from 88.24% to 92.04%, with 418 fewer false negatives and more false positives. Accuracy decreases from 85.66% to 85.19% (0.47 percentage points). These results do not demonstrate real-world recruitment benefit.
          </p>
        </div>
      )}
    </div>
  );
}
