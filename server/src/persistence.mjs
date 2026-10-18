import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from './config.mjs';

const STORE_VERSION = 2;
const EMPTY_STORE = { version: STORE_VERSION, sessions: {}, reports: {}, githubCache: {}, assessments: {}, candidates: {} };
let state = structuredClone(EMPTY_STORE);
let readyPromise;
let writeQueue = Promise.resolve();

const storePath = () => path.join(config.dataDir, 'placementiq-store.json');

export async function initStore() {
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    await fs.mkdir(config.dataDir, { recursive: true });
    try {
      const loaded = JSON.parse(await fs.readFile(storePath(), 'utf8'));
      if ([1,STORE_VERSION].includes(loaded.version)) {
        state = { ...structuredClone(EMPTY_STORE), ...loaded, version:STORE_VERSION };
        for(const item of Object.values(state.assessments)){
          item.candidateId ||= item.ownerId;item.status ||= item.interview?'completed':'in-progress';
          const report=state.reports[item.interview?.reportId];
          if(report&&!item.tasks)item.tasks=(report.improvementTasks||[]).map(t=>({...t,completed:false}));
        }
        if(loaded.version===1)for(const item of Object.values(state.assessments).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))){
          if(!item.demo&&item.baseline&&!state.candidates[item.ownerId])state.candidates[item.ownerId]={id:item.ownerId,version:1,personal:{},baselineInputs:item.baseline.inputs,baselineSources:item.baseline.sources,preferences:{},updatedAt:item.createdAt};
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        const backup = path.join(config.dataDir, `placementiq-store.corrupt-${Date.now()}.json`);
        try { await fs.rename(storePath(), backup); } catch { /* best effort */ }
      }
    }
    return state;
  })();
  return readyPromise;
}

async function persist() {
  await initStore();
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    const destination = storePath();
    const temp = `${destination}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
    await fs.writeFile(temp, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 });
    let replaced = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await fs.rename(temp, destination);
        replaced = true;
        break;
      } catch (err) {
        if (err.code === 'EPERM' || err.code === 'EBUSY') {
          await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
        } else {
          try { await fs.unlink(temp); } catch { /* ignore */ }
          throw err;
        }
      }
    }
    if (!replaced) {
      try {
        await fs.copyFile(temp, destination);
        await fs.unlink(temp).catch(() => {});
      } catch (err) {
        try { await fs.unlink(temp); } catch { /* ignore */ }
        throw err;
      }
    }
  });
  return writeQueue;
}

export function createId(prefix) {
  return `${prefix}_${randomUUID()}`;
}

export async function createSession(ownerId, {unified=false}={}) {
  await initStore();
  const now = new Date().toISOString();
  const session = {
    id: createId('session'), ownerId, candidateId:ownerId, workflowVersion:unified?2:1, createdAt: now, updatedAt: now,
    status: 'resume', avatarState: 'awaiting', paused: false,
    profile: { skills: [], projects: [], education: [], experience: [], strengths: [] },
    resume: null, github: { skipped: false, repositories: [], evidence: [], inspectedFiles: [] },
    domains: [], selectedDomain: null, questions: [], answers: [],
    questionIndex: 0, followUpsUsed: 0, targetQuestions: config.targetQuestions,
    model: { requested: config.ollamaModel, used: null, liveInference: false },
    versions: { coordinator: '1.3.0', questionBank: '1.2.0', prompt: '1.3.0', scoring: '1.2.0' }
  };
  state.sessions[session.id] = session;
  await persist();
  return structuredClone(session);
}

export async function getSession(sessionId, ownerId) {
  await initStore();
  const session = state.sessions[sessionId];
  if (!session || session.ownerId !== ownerId) return null;
  return structuredClone(session);
}

export async function listSessions(ownerId) {
  await initStore();
  return Object.values(state.sessions).filter((session) => session.ownerId === ownerId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((session) => structuredClone(session));
}

export async function updateSession(sessionId, ownerId, updater) {
  await initStore();
  const existing = state.sessions[sessionId];
  if (!existing || existing.ownerId !== ownerId) return null;
  const next = updater(structuredClone(existing));
  next.updatedAt = new Date().toISOString();
  state.sessions[sessionId] = next;
  await persist();
  return structuredClone(next);
}

export async function saveReport(report) {
  await initStore();
  state.reports[report.id] = structuredClone(report);
  await persist();
  return structuredClone(report);
}

export async function getReport(reportId, ownerId) {
  await initStore();
  const report = state.reports[reportId];
  return report?.ownerId === ownerId ? structuredClone(report) : null;
}

export async function listReports(ownerId) {
  await initStore();
  return Object.values(state.reports)
    .filter((report) => report.ownerId === ownerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((report) => structuredClone(report));
}

export async function getCache(key) {
  await initStore();
  const item = state.githubCache[key];
  if (!item || new Date(item.expiresAt).getTime() < Date.now()) return null;
  return structuredClone(item.value);
}

export async function setCache(key, value, ttlMs = 30 * 60 * 1000) {
  await initStore();
  state.githubCache[key] = { expiresAt: new Date(Date.now() + ttlMs).toISOString(), value };
  await persist();
}

export async function resetStoreForTests() {
  await fs.mkdir(config.dataDir, { recursive: true });
  state = structuredClone(EMPTY_STORE);
  readyPromise = Promise.resolve(state);
  writeQueue = Promise.resolve();
}

export async function listAssessments(ownerId) {
  await initStore();
  return Object.values(state.assessments).filter(item => item.ownerId === ownerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(item => structuredClone(item));
}

export async function getAssessment(id, ownerId) {
  await initStore();
  const item = state.assessments[id];
  return item?.ownerId === ownerId ? structuredClone(item) : null;
}

export async function saveAssessment(item) {
  await initStore();
  state.assessments[item.id] = structuredClone(item);
  await persist();
  return structuredClone(item);
}

export async function getCandidate(ownerId) {
  await initStore();return structuredClone(state.candidates[ownerId]||{id:ownerId,version:0,personal:{},baselineInputs:{},preferences:{}});
}
export async function saveCandidate(ownerId, changes) {
  await initStore();const current=await getCandidate(ownerId);
  const next={...current,...structuredClone(changes),id:ownerId,version:current.version+1,updatedAt:new Date().toISOString()};
  state.candidates[ownerId]=next;await persist();return structuredClone(next);
}

// Report, linked readiness result and completion marker share one persisted snapshot.
export async function saveCompletedAssessment(report,assessment){
 await initStore();const session=state.sessions[report.sessionId];
 if(!session||session.ownerId!==report.ownerId||assessment.ownerId!==report.ownerId||assessment.sessionId!==session.id)throw new Error('Assessment ownership mismatch');
 state.reports[report.id]=structuredClone(report);state.assessments[assessment.id]=structuredClone(assessment);
 state.sessions[session.id]={...session,status:'completed',avatarState:'completed',reportId:report.id,assessmentId:assessment.id,updatedAt:new Date().toISOString()};
 await persist();return structuredClone(assessment);
}
