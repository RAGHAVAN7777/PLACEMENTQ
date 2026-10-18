import test from 'node:test';
import assert from 'node:assert/strict';

process.env.PLACEMENTIQ_DATA_DIR = 'server/data/test-runtime/xai';
process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:9';
process.env.OLLAMA_MODEL = 'qwen3:4b-instruct';

const { baselineSchema, baselineExplain, baselineCounterfactual } = await import('../src/baseline.mjs');
const { getQuestionBank, analyzeSpeechDelivery } = await import('../src/coordinator.mjs');
const { config, setActiveOllamaModel } = await import('../src/config.mjs');

test('speech delivery telemetry analyzes WPM, filler words, and clarity', () => {
  assert.equal(analyzeSpeechDelivery('A typed answer has no measured duration.'), null);
  for (const durationSeconds of [NaN, Infinity, -1, 0, 91]) assert.equal(analyzeSpeechDelivery('Invalid duration.', { durationSeconds }), null);
  const answerWithFillers = 'Well, um, basically in React, like, the virtual DOM is um updated, and actually reconciliation happens, you know.';
  const metrics = analyzeSpeechDelivery(answerWithFillers, { durationSeconds: 8 });
  assert.ok(metrics);
  assert.equal(metrics.wordCount > 10, true);
  assert.ok(metrics.totalFillers >= 4);
  assert.equal(metrics.detectedFillers['um'], 2);
  assert.equal(metrics.detectedFillers['basically'], 1);
  assert.equal(metrics.detectedFillers['like'], 1);
  assert.ok(metrics.clarityScore < 85);
  assert.match(metrics.coachingTip, /filler words/i);

  const cleanAnswer = 'React reconciliation compares virtual DOM trees using a heuristic algorithm to calculate the minimal set of DOM operations.';
  const cleanMetrics = analyzeSpeechDelivery(cleanAnswer, { durationSeconds: 7 });
  assert.ok(cleanMetrics);
  assert.equal(cleanMetrics.totalFillers, 0);
  assert.equal(cleanMetrics.pace, 'Optimal');
  assert.ok(cleanMetrics.clarityScore >= 80);
});

test('question bank contains expanded engineering domains and schema integrity', async () => {
  const bank = await getQuestionBank();
  assert.ok(bank.questions.length >= 16);

  const reactQuestion = bank.questions.find((q) => q.id === 'react_reconciliation_01');
  assert.ok(reactQuestion);
  assert.equal(reactQuestion.domain, 'Frontend & TypeScript');
  assert.equal(reactQuestion.criteria.reduce((sum, c) => sum + c.maxPoints, 0), reactQuestion.maxPoints);

  const grpcQuestion = bank.questions.find((q) => q.id === 'rest_vs_grpc_01');
  assert.ok(grpcQuestion);
  assert.equal(grpcQuestion.domain, 'Backend & Systems');

  const dsaQuestion = bank.questions.find((q) => q.id === 'binary_tree_traversal_01');
  assert.ok(dsaQuestion);
  assert.equal(dsaQuestion.domain, 'Algorithms & Data Structures');

  const dockerQuestion = bank.questions.find((q) => q.id === 'docker_container_isolation_01');
  assert.ok(dockerQuestion);
  assert.equal(dockerQuestion.domain, 'Cloud & DevOps');
});

test('runtime model switching updates config dynamically', () => {
  const original = config.ollamaModel;
  setActiveOllamaModel('qwen3.5:9b');
  assert.equal(config.ollamaModel, 'qwen3.5:9b');
  setActiveOllamaModel(original);
  assert.equal(config.ollamaModel, original);
});

test('XAI feature attribution produces exact waterfall and top drivers', async () => {
  const profile = {
    age: 21, gender: 'Male', cgpa: 8.5, branch: 'CSE', college_tier: 'Tier 1',
    internships_count: 2, projects_count: 3, certifications_count: 2,
    coding_skill_score: 85, aptitude_score: 80, communication_skill_score: 75,
    logical_reasoning_score: 80, hackathons_participated: 2, github_repos: 8,
    linkedin_connections: 500, mock_interview_score: 80, attendance_percentage: 90,
    backlogs: 0, extracurricular_score: 75, leadership_score: 70, volunteer_experience: 'Yes',
    sleep_hours: 7, study_hours_per_day: 4,
  };

  const explanation = await baselineExplain(profile);
  assert.ok(explanation);
  assert.equal(typeof explanation.baseProbability, 'number');
  assert.equal(typeof explanation.finalProbability, 'number');
  assert.ok(Array.isArray(explanation.attributions));
  assert.ok(explanation.attributions.length >= 15);
  assert.ok(Array.isArray(explanation.topDrivers));
  assert.ok(Array.isArray(explanation.waterfall));
  assert.ok(explanation.waterfall.length >= 5);
  assert.equal(explanation.waterfall[0].type, 'base');
  assert.equal(explanation.waterfall[explanation.waterfall.length - 1].type, 'total');
  assert.equal(explanation.method, 'ordered-reference-path-v1');
  const total = explanation.baseProbability + explanation.waterfall.reduce((sum, step) => sum + step.delta, 0);
  assert.ok(Math.abs(total - explanation.finalProbability) < 1e-8);
  assert.ok(Math.abs(explanation.attributions.reduce((sum, item) => sum + item.contributionPct, explanation.baseProbability) - explanation.finalProbability) < 1e-8);
  assert.match(explanation.summaryText, /synthetic reference/);
});

test('counterfactual optimization generates prescriptive roadmap to target probability', async () => {
  const weakProfile = {
    age: 21, gender: 'Male', cgpa: 6.8, branch: 'CSE', college_tier: 'Tier 2',
    internships_count: 0, projects_count: 1, certifications_count: 0,
    coding_skill_score: 50, aptitude_score: 52, communication_skill_score: 55,
    logical_reasoning_score: 50, hackathons_participated: 0, github_repos: 1,
    linkedin_connections: 50, mock_interview_score: 50, attendance_percentage: 75,
    backlogs: 2, extracurricular_score: 45, leadership_score: 40, volunteer_experience: 'No',
    sleep_hours: 6, study_hours_per_day: 2,
  };

  const plan = await baselineCounterfactual(weakProfile, 0.80);
  assert.ok(plan);
  assert.equal(plan.targetProbability, 80);
  assert.ok(plan.achievedProbability >= 80);
  assert.ok(plan.achievedProbability <= 100);
  assert.equal(plan.targetReached, true);
  assert.ok(plan.recommendedActions.length > 0);

  // Backlogs must be cleared first as critical priority
  const backlogAction = plan.recommendedActions.find((a) => a.feature === 'backlogs');
  assert.ok(backlogAction);
  assert.equal(backlogAction.to, 0);
  assert.equal(backlogAction.priority, 'critical');

  // Immutable features must never be modified
  assert.equal(plan.optimizedInputs.branch, weakProfile.branch);
  assert.equal(plan.optimizedInputs.gender, weakProfile.gender);
  assert.equal(plan.optimizedInputs.cgpa, weakProfile.cgpa);
});

test('invalid baseline bodies and target units are rejected before spawning Python', async () => {
  for (const inputs of [null, [], 'profile']) {
    await assert.rejects(baselineExplain(inputs), error => error.status === 400);
  }
  for (const target of [null, '80', 80, true, -1, NaN, Infinity]) {
    await assert.rejects(baselineCounterfactual({}, target), error => error.status === 400);
  }
});
