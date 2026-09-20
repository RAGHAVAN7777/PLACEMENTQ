import { DATASET_META, PRELIMINARY_RESULTS, FEATURE_DEFINITIONS } from '../../config';
import { Info, AlertTriangle, Database, GitBranch, FlaskConical, Shield, BarChart3 } from 'lucide-react';
import './ModelLabPage.css';

export default function ModelLabPage() {
  return (
    <div className="model-lab">
      <div className="model-lab-intro">
        <p className="text-secondary">
          This page documents the dataset, modelling approach, preliminary results, and known limitations.
          It is intended for academic transparency and reproducibility.
        </p>
      </div>

      {/* Dataset Summary */}
      <section className="ml-section">
        <h2 className="ml-section-title">
          <Database size={18} />
          Dataset summary
        </h2>
        <div className="ml-meta-grid">
          <div className="ml-meta-item">
            <span className="ml-meta-label font-mono">File</span>
            <span className="ml-meta-value font-mono">{DATASET_META.filename}</span>
          </div>
          <div className="ml-meta-item">
            <span className="ml-meta-label font-mono">Records</span>
            <span className="ml-meta-value font-mono">{DATASET_META.rows.toLocaleString()}</span>
          </div>
          <div className="ml-meta-item">
            <span className="ml-meta-label font-mono">Columns</span>
            <span className="ml-meta-value font-mono">{DATASET_META.columns}</span>
          </div>
          <div className="ml-meta-item">
            <span className="ml-meta-label font-mono">Placed</span>
            <span className="ml-meta-value font-mono">{DATASET_META.placed.toLocaleString()} ({(DATASET_META.placed / DATASET_META.rows * 100).toFixed(1)}%)</span>
          </div>
          <div className="ml-meta-item">
            <span className="ml-meta-label font-mono">Not Placed</span>
            <span className="ml-meta-value font-mono">{DATASET_META.notPlaced.toLocaleString()} ({(DATASET_META.notPlaced / DATASET_META.rows * 100).toFixed(1)}%)</span>
          </div>
          <div className="ml-meta-item">
            <span className="ml-meta-label font-mono">Missing values</span>
            <span className="ml-meta-value font-mono">{DATASET_META.missingValues}</span>
          </div>
        </div>
      </section>

      {/* Target Distribution */}
      <section className="ml-section">
        <h2 className="ml-section-title">Target distribution</h2>
        <div className="target-dist">
          <div className="target-dist-bar">
            <div
              className="target-dist-placed"
              style={{ width: `${(DATASET_META.placed / DATASET_META.rows) * 100}%` }}
            >
              <span>Placed: {DATASET_META.placed.toLocaleString()}</span>
            </div>
            <div className="target-dist-not">
              <span>Not Placed: {DATASET_META.notPlaced.toLocaleString()}</span>
            </div>
          </div>
          <p className="text-tertiary font-mono" style={{ fontSize: '0.6875rem', marginTop: 8 }}>
            Target: {DATASET_META.target}
          </p>
        </div>
      </section>

      {/* Feature Dictionary */}
      <section className="ml-section">
        <h2 className="ml-section-title">Feature dictionary</h2>
        <div className="table-container">
          <table aria-label="Feature dictionary">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Category</th>
                <th>Type</th>
                <th>Range</th>
                <th>Required</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_DEFINITIONS.map((f) => (
                <tr key={f.key}>
                  <td className="font-mono" style={{ fontSize: '0.75rem' }}>{f.key}</td>
                  <td><span className="badge badge-neutral">{f.category}</span></td>
                  <td className="font-mono">{f.type}</td>
                  <td className="font-mono">
                    {f.type === 'number'
                      ? `${f.min ?? '—'}–${f.max ?? '—'}`
                      : f.options?.join(', ') ?? '—'}
                  </td>
                  <td>{f.required ? 'Yes' : 'No'}</td>
                  <td style={{ fontSize: '0.8125rem', maxWidth: 280 }}>{f.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Excluded Features */}
      <section className="ml-section">
        <h2 className="ml-section-title">
          <Shield size={18} />
          Excluded from prediction
        </h2>
        <div className="ml-excluded">
          {DATASET_META.excludedFromPrediction.map((col) => (
            <span key={col} className="badge badge-error font-mono">{col}</span>
          ))}
        </div>

        {/* Salary leakage */}
        <div className="notice notice-warning" style={{ marginTop: 16 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Salary leakage</strong>
            <p style={{ marginTop: 4 }}>{DATASET_META.salaryLeakageExplanation}</p>
          </div>
        </div>
      </section>

      {/* Preprocessing Plan */}
      <section className="ml-section">
        <h2 className="ml-section-title">
          <GitBranch size={18} />
          Preprocessing plan
        </h2>
        <div className="ml-preprocess">
          <div className="ml-preprocess-step">
            <span className="font-mono ml-step-num">1</span>
            <div>
              <strong>Drop leaked and ID features</strong>
              <p className="text-secondary">Remove student_id and salary_package_lpa before any modelling.</p>
            </div>
          </div>
          <div className="ml-preprocess-step">
            <span className="font-mono ml-step-num">2</span>
            <div>
              <strong>Encode categorical variables</strong>
              <p className="text-secondary">One-hot or ordinal encode branch, college_tier, gender, volunteer_experience.</p>
            </div>
          </div>
          <div className="ml-preprocess-step">
            <span className="font-mono ml-step-num">3</span>
            <div>
              <strong>Scale numeric features</strong>
              <p className="text-secondary">StandardScaler or MinMaxScaler for numeric columns.</p>
            </div>
          </div>
          <div className="ml-preprocess-step">
            <span className="font-mono ml-step-num">4</span>
            <div>
              <strong>Stratified train-test split</strong>
              <p className="text-secondary">80/20 split preserving target class balance, random_state=42.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Preliminary Model Results */}
      <section className="ml-section">
        <h2 className="ml-section-title">
          <FlaskConical size={18} />
          Model comparison
        </h2>
        <div className="notice notice-warning" style={{ marginBottom: 16 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{PRELIMINARY_RESULTS.label}</span>
        </div>

        <div className="table-container">
          <table aria-label="Model comparison results">
            <thead>
              <tr>
                <th>Model</th>
                <th className="table-num">Accuracy %</th>
                <th className="table-num">Precision %</th>
                <th className="table-num">Recall %</th>
                <th className="table-num">F1 %</th>
                <th className="table-num">ROC-AUC</th>
              </tr>
            </thead>
            <tbody>
              {PRELIMINARY_RESULTS.models.map((m) => (
                <tr key={m.modelName}>
                  <td style={{ fontWeight: 500 }}>{m.modelName}</td>
                  <td className="table-num font-mono">{m.accuracy.toFixed(2)}</td>
                  <td className="table-num font-mono">{m.precision.toFixed(2)}</td>
                  <td className="table-num font-mono">{m.recall.toFixed(2)}</td>
                  <td className="table-num font-mono">{m.f1Score.toFixed(2)}</td>
                  <td className="table-num font-mono">{m.rocAuc.toFixed(4)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid var(--color-border)' }}>
                <td style={{ fontWeight: 500, color: 'var(--color-text-secondary)' }}>Majority-class baseline</td>
                <td className="table-num font-mono">{PRELIMINARY_RESULTS.majorityBaseline.toFixed(2)}</td>
                <td className="table-num font-mono">—</td>
                <td className="table-num font-mono">—</td>
                <td className="table-num font-mono">—</td>
                <td className="table-num font-mono">0.5000</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="ml-notes">
          <h4 style={{ fontSize: '0.8125rem', marginBottom: 8 }}>Notes</h4>
          <ul>
            {PRELIMINARY_RESULTS.notes.map((note, i) => (
              <li key={i} className="text-secondary">{note}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Confusion Matrix / ROC — Awaiting */}
      <section className="ml-section">
        <h2 className="ml-section-title">
          <BarChart3 size={18} />
          Detailed evaluation artifacts
        </h2>
        <div className="ml-awaiting-grid">
          <div className="ml-awaiting-card">
            <h4>Confusion Matrix</h4>
            <div className="ml-awaiting-placeholder">
              <span className="font-mono text-tertiary">Awaiting evaluation artifact</span>
            </div>
          </div>
          <div className="ml-awaiting-card">
            <h4>ROC Curve</h4>
            <div className="ml-awaiting-placeholder">
              <span className="font-mono text-tertiary">Awaiting evaluation artifact</span>
            </div>
          </div>
          <div className="ml-awaiting-card">
            <h4>Feature Importance</h4>
            <div className="ml-awaiting-placeholder">
              <span className="font-mono text-tertiary">Awaiting evaluation artifact</span>
            </div>
          </div>
        </div>
        <p className="text-secondary" style={{ fontSize: '0.8125rem', marginTop: 12 }}>
          These visualizations will be populated when actual model evaluation artifacts are generated.
          They cannot be fabricated from the aggregate metrics reported above.
        </p>
      </section>

      {/* Limitations */}
      <section className="ml-section">
        <h2 className="ml-section-title">Limitations and intended use</h2>
        <div className="ml-limitations">
          <div className="notice notice-warning">
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Dataset provenance</strong>
              <p style={{ marginTop: 4 }}>{DATASET_META.provenance}</p>
            </div>
          </div>

          <ul className="ml-limitations-list">
            <li>
              <strong>Not a hiring predictor.</strong> This tool estimates preparation readiness
              based on self-reported inputs. It does not predict actual placement outcomes.
            </li>
            <li>
              <strong>Preliminary metrics are near-baseline.</strong> The reported model accuracies
              (54–57%) are only marginally above the majority-class baseline (~54.5%), suggesting
              limited predictive signal in the current feature set and modelling approach.
            </li>
            <li>
              <strong>Demographic features included.</strong> The preliminary results used all remaining
              columns including age and gender. A production model should carefully evaluate feature
              inclusion for fairness.
            </li>
            <li>
              <strong>The final ML feature set has not yet been established.</strong> The frontend field
              selection reflects the dataset schema, not a scientifically validated feature set.
            </li>
            <li>
              <strong>Illustrative scores are rule-based.</strong> Current readiness scores use transparent,
              product-defined weights — they are not outputs from a trained model.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
