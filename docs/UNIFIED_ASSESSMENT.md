# Unified PlacementIQ assessment integration

## Architecture and preserved components

React/TypeScript/Vite keeps the existing cream/brown workspace, sidebar, landing page, Three.js robot and text/voice controls. Native Node HTTP API coordinates local résumé parsing, public GitHub evidence, Ollama questions and grading, and a Python inference bridge. The original joblib classifier, fitted scaler, categorical encoders and feature order remain unchanged. JSON persistence is owner-scoped using the browser identity. No new framework or dependency was added.

## Workflow

New HTTP sessions use workflow version 2: upload PDF/DOCX (or paste text), optionally inspect GitHub, analyze evidence, review extracted fields/claims, confirm missing baseline inputs, save actual ML prediction, select a domain, interview, evaluate, then automatically open Overview. No question generation occurs before profile verification and baseline creation. Domain suggestions are recomputed after claim confirmation. Legacy sessions remain resumable using their earlier workflow.

Only missing model attributes are requested in the initial form steps. All prefilled values remain editable in final review. Prior verified inputs are reused with source labels. Conflicts between prior inputs and new résumé evidence are displayed and retained in the assessment. GitHub file evidence retains repository and path; language alone never becomes a numeric skill rating. Skipping GitHub is supported.

The normal interviewer remains adaptive and personalized through Ollama. Curated diverse questions are a visible fallback when generation fails. Live answer grading still requires valid model evidence; unavailable grading preserves the current question for retry. Demo sessions use fictional profiles, prepared questions/answers and explicitly labelled deterministic practice grading, while their baseline still runs the actual ML model. Demo records are excluded from real history and current profile updates.

## Exact ML mapping

The authoritative schema is generated from `ml/infer.py` and the saved `feature_names.joblib`/`label_encoders.joblib`, exposed by `/api/baseline/schema`. There are 23 raw inputs and 8 engineered features (31 model columns). No missing-value imputation is performed; all required inputs must pass validation.

| Input | Mapping or verification requirement |
|---|---|
| age | Candidate supplies whole number, 15–100 |
| gender | Candidate selects an actual fitted encoder category |
| cgpa | Explicit /10 résumé value or correction; 0–10. Percentage is not silently converted |
| branch | Explicit trained branch label/recognized degree alias; verify fitted category |
| college_tier | Candidate supplies fitted category; no institution-to-tier guess |
| internships_count | Explicit count or reviewed internship roles; verify distinct total |
| projects_count | Explicit count or named résumé projects; verify total |
| certifications_count | Distinct named résumé certifications; verify total |
| coding_skill_score | Candidate supplies 0–100; never inferred from repository language |
| aptitude_score | Candidate supplies 0–100 |
| communication_skill_score | Candidate supplies historical 0–100 |
| logical_reasoning_score | Candidate supplies 0–100 |
| hackathons_participated | Candidate supplies whole count 0–100 |
| github_repos | Candidate confirms whole total 0–10000; inspected subset is not the total |
| linkedin_connections | Candidate confirms whole count 0–100000 |
| mock_interview_score | Prior mock score 0–100; current interview is never inserted here |
| attendance_percentage | Candidate supplies 0–100 |
| backlogs | Explicit résumé count or candidate input, whole 0–100 |
| extracurricular_score | Candidate supplies 0–100 |
| leadership_score | Candidate supplies 0–100 |
| volunteer_experience | Candidate selects fitted category |
| sleep_hours | Candidate supplies 0–24 |
| study_hours_per_day | Candidate supplies 0–24 |

Other counts are integers 0–100. The form obtains categorical options from fitted encoders, not a duplicated UI list. The existing engineered columns are `tech_core_score`, `academic_consistency`, `backlog_risk_ratio`, `coding_cgpa_interaction`, `portfolio_strength`, `interview_readiness`, `high_performer_flag`, `zero_backlog_flag`. Their original equations and scaler transformation stay in `ml/infer.py`. Model version is the SHA-256 of the four saved inference artifacts. Explanations remain order-dependent reference-path effects, not SHAP or causal effects.

## Scoring and persistence

Baseline normalized score = model placed-class `predict_proba` × 100. Calibration on the deployment population is not established. Interview score = actual aggregated rubric marks / available maximum × 100, with existing hint caps, follow-up denominator handling, exact answer evidence validation and missing-evidence guards. Text-only answers do not establish vocal confidence.

New policy `readiness-policy-2.0`: readiness = 0.40 × baseline + 0.60 × interview, rounded to two decimals. This is a decision-support estimate, NOT a calibrated placement probability. Missing/insufficient evaluations withhold the result. Review-required marks remain visibly provisional. `.env` weights `READINESS_BASELINE_WEIGHT` and `READINESS_INTERVIEW_WEIGHT` must sum to one; changes affect new assessment policies only. Historical snapshots preserve their original weights.

Store version 2 adds `candidates`, candidate IDs, current profile versions, assessment status, candidate evidence snapshots, source conflicts and persistent action tasks. Version-1 stores migrate in memory when loaded and persist on the next write; original baseline/model/policy/results are retained. Existing report tasks and latest real baseline inputs are backfilled. Back up the runtime JSON before deployment.

One browser owner maps to one current candidate. Sessions and assessments reference that identity. Baseline snapshots are immutable; evidence mutation after baseline is rejected. Completion writes the report, integrated assessment and session completion marker in one persisted JSON snapshot. Repeated report completion is idempotent. Mutations for the same owner are serialized at the HTTP boundary. Existing temp-file replacement/retry persistence remains in place; this is not a transactional multi-process database. A reporting-state retry recovers incomplete earlier writes.

## Sidebar behavior

- **Overview:** primary readiness summary, components, strengths/gaps, next action and saved history; onboarding before the first assessment.
- **Integrated Readiness:** exact component weights/calculation, evidence, model provenance, pending/review states, historical selection and preparation recommendation.
- **Skill Analysis:** candidate-confirmed claims, observed repository evidence, baseline attributes and assessed interview proficiency remain distinct.
- **Scenario Lab:** editable actual model inputs; explicit execution of the saved model; transparent simulated interview slider; no historical mutation.
- **Interview Reports:** automatically selects latest saved report, adds linked baseline/integrated summary, exports both as JSON; explicit demo report selection stays isolated.
- **Action Plan:** stored practice tasks, priorities, review dates and persisted completion timestamps; no regeneration on navigation.
- **Progress:** actual baseline/interview/readiness history and completed/pending tasks; insufficient-history explanation and descriptive score differences.
- **Placement Predictor:** original research form prefilled with current verified inputs; creates an independent snapshot, never overwrites a completed assessment.
- **Model Lab:** existing actual artifact metadata, evaluation results, preprocessing and explanation diagnostics preserved.
- **Faculty Evidence:** architecture, methodology, actual previously recorded inference observations, limitations, model/report links and demo access.
- **Landing:** existing public design, start/continue routes and browser identity preserved.
- **Profile & Settings:** editable current personal/education/GitHub/interests, résumé metadata, verified inputs/history, existing voice/preferences controls. Current edits do not mutate historical snapshots.

## APIs and routes

Existing session/resume/GitHub/analysis/profile/start/answer/report and baseline APIs are reused. New `GET/PATCH /api/candidate` manages current personal details. New `PATCH /api/assessments/:id/tasks/:taskId` updates boolean task completion. `/api/baseline/schema?session=…` returns exact fields, prefill sources and conflicts. `/api/assessments` creates a confirmed baseline with linked session; `/api/assessments/:id` returns the saved assessment. Lists omit demo records; explicit owner-authorized IDs allow demo review. `/api/baseline/explain` handles hypothetical inputs without saving assessment changes.

The existing `/assessment` route hosts the complete journey. `/placement-assessment` remains the research predictor. Completion opens `/app/overview?session=…`; historical selection uses `assessment` or `report` query parameters. Demo navigation retains explicit assessment context.

## Changed files

Backend: `server/src/{persistence,readiness,readiness-policy,baseline,coordinator,server,demo}.mjs`, `ml/infer.py`, `.env`, `.env.example`.
Frontend services: `InterviewWorkspace.tsx`, `interviewApi.ts`, `readinessApi.ts`.
Frontend pages: `App.tsx`, `AppLayout.tsx`, `AssessmentPage.tsx/.css`, `InterviewPage.tsx`, `OverviewPage.tsx`, `ReadinessPage.tsx`, `SkillsPage.tsx`, `ScenariosPage.tsx`, `PlanPage.tsx`, `ProgressPage.tsx`, `ReportsPage.tsx`, `ProfilePage.tsx`.
New frontend modules: `IntegratedSummary.tsx`, `UnifiedPages.tsx`, `Unified.css`, `FacultyEvidence.tsx`, `CandidateProfile.tsx`.
Verification: `server/tests/unified.test.mjs`, updated readiness/resume-demo tests, `scripts/verify-demo-ui.cjs`, `scripts/benchmark-unified.mjs` and generated evidence. Earlier extraction/Ollama fixes are documented separately.

## Run and demonstrate

1. Install existing server/frontend npm dependencies and Python packages in `ml/requirements-inference.txt` as described in README. Keep the saved model artifacts.
2. Run `Start-PlacementIQ.cmd`, open `http://127.0.0.1:3000`. Configure an exact installed Ollama model for real interviewing. The checked CPU workaround and diagnosed CUDA initialization error are documented in `INTERVIEW_STARTUP_FIXES.md`; no GPU-memory cause was assumed.
3. Start Assessment; upload a text PDF/DOCX, optionally connect GitHub, confirm evidence and missing numeric attributes, then continue to the robot interview.
4. For faculty: top navigation **Demo Interview**, select level, **Try Demo Interview**, **Run Full Demo**. Pause/continue/exit remain available. At completion open the integrated demo dashboard. Ollama may be offline.
5. Run `npm run check`. Optional browser test: supply existing Playwright module/Chromium paths and run `node scripts/run-demo-ui.cjs`; it owns isolated services and data. `node scripts/benchmark-unified.mjs` compares the previous two-process baseline path with the combined path using identical fictional inputs.

## Verification and limitations

The full `npm run check` passed: 60 backend tests, 9 frontend tests and the production TypeScript/Vite build. A subsequently added migration test passed separately (70 distinct automated tests total). The isolated Chromium browser check passed the complete offline demo, pause/fill/edit/continue/exit, normal candidate verification and missing-input form, real baseline gate, every workspace route, persisted task checkbox after reload, 1440/390px dashboard overflow checks and zero page errors. See `docs/verification/resume-optimization/demo-offline-browser.json` and the `unified-*.png` screenshots. Real live grading and external GitHub access were not rerun in this integration pass; mocked failure/validation checks and prior recorded live evidence remain separate. The original baseline prediction and explanation required two Python model loads; the new `assessment` operation produces both in one process. The redundant browser-side baseline inference was also removed. Timing observations must not be generalized across hardware or interpreted as interview-quality validation.

Remaining constraints: local browser identity is not authentication; persistence targets a single local Node process; scanned documents need external OCR; many historical ML questionnaire attributes cannot be obtained from a résumé and require user-supplied measured values. A missing historical mock/aptitude rating must be obtained rather than fabricated. Real grading cannot finish without valid local inference. There is no calibrated combined prediction dataset. Live GitHub availability depends on network/rate limits. The current hardware/model differs from the originally requested 4B/4-GB target; no claim of benchmarking that target is made. Speech and Three.js retain existing browser/model dependencies and large lazy-loaded assets.

### Measured baseline change (17 October 2026)

A sequential run with the same fictional intermediate inputs measured **11,596 ms** for the former prediction + explanation calls and **6,310 ms** for the combined operation. Both prediction and complete explanation outputs matched exactly. This one observation is about 45.6% lower elapsed time; it is not a statistical benchmark. Full schema and SHA-256 are in `docs/verification/unified-baseline-benchmark.json`. The new integration API test measured 7,212 ms for baseline creation and 6,997 ms for the prepared offline demo from start through evaluation; these include model/persistence operations and were run alongside browser tests, so they are not controlled performance comparisons.

Fitted categorical options verified from the saved artifacts: gender `Female`, `Male`; branch `CSE`, `Civil`, `ECE`, `EEE`, `IT`, `Mechanical`; college tier `Tier 1`, `Tier 2`, `Tier 3`; volunteer experience `No`, `Yes`. The historical gender encoding is a model limitation and was not expanded without retraining.

Build limitation: Vite reports large optional speech/Three.js chunks. Existing lazy loading remains; no new dependency was added.
