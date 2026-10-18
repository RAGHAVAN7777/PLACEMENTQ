import test from 'node:test';
import assert from 'node:assert/strict';
import { computeReadinessScore, computeSkillGaps } from '../src/services/prediction.ts';

test('active backlogs remain a gap even though their target is zero', () => {
  const gap = computeSkillGaps({ backlogs: 3 }).find(item => item.feature === 'backlogs');
  assert.equal(gap.gap, 3);
  assert.match(gap.suggestedAction, /Clear 3 pending backlogs/);
  assert.equal(computeSkillGaps({ backlogs: 0 })[0].gap, 0);
});

test('invalid and extreme browser inputs cannot inflate a weighted feature', () => {
  assert.equal(computeReadinessScore({ cgpa: 1000 }).score, 15);
  assert.equal(computeReadinessScore({ cgpa: -1 }).score, 0);
  const result = computeReadinessScore({ cgpa: NaN, coding_skill_score: Infinity });
  assert.equal(result.score, 0);
  assert.deepEqual(result.contributions, []);
});
