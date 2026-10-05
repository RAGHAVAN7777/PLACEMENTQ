# Integrated baseline and interview readiness

The application now runs the existing `ml/models/placement_model.joblib` through the backend. The champion is HistGradientBoostingClassifier. Its fitted label encoders, scaler and 31-feature order are reused; no retraining occurs. The input form is generated from the artifact schema (23 raw fields), including fields missing from the former illustrative form. Unknown categories and missing values are rejected.

The prior `mock_interview_score` remains a separately confirmed historical input. The live agent score never enters the historical model. Résumé suggestions retain source passages and require student confirmation/correction. Suggestions never supply missing skill scores.

## Connected journey

1. Open `/placement-assessment`, fill the original model inputs and confirm them.
2. Generate the **Baseline Placement Estimate**. The server stores its probability, class, inputs, sources, timestamp and SHA-256 artifact-bundle version.
3. Continue to the associated Aria session. Résumé review, evidence analysis, questions, generated replies and rubric grading use the existing interview system.
4. Completing the interview opens `/app/readiness?session=...`. The **Verified Interview Performance** card displays actual rubric results separately from the historical prediction.
5. The coordinator compares saved results using the assessment's policy snapshot, records its reasoning and selects an action. Starting that action persists the plan and timestamp.
6. Start reassessment to create another assessment and session; previous results remain in history.

Existing completed interview sessions can add their missing baseline via `/placement-assessment?session=...`. An already-saved baseline cannot be overwritten. Old standalone interview reports remain available in Interview Reports. Legacy illustrative browser scores are not relabelled as trained-model predictions.

## Policy and persistence

`server/src/readiness-policy.mjs` is the single interpretation policy. Environment settings (documented in `.env.example`):

- `READINESS_BASELINE_THRESHOLD=50`
- `READINESS_INTERVIEW_THRESHOLD=65`
- `READINESS_BASELINE_WEIGHT=0.5`
- `READINESS_INTERVIEW_WEIGHT=0.5`

High means at or above the threshold. All four requested category labels are implemented. Missing results and insufficient evidence do not receive a complete category or composite. Validated follow-ups can resolve an earlier insufficient answer within the same scored question group. Uncertainty flags remain visible.

Weights must be finite, non-negative and sum to one. Their default is a visible policy assumption pending faculty validation, not a learned dataset weight. The composite is a decision-support index, never a probability. Both components, weights and calculation are displayed. Policies and weights are saved with each assessment, so subsequent configuration changes do not alter old reports.

Persistence extends the existing atomic JSON store, `server/data/runtime/placementiq-store.json`, with an additive `assessments` map; existing sessions, reports and caches are preserved. Each assessment stores a profile snapshot, immutable baseline, associated session/report, interview score/skills/provenance/uncertainty, matrix result, action, policy, timeline and started preparation plan. Full questions, answers, conversations and rubric evidence remain in the linked persisted report. All assessment endpoints enforce the existing owner identity.

## Runtime and commands

Python inference dependencies are in `ml/requirements-inference.txt`. The project's `.venv` was created using the available bundled Python 3.12 runtime; installed scikit-learn 1.9.0 matches the serialized artifacts. Existing NumPy 2.3.5 and pandas 3.0.1 were reused; joblib 1.6.0 and SciPy were installed into the project environment. No Ollama installation/download was performed.

```powershell
.\.venv\Scripts\python.exe -m pip install -r ml/requirements-inference.txt
node server/src/server.mjs
npm.cmd run dev --prefix frontend -- --host 127.0.0.1
npm.cmd test --prefix server
npm.cmd run build --prefix frontend
node server/src/verify-readiness.mjs
.\.venv\Scripts\python.exe ml/verify_inference.py
```

`PLACEMENTIQ_PYTHON` optionally overrides the Python executable. The default is `.venv/Scripts/python.exe` on Windows and `.venv/bin/python` elsewhere. Model errors are returned honestly; the baseline never substitutes an illustrative score.

## Verification

`readiness-acceptance.json` records real saved-model inference on fictional inputs: 99.87450907568426 and 0.12857393866141406. Four matrix branches use real existing interview reports scoring 100 and 88, with a deliberately configured test interview threshold of 90; the normal default remains 65. Unit tests separately cover the default thresholds and inclusive boundaries.

The acceptance runner checks missing results, insufficient evidence using a real saved report, malformed/incomplete/unconfirmed inputs, rejection of an injected agent-score input, ownership, immutable baselines, a second independent assessment, persisted results and preparation actions. `ml/verify_inference.py` evaluates only the original training source's feature-engineering assignments and uses the original scaler/model; it confirms identical probability without any fit or save calls.

## Completed live browser verification — 5 October 2026

The full form → saved ML baseline → résumé review → live Aria interview → integrated dashboard → started preparation plan path completed in the browser with a fictional test student. The interview had eight submitted answers across six scored question groups, using actual sequential `qwen3:4b-instruct` replies. The UI automatically navigated to the integrated result after the final spoken reply.

- Baseline: **99.87450907568426/100**, class **Placed**.
- Interview: **100/100**; Python, Project explanation and SQL each 100 under the saved rubric.
- Matrix: **Placement Ready** at the normal 50/65 thresholds.
- Selected and started action: **Company-specific preparation**.
- Composite: **99.94**, using the recorded default 0.5/0.5 policy.
- Assessment: `assessment_96846511-c6be-4280-ae4c-fd3a2e0ef44a`.
- Report: `report_7ecf6466-917e-4ac6-a838-b11b19e72f90`.

The completed result and started-plan state survived page reload and a backend process restart. A second baseline submitted through the UI created `assessment_44f09e8e-cab7-46f1-ba01-f99f8e6fd643`; both entries remained visible in [history](readiness-history.txt), with the second interview explicitly pending. See [actual complete conversation](READINESS_UI_TRANSCRIPT.md), [saved evidence and rubrics](readiness-live-ui.json), and [dashboard screenshot](readiness-dashboard.png). Scores describe this test fixture, not the user's skills.

Verification: 42/42 backend tests passed; 10/10 targeted readiness tests passed again after branch-category normalization; frontend production build passed (existing large-bundle warning); real-artifact acceptance passed 11 grouped checks; all 31 preprocessing features matched the original training equations exactly.

## Changed files

- `ml/infer.py`, `ml/requirements-inference.txt`, `ml/verify_inference.py`: saved-model inference and preprocessing parity verification.
- `server/src/baseline.mjs`, `readiness-policy.mjs`, `readiness.mjs`: schema, source suggestions, policy comparison and integrated persistence.
- `server/src/server.mjs`, `persistence.mjs`, `coordinator.mjs`: endpoints, additive assessment records and completion integration.
- `server/tests/readiness.test.mjs`, `server/src/verify-readiness.mjs`: policy and real-artifact acceptance checks.
- `frontend/src/services/readinessApi.ts`, `interviewApi.ts`: typed backend access.
- `frontend/src/features/assessment/AssessmentPage.tsx`, `readiness/ReadinessPage.tsx`, `readiness/ReadinessPage.css`: confirmed baseline form and integrated dashboard.
- `frontend/src/features/interview/InterviewPage.tsx`, `overview/OverviewPage.tsx`, `frontend/src/App.tsx`, `components/layout/AppLayout.tsx`: connected navigation and saved-session recovery.
- `.env.example`, `README.md`, this document and verification artifacts: configuration and reproducible evidence.

The landing hero and robot visuals were preserved. Their files already contained earlier work; this integration did not alter them.

## Remaining limitations

- The original dataset and model limitations still apply; model estimates and readiness labels are preparation guidance, not hiring decisions.
- Interview marks cover a bounded adaptive question set and remain subject to the displayed uncertainty/faculty-review flags.
- This is the project's existing single-process local JSON persistence with browser-bound owner identity, not an authenticated multi-user deployment. Clearing that identity can remove browser access to saved records, although server data remains.
- Résumé prefilling covers explicit matching values and named-project suggestions; missing fields require student input.
- The historical model requires a previous mock-interview input. Students without it cannot honestly complete a baseline until they have that measurement; Aria's new score is not substituted.
- The optional composite's policy weights await faculty validation.
