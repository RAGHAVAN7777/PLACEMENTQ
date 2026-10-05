// Explicit opt-in verification. Synthetic student data; never reads personal uploads.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
process.env.PLACEMENTIQ_DATA_DIR = `server/data/test-runtime/live-${Date.now()}`;
process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
process.env.OLLAMA_CONTEXT_SIZE = '4096';
process.env.OLLAMA_MAX_RETRIES = '0';
const { createApiServer } = await import('./server.mjs');
const { getQuestionBank } = await import('./coordinator.mjs');
const { getSession } = await import('./persistence.mjs');
const { config } = await import('./config.mjs');
const server = createApiServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/api`;
const owner = `student_${randomUUID().replaceAll('-', '')}`;
const headers = { 'Content-Type': 'application/json', 'X-PlacementIQ-Owner': owner };
const record = { timestamp: new Date().toISOString(), fixture: 'Synthetic PlacementIQ live verification student', model: config.ollamaModel, context: 4096, calls: [], passed: false };
async function call(path, body, method = body === undefined ? 'GET' : 'POST') {
  const start = performance.now();
  const response = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(180000) });
  const data = await response.json();
  record.calls.push({ path, status: response.status, elapsedMs: Math.round(performance.now() - start) });
  if (!response.ok) throw new Error(`${path}: ${JSON.stringify(data)}`);
  return data;
}
try {
  const health = await call('/health');
  assert.equal(health.ollama.ready, true); record.health = health.ollama;
  let { session } = await call('/sessions', {});
  const id = session.id;
  ({ session } = await call(`/sessions/${id}/resume`, { pastedText: 'LIVE VERIFICATION FIXTURE — fictional student. B.Tech Computer Science at Example University. Skills: Python, SQL, machine learning. Built a placement classifier in Python with scikit-learn. Removed salary recorded after placement to avoid target leakage. Compared a baseline using held-out precision and recall. Created a SQL dashboard for application records.' }));
  assert.equal(session.extractionMethod, 'ollama-grounded-extraction');
  assert.ok(Object.values(session.profile).flat().some((claim) => claim.confidence === 'model-extracted'));
  console.log('PASS real résumé extraction', session.inferenceMetrics.profileExtraction);
  Object.values(session.profile).flat().forEach((claim) => { claim.confirmed = true; });
  await call(`/sessions/${id}/profile`, { profile: session.profile }, 'PATCH');
  await call(`/sessions/${id}/github`, { skipped: true });
  const analysis = await fetch(`${base}/sessions/${id}/analyze`, { method: 'POST', headers });
  const events = (await analysis.text()).trim().split('\n').map(JSON.parse);
  assert.equal(events.at(-1).type, 'complete'); record.analysis = events.map(({ type, progress, message }) => ({ type, progress, message }));
  ({ session } = await call(`/sessions/${id}/start`, { domain: 'Machine learning' }));
  assert.ok(session.inferenceMetrics.questionPlanning);
  console.log('PASS real question planning', session.inferenceMetrics.questionPlanning);
  await call(`/sessions/${id}/pause`, {});
  assert.equal((await call(`/sessions/${id}`)).session.status, 'paused');
  ({ session } = await call(`/sessions/${id}/resume`, {}));
  const bank = await getQuestionBank();
  let report;
  while (session.status === 'interview') {
    const question = session.questions[session.questionIndex];
    const reference = bank.questions.find((item) => item.id === question.bankId).referenceAnswer;
    // The first partial answer exercises adaptive clarification. Remaining fixtures are reference-guided.
    const answer = session.questionIndex === 0 ? 'Leakage makes validation accuracy inflated because the model can indirectly see the outcome. I would remove the leaking feature.' : reference;
    const result = await call(`/sessions/${id}/answer`, { questionId: question.id, answer });
    assert.equal(result.answer.grade.method, 'ollama-rubric-estimate');
    assert.ok(result.answer.grade.awardedPoints >= 0 && result.answer.grade.awardedPoints <= result.answer.grade.maxPoints);
    console.log(`PASS real answer ${session.questionIndex + 1}: ${question.bankId}, ${result.answer.grade.awardedPoints}/${result.answer.grade.maxPoints}, follow-up=${question.followUp}`);
    session = result.session; report = result.report;
    assert.ok(session.answers.length <= 8);
  }
  assert.equal(session.status, 'completed'); assert.ok(report);
  assert.equal((await call(`/reports/${report.id}`)).report.id, report.id);
  assert.equal((await call(`/sessions/${id}/report`, {})).report.id, report.id);
  const internal = await getSession(id, owner);
  record.result = { sessionId: id, reportId: report.id, score: report.assessment.score, questions: report.questions.length, followUps: session.followUpsUsed, gradingMethods: [...new Set(report.questions.map((q) => q.grade.method))], metrics: internal.inferenceMetrics, firstPrompt: internal.questions[0].prompt, followUpPrompts: internal.questions.filter((q) => q.followUp).map((q) => q.prompt) };
  record.ollamaMemory = await (await fetch('http://localhost:11434/api/ps')).json();
  record.passed = true;
  console.log('PASS saved report, bounded interview, pause/resume and live grading');
} catch (error) { record.error = error.message; console.error(error); process.exitCode = 1; }
finally {
  await fs.mkdir(new URL('../../docs/verification/', import.meta.url), { recursive: true });
  await fs.writeFile(new URL('../../docs/verification/live-inference.json', import.meta.url), JSON.stringify(record, null, 2));
  await new Promise((resolve) => server.close(resolve));
}
