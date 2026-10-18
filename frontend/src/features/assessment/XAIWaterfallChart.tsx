import React, { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, TrendingDown, HelpCircle, ShieldCheck, ChevronDown } from 'lucide-react';
import { readinessApi, type XAIExplanation } from '../../services/readinessApi';
import { explanationView } from '../../services/modelResults';
import './XAIWaterfallChart.css';

interface XAIWaterfallChartProps {
  explanation?: XAIExplanation | null;
  inputs?: Record<string, string | number>;
  compact?: boolean;
}

export default function XAIWaterfallChart({ explanation: initialExplanation, inputs, compact = false }: XAIWaterfallChartProps) {
  const [explanation, setExplanation] = useState<XAIExplanation | null>(initialExplanation || null);
  const [loading, setLoading] = useState<boolean>(!initialExplanation && !!inputs);
  const [error, setError] = useState<string>('');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    if (initialExplanation) {
      setExplanation(initialExplanation);
      setLoading(false);
      setError('');
      return;
    }

    if (inputs && Object.keys(inputs).length > 0) {
      let active = true;
      setLoading(true);
      setExplanation(null);
      setError('');
      readinessApi.explain(inputs)
        .then(res => {
          if (active) setExplanation(res.explanation);
        })
        .catch(err => {
          if (active) setError(err instanceof Error ? err.message : 'Could not generate XAI attribution');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => { active = false; };
    }
    setExplanation(null);
    setLoading(false);
    setError('');
  }, [initialExplanation, inputs]);

  if (loading) {
    return (
      <div className="xai-waterfall-card">
        <p className="text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles className="spin" size={16} /> Computing model differences from a synthetic reference…
        </p>
      </div>
    );
  }

  if (error || !explanation) {
    if (error) {
      return (
        <div className="xai-waterfall-card">
          <p className="text-secondary" style={{ color: 'var(--color-error, #dc2626)' }}>
            Feature attribution unavailable: {error}
          </p>
        </div>
      );
    }
    return null;
  }

  const { base: normBase, final: normFinal, steps: calculatedWaterfall, drivers, drags } = explanationView(explanation);
  const normNet = normFinal - normBase;
  const summary = explanation.summaryText;

  // Layout parameters for SVG
  const svgWidth = Math.max(860, (calculatedWaterfall.length + 2) * 80);
  const svgHeight = 280;
  const paddingLeft = 60;
  const paddingRight = 40;
  const paddingTop = 40;
  const paddingBottom = 60;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  // Scale: 0% to 100% on Y-axis
  const getY = (prob: number) => {
    const clamped = Math.max(0, Math.min(1, prob));
    return paddingTop + chartHeight * (1 - clamped);
  };

  const totalSteps = 1 + calculatedWaterfall.length + 1; // Base + features + Final
  const stepWidth = chartWidth / totalSteps;
  const barWidth = Math.max(18, Math.min(38, stepWidth * 0.65));

  return (
    <div className={`xai-waterfall-card ${compact ? 'compact' : ''}`}>
      <div className="xai-header">
        <div className="xai-title-wrap">
          <h3>
            <Sparkles size={20} className="text-primary" />
            Explainable AI (XAI) Attribution Waterfall
          </h3>
          <p className="xai-subtitle">
            {explanation.method === 'ordered-reference-path-v1'
              ? 'Ordered model differences from a synthetic reference; results depend on feature order.'
              : 'Historical approximate explanation from a synthetic reference; omitted effects are shown explicitly.'}
          </p>
        </div>
        <div className="xai-meta-pills">
          <span className="xai-pill font-mono">
            Reference: {(normBase * 100).toFixed(1)}%
          </span>
          <span className={`xai-pill font-mono ${normNet >= 0 ? 'positive' : 'negative'}`}>
            {normNet >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            Net Impact: {normNet >= 0 ? '+' : ''}{(normNet * 100).toFixed(1)}% pts
          </span>
          <span className="xai-pill font-mono" style={{ borderColor: 'var(--color-primary, #6366f1)', color: 'var(--color-primary, #6366f1)' }}>
            Predicted: {(normFinal * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="xai-summary-banner">
        <strong>Model Diagnostic:</strong> {summary}
      </div>

      <div className="xai-chart-wrapper">
        <svg
          className="xai-waterfall-svg"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ minWidth: svgWidth }}
          aria-label="Waterfall attribution chart"
        >
          {/* Background grid lines at 0%, 25%, 50%, 75%, 100% */}
          {[0, 0.25, 0.5, 0.75, 1.0].map(tick => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={paddingLeft - 10}
                  y1={y}
                  x2={svgWidth - paddingRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray={tick === 0 || tick === 1 ? undefined : "3 3"}
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 16}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fontFamily="monospace"
                  fill="#94a3b8"
                >
                  {(tick * 100).toFixed(0)}%
                </text>
              </g>
            );
          })}

          {/* 1. Base Probability Column */}
          {(() => {
            const x = paddingLeft + 0 * stepWidth + (stepWidth - barWidth) / 2;
            const y = getY(normBase);
            const h = getY(0) - y;
            return (
              <g
                key="base"
                onMouseEnter={() => setHoveredIndex(-1)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(2, h)}
                  fill="#94a3b8"
                  rx="3"
                />
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="monospace"
                  fill="#475569"
                >
                  {(normBase * 100).toFixed(1)}%
                </text>
                <text
                  x={x + barWidth / 2}
                  y={svgHeight - paddingBottom + 16}
                  textAnchor="middle"
                  fontSize="9"
                  fontFamily="sans-serif"
                  fill="#64748b"
                >
                  Base
                </text>
                {/* Connector line to step 1 */}
                <line
                  x1={x + barWidth}
                  y1={y}
                  x2={x + stepWidth}
                  y2={y}
                  stroke="#cbd5e1"
                  strokeDasharray="2 2"
                />
              </g>
            );
          })()}

          {/* 2. Feature Steps */}
          {calculatedWaterfall.map((step, idx) => {
            const stepColIndex = idx + 1;
            const x = paddingLeft + stepColIndex * stepWidth + (stepWidth - barWidth) / 2;
            
            const prevRunning = stepColIndex === 1
              ? normBase
              : calculatedWaterfall[idx - 1].runningProbability;
            const currRunning = step.runningProbability;

            const yTop = getY(Math.max(prevRunning, currRunning));
            const yBottom = getY(Math.min(prevRunning, currRunning));
            const barH = Math.max(3, yBottom - yTop);

            const isPositive = step.direction === 'positive';
            const barColor = isPositive ? '#10b981' : '#ef4444';

            return (
              <g
                key={`${step.feature}-${idx}`}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={x}
                  y={yTop}
                  width={barWidth}
                  height={barH}
                  fill={barColor}
                  opacity={hoveredIndex === null || hoveredIndex === idx ? 0.9 : 0.4}
                  rx="3"
                />
                {/* Signed impact label */}
                <text
                  x={x + barWidth / 2}
                  y={yTop - 6}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="bold"
                  fontFamily="monospace"
                  fill={barColor}
                >
                  {isPositive ? '+' : ''}{(step.impact * 100).toFixed(1)}%
                </text>
                {/* Feature Name */}
                <text
                  x={x + barWidth / 2}
                  y={svgHeight - paddingBottom + 16}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontFamily="sans-serif"
                  fill="#334155"
                  transform={`rotate(25, ${x + barWidth / 2}, ${svgHeight - paddingBottom + 16})`}
                >
                  {step.label.length > 10 ? step.label.slice(0, 9) + '…' : step.label}
                </text>
                {/* Connector line to next step */}
                <line
                  x1={x + barWidth}
                  y1={getY(currRunning)}
                  x2={x + stepWidth}
                  y2={getY(currRunning)}
                  stroke="#cbd5e1"
                  strokeDasharray="2 2"
                />
              </g>
            );
          })}

          {/* 3. Final Probability Column */}
          {(() => {
            const finalColIndex = totalSteps - 1;
            const x = paddingLeft + finalColIndex * stepWidth + (stepWidth - barWidth) / 2;
            const y = getY(normFinal);
            const h = getY(0) - y;
            return (
              <g
                key="final"
                onMouseEnter={() => setHoveredIndex(999)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(2, h)}
                  fill="var(--color-primary, #6366f1)"
                  rx="3"
                />
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="monospace"
                  fill="var(--color-primary, #6366f1)"
                >
                  {(normFinal * 100).toFixed(1)}%
                </text>
                <text
                  x={x + barWidth / 2}
                  y={svgHeight - paddingBottom + 16}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                  fill="#4338ca"
                >
                  Final
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Top Drivers vs Top Drags */}
      <div className="xai-drivers-grid">
        <div className="xai-driver-column drivers">
          <h4>
            <TrendingUp size={16} /> Top Positive Placement Drivers
          </h4>
          {drivers.length === 0 ? (
            <p className="text-secondary" style={{ fontSize: '0.8125rem' }}>No features positively exceed benchmark.</p>
          ) : (
            drivers.map(d => (
              <div key={d.feature} className="xai-attr-row">
                <div className="xai-attr-feature">
                  <span className="xai-attr-label">{d.label}</span>
                  <span className="xai-attr-val">Your value: {d.value}</span>
                </div>
                <span className="xai-attr-impact positive">
                  +{(d.attribution * 100).toFixed(1)}% pts
                </span>
              </div>
            ))
          )}
        </div>

        <div className="xai-driver-column drags">
          <h4>
            <TrendingDown size={16} /> Top Dragging Factors
          </h4>
          {drags.length === 0 ? (
            <p className="text-secondary" style={{ fontSize: '0.8125rem' }}>No dragging factors below benchmark.</p>
          ) : (
            drags.map(d => (
              <div key={d.feature} className="xai-attr-row">
                <div className="xai-attr-feature">
                  <span className="xai-attr-label">{d.label}</span>
                  <span className="xai-attr-val">Your value: {d.value}</span>
                </div>
                <span className="xai-attr-impact negative">
                  {(d.attribution * 100).toFixed(1)}% pts
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Expandable full attribution breakdown */}
      {!compact && explanation.attributions.length > 0 && (
        <details className="xai-details-toggle">
          <summary>
            View all model differences
          </summary>
          <table className="xai-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Candidate Value</th>
                <th style={{ textAlign: 'right' }}>Marginal Attribution</th>
              </tr>
            </thead>
            <tbody>
              {explanation.attributions.map((attr) => {
                const attrVal = attr.contributionPct;
                return (
                  <tr key={attr.feature}>
                    <td><strong>{attr.label || attr.feature}</strong></td>
                    <td className="font-mono">{attr.studentValue ?? '—'}</td>
                    <td className={`num ${attrVal >= 0 ? 'text-success' : 'text-error'}`} style={{ color: attrVal >= 0 ? '#059669' : '#dc2626' }}>
                      {attrVal >= 0 ? '+' : ''}{Number(attrVal).toFixed(2)}% pts
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
