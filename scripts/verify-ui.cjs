// Run against isolated local test services, never a production or personal store.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PLACEMENTIQ_UI_TEST_URL || 'http://127.0.0.1:3001';
const output = path.resolve(__dirname, process.env.PLACEMENTIQ_UI_TEST_OUTPUT || '../docs/verification/audit-2026-10-14');

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const checks = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${base}/app/model-lab`);
    await page.getByText('Model Diagnostic:', { exact: true }).waitFor({ timeout: 90000 });
    assert.equal(await page.getByText('Feature attribution unavailable:', { exact: false }).count(), 0);
    await page.screenshot({ path: path.join(output, 'model-lab.png'), fullPage: true });
    checks.push('Model Lab loads the actual model explanation for its complete fictional profile.');

    await page.goto(`${base}/placement-assessment`);
    await page.locator('#baseline-cgpa').waitFor({ timeout: 90000 });
    const { high } = JSON.parse(await fs.readFile(path.resolve(__dirname, '../docs/verification/readiness-inputs.json'), 'utf8'));
    for (let step = 0; step < 3; step++) {
      const controls = await page.locator('[id^="baseline-"]').all();
      for (const control of controls) {
        const key = (await control.getAttribute('id')).slice('baseline-'.length);
        if (await control.evaluate(el => el.tagName) === 'SELECT') await control.selectOption(String(high[key]));
        else await control.fill(String(high[key]));
      }
      await page.getByRole('button', { name: 'Next', exact: true }).click();
    }
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Generate baseline estimate' }).click();
    await page.waitForURL('**/app/readiness?assessment=*', { timeout: 90000 });
    await page.getByText('Model Diagnostic:', { exact: true }).waitFor({ timeout: 90000 });
    await page.screenshot({ path: path.join(output, 'readiness.png'), fullPage: true });
    checks.push('All baseline form steps submit real model inputs and render a saved readiness result.');

    await page.goto(`${base}/app/scenarios`);
    await page.getByText('Target reached in this model scenario.', { exact: true }).waitFor({ timeout: 90000 });
    assert.match(await page.locator('.cf-projection-badge').innerText(), /99\.9%/);
    await page.getByLabel('Target model probability').fill('101');
    await page.getByText('Choose a target from 5% to 98%.', { exact: false }).waitFor();
    await page.getByLabel('Target model probability').fill('85');
    await page.getByText('Target reached in this model scenario.', { exact: true }).waitFor({ timeout: 90000 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, 'scenarios-mobile.png'), fullPage: true });
    checks.push('Model scenarios use percentage units and reject out-of-range targets; mobile screenshot saved.');

    // Explicit synthetic report fixtures exercise the real report component with
    // the backend's field names, including older records with estimated timing.
    const { getQuestionBank, analyzeSpeechDelivery } = await import('../server/src/coordinator.mjs');
    const { deterministicGrade, aggregateAnswers } = await import('../server/src/scoring.mjs');
    const bank = await getQuestionBank();
    const question = bank.questions[0];
    const delivery = analyzeSpeechDelivery(question.referenceAnswer, { durationSeconds: 30 });
    delete delivery.timingSource; // legacy record: timing was estimated
    const answer = { id: 'fixture_answer', questionId: question.id, skill: question.skill,
      question: question.prompt, answer: question.referenceAnswer, skipped: false, hintUsed: false,
      grade: deterministicGrade(question, question.referenceAnswer), deliveryMetrics: delivery };
    const report = { id: 'fixture_report', sessionId: 'fixture_session', createdAt: new Date().toISOString(),
      selectedDomain: question.domain, assessment: aggregateAnswers([answer]), questions: [answer],
      explainedConcepts: [], missingOrUncertainEvidence: [], improvementTasks: [], reassessmentTopics: [], comparison: [],
      evidenceProfile: { claimed: { skills: [], projects: [], education: [], experience: [], strengths: [] }, observed: [] },
      provenance: { model: { requested: 'fixture', used: null, liveInference: false }, versions: { prompt: 'fixture', coordinator: 'fixture' }, questionBankVersion: bank.version, aggregationPolicy: bank.aggregationPolicy },
      limitations: ['Synthetic rendering fixture; not a student assessment.'],
      communicationInsights: { averageWpm: delivery.wpm, totalFillerWords: delivery.totalFillers,
        clarityScore: delivery.clarityScore, paceClassification: delivery.pace, keyFeedback: delivery.coachingTip } };
    await page.route('**/api/reports', route => route.fulfill({ json: { reports: [report] } }));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/app/interviews`);
    await page.getByRole('heading', { name: 'Evidence-based interview report', exact: true }).waitFor();
    await page.getByText('Historical record: timing was estimated', { exact: false }).waitFor();
    await page.locator('details.answer-review summary').click();
    assert.equal(await page.locator('.interview-report').getByText('undefined', { exact: false }).count(), 0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, 'report-legacy.png'), fullPage: true });
    report.communicationInsights = null;
    report.questions[0].deliveryMetrics = null;
    await page.reload();
    await page.getByRole('heading', { name: 'Evidence-based interview report', exact: true }).waitFor();
    assert.equal(await page.getByText('Transcript and timing diagnostics', { exact: true }).count(), 0);
    checks.push('Legacy telemetry renders without missing-field errors; typed answers show no fabricated speaking metrics.');

    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, 'ui-results.json'), JSON.stringify({ passed: true, checks, errors }, null, 2));
    console.log(JSON.stringify({ passed: true, checks }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
