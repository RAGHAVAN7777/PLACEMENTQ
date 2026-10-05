import fs from 'node:fs/promises';
import path from 'node:path';
import { SERVER_DIR } from './config.mjs';
import { getQuestionBank } from './coordinator.mjs';
import { deterministicGrade } from './scoring.mjs';

const fixture = JSON.parse(await fs.readFile(path.join(SERVER_DIR, 'data', 'evaluation-set.v1.json'), 'utf8'));
const bank = await getQuestionBank();
const rows = fixture.labels.map((item) => {
  const question = bank.questions.find((question) => question.id === (item.questionId || fixture.questionId));
  if (!question) throw new Error(`Question ${item.questionId || fixture.questionId} not found.`);
  const first = deterministicGrade(question, item.answer);
  const second = deterministicGrade(question, item.answer);
  const withinReferenceRange = first.awardedPoints >= item.expectedMin && first.awardedPoints <= item.expectedMax;
  return {
    id: item.id, questionId: question.id, label: item.label, expectedRange: [item.expectedMin, item.expectedMax],
    actualPoints: first.awardedPoints, maxPoints: first.maxPoints,
    withinReferenceRange, repeatable: first.awardedPoints === second.awardedPoints
  };
});
const result = {
  evaluationSetVersion: fixture.version, questionBankVersion: bank.version,
  method: 'deterministic keyword-backed rubric fallback', runAt: new Date().toISOString(),
  cases: rows.length, withinRange: rows.filter((row) => row.withinReferenceRange).length,
  repeatable: rows.filter((row) => row.repeatable).length, rows,
  limitation: 'This small development set checks fallback behaviour and repeatability. Range labels are developer-assigned, not independently faculty-reviewed. Lexical estimates may miss correct paraphrases or credit incorrect claims using rubric words. This does not validate live-model grading or establish inter-rater reliability.'
};
await fs.writeFile(path.join(SERVER_DIR, 'data', 'evaluation-results.v1.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
