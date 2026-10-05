import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

process.env.PLACEMENTIQ_DATA_DIR = 'server/data/test-runtime/workflow';
process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:9';
process.env.OLLAMA_MAX_RETRIES = '0';

const { createApiServer } = await import('../src/server.mjs');
const { getSession, listReports, resetStoreForTests } = await import('../src/persistence.mjs');
const { getQuestionBank } = await import('../src/coordinator.mjs');
const { aggregateAnswers, deterministicGrade, validateModelGrade } = await import('../src/scoring.mjs');
const { getOllamaStatus, generateStructured } = await import('../src/ollama.mjs');
const { extractProfileDeterministically } = await import('../src/profile-extractor.mjs');
const { previewGitHub } = await import('../src/github.mjs');
const owner = 'student_workflow_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const stranger = 'student_workflow_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

async function withApi(run) {
  await resetStoreForTests();
  const server = createApiServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, method = 'GET', body, identity = owner) => {
    const response = await fetch(`${base}/api${path}`, { method, headers: { 'Content-Type': 'application/json', 'X-PlacementIQ-Owner': identity }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  try { await run(call, base); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

async function prepare(call, base) {
  const created = await call('/sessions', 'POST', {});
  const id = created.body.session.id;
  let result = await call(`/sessions/${id}/resume`, 'POST', { pastedText: 'B.Tech student at a university. Built a Python placement classifier using machine learning. Used SQL to inspect project records.' });
  assert.equal(result.status, 200);
  const profile = result.body.session.profile;
  Object.values(profile).flat().forEach((claim) => { claim.confirmed = true; });
  result = await call(`/sessions/${id}/profile`, 'PATCH', { profile });
  assert.equal(result.status, 200);
  await call(`/sessions/${id}/github`, 'POST', { skipped: true });
  const analysis = await fetch(`${base}/api/sessions/${id}/analyze`, { method: 'POST', headers: { 'X-PlacementIQ-Owner': owner } });
  const events = (await analysis.text()).trim().split('\n').map(JSON.parse);
  assert.equal(events.at(-1).type, 'complete');
  assert.equal(events.at(-1).session.status, 'domain-selection');
  result = await call(`/sessions/${id}/start`, 'POST', { domain: 'Machine learning' });
  assert.equal(result.status, 200);
  return result.body.session;
}

test('complete HTTP practice journey, pause/resume, protected rubrics, restart persistence and reassessment', async () => {
  await withApi(async (call, base) => {
    let session = await prepare(call, base);
    const id = session.id;
    assert.equal(session.questions[1].prompt, '');
    assert.equal(session.questions[0].referenceAnswer, undefined);
    assert.equal(session.questions[0].criteria, undefined);
    assert.equal(session.questions[0].hint, undefined);
    assert.equal(session.model.liveInference, false);
    assert.equal((await call(`/sessions/${id}/pause`, 'POST', {})).body.session.status, 'paused');
    assert.equal((await call(`/sessions/${id}/answer`, 'POST', { answer: 'No answer while paused.' })).status, 409);
    assert.equal((await call(`/sessions/${id}/resume`, 'POST', {})).body.session.status, 'interview');
    const bank = await getQuestionBank();
    let completed;
    while (session.status === 'interview') {
      const question = session.questions[session.questionIndex];
      const answer = bank.questions.find((item) => item.id === question.bankId).referenceAnswer;
      completed = await call(`/sessions/${id}/answer`, 'POST', { questionId: question.id, answer });
      assert.equal(completed.status, 200);
      session = completed.body.session;
      assert.ok(session.answers.length <= 8);
    }
    assert.equal(session.status, 'completed');
    const report = completed.body.report;
    assert.ok(report.provenance.questionSnapshots.every((question) => question.criteria && question.referenceAnswer));
    assert.ok(report.questions.every((answer) => answer.grade.method === 'deterministic-rubric' && answer.grade.reviewNeeded));
    assert.equal((await call(`/sessions/${id}/report`, 'POST', {})).body.report.id, report.id);
    assert.equal((await listReports(owner)).length, 1);
    assert.equal((await call(`/sessions/${id}/resume`, 'POST', { pastedText: 'Cannot overwrite a completed assessment.' })).status, 409);
    const restarted = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', `import { getSession, getReport } from './src/persistence.mjs'; const s=await getSession(${JSON.stringify(id)}, ${JSON.stringify(owner)});const r=await getReport(s.reportId, ${JSON.stringify(owner)}); console.log(JSON.stringify({status:s.status,report:r.id}));`], { env: process.env });
    assert.deepEqual(JSON.parse(restarted.stdout), { status: 'completed', report: report.id });

    session = await prepare(call, base);
    while (session.status === 'interview') {
      completed = await call(`/sessions/${session.id}/answer`, 'POST', { questionId: session.questions[session.questionIndex].id, skipped: true });
      session = completed.body.session;
    }
    assert.equal(completed.body.report.assessment.score, 0);
    assert.ok(completed.body.report.assessment.skills.every((skill) => skill.result === 'insufficient evidence' && skill.score === null));
    assert.ok(completed.body.report.comparison.length > 0);
  });
});

test('concurrent and stale answers cannot advance the same question twice', async () => {
  await withApi(async (call, base) => {
    const session = await prepare(call, base);
    const payload = { questionId: session.questions[0].id, answer: 'Leakage makes validation accuracy inflated because the model can see the outcome.' };
    const results = await Promise.all([call(`/sessions/${session.id}/answer`, 'POST', payload), call(`/sessions/${session.id}/answer`, 'POST', payload)]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    const current = (await call(`/sessions/${session.id}`)).body.session;
    assert.equal(current.answers.length, 1);
    assert.equal(current.questions[current.questionIndex].followUp, true);
    assert.doesNotMatch(current.questions[current.questionIndex].prompt, /If the answer|ask the student/);
    assert.equal(current.answers[0].feedbackDeferred, true);
    assert.deepEqual(current.answers[0].grade.missingConcepts, []);
    assert.equal((await call(`/sessions/${session.id}/answer`, 'POST', payload)).status, 409);
  });
});

test('ownership and state checks happen before extraction, GitHub access, and streamed analysis', async () => {
  await withApi(async (call) => {
    const id = (await call('/sessions', 'POST', {})).body.session.id;
    for (const [path, body] of [['resume', { contentBase64: 'invalid' }], ['github', { repositories: [{ owner: 'example', name: 'private' }] }], ['analyze', {}], ['hint', {}], ['report', {}]]) {
      assert.equal((await call(`/sessions/${id}/${path}`, 'POST', body, stranger)).status, 404);
    }
    assert.equal((await call(`/sessions/${id}/profile`, 'PATCH', { profile: {} })).status, 409);
    assert.equal((await call(`/sessions/${id}/start`, 'POST', { domain: 'Python' })).status, 409);
    assert.equal((await call('/sessions', 'POST', null)).status, 201); // creation does not accept or inspect arbitrary profile data
    assert.deepEqual((await call('/sessions', 'GET', undefined, stranger)).body.sessions, []);
  });
});

test('student corrections cannot claim a fabricated resume source', async () => {
  await withApi(async (call) => {
    const id = (await call('/sessions', 'POST', {})).body.session.id;
    let result = await call(`/sessions/${id}/resume`, 'POST', { pastedText: 'Built a Python project with SQL queries for placement records.' });
    const profile = result.body.session.profile;
    const original = profile.skills[0];
    original.sourcePassage = 'I am an expert in Kubernetes production clusters.';
    original.name = 'Kubernetes'; original.origin = 'resume'; original.confirmed = true;
    result = await call(`/sessions/${id}/profile`, 'PATCH', { profile });
    assert.equal(result.body.session.profile.skills[0].origin, 'student-correction');
    assert.equal((await getSession(id, owner)).resume.text, 'Built a Python project with SQL queries for placement records.');
  });
});

test('model responses require complete criteria and suspect evidence requires review', async () => {
  const question = (await getQuestionBank()).questions[0];
  assert.equal(validateModelGrade(question, 'some response', { criteria: [] }), null);
  const result = validateModelGrade(question, 'An actual answer.', { criteria: question.criteria.map((criterion) => ({ criterionId: criterion.id, points: 99, evidenceExcerpt: 'invented quote', explanation: 'An estimate' })), missingConcepts: [], explanation: 'Estimated', reviewNeeded: false, uncertainty: 'low' });
  assert.equal(result.awardedPoints, 0); assert.equal(result.reviewNeeded, true); assert.equal(result.uncertainty, 'high');
  const aggregate = aggregateAnswers([{ skill: 'Python', grade: { awardedPoints: Infinity, maxPoints: 4 } }, { skill: 'SQL', grade: { awardedPoints: 999, maxPoints: 4 } }]);
  assert.equal(aggregate.score, 50);
});

test('source identities are unique, retain exact whitespace and recognise C++', () => {
  const source = 'Built a  Python project for students.\nBuilt a  Python project for teachers.\nSkilled in C++ programming.';
  const profile = extractProfileDeterministically(source);
  assert.equal(new Set(profile.projects.map((claim) => claim.id)).size, 2);
  assert.ok(profile.skills.some((claim) => claim.name === 'C++'));
  assert.ok(Object.values(profile).flat().every((claim) => source.includes(claim.sourcePassage)));
});

test('keyword matching does not award substring credit or mistake skipped work for assessed skill', async () => {
  const question = (await getQuestionBank()).questions.find((item) => item.id === 'python_errors_02');
  const grade = deterministicGrade(question, 'Without knowledge, my prototype is unsuitable.');
  assert.equal(grade.criteria.find((criterion) => criterion.criterionId === 'resources').points, 0);
  assert.equal(grade.criteria.find((criterion) => criterion.criterionId === 'validation').points, 0);
  const skipped = deterministicGrade(question, '', { skipped: true });
  assert.equal(aggregateAnswers([{ skill: 'Python', skipped: true, grade: skipped }]).skills[0].result, 'insufficient evidence');
});

test('missing exact configured model does not silently use another model tag', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ models: [{ name: 'qwen3:latest' }] }));
  try {
    const status = await getOllamaStatus();
    assert.equal(status.installed, false); assert.equal(status.mode, 'local-practice');
  } finally { globalThis.fetch = originalFetch; }
});

test('malformed inference falls back explicitly and concurrent inference stays serial', async () => {
  const originalFetch = globalThis.fetch;
  let active = 0; let peak = 0; let malformed = false;
  globalThis.fetch = async (url) => {
    if (url.endsWith('/api/tags')) return new Response(JSON.stringify({ models: [{ name: 'qwen3:4b-instruct' }] }));
    if (url.endsWith('/api/show')) return new Response(JSON.stringify({ capabilities: ['completion'] }));
    active += 1; peak = Math.max(active, peak);
    await new Promise((resolve) => setTimeout(resolve, 15)); active -= 1;
    return new Response(JSON.stringify({ response: malformed ? 'not JSON' : '{"ok":true}' }));
  };
  try {
    const input = { system: 'Test fixture', prompt: 'Fixture', schema: { type: 'object' } };
    const results = await Promise.all([generateStructured(input), generateStructured(input)]);
    assert.ok(results.every((result) => result.available)); assert.equal(peak, 1);
    malformed = true;
    const result = await generateStructured(input);
    assert.equal(result.available, false); assert.match(result.status.message, /inference failed/i);
  } finally { globalThis.fetch = originalFetch; }
});

test('GitHub secondary rate limits and unavailable repositories are actionable', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('{}', { status: 429, headers: { 'retry-after': '30' } });
    await assert.rejects(previewGitHub('https://github.com/secondary-limit-fixture'), (error) => error.code === 'github_rate_limited' && error.details.retryAfterSeconds === '30');
    globalThis.fetch = async () => new Response('{}', { status: 404 });
    await assert.rejects(previewGitHub('https://github.com/unavailable-fixture'), (error) => error.code === 'github_not_found');
  } finally { globalThis.fetch = originalFetch; }
});

test('failed or invalid live inference never advances a session with fabricated fallback output', async () => {
  const { createSession, updateSession } = await import('../src/persistence.mjs');
  const { ingestResume, answerQuestion } = await import('../src/coordinator.mjs');
  const session = await createSession(owner);
  const originalFetch = globalThis.fetch;
  const bank = await getQuestionBank();
  let modelOutput = 'not JSON';
  globalThis.fetch = async (url) => {
    if (url.endsWith('/api/tags')) return new Response(JSON.stringify({ models: [{ name: 'qwen3:4b-instruct' }] }));
    if (url.endsWith('/api/show')) return new Response(JSON.stringify({ capabilities: ['completion'] }));
    return new Response(JSON.stringify({ response: modelOutput }));
  };
  try {
    await assert.rejects(ingestResume(session.id, owner, { text: 'Built a Python project in my university course.', fileName: 'fixture.txt' }), (error) => error.code === 'local_inference_failed');
    assert.equal((await getSession(session.id, owner)).status, 'resume');
    await updateSession(session.id, owner, (item) => ({ ...item, status: 'interview', questions: [{ ...bank.questions[0], bankId: bank.questions[0].id }], questionIndex: 0 }));
    modelOutput = '{"criteria":[]}';
    await assert.rejects(answerQuestion(session.id, owner, { answer: 'A list can change in place while a string cannot.' }), (error) => error.code === 'invalid_model_grade');
    assert.equal((await getSession(session.id, owner)).answers.length, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('invalid model evidence retries once and never turns formatting errors into student deductions', async () => {
  const { createSession, updateSession } = await import('../src/persistence.mjs');
  const { answerQuestion } = await import('../src/coordinator.mjs');
  const session = await createSession(owner);
  const bank = await getQuestionBank();
  const question = bank.questions[0];
  const answer = 'Lists change in place while strings need a new object; aliasing can unexpectedly share updates.';
  await updateSession(session.id, owner, (item) => ({ ...item, status: 'interview', questions: [question, bank.questions[1]], questionIndex: 0, model: { ...item.model, liveInference: true } }));
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let repairValid = false;
  globalThis.fetch = async (url) => {
    if (url.endsWith('/api/tags')) return new Response(JSON.stringify({ models: [{ name: 'qwen3:4b-instruct' }] }));
    if (url.endsWith('/api/show')) return new Response(JSON.stringify({ capabilities: ['completion'] }));
    calls += 1;
    const valid = repairValid && calls % 2 === 0;
    const output = { criteria: question.criteria.map((criterion) => ({ criterionId: criterion.id, points: criterion.maxPoints, evidenceExcerpt: valid ? answer : 'A fabricated quote not present in the response.', explanation: 'Fixture only' })), missingConcepts: [], explanation: 'Fixture only', uncertainty: 'low', reviewNeeded: false, nextAction: 'advance', followUpQuestion: '', acknowledgement: 'Recorded' };
    return new Response(JSON.stringify({ response: JSON.stringify(output) }));
  };
  try {
    await assert.rejects(answerQuestion(session.id, owner, { answer }), (error) => error.code === 'invalid_model_evidence');
    assert.equal(calls, 2);
    assert.equal((await getSession(session.id, owner)).answers.length, 0);
    repairValid = true;
    const result = await answerQuestion(session.id, owner, { answer });
    assert.equal(calls, 4);
    assert.equal(result.answer.grade.awardedPoints, question.maxPoints);
    assert.equal(result.session.inferenceMetrics[`grading_${result.answer.id}`].evidenceRetry, true);
    assert.equal(result.session.answers.length, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('merging grounded model extraction with lexical discovery does not duplicate claims', async () => {
  const { mergeProfile } = await import('../src/coordinator.mjs');
  const source = 'Built a Python project at university.';
  const fallback = extractProfileDeterministically(source);
  const primary = { ...fallback, skills: [{ name: 'Python', sourcePassage: 'Python', confidence: 'model-extracted' }], projects: [{ name: 'A Python project', sourcePassage: source }] };
  const merged = mergeProfile(primary, fallback);
  assert.equal(merged.skills.length, 1);
  assert.equal(merged.projects.length, 1);
  const prefixed = { ...fallback, projects: [{ name: 'Project entry', sourcePassage: `Project: ${source}` }] };
  assert.equal(mergeProfile(primary, prefixed).projects.length, 1);
});

test('a live session cannot silently switch to practice questions when Ollama disconnects', async () => {
  const { createSession, updateSession } = await import('../src/persistence.mjs');
  const { startInterview } = await import('../src/coordinator.mjs');
  const session = await createSession(owner);
  await updateSession(session.id, owner, (item) => ({ ...item, status: 'domain-selection', domains: [{ domain: 'Python' }], suggestedDomain: 'Python', model: { ...item.model, liveInference: true } }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Connection refused'); };
  try {
    await assert.rejects(startInterview(session.id, owner, 'Python'), (error) => error.code === 'local_inference_failed');
    const saved = await getSession(session.id, owner);
    assert.equal(saved.status, 'domain-selection');
    assert.equal(saved.questions.length, 0);
  } finally { globalThis.fetch = originalFetch; }
});


test('unusable conversational reply keeps the same question and saves no invented dialogue', async () => {
  const { createSession, updateSession } = await import('../src/persistence.mjs');
  const { answerQuestion } = await import('../src/coordinator.mjs');
  const session = await createSession(owner);
  const question = (await getQuestionBank()).questions[0];
  const answer = 'Lists change in place while strings need a new object; aliases share updates.';
  await updateSession(session.id, owner, s => ({ ...s, status: 'interview', questions: [question], versions: {...s.versions, conversation: '1.0.0'}, model: {...s.model, liveInference: true} }));
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    if (url.endsWith('/api/tags')) return new Response(JSON.stringify({models:[{name:'qwen3:4b-instruct'}]}));
    if (url.endsWith('/api/show')) return new Response(JSON.stringify({capabilities:['completion']}));
    const output = { criteria: question.criteria.map(c => ({criterionId:c.id,points:c.maxPoints,evidenceExcerpt:answer,explanation:'Test fixture'})), missingConcepts:[], explanation:'Test fixture', uncertainty:'low', reviewNeeded:false, nextAction:'advance', acknowledgement:'Great!', responseKind:'confirm', answerAnchor:'Lists change in place' };
    return new Response(JSON.stringify({response:JSON.stringify(output)}));
  };
  try {
    await assert.rejects(answerQuestion(session.id, owner, {questionId:question.id, answer}), e => e.code === 'invalid_model_evidence');
    const saved = await getSession(session.id, owner);
    assert.equal(saved.questionIndex, 0); assert.equal(saved.answers.length, 0); assert.equal(saved.conversation, undefined);
  } finally { globalThis.fetch = previousFetch; }
});
