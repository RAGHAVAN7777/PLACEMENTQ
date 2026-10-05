// Explicit local inference integration test; all student answers are fictional.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
process.env.PLACEMENTIQ_DATA_DIR ||= `server/data/test-runtime/conversation-${Date.now()}`;
process.env.OLLAMA_CONTEXT_SIZE = '4096';
const { createSession, updateSession, listSessions, getReport } = await import('./persistence.mjs');
const { getQuestionBank } = await import('./coordinator.mjs');
const { createApiServer } = await import('./server.mjs');
const bank = await getQuestionBank();
const server = createApiServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/api`;
const owner = 'student_conversation_live_test_20261004';
const headers = { 'Content-Type': 'application/json', 'X-PlacementIQ-Owner': owner };
const record = { runAt: new Date().toISOString(), fixture: 'Fictional student; each isolated branch uses one seeded base question plus one generated follow-up, then a real saved report. Production interviews use six base questions plus at most two follow-ups. All replies and grades are actual Ollama calls through the HTTP backend.', model: 'qwen3:4b-instruct', context: 4096, paths: [], passed: false };
const seeds = [
  { name: 'strong', answer: 'Lists and dictionaries are mutable: their contents can change in place. Strings, tuples and integers are immutable. Two names can reference the same list, so appending through one name changes what the other sees. A list used as a default argument is created once and reused across calls, leaking items between calls. I use None as the default and create a fresh list inside each call.' },
  { name: 'weak', answer: 'I think mutable means I can assign another value to a variable. I use lists and strings but I am not sure what shared state means.' }
];
async function call(path, body) {
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data)); return data;
}
try {
  for (const seed of seeds) {
    const existing = (await listSessions(owner)).find(s => s.verificationBranch === seed.name || s.answers[0]?.answer === seed.answer);
    const created = existing || await createSession(owner);
    const ids = ['python_mutability_01'];
    const questions = ids.map(id => ({ ...bank.questions.find(q => q.id === id), bankId: id }));
    let session = existing || await updateSession(created.id, owner, s => ({ ...s, verificationBranch: seed.name, status: 'interview', selectedDomain: 'Python', targetQuestions: 1, questions,
      profile: { ...s.profile, projects: [{ id: 'fixture_project', value: 'Placement tracker', sourcePassage: 'I built a local Python and SQLite placement tracker.', confirmed: true }] },
      conversation: [{ id: 'initial', role: 'assistant', text: questions[0].prompt, kind: 'question', questionId: questions[0].id }],
      versions: { ...s.versions, conversation: '1.0.0', coordinator: '1.4.0', prompt: '1.4.0' }, model: { ...s.model, liveInference: true } }));
    const path = { name: seed.name, sessionId: session.id, turns: session.answers.map(a => ({ question: a.question, answer: a.answer, reply: a.reply, grade: a.grade, elapsedMs: session.inferenceMetrics?.[`grading_${a.id}`]?.wallMs || 0 })), report: session.reportId ? await getReport(session.reportId, owner) : null }; record.paths.push(path);
    while (session.status === 'interview') {
      const q = session.questions[session.questionIndex];
      const reference = bank.questions.find(item => item.id === q.bankId).referenceAnswer;
      const answer = session.questionIndex === 0 ? seed.answer : q.bankId === 'project_decisions_01' ? 'I chose SQLite for my offline single-user placement tracker because it needs no server and stores everything in one file. PostgreSQL would support concurrent users better but needs a server to manage. SQLite has limited concurrent writes. I tested saving and reopening applications and rolled back failed updates; I measured query latency using 10,000 test records.' : reference + (q.followUp ? ' For example, a = [1]; b = a; b.append(2) makes a equal [1, 2], because both names reference the same list. A fresh list inside the function prevents sharing between calls.' : '');
      const started = performance.now();
      const result = await call(`/sessions/${session.id}/answer`, { questionId: q.id, answer });
      session = result.session;
      const saved = session.answers.at(-1);
      assert.equal(saved.grade.method, 'ollama-rubric-estimate');
      assert.equal(saved.grade.evidenceValidationFailed, false);
      path.turns.push({ question: q.prompt, answer, reply: saved.reply, grade: saved.grade, elapsedMs: Math.round(performance.now() - started) });
      console.log(`${seed.name} turn ${path.turns.length}: ${saved.reply.text}`);
      if (path.turns.length === 1) {
        assert.equal(session.questions[session.questionIndex]?.followUp, true, `${seed.name} should receive a follow-up`);
        assert.ok(saved.reply.question && saved.reply.question !== q.prompt);
        if (seed.name === 'weak') assert.ok(['clarify', 'challenge'].includes(saved.reply.kind));
        assert.ok(saved.reply.reaction.length >= 20 && saved.reply.answerAnchor.length >= 5);
      }
      if (result.report) path.report = result.report;
      assert.ok(path.turns.length <= 5);
      await fs.writeFile(new URL('../../docs/verification/live-conversation.json', import.meta.url), JSON.stringify(record, null, 2));
    }
    assert.ok(path.report);
    assert.equal(path.report.conversation.length, 1 + path.turns.length * 2);
    const restored = await call(`/sessions/${session.id}`);
    assert.deepEqual(restored.session.conversation, path.report.conversation);
    console.log(`${seed.name}: report ${path.report.assessment.score}/100, conversation persisted.`);
  }
  record.passed = true;
} catch (error) { record.error = error.message; process.exitCode = 1; console.error(error); }
finally {
  await fs.writeFile(new URL('../../docs/verification/live-conversation.json', import.meta.url), JSON.stringify(record, null, 2));
  const markdown = ['# Actual local interview test transcripts', '', `Run: ${record.runAt}. Model: ${record.model}; 4096 context; sequential calls.`, '', record.fixture, ...record.paths.flatMap(p => ['', `## ${p.name}`, ...p.turns.flatMap((t, i) => ['', `### Turn ${i + 1}`, `**Aria asked:** ${t.question}`, '', `**Test student:** ${t.answer}`, '', `**Actual Aria reply:** ${t.reply.text}`, '', `Rubric: ${t.grade.awardedPoints}/${t.grade.maxPoints}. Request: ${(t.elapsedMs / 1000).toFixed(1)} seconds.`]), '', p.report ? `Saved report: ${p.report.assessment.score}/100.` : 'No completed report.']), '', `Passed: ${record.passed}. ${record.error || ''}`].join('\n');
  await fs.writeFile(new URL('../../docs/verification/CONVERSATION_TRANSCRIPTS.md', import.meta.url), markdown);
  await new Promise(resolve => server.close(resolve));
}
