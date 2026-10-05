import { selectScoredAnswers } from './scoring.mjs';

export function validatePolicy(policy) {
  for (const key of ['baselineThreshold', 'interviewThreshold']) {
    if (!Number.isFinite(policy[key]) || policy[key] < 0 || policy[key] > 100) throw new Error(`${key} must be from 0 to 100`);
  }
  const { baselineWeight, interviewWeight } = policy;
  if (![baselineWeight, interviewWeight].every(value => Number.isFinite(value) && value >= 0) || Math.abs(baselineWeight + interviewWeight - 1) > 1e-9) throw new Error('Readiness weights must be non-negative and sum to 1');
  return Object.freeze({ ...policy });
}

export const readinessPolicy = validatePolicy({
  version: 'readiness-policy-1.0',
  baselineThreshold: Number(process.env.READINESS_BASELINE_THRESHOLD ?? 50),
  interviewThreshold: Number(process.env.READINESS_INTERVIEW_THRESHOLD ?? 65),
  baselineWeight: Number(process.env.READINESS_BASELINE_WEIGHT ?? 0.5),
  interviewWeight: Number(process.env.READINESS_INTERVIEW_WEIGHT ?? 0.5),
  weightStatus: 'Policy defaults pending faculty validation; not learned from the dataset',
});

export function compareReadiness(baseline, report, policy) {
  validatePolicy(policy);
  const pending = (status, explanation) => ({ status, category: 'Assessment incomplete', explanation, composite: null, action: null });
  if (!baseline) return pending('missing-baseline', 'Complete and confirm the historical-model inputs before comparing the two assessments.');
  if (!report) return pending('missing-interview', 'Your baseline estimate is saved. Complete the robot interview to demonstrate your current skills.');
  const assessment = report.assessment;
  const scoredAnswers = selectScoredAnswers(report.questions);
  const insufficient = !assessment || !Number.isFinite(assessment.score) || assessment.maxPoints <= 0 || !assessment.skills?.length || !scoredAnswers.length
    || assessment.evidenceStatus === 'insufficient evidence'
    || assessment.skills.some(skill => skill.score === null || skill.result === 'insufficient evidence')
    || scoredAnswers.some(answer => answer.grade?.evidenceValidationFailed || answer.grade?.evidenceStatus === 'insufficient evidence');
  if (insufficient) return { ...pending('insufficient-evidence', 'Some interview skills lack sufficient supporting answer evidence. Complete a reviewed reassessment before interpreting readiness.'), action: { type: 'reassessment', title: 'Reassessment', reason: 'Collect missing or unvalidated answer evidence.', steps: ['Review the flagged answers with your faculty mentor.', 'Practise the unassessed skills and start a new assessment.'] } };
  const baselineHigh = baseline.score >= policy.baselineThreshold;
  const interviewHigh = assessment.score >= policy.interviewThreshold;
  const category = baselineHigh
    ? interviewHigh ? 'Placement Ready' : 'Profile Strong, Interview Preparation Required'
    : interviewHigh ? 'Demonstrated Skill Strong, Profile Improvement Required' : 'Structured Readiness Development Required';
  const weakest = [...assessment.skills].sort((a, b) => a.score - b.score).slice(0, 2);
  const focus = weakest.map(skill => `${skill.skill} (${skill.score}/100)`).join(', ');
  let action;
  if (baselineHigh && interviewHigh) action = { type: 'company-specific', title: 'Company-specific preparation', reason: 'Both results meet the configured thresholds.', steps: ['Choose a target company and map its published role requirements to your demonstrated skills.', `Practise role-specific scenarios, starting with ${focus}.`, 'Reassess after your next practice cycle.'] };
  else if (!interviewHigh) {
    const project = /project|communication/i.test(weakest[0]?.skill || '');
    const academic = !baselineHigh && (baseline.inputs.backlogs > 0 || baseline.inputs.cgpa < 6 || baseline.inputs.aptitude_score < 50);
    action = academic
      ? { type: 'academic', title: 'Aptitude or academic recovery', reason: `Confirmed inputs: CGPA ${baseline.inputs.cgpa}, backlogs ${baseline.inputs.backlogs}, aptitude ${baseline.inputs.aptitude_score}. Interview focus: ${focus}.`, steps: ['Create a subject revision and backlog-clearing schedule.', 'Complete timed aptitude exercises and review errors.', `Practise and reassess ${focus}.`] }
      : { type: project ? 'project' : 'technical', title: project ? 'Project explanation practice' : 'Technical interview practice', reason: `The weakest demonstrated skills are ${focus}.`, steps: weakest.map(skill => `Explain one ${skill.skill} concept with a concrete example, trade-off and verification method.`).concat(['Review the rubric evidence below and repeat the interview after practice.']) };
  } else action = { type: 'profile', title: 'Resume/profile improvement', reason: `Interview performance is strong; the baseline is below ${policy.baselineThreshold}. Confirmed experience: ${baseline.inputs.internships_count} internships and ${baseline.inputs.projects_count} projects. This comparison is not a causal feature explanation.`, steps: ['Review the confirmed academic and experience inputs for accuracy.', 'Document project outcomes and internship responsibilities with evidence.', 'Strengthen relevant profile gaps and start a new baseline assessment.'] };
  const reviewNeeded = scoredAnswers.some(answer => answer.grade?.reviewNeeded || answer.grade?.uncertainty !== 'low');
  return {
    status: 'complete', category, baselineHigh, interviewHigh, reviewNeeded,
    explanation: `Baseline ${baseline.score.toFixed(2)}/100 is ${baselineHigh ? 'at or above' : 'below'} ${policy.baselineThreshold}; interview ${assessment.score}/100 is ${interviewHigh ? 'at or above' : 'below'} ${policy.interviewThreshold}. ${reviewNeeded ? 'Some rubric marks need review; this interpretation is provisional.' : 'The category compares these two separate results.'} It is preparation guidance, not a hiring decision.`,
    composite: { value: Number((policy.baselineWeight * baseline.score + policy.interviewWeight * assessment.score).toFixed(2)), baselineScore: baseline.score, interviewScore: assessment.score, baselineWeight: policy.baselineWeight, interviewWeight: policy.interviewWeight, label: 'Decision-support index; not a placement probability' }, action,
  };
}
