// Explicit live check of two fictional answers that exposed quote-format deductions.
// Seeds isolated question fixtures; does not modify any user's interview or report.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
process.env.PLACEMENTIQ_DATA_DIR = `server/data/test-runtime/quotes-${Date.now()}`;
const { createSession, updateSession } = await import('./persistence.mjs');
const { getQuestionBank, answerQuestion } = await import('./coordinator.mjs');
const { config } = await import('./config.mjs');
const owner = 'student_live_evidence_verification_20261004';
const bank = await getQuestionBank();
const fixtures = [
  { id: 'python_errors_02', answer: 'Check the allowed file type and enforce a size limit before parsing; do not trust the extension alone. Open the file with a context manager so it closes even on failure. Catch expected errors specifically, such as FileNotFoundError, PermissionError and the parser’s documented error, and give an actionable message. Unexpected defects should propagate to the application error boundary or be logged with their traceback. Avoid a blanket catch that returns success or silently discards the exception.' },
  { id: 'project_decisions_01', answer: 'I chose SQLite because this tracker was for one person on an offline laptop with no budget for server administration. PostgreSQL was an alternative with better concurrent writes, but it required a running service. SQLite gave us a single local database file and simple installation; the trade-off was limited concurrent writes and no shared multi-user server. I tested inserting, updating and reopening saved application records, verified rollback after a failed update, and measured the response time of list queries with 10,000 fixture rows.' },
];
const record = { runAt: new Date().toISOString(), fixture: 'Fictional development answers, isolated question sessions', model: config.ollamaModel, context: config.ollamaContextSize, results: [], passed: false };
try {
  for (const fixture of fixtures) {
    const session = await createSession(owner);
    const question = bank.questions.find((item) => item.id === fixture.id);
    await updateSession(session.id, owner, (item) => ({ ...item, status: 'interview', selectedDomain: question.domain, questions: [{ ...question, bankId: question.id }, bank.questions[0]], model: { ...item.model, liveInference: true } }));
    const result = await answerQuestion(session.id, owner, { questionId: question.id, answer: fixture.answer });
    assert.equal(result.answer.grade.method, 'ollama-rubric-estimate');
    assert.equal(result.answer.grade.evidenceValidationFailed, false);
    record.results.push({ questionId: question.id, answer: fixture.answer, grade: result.answer.grade, metrics: result.session.inferenceMetrics[`grading_${result.answer.id}`] });
    console.log(`${question.id}: ${result.answer.grade.awardedPoints}/${result.answer.grade.maxPoints}; evidence retry=${Boolean(record.results.at(-1).metrics.evidenceRetry)}`);
  }
  record.passed = true;
} catch (error) { record.error = error.message; process.exitCode = 1; console.error(error.message); }
await fs.writeFile(new URL('../../docs/verification/live-evidence-retry.json', import.meta.url), JSON.stringify(record, null, 2));
