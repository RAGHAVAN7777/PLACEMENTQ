import test from 'node:test';
import assert from 'node:assert/strict';
import { explanationView } from '../src/services/modelResults.ts';

test('sub-one-percent probabilities and contributions keep their percent units', () => {
  const result = explanationView({ baseProbability: 0.2, finalProbability: 0.8,
    waterfall: [{ step: 'Coding', delta: 0.6, type: 'positive', studentValue: 50 }],
    topDrivers: [{ feature: 'coding', label: 'Coding', studentValue: 50, contributionPct: 0.6 }], topDrags: [] });
  assert.equal(result.base, 0.002);
  assert.equal(result.final, 0.008);
  assert.equal(result.steps[0].impact, 0.006);
  assert.equal(result.drivers[0].attribution, 0.006);
  assert.equal(result.steps.length, 1);
});

test('historical waterfalls reconcile omitted effects explicitly without clipping', () => {
  const result = explanationView({ baseProbability: 90, finalProbability: 80,
    waterfall: [{ step: 'A', delta: 20, type: 'positive' }, { step: 'B', delta: -25, type: 'negative' }],
    topDrivers: [], topDrags: [] });
  assert.equal(result.steps[0].runningProbability, 1.1);
  assert.ok(Math.abs(result.steps.at(-1).impact + 0.05) < 1e-12);
  assert.equal(result.steps.at(-1).runningProbability, result.final);
});
