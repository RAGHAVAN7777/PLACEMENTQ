/**
 * Illustrative Prediction Service
 *
 * This module provides a DEMONSTRATION evaluator for the PlacementIQ frontend.
 * It uses transparent, rule-based scoring with documented weights and thresholds.
 *
 * IMPORTANT: These scores are illustrative preparation-readiness estimates.
 * They are NOT placement predictions from a trained model.
 *
 * The weights below are product-defined assumptions chosen for reasonable
 * face-validity, not empirically validated coefficients.
 */

import type {
  StudentProfile,
  EvaluationResult,
  FeatureContribution,
  Recommendation,
  SkillGap,
  ReadinessBand,
} from '../types';
import { FEATURE_DEFINITIONS, READINESS_THRESHOLDS } from '../config';

// ─── Illustrative Weights ───────────────────────────────────────────────────
// These are transparent, product-defined weights for the readiness score.
// They are NOT model coefficients or empirically validated.
const ILLUSTRATIVE_WEIGHTS: Record<string, { weight: number; normalize: (v: number) => number }> = {
  cgpa:                     { weight: 0.15, normalize: (v) => v / 10 },
  coding_skill_score:       { weight: 0.15, normalize: (v) => v / 100 },
  aptitude_score:           { weight: 0.10, normalize: (v) => v / 100 },
  communication_skill_score:{ weight: 0.08, normalize: (v) => v / 100 },
  logical_reasoning_score:  { weight: 0.08, normalize: (v) => v / 100 },
  mock_interview_score:     { weight: 0.08, normalize: (v) => v / 100 },
  internships_count:        { weight: 0.08, normalize: (v) => Math.min(v / 4, 1) },
  projects_count:           { weight: 0.07, normalize: (v) => Math.min(v / 6, 1) },
  certifications_count:     { weight: 0.04, normalize: (v) => Math.min(v / 4, 1) },
  hackathons_participated:  { weight: 0.04, normalize: (v) => Math.min(v / 4, 1) },
  github_repos:             { weight: 0.03, normalize: (v) => Math.min(v / 10, 1) },
  attendance_percentage:    { weight: 0.05, normalize: (v) => v / 100 },
  backlogs:                 { weight: 0.05, normalize: (v) => Math.max(0, 1 - v / 5) },
};

// ─── Band Classification ────────────────────────────────────────────────────
function classifyBand(score: number): ReadinessBand {
  if (score <= READINESS_THRESHOLDS.needsPreparation.max) return 'needs-preparation';
  if (score <= READINESS_THRESHOLDS.developing.max) return 'developing';
  return 'well-prepared';
}

// ─── Compute Readiness Score ────────────────────────────────────────────────
export function computeReadinessScore(profile: StudentProfile): {
  score: number;
  contributions: FeatureContribution[];
} {
  const contributions: FeatureContribution[] = [];
  let totalScore = 0;

  for (const [key, config] of Object.entries(ILLUSTRATIVE_WEIGHTS)) {
    const value = (profile as unknown as Record<string, unknown>)[key];
    if (value === undefined || value === null) continue;

    const numValue = Number(value);
    const normalised = config.normalize(numValue);
    const contribution = normalised * config.weight * 100;
    totalScore += contribution;

    const featureDef = FEATURE_DEFINITIONS.find(f => f.key === key);
    const target = featureDef?.target ?? 0;
    const targetNorm = target > 0 ? config.normalize(target) : 0.7;

    contributions.push({
      feature: key,
      label: featureDef?.label ?? key,
      value: numValue,
      contribution: +(contribution).toFixed(2),
      direction: normalised >= targetNorm ? 'positive' : normalised >= targetNorm * 0.7 ? 'neutral' : 'negative',
    });
  }

  // Sort by absolute contribution descending
  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return { score: Math.round(Math.min(100, Math.max(0, totalScore))), contributions };
}

// ─── Compute Skill Gaps ─────────────────────────────────────────────────────
export function computeSkillGaps(profile: StudentProfile): SkillGap[] {
  const gaps: SkillGap[] = [];

  for (const def of FEATURE_DEFINITIONS) {
    if (def.type === 'select' || def.target === 0) continue;

    const value = (profile as unknown as Record<string, unknown>)[def.key];
    if (value === undefined || value === null) continue;

    const numValue = Number(value);
    const gap = def.target - numValue;

    gaps.push({
      feature: def.key,
      label: def.label,
      category: def.category === 'supplementary' ? 'skill' : def.category,
      currentValue: numValue,
      target: def.target,
      gap: Math.max(0, +gap.toFixed(2)),
      unit: def.unit ?? '',
      suggestedAction: generateSuggestedAction(def.key, numValue, def.target, gap),
    });
  }

  return gaps.sort((a, b) => b.gap / Math.max(b.target, 1) - a.gap / Math.max(a.target, 1));
}

// ─── Generate Suggested Actions ─────────────────────────────────────────────
function generateSuggestedAction(key: string, current: number, target: number, gap: number): string {
  if (gap <= 0) return 'On track — maintain your current preparation level.';

  const actions: Record<string, string> = {
    cgpa: 'Focus on upcoming semester coursework. Identify weak subjects and create a revision schedule.',
    coding_skill_score: `Complete two timed coding practice sessions daily, focusing on data structures. Target score: ${target}.`,
    aptitude_score: `Practice quantitative aptitude with timed mock tests. Aim to improve by ${Math.ceil(gap)} points.`,
    communication_skill_score: 'Record a two-minute project explanation and review its structure. Practice group discussions.',
    logical_reasoning_score: 'Solve logical reasoning puzzles daily. Focus on pattern recognition and syllogisms.',
    mock_interview_score: 'Schedule two mock interviews this week. Focus on STAR method responses and technical clarity.',
    internships_count: `Apply to ${Math.ceil(gap)} more internship positions. Tailor your resume for each application.`,
    projects_count: `Build ${Math.ceil(gap)} more projects demonstrating different technical skills.`,
    certifications_count: `Complete ${Math.ceil(gap)} relevant industry certifications in your area of interest.`,
    hackathons_participated: `Participate in ${Math.ceil(gap)} more hackathons to develop teamwork and rapid prototyping skills.`,
    github_repos: `Create ${Math.ceil(gap)} more public repositories showcasing clean, documented code.`,
    attendance_percentage: `Improve attendance by ${Math.ceil(gap)}%. Consistent attendance supports structured learning.`,
    backlogs: `Clear ${Math.ceil(current)} pending backlogs. Prioritise subjects with upcoming exams.`,
    extracurricular_score: 'Engage in one new extracurricular activity that aligns with your career interests.',
    leadership_score: 'Take a leadership role in a student organisation or project team.',
    study_hours_per_day: `Increase daily study time to ${target} hours with focused, timed sessions.`,
  };

  return actions[key] ?? `Work to improve ${key.replace(/_/g, ' ')} toward the target of ${target}.`;
}

// ─── Generate Recommendations ───────────────────────────────────────────────
function generateRecommendations(
  profile: StudentProfile,
  gaps: SkillGap[]
): Recommendation[] {
  const topGaps = gaps.filter(g => g.gap > 0).slice(0, 6);
  return topGaps.map((gap, i) => ({
    id: `rec-${gap.feature}-${i}`,
    feature: gap.feature,
    title: `Improve ${gap.label}`,
    description: gap.suggestedAction,
    priority: i < 2 ? 'high' as const : i < 4 ? 'medium' as const : 'low' as const,
    effort: getEffort(gap.feature),
    category: gap.category,
  }));
}

function getEffort(feature: string): 'small' | 'medium' | 'large' {
  const large = ['cgpa', 'internships_count', 'backlogs'];
  const medium = ['coding_skill_score', 'projects_count', 'mock_interview_score', 'aptitude_score'];
  return large.includes(feature) ? 'large' : medium.includes(feature) ? 'medium' : 'small';
}

// ─── PredictionService Interface ────────────────────────────────────────────
export interface PredictionService {
  evaluate(profile: StudentProfile): Promise<EvaluationResult>;
  getSkillGaps(profile: StudentProfile): SkillGap[];
}

// ─── Illustrative (Demo) Implementation ─────────────────────────────────────
export class IllustrativePredictionService implements PredictionService {
  async evaluate(profile: StudentProfile): Promise<EvaluationResult> {
    // Short delay for natural UX transition
    await new Promise(resolve => setTimeout(resolve, 600));

    const { score, contributions } = computeReadinessScore(profile);
    const gaps = computeSkillGaps(profile);
    const recommendations = generateRecommendations(profile, gaps);

    return {
      mode: 'illustrative',
      illustrativeReadinessScore: score,
      readinessBand: classifyBand(score),
      // placementProbability intentionally omitted — not available until ML service
      featureContributions: contributions,
      recommendations,
      timestamp: new Date().toISOString(),
    };
  }

  getSkillGaps(profile: StudentProfile): SkillGap[] {
    return computeSkillGaps(profile);
  }
}

// Singleton
export const predictionService: PredictionService = new IllustrativePredictionService();
