import { create } from 'zustand';
import type {
  AppData,
  AssessmentDraft,
  AssessmentSnapshot,
  ActionTask,
  Scenario,
  StudentProfile,
  EvaluationResult,
  UserPreferences,
} from '../types';
import { STORAGE_KEY, STORAGE_VERSION, SAMPLE_PROFILE } from '../config';
import { predictionService } from './prediction';

// ─── Storage Helpers ────────────────────────────────────────────────────────
function loadFromStorage(): AppData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AppData;
    if (data.version !== STORAGE_VERSION) return null;
    // Old demo snapshots must never masquerade as a completed student assessment.
    const assessments = (data.assessments || []).filter((item) => !item.id.startsWith('sample-') && item.label !== 'Sample Profile');
    return { ...data, assessments, sampleProfileLoaded: false };
  } catch {
    return null;
  }
}

function saveToStorage(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('PlacementIQ: Failed to save to localStorage', e);
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

const DEFAULT_DATA: AppData = {
  version: STORAGE_VERSION,
  assessments: [],
  tasks: [],
  scenarios: [],
  preferences: {},
};

// ─── Store Interface ────────────────────────────────────────────────────────
interface AppStore extends AppData {
  // Draft
  initDraft: () => void;
  updateDraft: (profile: Partial<StudentProfile>) => void;
  setDraftStep: (step: number) => void;
  clearDraft: () => void;

  // Assessment
  submitAssessment: (profile: StudentProfile) => Promise<AssessmentSnapshot>;
  recordBaselineAssessment: (profile: StudentProfile, id?: string) => Promise<AssessmentSnapshot>;
  getLatestAssessment: () => AssessmentSnapshot | undefined;

  // Sample profile
  loadSampleProfile: () => Promise<void>;

  // Tasks
  addTask: (task: Omit<ActionTask, 'id' | 'createdAt' | 'status'>) => void;
  updateTask: (id: string, updates: Partial<ActionTask>) => void;
  deleteTask: (id: string) => void;
  hasTask: (feature: string, title: string) => boolean;

  // Scenarios
  saveScenario: (scenario: Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateScenario: (id: string, updates: Partial<Scenario>) => void;
  deleteScenario: (id: string) => void;

  // Preferences
  updatePreferences: (prefs: Partial<UserPreferences>) => void;

  // Data management
  exportData: () => string;
  clearAllData: () => void;

  // Internal
  _persist: () => void;
}

export const useStore = create<AppStore>((set, get) => {
  const initial = loadFromStorage() ?? DEFAULT_DATA;

  return {
    ...initial,

    // ── Draft ─────────────────────────────────────────────────────────────
    initDraft: () => {
      const state = get();
      if (!state.draft) {
        set({
          draft: {
            id: generateId(),
            step: 1,
            lastSaved: new Date().toISOString(),
            profile: {},
            isDirty: false,
          },
        });
        get()._persist();
      }
    },

    updateDraft: (profile) => {
      set((state) => ({
        draft: state.draft
          ? {
              ...state.draft,
              profile: { ...state.draft.profile, ...profile },
              lastSaved: new Date().toISOString(),
              isDirty: true,
            }
          : undefined,
      }));
      get()._persist();
    },

    setDraftStep: (step) => {
      set((state) => ({
        draft: state.draft ? { ...state.draft, step } : undefined,
      }));
      get()._persist();
    },

    clearDraft: () => {
      set({ draft: undefined });
      get()._persist();
    },

    // ── Assessment ────────────────────────────────────────────────────────
    submitAssessment: async (profile) => {
      const evaluation = await predictionService.evaluate(profile);
      const snapshot: AssessmentSnapshot = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        profile,
        evaluation,
      };
      set((state) => ({
        assessments: [...state.assessments, snapshot],
        draft: undefined,
        sampleProfileLoaded: state.sampleProfileLoaded,
      }));
      get()._persist();
      return snapshot;
    },

    recordBaselineAssessment: async (profile, id) => {
      const evaluation = await predictionService.evaluate(profile);
      const snapshot: AssessmentSnapshot = {
        id: id || generateId(),
        timestamp: new Date().toISOString(),
        profile,
        evaluation,
        label: 'Illustrative workspace score from confirmed baseline inputs',
      };
      set((state) => ({
        assessments: [...state.assessments.filter((item) => item.id !== snapshot.id), snapshot],
      }));
      get()._persist();
      return snapshot;
    },

    getLatestAssessment: () => {
      const state = get();
      const studentAssessment = [...state.assessments].reverse().find((item) => !item.id.startsWith('sample-') && item.label !== 'Sample Profile');
      if (studentAssessment) return studentAssessment;
      if (state.sampleProfileLoaded) {
        return [...state.assessments].reverse().find((item) => item.label === 'Sample Profile' || item.id.startsWith('sample-'));
      }
      return undefined;
    },

    // ── Sample Profile ────────────────────────────────────────────────────
    loadSampleProfile: async () => {
      const evaluation = await predictionService.evaluate(SAMPLE_PROFILE as StudentProfile);
      const snapshot: AssessmentSnapshot = {
        id: `sample-${generateId()}`,
        timestamp: new Date().toISOString(),
        profile: SAMPLE_PROFILE as StudentProfile,
        evaluation,
        label: 'Sample Profile',
      };
      set((state) => ({
        assessments: [...state.assessments, snapshot],
        sampleProfileLoaded: true,
      }));
      get()._persist();
    },

    // ── Tasks ─────────────────────────────────────────────────────────────
    addTask: (task) => {
      const newTask: ActionTask = {
        ...task,
        id: generateId(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      set((state) => ({ tasks: [...state.tasks, newTask] }));
      get()._persist();
    },

    updateTask: (id, updates) => {
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id
            ? {
                ...t,
                ...updates,
                completedAt:
                  updates.status === 'completed'
                    ? new Date().toISOString()
                    : updates.status === 'pending'
                    ? undefined
                    : t.completedAt,
              }
            : t
        ),
      }));
      get()._persist();
    },

    deleteTask: (id) => {
      set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
      get()._persist();
    },

    hasTask: (feature, title) => {
      return get().tasks.some((t) => t.feature === feature && t.title === title);
    },

    // ── Scenarios ─────────────────────────────────────────────────────────
    saveScenario: (scenario) => {
      const now = new Date().toISOString();
      const newScenario: Scenario = {
        ...scenario,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      set((state) => ({ scenarios: [...state.scenarios, newScenario] }));
      get()._persist();
    },

    updateScenario: (id, updates) => {
      set((state) => ({
        scenarios: state.scenarios.map((s) =>
          s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
        ),
      }));
      get()._persist();
    },

    deleteScenario: (id) => {
      set((state) => ({ scenarios: state.scenarios.filter((s) => s.id !== id) }));
      get()._persist();
    },

    // ── Preferences ───────────────────────────────────────────────────────
    updatePreferences: (prefs) => {
      set((state) => ({
        preferences: { ...state.preferences, ...prefs },
      }));
      get()._persist();
    },

    // ── Data Management ───────────────────────────────────────────────────
    exportData: () => {
      const state = get();
      const exportObj: AppData = {
        version: state.version,
        draft: state.draft,
        assessments: state.assessments,
        tasks: state.tasks,
        scenarios: state.scenarios,
        preferences: state.preferences,
      };
      return JSON.stringify(exportObj, null, 2);
    },

    clearAllData: () => {
      localStorage.removeItem(STORAGE_KEY);
      set({ ...DEFAULT_DATA, draft: undefined, sampleProfileLoaded: undefined });
    },

    // ── Persistence ───────────────────────────────────────────────────────
    _persist: () => {
      const state = get();
      saveToStorage({
        version: state.version,
        draft: state.draft,
        assessments: state.assessments,
        tasks: state.tasks,
        scenarios: state.scenarios,
        preferences: state.preferences,
        sampleProfileLoaded: state.sampleProfileLoaded,
      });
    },
  };
});
