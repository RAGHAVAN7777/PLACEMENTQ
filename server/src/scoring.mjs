const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9+#.\s_-]/g, ' ').replace(/\s+/g, ' ').trim();
const gradingDirective = (answer) => /\b(ignore\b.{0,60}\b(rubric|instructions|system|previous)|award\b.{0,30}\b(full marks|maximum|perfect)|replace\b.{0,30}\b(system|prompt)|return\b.{0,30}\b(perfect score|full marks))\b/is.test(answer);
const hasKeyword = (answer, keyword) => {
  const escaped = normalize(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(normalize(answer));
};

function keywordCoverage(answer, keywords) {
  const hits = keywords.filter((keyword) => hasKeyword(answer, keyword)).length;
  return keywords.length ? hits / Math.min(keywords.length, 2) : 0;
}

function excerptFor(answer, keywords) {
  const sentences = answer.split(/(?<=[.!?])\s+/).filter(Boolean);
  return (sentences.find((sentence) => keywords.some((keyword) => hasKeyword(sentence, keyword))) || sentences[0] || '').slice(0, 280);
}

export function deterministicGrade(question, answer, { hintUsed = false, skipped = false } = {}) {
  const directive = gradingDirective(answer);
  if (skipped || answer.trim().length < 12 || directive) {
    return {
      method: 'deterministic-rubric', reviewNeeded: true, uncertainty: 'high', evidenceStatus: 'insufficient evidence',
      criteria: question.criteria.map((criterion) => ({
        criterionId: criterion.id, label: criterion.label, points: 0,
        maxPoints: criterion.maxPoints, evidenceExcerpt: '', explanation: 'Insufficient answer evidence.'
      })),
      missingConcepts: question.expectedConcepts, explanation: skipped ? 'Question skipped.' : directive ? 'The response contains a request to override grading. No automatic credit was awarded; review the answer separately.' : 'The response was too short to assess.',
      rawPoints: 0, awardedPoints: 0, maxPoints: question.maxPoints
    };
  }
  const criteria = question.criteria.map((criterion) => {
    const coverage = Math.min(1, keywordCoverage(answer, criterion.keywords));
    const points = Math.round(criterion.maxPoints * coverage * 2) / 2;
    return {
      criterionId: criterion.id, label: criterion.label, points, maxPoints: criterion.maxPoints,
      evidenceExcerpt: points ? excerptFor(answer, criterion.keywords) : '',
      explanation: points === criterion.maxPoints ? 'The answer provides relevant rubric evidence.' : points ? 'The concept is present but incomplete.' : 'No clear evidence for this criterion.'
    };
  });
  const rawPoints = criteria.reduce((sum, item) => sum + item.points, 0);
  const cap = hintUsed ? question.maxPoints * 0.7 : question.maxPoints;
  const awardedPoints = Math.min(rawPoints, cap);
  const missingConcepts = criteria.filter((criterion) => criterion.points < criterion.maxPoints).map((criterion) => criterion.label);
  return {
    method: 'deterministic-rubric', reviewNeeded: true, uncertainty: 'medium', evidenceStatus: 'assessed', criteria,
    missingConcepts, explanation: hintUsed ? 'Rubric score was capped at 70% because a hint was used.' : 'Local concept matching estimate; faculty review is recommended.',
    rawPoints, awardedPoints, maxPoints: question.maxPoints
  };
}

function groundedExcerpt(answer, proposed) {
  const comparable = (value) => value.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  const source = answer.replace(/\s+/g, ' ');
  const quote = proposed.trim().replace(/\s+/g, ' ').slice(0, 280);
  if (!quote) return '';
  const lower = comparable(source);
  const exact = lower.indexOf(comparable(quote));
  if (exact >= 0) return source.slice(exact, exact + quote.length);
  // Models sometimes abbreviate a correct quote. Restore only a short, ordered,
  // verbatim source span; never accept paraphrases or fabricated fragments.
  const fragments = quote.split(/\.{3}|…/).map((part) => part.trim());
  if (fragments.length < 2 || fragments.some((part) => part.length < 8)) return '';
  let start = -1;
  let end = 0;
  for (const fragment of fragments) {
    const index = lower.indexOf(comparable(fragment), end);
    if (index < 0) return '';
    if (start < 0) start = index;
    end = index + fragment.length;
  }
  return end - start <= 280 ? source.slice(start, end) : '';
}

export function validateModelGrade(question, answer, output, { hintUsed = false } = {}) {
  if (gradingDirective(answer)) return deterministicGrade(question, answer, { hintUsed });
  if (!output || !Array.isArray(output.criteria) || !Array.isArray(output.missingConcepts) || typeof output.explanation !== 'string' || typeof output.reviewNeeded !== 'boolean' || !['low', 'medium', 'high'].includes(output.uncertainty)) return null;
  if (output.criteria.length !== question.criteria.length || new Set(output.criteria.map((item) => item?.criterionId)).size !== question.criteria.length) return null;
  if (output.criteria.some((item) => !question.criteria.some((expected) => expected.id === item?.criterionId) || typeof item.points !== 'number' || !Number.isFinite(item.points) || typeof item.evidenceExcerpt !== 'string' || typeof item.explanation !== 'string')) return null;
  let invalidEvidence = false;
  const criteria = question.criteria.map((expected) => {
    const proposed = output.criteria.find((item) => item?.criterionId === expected.id) || {};
    const numeric = Number(proposed.points);
    const points = Number.isFinite(numeric) ? Math.min(expected.maxPoints, Math.max(0, Math.round(numeric * 2) / 2)) : 0;
    const evidenceExcerpt = groundedExcerpt(answer, proposed.evidenceExcerpt);
    if (points > 0 && !evidenceExcerpt) invalidEvidence = true;
    return {
      criterionId: expected.id, label: expected.label, points: evidenceExcerpt ? points : 0,
      maxPoints: expected.maxPoints, evidenceExcerpt,
      explanation: points > 0 && !evidenceExcerpt ? 'The model’s supporting quote could not be matched to your answer. This criterion needs review.' : proposed.explanation.slice(0, 300)
    };
  });
  const rawPoints = criteria.reduce((sum, item) => sum + item.points, 0);
  const cap = hintUsed ? question.maxPoints * 0.7 : question.maxPoints;
  return {
    method: 'ollama-rubric-estimate', evidenceValidationFailed: invalidEvidence, reviewNeeded: invalidEvidence || output.reviewNeeded || output.uncertainty !== 'low', evidenceStatus: answer.trim().length < 12 ? 'insufficient evidence' : 'assessed',
    uncertainty: invalidEvidence ? 'high' : output.uncertainty,
    criteria, missingConcepts: Array.isArray(output.missingConcepts) ? output.missingConcepts.filter((x) => typeof x === 'string').slice(0, 8) : [],
    explanation: invalidEvidence ? 'Some model quotes could not be validated. Their criteria have no automatic credit and require review; this does not establish that the answer was wrong.' : output.explanation.slice(0, 500),
    rawPoints, awardedPoints: Math.min(rawPoints, cap), maxPoints: question.maxPoints
  };
}

export function selectScoredAnswers(answers) {
  const attempts = answers.filter((answer) => answer.grade).map((answer) => ({ ...answer, grade: {
    ...answer.grade,
    maxPoints: Number.isFinite(answer.grade.maxPoints) ? Math.max(0, answer.grade.maxPoints) : 0,
    awardedPoints: Number.isFinite(answer.grade.awardedPoints) ? Math.min(Math.max(0, answer.grade.maxPoints || 0), Math.max(0, answer.grade.awardedPoints)) : 0
  } }));
  // A clarification assesses the same rubric. It must not create another denominator.
  // Keep one whole validated attempt rather than combining contradictory fragments.
  const groups = new Map();
  attempts.forEach((answer, index) => {
    const key = answer.questionGroupId || answer.questionId || `legacy_${index}`;
    const previous = groups.get(key);
    if (!previous || answer.grade.awardedPoints > previous.grade.awardedPoints || (answer.grade.awardedPoints === previous.grade.awardedPoints && previous.skipped && !answer.skipped)) groups.set(key, answer);
  });
  return [...groups.values()];
}

export function aggregateAnswers(answers) {
  const graded = selectScoredAnswers(answers);
  const total = graded.reduce((sum, answer) => sum + answer.grade.awardedPoints, 0);
  const maximum = graded.reduce((sum, answer) => sum + answer.grade.maxPoints, 0);
  const score = maximum ? Math.round((total / maximum) * 100) : 0;
  const bySkill = new Map();
  for (const answer of graded) {
    const item = bySkill.get(answer.skill) || { skill: answer.skill, points: 0, maxPoints: 0, questions: 0, assessedAnswers: 0, reviewNeeded: false };
    item.points += answer.grade.awardedPoints;
    item.maxPoints += answer.grade.maxPoints;
    item.questions += 1;
    if (!answer.skipped && answer.grade.evidenceStatus !== 'insufficient evidence') item.assessedAnswers += 1;
    item.reviewNeeded ||= answer.grade.reviewNeeded;
    bySkill.set(answer.skill, item);
  }
  const skills = [...bySkill.values()].map((item) => ({ ...item, score: item.maxPoints && item.assessedAnswers ? Math.round(item.points / item.maxPoints * 100) : null, result: item.assessedAnswers ? 'assessed' : 'insufficient evidence' }));
  return { score, totalPoints: Number(total.toFixed(2)), maxPoints: maximum, skills, scoredQuestions: graded.length, recordedAttempts: answers.filter((answer) => answer.grade).length };
}
