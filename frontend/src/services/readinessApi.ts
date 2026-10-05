import { request, type InterviewReport } from './interviewApi';

export interface BaselineField { key: string; label: string; type: 'select' | 'number'; options?: string[]; min?: number; max?: number; step?: number; integer?: boolean }
export interface BaselineSource { value?: string | number; source: string; passage?: string; confirmed: boolean; corrected?: boolean }
export interface PreparationAction { type: string; title: string; reason: string; steps: string[]; status?: string; startedAt?: string }
export interface IntegratedAssessment {
  id: string; sessionId: string; createdAt: string;
  baseline: null | { score: number; probability: number; predictedClass: string; modelName: string; modelVersion: string; timestamp: string; inputs: Record<string, number | string>; sources: Record<string, BaselineSource>; featureOrder: string[] };
  interview: null | InterviewReport['assessment'] & { reportId: string; timestamp: string; provenance: InterviewReport['provenance']; uncertainty: Array<{ uncertainty: string; reviewNeeded: boolean; evidenceStatus?: string }> };
  policy: { version: string; baselineThreshold: number; interviewThreshold: number; baselineWeight: number; interviewWeight: number; weightStatus: string };
  result: { status: string; category: string; explanation: string; reviewNeeded?: boolean; action: PreparationAction | null; composite: null | { value: number; baselineScore: number; interviewScore: number; baselineWeight: number; interviewWeight: number; label: string } };
  preparation?: PreparationAction;
  timeline: Array<{ stage: string; message: string; timestamp: string }>;
}
export const readinessApi = {
  schema: (session?: string) => request<{ fields: BaselineField[]; modelVersion: string; modelName: string; prefill: Record<string, BaselineSource> }>(`/api/baseline/schema${session ? `?session=${encodeURIComponent(session)}` : ''}`),
  predict: (inputs: Record<string, string | number>, sessionId?: string) => request<{ assessment: IntegratedAssessment }>('/api/assessments', { method: 'POST', body: JSON.stringify({ inputs, sessionId, confirmed: true }) }),
  list: () => request<{ assessments: IntegratedAssessment[] }>('/api/assessments'),
  get: (id: string) => request<{ assessment: IntegratedAssessment }>(`/api/assessments/${encodeURIComponent(id)}`),
  prepare: (id: string) => request<{ assessment: IntegratedAssessment }>(`/api/assessments/${encodeURIComponent(id)}/prepare`, { method: 'POST', body: '{}' }),
};
