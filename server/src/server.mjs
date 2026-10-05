import http from 'node:http';
import { URL } from 'node:url';
import { config } from './config.mjs';
import { createSession, getReport, getSession, initStore, listReports, listSessions, listAssessments, getAssessment } from './persistence.mjs';
import { baselineSchema, resumePrefill } from './baseline.mjs';
import { createBaseline, startPreparation } from './readiness.mjs';
import { HttpError, requireOwner } from './security.mjs';
import { extractResume } from './resume.mjs';
import { previewGitHub, inspectRepository } from './github.mjs';
import { getOllamaStatus } from './ollama.mjs';
import {
  analyzeSession, answerQuestion, getQuestionBank, ingestResume, recordHint,
  saveGitHubEvidence, setPaused, startInterview, updateProfile, requireSessionState, recoverReport
} from './coordinator.mjs';

const JSON_LIMIT = 12 * 1024 * 1024;

const publicAnswer = (answer, session) => session.questions[session.questionIndex]?.parentQuestionId === answer.questionId ? {
  ...answer, feedbackDeferred: true, grade: { ...answer.grade, criteria: [], missingConcepts: [], explanation: 'Your answer is saved. Detailed rubric feedback appears after the follow-up.' }
} : answer;

const publicSession = (session) => session ? {
  ...session,
  ownerId: undefined,
  resume: session.resume ? { ...session.resume, text: undefined, extractedCharacters: session.resume.text?.length || 0 } : null,
  answers: session.answers.map((answer) => publicAnswer(answer, session)),
  questions: session.questions.map(({ id, bankId, skill, domain, difficulty, prompt, maxPoints, hintUsed, followUp, context, parentQuestionId }, index) => ({
    id, bankId, skill, domain, difficulty, maxPoints, hintUsed, followUp, parentQuestionId,
    prompt: index <= session.questionIndex ? prompt : '', context: index <= session.questionIndex ? context : null
  }))
} : null;

function baseHeaders(req) {
  const origin = req.headers.origin;
  const allowedOrigin = origin && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin) ? origin : 'http://127.0.0.1:3000';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, X-PlacementIQ-Owner',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };
}

function json(res, req, status, payload) {
  res.writeHead(status, { ...baseHeaders(req), 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > JSON_LIMIT) throw new HttpError(413, 'Request body is too large.', 'request_too_large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object');
    return value;
  }
  catch { throw new HttpError(400, 'Request body must be valid JSON.', 'invalid_json'); }
}

const match = (pathname, expression) => pathname.match(expression);

async function route(req, res) {
  if (req.method === 'OPTIONS') { res.writeHead(204, baseHeaders(req)); return res.end(); }
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;

  if (req.method === 'GET' && pathname === '/api/health') {
    const ollama = await getOllamaStatus();
    return json(res, req, 200, { ok: true, service: 'PlacementIQ local assessment API', version: '1.0.0', ollama, limits: {
      resumeMb: config.maxResumeBytes / 1024 / 1024, resumeCharacters: config.maxResumeTextChars,
      repositoryCharacters: config.maxRepoTextChars, answerCharacters: config.maxAnswerChars,
      activeInferenceRequests: 1, contextSize: config.ollamaContextSize
    } });
  }
  if (req.method === 'GET' && pathname === '/api/ollama/status') {
    return json(res, req, 200, { ollama: await getOllamaStatus() });
  }
  if (req.method === 'GET' && pathname === '/api/question-bank') {
    const bank = await getQuestionBank();
    return json(res, req, 200, { version: bank.version, aggregationPolicy: bank.aggregationPolicy, questions: bank.questions.map(({ id, skill, domain, difficulty, maxPoints }) => ({ id, skill, domain, difficulty, maxPoints })) });
  }

  const ownerId = requireOwner(req);

  if (req.method === 'GET' && pathname === '/api/baseline/schema') {
    const sessionId = url.searchParams.get('session');
    const session = sessionId ? await getSession(sessionId, ownerId) : null;
    if (sessionId && !session) throw new HttpError(404, 'Interview session not found.', 'session_not_found');
    return json(res, req, 200, { ...await baselineSchema(), prefill: resumePrefill(session) });
  }
  if (req.method === 'POST' && pathname === '/api/assessments') {
    const assessment = await createBaseline(ownerId, await readJson(req));
    return json(res, req, 201, { assessment: { ...assessment, ownerId: undefined } });
  }
  if (req.method === 'GET' && pathname === '/api/assessments') {
    return json(res, req, 200, { assessments: (await listAssessments(ownerId)).map(item => ({ ...item, ownerId: undefined })) });
  }
  const assessmentPath = pathname.match(/^\/api\/assessments\/([^/]+)(\/prepare)?$/);
  if (assessmentPath && req.method === 'POST' && assessmentPath[2]) {
    const assessment = await startPreparation(decodeURIComponent(assessmentPath[1]), ownerId);
    return json(res, req, 200, { assessment: { ...assessment, ownerId: undefined } });
  }
  if (assessmentPath && req.method === 'GET' && !assessmentPath[2]) {
    const assessment = await getAssessment(decodeURIComponent(assessmentPath[1]), ownerId);
    if (!assessment) throw new HttpError(404, 'Assessment not found.', 'assessment_not_found');
    return json(res, req, 200, { assessment: { ...assessment, ownerId: undefined } });
  }

  if (req.method === 'GET' && pathname === '/api/sessions') {
    return json(res, req, 200, { sessions: (await listSessions(ownerId)).map(publicSession) });
  }

  if (req.method === 'POST' && pathname === '/api/sessions') {
    return json(res, req, 201, { session: publicSession(await createSession(ownerId)) });
  }
  let found = match(pathname, /^\/api\/sessions\/([^/]+)$/);
  if (req.method === 'GET' && found) {
    const session = await getSession(decodeURIComponent(found[1]), ownerId);
    if (!session) throw new HttpError(404, 'Interview session not found.', 'session_not_found');
    return json(res, req, 200, { session: publicSession(session) });
  }
  found = match(pathname, /^\/api\/sessions\/([^/]+)\/resume$/);
  if (req.method === 'POST' && found) {
    const sessionId = decodeURIComponent(found[1]);
    const current = await requireSessionState(sessionId, ownerId);
    const body = await readJson(req);
    // The existing client uses /resume for both a resume upload and unpausing.
    if (['paused', 'interview'].includes(current.status) && Object.keys(body).length === 0) {
      return json(res, req, 200, { session: publicSession(await setPaused(sessionId, ownerId, false)) });
    }
    await requireSessionState(sessionId, ownerId, ['resume', 'profile-review', 'github', 'analysis', 'domain-selection']);
    const extracted = await extractResume(body);
    const session = await ingestResume(sessionId, ownerId, extracted);
    if (!session) throw new HttpError(404, 'Interview session not found.', 'session_not_found');
    return json(res, req, 200, { session: publicSession(session), extraction: { fileName: extracted.fileName, method: extracted.method, characters: extracted.text.length, warnings: extracted.warnings } });
  }
  found = match(pathname, /^\/api\/sessions\/([^/]+)\/profile$/);
  if (req.method === 'PATCH' && found) {
    const body = await readJson(req);
    const session = await updateProfile(decodeURIComponent(found[1]), ownerId, body.profile);
    if (!session) throw new HttpError(404, 'Interview session not found.', 'session_not_found');
    return json(res, req, 200, { session: publicSession(session) });
  }
  if (req.method === 'POST' && pathname === '/api/github/preview') {
    const body = await readJson(req);
    return json(res, req, 200, await previewGitHub(String(body.url || '')));
  }
  found = match(pathname, /^\/api\/sessions\/([^/]+)\/github$/);
  if (req.method === 'POST' && found) {
    const body = await readJson(req);
    const sessionId = decodeURIComponent(found[1]);
    await requireSessionState(sessionId, ownerId, ['github', 'analysis', 'domain-selection']);
    let session;
    let results = [];
    if (body.skipped) {
      session = await saveGitHubEvidence(sessionId, ownerId, [], true);
    } else {
      const repositories = Array.isArray(body.repositories) ? body.repositories.slice(0, 2) : [];
      if (!repositories.length) throw new HttpError(400, 'Select one or two repositories, or continue without GitHub.', 'repository_required');
      for (const repository of repositories) results.push(await inspectRepository(repository));
      session = await saveGitHubEvidence(sessionId, ownerId, results, false);
    }
    if (!session) throw new HttpError(404, 'Interview session not found.', 'session_not_found');
    return json(res, req, 200, { session: publicSession(session), results });
  }
  found = match(pathname, /^\/api\/sessions\/([^/]+)\/analyze$/);
  if (req.method === 'POST' && found) {
    await requireSessionState(decodeURIComponent(found[1]), ownerId, ['analysis', 'domain-selection']);
    res.writeHead(200, { ...baseHeaders(req), 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Transfer-Encoding': 'chunked', Connection: 'keep-alive' });
    const emit = (event) => { if (!res.destroyed) res.write(`${JSON.stringify(event)}\n`); };
    try { await analyzeSession(decodeURIComponent(found[1]), ownerId, (event) => emit(event.type === 'complete' ? { ...event, session: publicSession(event.session) } : event)); }
    catch (error) { emit({ type: 'error', code: error.code || 'analysis_failed', message: error.message || 'Analysis failed.' }); }
    return res.end();
  }
  found = match(pathname, /^\/api\/sessions\/([^/]+)\/start$/);
  if (req.method === 'POST' && found) {
    const body = await readJson(req);
    const session = await startInterview(decodeURIComponent(found[1]), ownerId, String(body.domain || ''));
    if (!session) throw new HttpError(404, 'Interview session not found.', 'session_not_found');
    return json(res, req, 200, { session: publicSession(session) });
  }
  found = match(pathname, /^\/api\/sessions\/([^/]+)\/hint$/);
  if (req.method === 'POST' && found) {
    const result = await recordHint(decodeURIComponent(found[1]), ownerId);
    return json(res, req, 200, { ...result, session: publicSession(result.session) });
  }
  found = match(pathname, /^\/api\/sessions\/([^/]+)\/answer$/);
  if (req.method === 'POST' && found) {
    const result = await answerQuestion(decodeURIComponent(found[1]), ownerId, await readJson(req));
    return json(res, req, 200, { ...result, answer: publicAnswer(result.answer, result.session), session: publicSession(result.session), report: result.report ? { ...result.report, ownerId: undefined } : null });
  }
  found = match(pathname, /^\/api\/sessions\/([^/]+)\/report$/);
  if (req.method === 'POST' && found) {
    const result = await recoverReport(decodeURIComponent(found[1]), ownerId);
    return json(res, req, 200, { session: publicSession(result.session), report: { ...result.report, ownerId: undefined } });
  }
  found = match(pathname, /^\/api\/sessions\/([^/]+)\/(pause|resume)$/);
  if (req.method === 'POST' && found) {
    const session = await setPaused(decodeURIComponent(found[1]), ownerId, found[2] === 'pause');
    return json(res, req, 200, { session: publicSession(session) });
  }
  if (req.method === 'GET' && pathname === '/api/reports') {
    const reports = (await listReports(ownerId)).map((report) => ({ ...report, ownerId: undefined }));
    return json(res, req, 200, { reports });
  }
  found = match(pathname, /^\/api\/reports\/([^/]+)$/);
  if (req.method === 'GET' && found) {
    const report = await getReport(decodeURIComponent(found[1]), ownerId);
    if (!report) throw new HttpError(404, 'Interview report not found.', 'report_not_found');
    return json(res, req, 200, { report: { ...report, ownerId: undefined } });
  }
  throw new HttpError(404, 'API route not found.', 'not_found');
}

export function createApiServer() {
  const operations = new Set();
  return http.createServer(async (req, res) => {
    const sessionPath = req.url?.split('?')[0].match(/^\/api\/sessions\/([^/]+)/);
    const operationKey = ['POST', 'PATCH'].includes(req.method) ? sessionPath?.[1] || (req.url?.startsWith('/api/assessments') ? `assessment:${req.headers['x-placementiq-owner']}` : null) : null;
    let acquired = false;
    try {
      if (operationKey && operations.has(operationKey)) throw new HttpError(409, 'Another action is still running for this interview. Wait for it to finish, then refresh.', 'session_busy');
      if (operationKey) { operations.add(operationKey); acquired = true; }
      await route(req, res);
    } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (!res.headersSent) json(res, req, status, { error: { code: error.code || 'internal_error', message: status === 500 ? 'The local server encountered an unexpected error.' : error.message, details: error.details } });
    else res.end();
    if (status === 500) console.error(error);
    } finally { if (acquired) operations.delete(operationKey); }
  });
}

if (process.argv[1] && new URL(import.meta.url).pathname.replace(/^\/(.:)/, '$1') === process.argv[1].replace(/\\/g, '/')) {
  await initStore();
  const server = createApiServer();
  server.listen(config.port, config.host, () => {
    console.log(`PlacementIQ local API ready at http://${config.host}:${config.port}`);
    console.log(`Ollama model: ${config.ollamaModel} (${config.ollamaBaseUrl})`);
  });
}
