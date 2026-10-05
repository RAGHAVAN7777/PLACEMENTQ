import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speechMotion } from '../src/features/interview/avatar/speechMotion.ts';

const cue = { active: true, text: 'Explain your project and its tradeoffs.', charIndex: 0, startedAt: 1000, boundaryAt: 1000, rate: 0.94 };

function assertMovingThroughout(value) {
  for (let second = 0; second < 20; second++) {
    const jaws = Array.from({ length: 30 }, (_, frame) => speechMotion(value, 1000 + second * 1000 + frame * 1000 / 30).jaw);
    assert.ok(Math.max(...jaws) > 0.5, `Must visibly open in second ${second}`);
    assert.ok(Math.min(...jaws) < 0.05, `Must close between syllables in second ${second}`);
  }
}

test('speech stays animated when a Windows voice supplies no boundaries', () => {
  assertMovingThroughout(cue);
});

test('a single stale word boundary ending on a closed consonant never freezes the lips', () => {
  assertMovingThroughout({ ...cue, text: 'map', boundaryAt: 1020 });
});

test('end, mute, interruption, pause and errors immediately close the mouth', () => {
  for (const time of [1200, 5000, 90000]) {
    assert.deepEqual(speechMotion({ ...cue, active: false }, time), { jaw: 0, round: 0, wide: 0 });
    assert.deepEqual(speechMotion(null, time), { jaw: 0, round: 0, wide: 0 });
  }
});

test('lip shapes stay bounded across rates and resume with fresh timing', () => {
  for (const rate of [0.5, 0.94, 1.5, 2]) {
    for (let frame = 0; frame < 180; frame++) {
      const motion = speechMotion({ ...cue, rate, boundaryAt: 2000, charIndex: 12 }, 2000 + frame * 1000 / 30);
      for (const value of Object.values(motion)) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
    }
  }
});
