import { baselineInference, baselineSchema, resumePrefill } from './baseline.mjs';
import { readinessPolicy, compareReadiness } from './readiness-policy.mjs';
import { createId, createSession, getSession, listAssessments, listReports, saveAssessment, getAssessment } from './persistence.mjs';
import { HttpError } from './security.mjs';

const event = (stage, message) => ({ stage, message, timestamp: new Date().toISOString() });
const newRecord = (ownerId, sessionId) => ({ id: createId('assessment'), ownerId, sessionId, createdAt: new Date().toISOString(), policy: { ...readinessPolicy }, baseline: null, interview: null, timeline: [] });

function integrate(record, report) {
  if (report) record.interview = { reportId: report.id, sessionId: report.sessionId, timestamp: report.createdAt, ...report.assessment, provenance: report.provenance, uncertainty: report.questions.map(answer => ({ questionId: answer.questionId, uncertainty: answer.grade?.uncertainty, reviewNeeded: answer.grade?.reviewNeeded, evidenceStatus: answer.grade?.evidenceStatus })) };
  record.result = compareReadiness(record.baseline, report, record.policy);
  record.timeline.push(event('read-baseline', record.baseline ? `Read saved baseline ${record.baseline.score.toFixed(2)}/100 (${record.baseline.modelName}).` : 'Baseline is not yet available.'));
  record.timeline.push(event('read-interview', report ? `Read saved interview report ${report.id}: ${report.assessment.score}/100.` : 'Waiting for a completed interview.'));
  record.timeline.push(event('compare', record.result.explanation));
  if (record.result.action) record.timeline.push(event('select-action', `${record.result.action.title}: ${record.result.action.reason}`));
  record.updatedAt = new Date().toISOString();
  return record;
}

export async function createBaseline(ownerId, body) {
  if (body.confirmed !== true) throw new HttpError(400, 'Confirm or correct all baseline inputs before prediction.', 'confirmation_required');
  if (!body.inputs || typeof body.inputs !== 'object' || Array.isArray(body.inputs)) throw new HttpError(400, 'Baseline inputs must be an object containing the original model fields.', 'invalid_baseline');
  const allowed = new Set((await baselineSchema()).fields.map(field => field.key));
  if (Object.keys(body.inputs).some(key => !allowed.has(key))) throw new HttpError(400, 'Only original trained-model inputs are accepted. The live interview score is stored separately.', 'invalid_baseline');
  const session = body.sessionId ? await getSession(body.sessionId, ownerId) : null;
  if (body.sessionId && !session) throw new HttpError(404, 'Interview session not found.', 'session_not_found');
  const previous = session ? (await listAssessments(ownerId)).find(item => item.sessionId === session.id) : null;
  if (previous?.baseline) throw new HttpError(409, 'This assessment already has an immutable baseline. Start a reassessment for new inputs.', 'baseline_exists');
  const prediction = await baselineInference({ inputs: body.inputs });
  const linkedSession = session || await createSession(ownerId);
  const record = previous || newRecord(ownerId, linkedSession.id);
  const candidates = resumePrefill(session);
  record.baseline = { ...prediction, timestamp: new Date().toISOString(), confirmed: true, sources: Object.fromEntries(Object.entries(prediction.inputs).map(([key, value]) => [key, candidates[key] ? { ...candidates[key], confirmed: true, corrected: value !== candidates[key].value } : { source: 'Student confirmed input', confirmed: true }])) };
  record.profileSnapshot = { inputs: prediction.inputs, sources: record.baseline.sources, confirmedAt: record.baseline.timestamp };
  record.timeline.push(event('baseline-inference', 'Ran the unchanged historical model using its fitted encoders, scaler and original feature order.'));
  const report = (await listReports(ownerId)).find(item => item.sessionId === linkedSession.id);
  return saveAssessment(integrate(record, report));
}

export async function integrateInterview(report) {
  const existing = (await listAssessments(report.ownerId)).find(item => item.sessionId === report.sessionId);
  if (existing?.interview?.reportId === report.id) return existing;
  return saveAssessment(integrate(existing || newRecord(report.ownerId, report.sessionId), report));
}

export async function startPreparation(id, ownerId) {
  const record = await getAssessment(id, ownerId);
  if (!record) throw new HttpError(404, 'Assessment not found.', 'assessment_not_found');
  if (!record.result?.action) throw new HttpError(409, 'Complete both assessments before starting preparation.', 'assessment_incomplete');
  if (!record.preparation) {
    record.preparation = { ...record.result.action, status: 'started', startedAt: new Date().toISOString() };
    record.timeline.push(event('start-preparation', `Started ${record.preparation.title}.`));
    await saveAssessment(record);
  }
  return record;
}
