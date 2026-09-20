import type { FeatureDefinition } from '../types';

// ─── Design Tokens ──────────────────────────────────────────────────────────
export const TOKENS = {
  colors: {
    canvas: '#F5F3ED',
    canvasAlt: '#ECEAE3',
    text: '#171917',
    textSecondary: '#555750',
    textTertiary: '#888880',
    primary: '#244BDB',
    primaryHover: '#1A3AB0',
    primaryLight: '#E8ECFA',
    border: '#D8D5CC',
    borderLight: '#E8E6DF',
    success: '#2D7A3A',
    successLight: '#E8F5EA',
    warning: '#B5850B',
    warningLight: '#FFF8E1',
    error: '#C62828',
    errorLight: '#FDECEA',
    white: '#FFFFFF',
    particle: '#3A3D3A',
    particleAccent: '#244BDB',
  },
  fonts: {
    sans: "'Manrope', 'Inter', system-ui, -apple-system, sans-serif",
    serif: "'Instrument Serif', 'Georgia', 'Times New Roman', serif",
    mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', 'Consolas', monospace",
  },
  radii: {
    sm: '4px',
    md: '6px',
    lg: '8px',
  },
  shadows: {
    sm: '0 1px 2px rgba(23,25,23,0.06)',
    md: '0 2px 8px rgba(23,25,23,0.08)',
    lg: '0 4px 16px rgba(23,25,23,0.1)',
  },
  maxWidth: '1440px',
  sidebarWidth: '232px',
} as const;

// ─── Routes ─────────────────────────────────────────────────────────────────
export const ROUTES = {
  home: '/',
  assessment: '/assessment',
  overview: '/app/overview',
  skills: '/app/skills',
  scenarios: '/app/scenarios',
  plan: '/app/plan',
  progress: '/app/progress',
  modelLab: '/app/model-lab',
  profile: '/app/profile',
} as const;

// ─── Readiness Thresholds ───────────────────────────────────────────────────
export const READINESS_THRESHOLDS = {
  needsPreparation: { max: 40, label: 'Needs preparation', color: '#C62828' },
  developing: { max: 65, label: 'Developing', color: '#B5850B' },
  wellPrepared: { max: 100, label: 'Well prepared', color: '#2D7A3A' },
} as const;

// ─── Feature Definitions ────────────────────────────────────────────────────
export const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  // Academic
  {
    key: 'cgpa', label: 'CGPA', shortLabel: 'CGPA',
    category: 'academic', type: 'number', required: true,
    min: 0, max: 10, step: 0.01, unit: '/ 10',
    description: 'Cumulative Grade Point Average on a 10-point scale.',
    target: 7.5,
    warningThreshold: { low: 3.0, message: 'CGPA below 3.0 is uncommon in the dataset.' },
  },
  {
    key: 'branch', label: 'Branch / Department', shortLabel: 'Branch',
    category: 'academic', type: 'select', required: true,
    options: ['CSE', 'IT', 'ECE', 'EEE', 'ME', 'CE', 'Other'],
    description: 'Your academic department or branch of study.',
    target: 0,
  },
  {
    key: 'college_tier', label: 'College Tier', shortLabel: 'Tier',
    category: 'academic', type: 'select', required: true,
    options: ['Tier 1', 'Tier 2', 'Tier 3'],
    description: 'A dataset categorisation based on college ranking group. This reflects a dataset label, not a judgement of educational quality.',
    target: 0,
  },
  {
    key: 'attendance_percentage', label: 'Attendance', shortLabel: 'Attendance',
    category: 'academic', type: 'number', required: true,
    min: 0, max: 100, step: 0.1, unit: '%',
    description: 'Overall attendance percentage.',
    target: 80,
  },
  {
    key: 'backlogs', label: 'Active Backlogs', shortLabel: 'Backlogs',
    category: 'academic', type: 'number', required: true,
    min: 0, max: 50, step: 1, unit: 'count',
    description: 'Number of active (uncleared) backlogs.',
    target: 0,
  },

  // Skills
  {
    key: 'coding_skill_score', label: 'Coding Skill Score', shortLabel: 'Coding',
    category: 'skill', type: 'number', required: true,
    min: 0, max: 100, step: 0.1, unit: '/ 100',
    description: 'Self-reported coding ability score. Should eventually be derived from a structured assessment.',
    target: 75,
  },
  {
    key: 'aptitude_score', label: 'Aptitude Score', shortLabel: 'Aptitude',
    category: 'skill', type: 'number', required: true,
    min: 0, max: 100, step: 0.1, unit: '/ 100',
    description: 'Quantitative and verbal aptitude test score.',
    target: 70,
  },
  {
    key: 'communication_skill_score', label: 'Communication Score', shortLabel: 'Communication',
    category: 'skill', type: 'number', required: true,
    min: 0, max: 100, step: 0.1, unit: '/ 100',
    description: 'Communication ability assessment score.',
    target: 65,
  },
  {
    key: 'logical_reasoning_score', label: 'Logical Reasoning Score', shortLabel: 'Logic',
    category: 'skill', type: 'number', required: true,
    min: 0, max: 100, step: 0.1, unit: '/ 100',
    description: 'Logical and analytical reasoning test score.',
    target: 70,
  },
  {
    key: 'mock_interview_score', label: 'Mock Interview Score', shortLabel: 'Interview',
    category: 'skill', type: 'number', required: true,
    min: 0, max: 100, step: 0.1, unit: '/ 100',
    description: 'Mock interview performance score.',
    target: 65,
  },

  // Experience
  {
    key: 'internships_count', label: 'Internships Completed', shortLabel: 'Internships',
    category: 'experience', type: 'number', required: true,
    min: 0, max: 20, step: 1, unit: 'count',
    description: 'Number of internships completed.',
    target: 2,
    warningThreshold: { high: 10, message: 'More than 10 internships is uncommon in the dataset.' },
  },
  {
    key: 'projects_count', label: 'Projects Completed', shortLabel: 'Projects',
    category: 'experience', type: 'number', required: true,
    min: 0, max: 30, step: 1, unit: 'count',
    description: 'Number of technical projects completed.',
    target: 3,
  },
  {
    key: 'certifications_count', label: 'Certifications', shortLabel: 'Certs',
    category: 'experience', type: 'number', required: true,
    min: 0, max: 30, step: 1, unit: 'count',
    description: 'Number of professional certifications obtained.',
    target: 2,
  },

  // Activity
  {
    key: 'hackathons_participated', label: 'Hackathons Participated', shortLabel: 'Hackathons',
    category: 'activity', type: 'number', required: true,
    min: 0, max: 30, step: 1, unit: 'count',
    description: 'Number of hackathons participated in.',
    target: 2,
  },
  {
    key: 'github_repos', label: 'GitHub Repositories', shortLabel: 'GitHub',
    category: 'activity', type: 'number', required: true,
    min: 0, max: 100, step: 1, unit: 'repos',
    description: 'Number of public GitHub repositories.',
    target: 5,
  },

  // Supplementary
  {
    key: 'extracurricular_score', label: 'Extracurricular Score', shortLabel: 'Extracurricular',
    category: 'supplementary', type: 'number', required: false,
    min: 0, max: 100, step: 0.1, unit: '/ 100',
    description: 'Overall extracurricular involvement score (optional).',
    target: 50,
  },
  {
    key: 'leadership_score', label: 'Leadership Score', shortLabel: 'Leadership',
    category: 'supplementary', type: 'number', required: false,
    min: 0, max: 100, step: 0.1, unit: '/ 100',
    description: 'Leadership experience score (optional).',
    target: 50,
  },
  {
    key: 'volunteer_experience', label: 'Volunteer Experience', shortLabel: 'Volunteer',
    category: 'supplementary', type: 'select', required: false,
    options: ['Yes', 'No'],
    description: 'Whether you have volunteer experience (optional).',
    target: 0,
  },
  {
    key: 'study_hours_per_day', label: 'Study Hours per Day', shortLabel: 'Study',
    category: 'supplementary', type: 'number', required: false,
    min: 0, max: 24, step: 0.5, unit: 'hrs',
    description: 'Average daily study hours (optional).',
    target: 4,
  },
];

// ─── Assessment Steps ───────────────────────────────────────────────────────
export const ASSESSMENT_STEPS = [
  { id: 1, title: 'Academic Profile', categories: ['academic'] as const },
  { id: 2, title: 'Technical Experience', categories: ['experience', 'activity'] as const },
  { id: 3, title: 'Skills & Preparation', categories: ['skill', 'supplementary'] as const },
  { id: 4, title: 'Review & Submit', categories: [] as const },
];

// ─── Scenario Editable Fields ───────────────────────────────────────────────
export const SCENARIO_EDITABLE_FIELDS: (keyof import('../types').StudentProfile)[] = [
  'coding_skill_score',
  'communication_skill_score',
  'aptitude_score',
  'logical_reasoning_score',
  'mock_interview_score',
  'projects_count',
  'internships_count',
  'certifications_count',
  'hackathons_participated',
  'github_repos',
  'study_hours_per_day',
];

// ─── Dataset Metadata ───────────────────────────────────────────────────────
export const DATASET_META = {
  filename: 'student_placement_prediction_dataset_2026.csv',
  rows: 100_000,
  columns: 26,
  placed: 54_459,
  notPlaced: 45_541,
  missingValues: 0,
  duplicatesExcludingId: 0,
  target: 'placement_status',
  excludedFromPrediction: ['student_id', 'salary_package_lpa'],
  salaryLeakageExplanation:
    'All not-placed records have salary_package_lpa = 0, while placed records have positive values. ' +
    'Salary is known after the placement outcome, making it a leaked feature that must be excluded.',
  provenance:
    'Dataset provenance is not yet verified. Its numerical patterns suggest generated data, ' +
    'but confirmed synthetic origin cannot be asserted without source documentation.',
};

// ─── Preliminary Model Results ──────────────────────────────────────────────
export const PRELIMINARY_RESULTS = {
  status: 'preliminary' as const,
  label: 'Reported preliminary run — reproduction pending',
  splitConfig: {
    testSize: 0.2,
    randomState: 42,
    stratified: true,
  },
  notes: [
    'These metrics used all remaining dataset columns (including demographic fields) after excluding student_id and salary_package_lpa.',
    'They must not be misrepresented as evaluation of a later reduced feature set.',
    'ROC curves, confusion matrices, and feature importances are not available from these aggregate metrics.',
  ],
  models: [
    { modelName: 'Logistic Regression', accuracy: 57.00, precision: 57.89, recall: 77.24, f1Score: 66.18, rocAuc: 0.5849 },
    { modelName: 'Decision Tree (depth=8)', accuracy: 54.84, precision: 57.23, recall: 67.61, f1Score: 61.99, rocAuc: 0.5535 },
    { modelName: 'Random Forest (150 trees, depth=14)', accuracy: 56.52, precision: 56.97, recall: 82.33, f1Score: 67.34, rocAuc: 0.5772 },
  ],
  majorityBaseline: 54.46,
};

// ─── Sample Profile ─────────────────────────────────────────────────────────
export const SAMPLE_PROFILE = {
  cgpa: 7.5,
  branch: 'CSE' as const,
  college_tier: 'Tier 2' as const,
  internships_count: 2,
  projects_count: 4,
  certifications_count: 3,
  coding_skill_score: 72,
  aptitude_score: 65,
  communication_skill_score: 58,
  logical_reasoning_score: 68,
  mock_interview_score: 55,
  hackathons_participated: 2,
  github_repos: 8,
  attendance_percentage: 82,
  backlogs: 0,
  extracurricular_score: 45,
  leadership_score: 38,
  study_hours_per_day: 3.5,
};

// ─── Local Storage Keys ─────────────────────────────────────────────────────
export const STORAGE_KEY = 'placementiq_data';
export const STORAGE_VERSION = 1;
