import type { XAIExplanation } from './readinessApi.ts';

/** API probabilities are percentages, including values below one percent. */
export function explanationView(explanation: XAIExplanation) {
  const base = explanation.baseProbability / 100;
  const final = explanation.finalProbability / 100;
  let running = base;
  const steps = explanation.waterfall.filter(s => s.type !== 'base' && s.type !== 'total').map(s => {
    const impact = s.delta / 100;
    running += impact;
    return { feature: s.step, label: s.step, value: s.studentValue ?? '—', impact,
      direction: impact > 0 ? 'positive' : impact < 0 ? 'negative' : 'neutral', runningProbability: running };
  });
  // Historical explanations omitted smaller effects. Show their remainder
  // explicitly instead of silently clipping or rescaling recorded evidence.
  if (Math.abs(final - running) > 1e-8) {
    const impact = final - running;
    steps.push({ feature: 'remaining', label: 'Other effects / rounding', value: '—', impact,
      direction: impact >= 0 ? 'positive' : 'negative', runningProbability: final });
  }
  const normalize = (d: XAIExplanation['attributions'][number]) => ({
    feature: d.feature, label: d.label, value: d.studentValue, attribution: d.contributionPct / 100,
  });
  return { base, final, steps, drivers: explanation.topDrivers.map(normalize), drags: explanation.topDrags.map(normalize) };
}
