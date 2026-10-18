import { request, type InterviewReport } from './interviewApi';

export interface BaselineField { key: string; label: string; type: 'select' | 'number'; options?: string[]; min?: number; max?: number; step?: number; integer?: boolean }
export interface BaselineSource { value?: string | number; source: string; passage?: string; confirmed: boolean; corrected?: boolean }
export interface PreparationAction { type: string; title: string; reason: string; steps: string[]; status?: string; startedAt?: string }

export interface XAIWaterfallStep {
  step: string;
  value?: number;
  delta: number;
  studentValue?: number | string;
  type: 'base' | 'total' | 'positive' | 'negative' | 'neutral';
}

export interface XAIAttribution {
  feature: string;
  label: string;
  studentValue: number | string;
  baselineValue: number | string;
  contributionPct: number;
  direction: 'positive' | 'negative' | 'neutral';
}

export interface XAIExplanation {
  baseProbability: number;
  finalProbability: number;
  // Probabilities and contributions use percent / percentage points, never fractions.
  attributions: XAIAttribution[];
  topDrivers: XAIAttribution[];
  topDrags: XAIAttribution[];
  waterfall: XAIWaterfallStep[];
  summaryText: string;
  method?: string;
  modelVersion: string;
  modelName: string;
}

export interface CounterfactualAction {
  feature: string;
  label: string;
  from: number;
  to: number;
  delta: number;
  priority: 'critical' | 'high' | 'medium';
  difficulty: 'Low' | 'Medium' | 'High';
  unit: string;
  rationale: string;
}

export interface CounterfactualPlan {
  targetReached: boolean;
  currentProbability: number;
  targetProbability: number;
  achievedProbability: number;
  recommendedActions: CounterfactualAction[];
  effortLevel: string;
  optimizedInputs: Record<string, string | number>;
}

export interface RoadmapTask {id:string;title:string;skill:string;stage:number;category:string;description:string;why:string;action:string;aiPractice?:string;outcome:string;completionCriteria:string;estimatedHours:number;priority:string;priorityScore:number;priorityFactors:Record<string,number|string>;evidence:{questionId?:string;source:string};resources:Array<{title:string;url:string;difficulty:string}>;week:number|null;completed:boolean;status:string;notes:string;completedAt:string|null;}
export interface PreparationPreferences {targetRole:string;weeks:number;hoursPerWeek:number;goal:string;useAI:boolean;}
export interface Roadmap {id:string;version:number;demo:boolean;startDate:string|null;updatedAt:string;preferences:PreparationPreferences|null;status:string;tasks:RoadmapTask[];stages:string[];changeReason:string;generation:{method:string;wallMs?:number;notice?:string};}
export interface IntegratedAssessment {
  roadmap?:Roadmap;roadmapVersions?:Roadmap[];
  id: string; sessionId: string; createdAt: string; status?:string; demo?:{name:string;level:string};candidateSnapshot?:{name:string|null;details?:any;profile?:any;github?:any}; tasks?:Array<{id:string;title:string;action:string;priority:string;reviewDate?:string;completed:boolean;completedAt?:string}>;
  baseline: null | {
    score: number;
    probability: number;
    predictedClass: string;
    modelName: string;
    modelVersion: string;
    timestamp: string;
    inputs: Record<string, number | string>;
    sources: Record<string, BaselineSource>;
    featureOrder: string[];
    explanation?: XAIExplanation | null;
  };
  interview: null | InterviewReport['assessment'] & { reportId: string; timestamp: string; provenance: InterviewReport['provenance']; uncertainty: Array<{ uncertainty: string; reviewNeeded: boolean; evidenceStatus?: string }> };
  policy: { version: string; baselineThreshold: number; interviewThreshold: number; baselineWeight: number; interviewWeight: number; weightStatus: string };
  result: { status: string; category: string; explanation: string; reviewNeeded?: boolean; action: PreparationAction | null; composite: null | { value: number; baselineScore: number; interviewScore: number; baselineWeight: number; interviewWeight: number; label: string } };
  preparation?: PreparationAction;
  timeline: Array<{ stage: string; message: string; timestamp: string }>;
}
export const readinessApi = {
  roadmap:(id:string)=>request<{assessment:IntegratedAssessment}>(`/api/assessments/${id}/roadmap`),
  schedule:(id:string,preferences:PreparationPreferences)=>request<{assessment:IntegratedAssessment}>(`/api/assessments/${id}/roadmap`,{method:'POST',body:JSON.stringify(preferences)}),
  editTask:(id:string,taskId:string,patch:Partial<Pick<RoadmapTask,'status'|'completed'|'notes'|'week'>>)=>request<{assessment:IntegratedAssessment}>(`/api/assessments/${id}/tasks/${taskId}`,{method:'PATCH',body:JSON.stringify(patch)}),
  schema: (session?: string) => request<{ fields: BaselineField[]; modelVersion: string; modelName: string; prefill: Record<string, BaselineSource>;conflicts?:Array<{key:string;previous:BaselineSource;current:BaselineSource}> }>(`/api/baseline/schema${session ? `?session=${encodeURIComponent(session)}` : ''}`),
  predict: (inputs: Record<string, string | number>, sessionId?: string) => request<{ assessment: IntegratedAssessment }>('/api/assessments', { method: 'POST', body: JSON.stringify({ inputs, sessionId, confirmed: true }) }),
  list: () => request<{ assessments: IntegratedAssessment[] }>('/api/assessments'),
  get: (id: string) => request<{ assessment: IntegratedAssessment }>(`/api/assessments/${encodeURIComponent(id)}`),
  prepare: (id: string) => request<{ assessment: IntegratedAssessment }>(`/api/assessments/${encodeURIComponent(id)}/prepare`, { method: 'POST', body: '{}' }),
  task:(id:string,taskId:string,completed:boolean)=>request<{assessment:IntegratedAssessment}>(`/api/assessments/${id}/tasks/${taskId}`,{method:'PATCH',body:JSON.stringify({completed})}),
  explain: (inputs: Record<string, string | number>) => request<{ explanation: XAIExplanation }>('/api/baseline/explain', { method: 'POST', body: JSON.stringify({ inputs }) }),
  counterfactual: (inputs: Record<string, string | number>, targetProbability?: number) => request<{ plan: CounterfactualPlan }>('/api/baseline/counterfactual', { method: 'POST', body: JSON.stringify({ inputs, targetProbability }) }),
};

