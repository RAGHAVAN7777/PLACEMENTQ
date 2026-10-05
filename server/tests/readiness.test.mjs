import test from 'node:test';
import assert from 'node:assert/strict';
import { compareReadiness, validatePolicy, readinessPolicy } from '../src/readiness-policy.mjs';
import { resumePrefill } from '../src/baseline.mjs';

const baseline = score => ({ score, inputs: { cgpa: 8, backlogs: 0, aptitude_score: 70, internships_count: 2, projects_count: 3 } });
const report = score => ({ assessment: { score, maxPoints: 10, skills: [{ skill: 'Python', score, result: 'assessed' }] }, questions: [{ grade: { uncertainty: 'low', reviewNeeded: false, evidenceStatus: 'assessed' } }] });
for (const [b, i, expected] of [
  [80, 80, 'Placement Ready'],
  [80, 40, 'Profile Strong, Interview Preparation Required'],
  [30, 80, 'Demonstrated Skill Strong, Profile Improvement Required'],
  [30, 40, 'Structured Readiness Development Required'],
]) test(`matrix ${b}/${i}`, () => {
  const result = compareReadiness(baseline(b), report(i), readinessPolicy);
  assert.equal(result.category, expected);
  assert.ok(result.action.steps.length);
  assert.equal(result.composite.value, (b + i) / 2);
});
test('missing results never become zero or a readiness category', () => {
  assert.equal(compareReadiness(null, report(90), readinessPolicy).status, 'missing-baseline');
  assert.equal(compareReadiness(baseline(90), null, readinessPolicy).status, 'missing-interview');
  assert.equal(compareReadiness(null, null, readinessPolicy).composite, null);
});
test('insufficient and unvalidated evidence block the matrix and composite', () => {
  const insufficient = report(0); insufficient.assessment.skills[0].result = 'insufficient evidence';
  assert.equal(compareReadiness(baseline(90), insufficient, readinessPolicy).status, 'insufficient-evidence');
  const invalid = report(90); invalid.questions[0].grade.evidenceValidationFailed = true;
  assert.equal(compareReadiness(baseline(90), invalid, readinessPolicy).composite, null);
});
test('threshold boundaries are inclusive and policy weights must be valid', () => {
  assert.equal(compareReadiness(baseline(50), report(65), readinessPolicy).category, 'Placement Ready');
  for (const weights of [[-1,2],[0.5,0.7],[NaN,0.5]]) assert.throws(() => validatePolicy({ ...readinessPolicy, baselineWeight: weights[0], interviewWeight: weights[1] }));
  assert.throws(() => validatePolicy({ ...readinessPolicy, interviewThreshold: 101 }));
});
test('academic action requires actual weak academic inputs', () => {
  const b = baseline(30); b.inputs.backlogs = 2;
  assert.equal(compareReadiness(b, report(40), readinessPolicy).action.type, 'academic');
});
test('a validated follow-up resolves insufficient evidence in its scored question group', () => {
  const r = report(80);
  r.questions = [
    { questionId: 'initial', questionGroupId: 'same', grade: { maxPoints: 5, awardedPoints: 0, evidenceStatus: 'insufficient evidence' } },
    { questionId: 'followup', questionGroupId: 'same', grade: { maxPoints: 5, awardedPoints: 4, evidenceStatus: 'assessed', uncertainty: 'low', reviewNeeded: false } },
  ];
  assert.equal(compareReadiness(baseline(80), r, readinessPolicy).status, 'complete');
});
test('resume suggestions retain sources and never infer absent values or agent scores', () => {
  const result = resumePrefill({ resume: { fileName: 'example.txt', text: 'CSE CGPA: 8.4/10. Completed 2 internships and 3 projects. Active backlogs: 0.' } });
  assert.equal(result.cgpa.value, 8.4); assert.equal(result.internships_count.value, 2);
  assert.equal(result.backlogs.value, 0); assert.equal(result.cgpa.confirmed, false);
  assert.ok(result.cgpa.passage.includes('8.4')); assert.equal(result.mock_interview_score, undefined);
  assert.deepEqual(resumePrefill({ resume: { text: 'Python projects', fileName: 'minimal.txt' } }), {});
  assert.equal(resumePrefill({ resume: { text: 'B.Tech ME', fileName: 'mechanical.txt' } }).branch.value, 'Mechanical');
  assert.equal(resumePrefill({ resume: { text: 'B.Tech Civil', fileName: 'civil.txt' } }).branch.value, 'Civil');
});
