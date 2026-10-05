const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const OWNER_KEY = 'placementiq_owner_v1';
const SESSION_KEY = 'placementiq_interview_session_v1';

function randomOwnerId() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `student_${Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export function ownerId() {
  let value = localStorage.getItem(OWNER_KEY);
  if (!value) {
    value = randomOwnerId();
    localStorage.setItem(OWNER_KEY, value);
  }
  return value;
}

export const savedSessionId = () => localStorage.getItem(SESSION_KEY);
export const rememberSession = (id: string | null) => id ? localStorage.setItem(SESSION_KEY, id) : localStorage.removeItem(SESSION_KEY);

export interface EvidenceClaim {
  id: string;
  name: string;
  sourcePassage: string;
  origin: string;
  confidence: string;
  confirmed: boolean;
}

export interface InterviewQuestion {
  id: string;
  bankId: string;
  skill: string;
  domain: string;
  difficulty: string;
  prompt: string;
  maxPoints: number;
  hintUsed: boolean;
  followUp: boolean;
  context?: { type: string; label: string; passage: string } | null;
}

export interface GradeCriterion {
  criterionId: string;
  label: string;
  points: number;
  maxPoints: number;
  evidenceExcerpt: string;
  explanation: string;
}

export interface InterviewGrade {
  method: string;
  reviewNeeded: boolean;
  uncertainty: 'low' | 'medium' | 'high';
  criteria: GradeCriterion[];
  missingConcepts: string[];
  explanation: string;
  awardedPoints: number;
  maxPoints: number;
}

export interface InterviewAnswer {
  feedbackDeferred?: boolean;
  id: string;
  skill: string;
  question: string;
  answer: string;
  skipped: boolean;
  hintUsed: boolean;
  grade: InterviewGrade;
}

export interface InterviewReport {
  conversation?: ConversationTurn[];
  id: string;
  sessionId: string;
  createdAt: string;
  selectedDomain: string;
  assessment: {
    score: number;
    totalPoints: number;
    maxPoints: number;
    scoredQuestions?: number;
    recordedAttempts?: number;
    skills: Array<{ skill: string; points: number; maxPoints: number; questions: number; reviewNeeded: boolean; score: number | null; result: string }>;
  };
  questions: InterviewAnswer[];
  explainedConcepts: Array<{ skill: string; concept: string; excerpt: string }>;
  missingOrUncertainEvidence: string[];
  improvementTasks: Array<{ id: string; title: string; action: string; priority: string }>;
  reassessmentTopics: string[];
  comparison: Array<{ skill: string; previousScore: number | null; currentScore: number; change: number | null }>;
  evidenceProfile: { claimed: Record<string, EvidenceClaim[]>; observed: RepositoryEvidence[]; assessed: unknown[] };
  provenance: { model: { requested: string; used: string | null; liveInference: boolean }; versions: Record<string, string>; questionBankVersion: string; aggregationPolicy: string };
  limitations: string[];
}

export interface RepositoryEvidence {
  skill: string;
  passage: string;
  sourcePath: string;
  repository: string;
  origin: string;
  confidence: string;
}

export interface InterviewSession {
  conversation?: ConversationTurn[];
  id: string;
  createdAt: string;
  updatedAt: string;
  status: 'resume' | 'profile-review' | 'github' | 'analysis' | 'domain-selection' | 'interview' | 'paused' | 'reporting' | 'completed';
  avatarState: 'idle' | 'processing' | 'speaking' | 'awaiting' | 'error' | 'completed';
  paused: boolean;
  profile: Record<'skills' | 'projects' | 'education' | 'experience' | 'strengths', EvidenceClaim[]>;
  resume: null | { fileName: string; method: string; extractedCharacters: number };
  github: { skipped: boolean; repositories: Array<{ fullName: string; name: string }>; evidence: RepositoryEvidence[]; inspectedFiles: Array<{ repository: string; path: string; size: number }>; notice?: string };
  domains: Array<{ domain: string; claimed: number; observed: number; strength: number; basis: string; evidence: string[] }>;
  selectedDomain: string | null;
  suggestedDomain?: string;
  questions: InterviewQuestion[];
  answers: InterviewAnswer[];
  questionIndex: number;
  followUpsUsed: number;
  targetQuestions: number;
  model: { requested: string; used: string | null; liveInference: boolean; lastStatus?: OllamaStatus };
  reportId?: string;
}

export interface ConversationTurn {
  id: string;
  role: 'assistant' | 'student';
  text: string;
  kind: string;
  reaction?: string;
  question?: string | null;
  questionId?: string | null;
  createdAt?: string;
  model?: string | null;
}

export interface OllamaStatus {
  ready?: boolean;
  reachable: boolean;
  installed: boolean;
  model: string;
  endpoint: string;
  models: string[];
  message: string;
  details?: { capabilities: string[]; family: string | null; parameterSize: string | null; quantization: string | null } | null;
}

type ApiErrorBody = { error?: { message?: string; code?: string } };

export async function request<T>(pathname: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(`${API_BASE}${pathname}`, {
    ...init,
    signal: init.signal || AbortSignal.timeout(270000),
    headers: { 'Content-Type': 'application/json', 'X-PlacementIQ-Owner': ownerId(), ...(init.headers || {}) }
  }); } catch (error) { throw new Error(error instanceof DOMException && /timeout|abort/i.test(error.name) ? 'The local service took too long. Your saved progress is safe; try again.' : 'Could not reach the local interview service. Start PlacementIQ and reconnect.'); }
  const payload = await response.json().catch(() => ({})) as ApiErrorBody;
  if (!response.ok) throw new Error(payload.error?.message || `Request failed (${response.status}).`);
  return payload as T;
}

export function fileToBase64(file: File, onProgress: (percent: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => event.lengthComputable && onProgress(Math.round(event.loaded / event.total * 70));
    reader.onerror = () => reject(new Error('The file could not be read in this browser.'));
    reader.onload = () => { onProgress(75); resolve(String(reader.result).split(',')[1] || ''); };
    reader.readAsDataURL(file);
  });
}

export const interviewApi = {
  health: () => request<{ ollama: OllamaStatus; limits: Record<string, number> }>('/api/health'),
  createSession: () => request<{ session: InterviewSession }>('/api/sessions', { method: 'POST', body: '{}' }),
  getSession: (id: string) => request<{ session: InterviewSession }>(`/api/sessions/${encodeURIComponent(id)}`),
  uploadResume: (id: string, body: unknown) => request<{ session: InterviewSession; extraction: { fileName: string; method: string; characters: number } }>(`/api/sessions/${encodeURIComponent(id)}/resume`, { method: 'POST', body: JSON.stringify(body) }),
  saveProfile: (id: string, profile: InterviewSession['profile']) => request<{ session: InterviewSession }>(`/api/sessions/${encodeURIComponent(id)}/profile`, { method: 'PATCH', body: JSON.stringify({ profile }) }),
  previewGitHub: (url: string) => request<{ type: string; profile: { login: string; name?: string }; repositories: Array<{ owner: string; name: string; fullName: string; description?: string; language?: string; updatedAt: string }>; cached: boolean }>('/api/github/preview', { method: 'POST', body: JSON.stringify({ url }) }),
  saveGitHub: (id: string, repositories: Array<{ owner: string; name: string }>, skipped = false) => request<{ session: InterviewSession; results: unknown[] }>(`/api/sessions/${encodeURIComponent(id)}/github`, { method: 'POST', body: JSON.stringify({ repositories, skipped }) }),
  start: (id: string, domain: string) => request<{ session: InterviewSession }>(`/api/sessions/${encodeURIComponent(id)}/start`, { method: 'POST', body: JSON.stringify({ domain }) }),
  answer: (id: string, answer: string, skipped = false, questionId?: string) => request<{ session: InterviewSession; answer: InterviewAnswer; report: InterviewReport | null }>(`/api/sessions/${encodeURIComponent(id)}/answer`, { method: 'POST', body: JSON.stringify({ answer, skipped, questionId }) }),
  finishReport: (id: string) => request<{ session: InterviewSession; report: InterviewReport }>(`/api/sessions/${encodeURIComponent(id)}/report`, { method: 'POST', body: '{}' }),
  hint: (id: string) => request<{ session: InterviewSession; hint: string; scoringPolicy: string }>(`/api/sessions/${encodeURIComponent(id)}/hint`, { method: 'POST', body: '{}' }),
  pause: (id: string, paused: boolean) => request<{ session: InterviewSession }>(`/api/sessions/${encodeURIComponent(id)}/${paused ? 'pause' : 'resume'}`, { method: 'POST', body: '{}' }),
  reports: () => request<{ reports: InterviewReport[] }>('/api/reports'),
  report: (id: string) => request<{ report: InterviewReport }>(`/api/reports/${encodeURIComponent(id)}`),
  analyze: async (id: string, onEvent: (event: { type: string; stage?: string; message: string; progress?: number; session?: InterviewSession }) => void) => {
    const response = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(id)}/analyze`, { method: 'POST', signal: AbortSignal.timeout(180000), headers: { 'Content-Type': 'application/json', 'X-PlacementIQ-Owner': ownerId() }, body: '{}' });
    if (!response.ok || !response.body) throw new Error('Analysis could not start.');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    let completed = false;
    const emit = (line: string) => { const event = JSON.parse(line); if (event.type === 'complete') completed = true; onEvent(event); };
    try {
    while (true) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = pending.split('\n');
      pending = lines.pop() || '';
      for (const line of lines) if (line.trim()) emit(line);
      if (done) break;
    }
    if (pending.trim()) emit(pending);
    if (!completed) throw new Error('Analysis was interrupted. Resume it to continue from your saved evidence.');
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
};
