import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateAnswers, selectScoredAnswers, validateModelGrade } from '../src/scoring.mjs';

const attempt = (questionId, group, points, hint = false, skipped = false) => ({ questionId, questionGroupId: group, skill: 'Python', hintUsed: hint, skipped, grade: { awardedPoints: points, maxPoints: 4, reviewNeeded: false, evidenceStatus: skipped ? 'insufficient evidence' : 'assessed' } });
test('follow-up keeps one denominator and cannot reduce an already demonstrated score', () => {
  const result = aggregateAnswers([attempt('q1', 'q1', 3), attempt('q1f', 'q1', 1), attempt('q2', 'q2', 2)]);
  assert.equal(result.score, 63);
  assert.equal(result.maxPoints, 8);
  assert.equal(result.totalPoints, 5);
  assert.equal(result.scoredQuestions, 2);
  assert.equal(result.recordedAttempts, 3);
});
test('valid clarification improves the original score but a skip cannot inflate it', () => {
  const result = aggregateAnswers([attempt('q1', 'q1', 1), attempt('q1f', 'q1', 3), attempt('q2', 'q2', 0, false, true)]);
  assert.equal(result.score, 38);
  assert.equal(result.totalPoints, 3);
  assert.equal(result.maxPoints, 8);
  assert.equal(aggregateAnswers([attempt('q1', 'q1', 0, false, true)]).score, 0);
  const original = { ...attempt('q1', 'q1', 1), grade: { ...attempt('q1', 'q1', 1).grade, missingConcepts: ['Aliasing'] } };
  const clarification = { ...attempt('q1f', 'q1', 4), grade: { ...attempt('q1f', 'q1', 4).grade, missingConcepts: [] } };
  assert.deepEqual(selectScoredAnswers([original, clarification]).flatMap((answer) => answer.grade.missingConcepts), []);
});
test('partial evidence gets bounded fractional credit and hint caps remain intact', () => {
  const question = { maxPoints: 4, criteria: [{ id: 'c', label: 'Concept', maxPoints: 4 }] };
  const output = { criteria: [{ criterionId: 'c', points: 3.5, evidenceExcerpt: 'A list changes in place.', explanation: 'Relevant partial reasoning.' }], missingConcepts: [], explanation: 'Partial', uncertainty: 'low', reviewNeeded: false };
  const grade = validateModelGrade(question, 'A list changes in place.', output, { hintUsed: true });
  assert.equal(grade.rawPoints, 3.5);
  assert.equal(grade.awardedPoints, 2.8);
  assert.equal(aggregateAnswers([attempt('q1', 'q1', grade.awardedPoints, true), attempt('q1f', 'q1', 2, true)]).score, 70);
});

test('model ellipses restore only exact ordered source evidence without penalising the student', () => {
  const question = { maxPoints: 1, criteria: [{ id: 'examples', label: 'Examples', maxPoints: 1 }] };
  const answer = 'Mutating a list changes the same object in place; strings and integers need a new object.';
  const output = (excerpt) => ({ criteria: [{ criterionId: 'examples', points: 1, evidenceExcerpt: excerpt, explanation: 'Correct examples.' }], missingConcepts: [], explanation: 'Correct', uncertainty: 'low', reviewNeeded: false });
  const grade = validateModelGrade(question, answer, output('Mutating a list...strings and integers need a new object.'));
  assert.equal(grade.awardedPoints, 1);
  assert.equal(grade.criteria[0].evidenceExcerpt, answer);
  assert.equal(grade.reviewNeeded, false);
  const typographic = validateModelGrade(question, 'Catch the parser’s documented error.', output("Catch the parser's documented error."));
  assert.equal(typographic.awardedPoints, 1);
  assert.equal(typographic.criteria[0].evidenceExcerpt, 'Catch the parser’s documented error.');
  for (const quote of ['Mutating a list...tuples are mutable', 'strings and integers...Mutating a list', 'Mutating...object.']) {
    const rejected = validateModelGrade(question, answer, output(quote));
    assert.equal(rejected.awardedPoints, 0);
    assert.equal(rejected.reviewNeeded, true);
  }
});
