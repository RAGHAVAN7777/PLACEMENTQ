import test from 'node:test';
import assert from 'node:assert/strict';
import { answerEvidence, resolveEvidenceSelections, conversationContext, conversationHistory, validateConversation } from '../src/conversation.mjs';

test('model-selected evidence IDs resolve only to exact passages from the actual answer', () => {
  const answer = 'Catch only expected exceptions such as permission or parse errors. Preserve unexpected tracebacks.';
  const passages = answerEvidence(answer);
  const result = resolveEvidenceSelections({ criteria: [{ evidenceId: 0, evidenceExcerpt: 'wrong paraphrase' }], answerAnchorId: 1 }, answer);
  assert.equal(result.criteria[0].evidenceExcerpt, passages[0]);
  assert.equal(result.answerAnchor, passages[1]);
  assert.ok(passages.every(p => answer.includes(p) && p.length <= 150));
  assert.equal(resolveEvidenceSelections({criteria: [{evidenceId: 88, evidenceExcerpt: 'unmatched'}]}, answer).criteria[0].evidenceExcerpt, 'unmatched');
});

test('bounded context carries recent answers, reviewed projects and observed source evidence', () => {
  const text = 'x'.repeat(5000);
  const question = { bankId: 'q1', prompt: text, context: { passage: text } };
  const session = { questions: [question, { bankId: 'q2', skill: 'SQL' }], questionIndex: 0, targetQuestions: 6, followUpsUsed: 0, answers: Array.from({length: 8}, () => ({ question: text, answer: text, reply: { text } })), profile: { projects: [{ confirmed: true, sourcePassage: text }, { confirmed: false, sourcePassage: 'unreviewed' }] }, github: { evidence: [{ sourcePath: 'README.md', passage: text }] } };
  const context = conversationContext(session, question);
  assert.equal(context.recentTurns.length, 2);
  assert.equal(context.reviewedProjects.length, 1);
  assert.ok(JSON.stringify(context).length < 2100);
  assert.equal(context.canProbe, true);
  assert.equal(conversationContext({...session, followUpsUsed: 2}, question).canProbe, false);
  assert.equal(conversationContext(session, {...question, followUp: true}).canProbe, false);
});

test('conversation requires an actual answer anchor and meaningful reply, including short answers', () => {
  const reply = { acknowledgement: 'You identified that a list can change in place.', responseKind: 'confirm', answerAnchor: 'list can change', nextAction: 'follow_up', followUpQuestion: 'How would that affect two aliases of the same list?' };
  assert.equal(validateConversation(reply, 'A list can change in place.', true), true);
  assert.equal(validateConversation({...reply, answerAnchor: 'invented quote'}, 'A list can change in place.', true), false);
  assert.equal(validateConversation({...reply, acknowledgement: 'Great!'}, 'A list can change in place.', true), false);
  assert.equal(validateConversation({...reply, acknowledgement: 'You explained mutation. What about copying?'}, 'A list can change in place.', true), false);
  assert.equal(validateConversation({...reply, answerAnchor: 'no'}, 'no', true), true);
  assert.equal(validateConversation({...reply, followUpQuestion: ''}, 'A list can change in place.', true), false);
});

test('legacy history restores recorded questions and answers without fabricated reactions', () => {
  const answers = [{ id: 'a', questionId: 'q', question: 'Why?', answer: 'Because.' }];
  const history = conversationHistory({ answers });
  assert.deepEqual(history.map(t => t.text), ['Why?', 'Because.']);
  assert.equal(conversationHistory({ answers, conversation: history }), history);
});
