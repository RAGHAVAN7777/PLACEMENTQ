// ─── Dataset Column Names (canonical) ───────────────────────────────────────
export const DATASET_COLUMNS = [
  'student_id', 'age', 'gender', 'cgpa', 'branch', 'college_tier',
  'internships_count', 'projects_count', 'certifications_count',
  'coding_skill_score', 'aptitude_score', 'communication_skill_score',
  'logical_reasoning_score', 'hackathons_participated', 'github_repos',
  'linkedin_connections', 'mock_interview_score', 'attendance_percentage',
  'backlogs', 'extracurricular_score', 'leadership_score',
  'volunteer_experience', 'sleep_hours', 'study_hours_per_day',
  'placement_status', 'salary_package_lpa'
] as const;

export type DatasetColumn = typeof DATASET_COLUMNS[number];

// ─── Branch / Tier ──────────────────────────────────────────────────────────
export const BRANCHES = ['CSE', 'IT', 'ECE', 'EEE', 'ME', 'CE', 'Other'] as const;
export type Branch = typeof BRANCHES[number];

export const COLLEGE_TIERS = ['Tier 1', 'Tier 2', 'Tier 3'] as const;
export type CollegeTier = typeof COLLEGE_TIERS[number];

// ─── Student Profile (maps to dataset features) ────────────────────────────
export interface StudentProfile {
  // Core academic
  cgpa: number;                        // 0–10
  branch: Branch;
  college_tier: CollegeTier;

  // Experience counts
  internships_count: number;           // ≥ 0 integer
  projects_count: number;              // ≥ 0 integer
  certifications_count: number;        // ≥ 0 integer

  // Skill scores (0–100)
  coding_skill_score: number;
  aptitude_score: number;
  communication_skill_score: number;
  logical_reasoning_score: number;
  mock_interview_score: number;

  // Activity counts
  hackathons_participated: number;     // ≥ 0 integer
  github_repos: number;               // ≥ 0 integer

  // Academic metrics
  attendance_percentage: number;       // 0–100
  backlogs: number;                    // ≥ 0 integer

  // Supplementary (optional)
  extracurricular_score?: number;      // 0–100
  leadership_score?: number;           // 0–100
  volunteer_experience?: string;       // Yes/No in dataset
  study_hours_per_day?: number;        // 0–24
}

// ─── Assessment Draft ───────────────────────────────────────────────────────
export interface AssessmentDraft {
  id: string;
  step: number;               // 1–4
  lastSaved: string;          // ISO timestamp
  profile: Partial<StudentProfile>;
  isDirty: boolean;
}

// ─── Assessment Snapshot ────────────────────────────────────────────────────
export interface AssessmentSnapshot {
  id: string;
  timestamp: string;          // ISO timestamp
  profile: StudentProfile;
  evaluation: EvaluationResult;
  label?: string;             // Optional user label, e.g. "Before prep course"
}

// ─── Readiness Band ─────────────────────────────────────────────────────────
export type ReadinessBand = 'needs-preparation' | 'developing' | 'well-prepared';

// ─── Evaluation Result ──────────────────────────────────────────────────────
export type EvaluationMode = 'illustrative' | 'model';

export interface EvaluationResult {
  mode: EvaluationMode;
  illustrativeReadinessScore: number;  // 0–100, product-defined
  readinessBand: ReadinessBand;
  placementProbability?: number;       // Only from actual ML service
  featureContributions: FeatureContribution[];
  recommendations: Recommendation[];
  timestamp: string;
}

export interface FeatureContribution {
  feature: string;
  label: string;
  value: number;
  contribution: number;       // Relative weight in scoring
  direction: 'positive' | 'negative' | 'neutral';
}

// ─── Skill Gap ──────────────────────────────────────────────────────────────
export interface SkillGap {
  feature: string;
  label: string;
  category: 'academic' | 'skill' | 'experience' | 'activity';
  currentValue: number;
  target: number;
  gap: number;                // target - currentValue (positive means below target)
  unit: string;
  suggestedAction: string;
}

// ─── Recommendation ─────────────────────────────────────────────────────────
export interface Recommendation {
  id: string;
  feature: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  effort: 'small' | 'medium' | 'large';
  category: string;
}

// ─── Action Task ────────────────────────────────────────────────────────────
export type TaskStatus = 'pending' | 'in-progress' | 'completed';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface ActionTask {
  id: string;
  title: string;
  rationale: string;
  priority: TaskPriority;
  effort: 'small' | 'medium' | 'large';
  targetDate?: string;        // ISO date
  status: TaskStatus;
  feature: string;            // Related skill/feature
  category: string;
  createdAt: string;
  completedAt?: string;
}

// ─── Scenario ───────────────────────────────────────────────────────────────
export interface Scenario {
  id: string;
  name: string;
  baseAssessmentId: string;
  hypotheticalProfile: Partial<StudentProfile>;
  evaluation?: EvaluationResult;
  createdAt: string;
  updatedAt: string;
}

// ─── Model Evaluation Artifact ──────────────────────────────────────────────
export interface ModelMetrics {
  modelName: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  rocAuc: number;
}

export interface ConfusionMatrixData {
  truePositive: number;
  falsePositive: number;
  trueNegative: number;
  falseNegative: number;
}

export interface ModelEvaluationArtifact {
  status: 'pending' | 'preliminary' | 'validated';
  splitConfig?: {
    testSize: number;
    randomState: number;
    stratified: boolean;
  };
  models: ModelMetrics[];
  confusionMatrices?: Record<string, ConfusionMatrixData>;
  rocCurves?: Record<string, { fpr: number[]; tpr: number[] }>;
  featureImportances?: Record<string, { feature: string; importance: number }[]>;
  notes: string[];
}

// ─── Feature Definition (for UI and validation) ─────────────────────────────
export interface FeatureDefinition {
  key: keyof StudentProfile;
  label: string;
  shortLabel: string;
  category: 'academic' | 'skill' | 'experience' | 'activity' | 'supplementary';
  type: 'number' | 'select';
  required: boolean;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: readonly string[];
  description?: string;
  target: number;             // Illustrative preparation benchmark
  warningThreshold?: { low?: number; high?: number; message: string };
}

// ─── App State ──────────────────────────────────────────────────────────────
export interface UserPreferences {
  displayName?: string;
}

export interface AppData {
  version: number;
  draft?: AssessmentDraft;
  assessments: AssessmentSnapshot[];
  tasks: ActionTask[];
  scenarios: Scenario[];
  preferences: UserPreferences;
  sampleProfileLoaded?: boolean;
}

// ─── Counterfactual Optimization Types ─────────────────────────────────────
export interface CounterfactualChange {
  feature: keyof StudentProfile;
  label: string;
  currentValue: number;
  recommendedValue: number;
  delta: number;
  unit: string;
  roiScore: number; // Return on investment: score boost / effort
  rationale: string;
}

export interface CounterfactualPath {
  id: string;
  name: string;
  tagline: string;
  targetScore: number;
  projectedScore: number;
  scoreDelta: number;
  effortTier: 'low' | 'medium' | 'high';
  estimatedWeeks: string;
  changes: CounterfactualChange[];
  summary: string;
  hypotheticalProfile: Partial<StudentProfile>;
}

// ─── Assessment Policy Types ───────────────────────────────────────────────
export type PolicyMode = 'standard' | 'high-recall';

export interface PolicyDefinition {
  mode: PolicyMode;
  name: string;
  shortName: string;
  cutoff: number;
  description: string;
  recall: number;
  precision: number;
  accuracy: number;
  rescuedCount: number;
  tagline: string;
}

