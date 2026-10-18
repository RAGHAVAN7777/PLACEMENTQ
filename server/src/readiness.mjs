import {attachRoadmap,buildRoadmap} from './roadmap.mjs';
import { baselineInference, baselineSchema, resumePrefill } from './baseline.mjs';
import { readinessPolicy, compareReadiness } from './readiness-policy.mjs';
import { createId, createSession, getSession, listAssessments, listReports, saveAssessment, getAssessment, updateSession, saveCandidate, saveCompletedAssessment, getCandidate } from './persistence.mjs';
import { HttpError } from './security.mjs';

const event = (stage, message) => ({ stage, message, timestamp: new Date().toISOString() });
const newRecord = (ownerId, sessionId) => ({ id: createId('assessment'), ownerId, candidateId:ownerId, sessionId, status:'in-progress', createdAt: new Date().toISOString(), policy: { ...readinessPolicy }, baseline: null, interview: null, timeline: [] });

function integrate(record, report) {
  if (report) record.interview = { reportId: report.id, sessionId: report.sessionId, timestamp: report.createdAt, ...report.assessment, provenance: report.provenance, uncertainty: report.questions.map(answer => ({ questionId: answer.questionId, uncertainty: answer.grade?.uncertainty, reviewNeeded: answer.grade?.reviewNeeded, evidenceStatus: answer.grade?.evidenceStatus })) };
  record.result = compareReadiness(record.baseline, report, record.policy);
  record.status=report?'completed':'in-progress';
  if(report){record.completedAt ||= report.createdAt;record.tasks ||= (report.improvementTasks||[]).map((task,index)=>({...task,completed:false,reviewDate:new Date(Date.parse(report.createdAt)+(index+1)*7*86400000).toISOString().slice(0,10)}));}
  record.timeline.push(event('read-baseline', record.baseline ? `Read saved baseline ${record.baseline.score.toFixed(2)}/100 (${record.baseline.modelName}).` : 'Baseline is not yet available.'));
  record.timeline.push(event('read-interview', report ? `Read saved interview report ${report.id}: ${report.assessment.score}/100.` : 'Waiting for a completed interview.'));
  record.timeline.push(event('compare', record.result.explanation));
  if (record.result.action) record.timeline.push(event('select-action', `${record.result.action.title}: ${record.result.action.reason}`));
  if(report)attachRoadmap(record,report);
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
  if(session?.workflowVersion===2 && (session.status!=='domain-selection'||!session.profileVerifiedAt))throw new HttpError(409,'Complete resume and GitHub review before candidate verification.','verification_required');
  const prediction = await baselineInference({operation:'assessment',inputs:body.inputs});
  const explanation=prediction.explanation;
  const linkedSession = session || await createSession(ownerId);
  const record = previous || newRecord(ownerId, linkedSession.id);
  record.demo = linkedSession.demo || null;
  const candidate=await getCandidate(ownerId);
  const candidates = resumePrefill(session);
  record.sourceConflicts=Object.entries(candidates).filter(([k,v])=>candidate.baselineInputs[k]!==undefined&&candidate.baselineInputs[k]!==v.value).map(([field,v])=>({field,previous:{value:candidate.baselineInputs[field],source:'Previously verified candidate input'},current:v}));
  record.baseline = { ...prediction, explanation, timestamp: new Date().toISOString(), confirmed: true, sources: Object.fromEntries(Object.entries(prediction.inputs).map(([key, value]) => [key, candidates[key] ? { ...candidates[key], confirmed: true, corrected: value !== candidates[key].value } : { source: 'Student confirmed input', confirmed: true }])) };
  if (linkedSession.demo) for(const source of Object.values(record.baseline.sources)) source.source='Fictional demo input; not extracted or measured';
  record.profileSnapshot = { inputs: prediction.inputs, sources: record.baseline.sources, confirmedAt: record.baseline.timestamp };
  record.candidateSnapshot={profileVersion:candidate.version,name:session?.resumeDetails?.fields?.candidateName?.value||null,details:session?.resumeDetails||null,profile:session?.profile||null,github:session?.github||null,resume:session?.resume?{fileName:session.resume.fileName,contentHash:session.resume.contentHash}:null};
  record.timeline.push(event('baseline-inference', 'Ran the unchanged historical model using its fitted encoders, scaler and original feature order.'));
  const report = (await listReports(ownerId)).find(item => item.sessionId === linkedSession.id);
  const saved=await saveAssessment(integrate(record, report));
  await updateSession(linkedSession.id,ownerId,s=>({...s,assessmentId:saved.id,baselineReady:true}));
  if(!linkedSession.demo)await saveCandidate(ownerId,{baselineInputs:prediction.inputs,baselineSources:record.baseline.sources,...(session?{details:session.resumeDetails||null,profile:session.profile||null,github:session.github||null,resume:record.candidateSnapshot.resume}:{})});
  return saved;
}

export async function integrateInterview(report) {
  const existing = (await listAssessments(report.ownerId)).find(item => item.sessionId === report.sessionId);
  if (existing?.interview?.reportId === report.id) return existing;
  const record=existing || newRecord(report.ownerId, report.sessionId);
  record.demo=report.demo || null;
  const hadRoadmap=Boolean(record.roadmap);
  integrate(record,report);
  const prior=(await listAssessments(report.ownerId)).find(a=>a.id!==record.id&&Boolean(a.demo)===Boolean(record.demo)&&a.roadmap?.preferences);
  if(prior&&!hadRoadmap){record.roadmap=buildRoadmap(record,report,prior.roadmap.preferences);record.roadmap.changeReason='New interview evidence replaced the prior gap analysis. Your preparation preferences were reused; prior assessment tasks remain in history.';record.roadmap.previousAssessmentId=prior.id;record.tasks=record.roadmap.tasks;}
  return saveCompletedAssessment(report,record);
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

export async function updatePlanTask(id,ownerId,taskId,completed){
  if(typeof completed!=='boolean')throw new HttpError(400,'Task completion must be true or false.','invalid_task');
  const record=await getAssessment(id,ownerId);if(!record)throw new HttpError(404,'Assessment not found.','assessment_not_found');
  const task=record.tasks?.find(t=>t.id===taskId);if(!task)throw new HttpError(404,'Task not found.','task_not_found');
  task.completed=completed;task.completedAt=completed?new Date().toISOString():null;return saveAssessment(record);
}
