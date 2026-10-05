import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from './config.mjs';

const STORE_VERSION = 1;
const EMPTY_STORE = { version: STORE_VERSION, sessions: {}, reports: {}, githubCache: {}, assessments: {} };
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
      if (loaded.version === STORE_VERSION) {
        state = { ...structuredClone(EMPTY_STORE), ...loaded };
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
    const temp = `${destination}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temp, destination);
  });
  return writeQueue;
}

export function createId(prefix) {
  return `${prefix}_${randomUUID()}`;
}

export async function createSession(ownerId) {
  await initStore();
  const now = new Date().toISOString();
  const session = {
    id: createId('session'), ownerId, createdAt: now, updatedAt: now,
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
