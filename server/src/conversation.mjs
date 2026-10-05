// Bound context for a 4k local model. Student/repository text remains untrusted.
export function answerEvidence(answer) {
  const parts = [];
  for (const sentence of answer.match(/[^.!?;\n]+[.!?;]?/g) || []) {
    let remaining = sentence.trim();
    while (remaining.length > 150) {
      const space = remaining.lastIndexOf(' ', 150);
      const end = space > 0 ? space : 150;
      parts.push(remaining.slice(0, end)); remaining = remaining.slice(end).trimStart();
    }
    if (remaining) parts.push(remaining);
  }
  return parts;
}

// The model selects source IDs; the server copies the corresponding actual text.
// This avoids asking a small model to reproduce punctuation and every word exactly.
export function resolveEvidenceSelections(output, answer) {
  if (!output || typeof output !== 'object') return output;
  const passages = answerEvidence(answer);
  const selected = id => Number.isInteger(id) && id >= 0 && id < passages.length ? passages[id] : null;
  return { ...output, criteria: Array.isArray(output.criteria) ? output.criteria.map(c => c && typeof c === 'object' ? ({ ...c, evidenceExcerpt: selected(c.evidenceId) ?? c.evidenceExcerpt }) : c) : output.criteria,
    answerAnchor: selected(output?.answerAnchorId) ?? output?.answerAnchor };
}

export function conversationContext(session, question) {
  const pending = session.questions.slice(session.questionIndex + 1).filter(q => !q.followUp);
  return {
    turn: session.answers.length + 1, maximumTurns: session.targetQuestions + 2,
    canProbe: !question.followUp && session.followUpsUsed < 2,
    remaining: pending.map(q => ({ bankId: q.bankId, skill: q.skill })),
    currentEvidence: question.context?.passage?.slice(0, 240) || '',
    reviewedProjects: session.profile.projects.filter(p => p.confirmed).slice(0, 2).map(p => p.sourcePassage.slice(0, 180)),
    observed: session.github.evidence.slice(0, 2).map(e => ({ path: e.sourcePath, passage: e.passage.slice(0, 160) })),
    recentTurns: session.answers.slice(-2).map(a => ({ question: a.question.slice(0, 160), answer: a.answer.slice(0, 220), response: a.reply?.text?.slice(0, 220) || '' }))
  };
}

export function validateConversation(output, answer, canProbe) {
  if (typeof output.acknowledgement !== 'string' || output.acknowledgement.trim().length < 20 || output.acknowledgement.length > 420) return false;
  if (output.acknowledgement.includes('?')) return false;
  if (!['confirm', 'clarify', 'challenge'].includes(output.responseKind)) return false;
  if (typeof output.answerAnchor !== 'string' || output.answerAnchor.trim().length < Math.min(5, answer.trim().length)) return false;
  const normalize = text => text.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
  if (!normalize(answer).includes(normalize(output.answerAnchor))) return false;
  if (output.nextAction === 'follow_up' && canProbe && (typeof output.followUpQuestion !== 'string' || output.followUpQuestion.length < 20 || output.followUpQuestion.length > 350)) return false;
  return !/^(great|good|excellent|thank you|noted|recorded)[!. ]*$/i.test(output.acknowledgement.trim());
}

export function conversationHistory(session) {
  if (session.conversation?.length) return session.conversation;
  // Compatibility: show old recorded questions/answers, without invented replies.
  return session.answers.flatMap(a => [
    { id: `${a.id}_q`, role: 'assistant', text: a.question, kind: 'question', questionId: a.questionId },
    { id: a.id, role: 'student', text: a.skipped ? 'Skipped this question.' : a.answer, kind: 'answer', questionId: a.questionId }
  ]);
}
