# Personalized preparation roadmap — 18 October 2026

## Implementation

The existing JSON assessment store, Node API, React workspace, Python baseline and Ollama queue are retained. No dependency or ML artifact was replaced. The integrated readiness formula remains unchanged.

New files: `server/src/roadmap.mjs`, `server/tests/roadmap.test.mjs`, `frontend/src/features/plan/RoadmapPlan.tsx`, `RoadmapPlan.css`, `RoadmapSummary.tsx`, `scripts/verify-roadmap-ui.cjs`.
Modified: `server/src/readiness.mjs`, `server/src/server.mjs`, `frontend/src/services/readinessApi.ts`, `InterviewWorkspace.tsx`, `features/readiness/UnifiedPages.tsx`, `ReadinessPage.tsx`, `features/overview/OverviewPage.tsx`, `features/skills/SkillsPage.tsx`, and the existing demo browser verification selector.

## Automatic evidence analysis

Report finalization attaches a deterministic roadmap before the report, assessment and completed session are persisted together. Existing completed assessments gain a roadmap lazily when Action Plan is opened. No extra résumé or questionnaire is requested.

The generator reads the verified profile/project snapshot, optional observed repository files, baseline inputs and supported reference-path attributions, evaluated interview skill scores and missing rubric concepts, and integrated readiness. It uses the same best-attempt/follow-up grouping as scoring, preventing already-corrected gaps from being resurrected. Provisional grades are marked and weighted with less evidence confidence. Repository absence/private work never becomes a skill penalty.

Weak technical concepts produce focused foundation exercises and implementation tasks; project/behavioral gaps produce explanation or interview exercises. Verified academic constraints and zero internships can produce appropriate study or project-evidence tasks without treating them as proof of low skill. A low baseline with strong interview evidence triggers a profile-evidence review, not a fabricated causal diagnosis. Strong performance gets bounded extension/review work rather than every possible topic.

Tasks carry learning objectives, concrete practice, estimated effort, observable completion criteria, related skill, source question ID, rationale, priority factors and a small curated resource list. Resource URLs for Python, PostgreSQL, MDN and scikit-learn were opened and verified on 18 October 2026. No search service or invented course/certificate is used.

## Priority and scheduling

Priority = round(100 × (0.35 performance gap + 0.25 target-role relevance + 0.20 evidence confidence + 0.10 stated-goal relevance + 0.10 weekly time fit)). Each factor and the formula are available in task details. High is ≥70, medium ≥50, otherwise low. Effort estimates are planning heuristics, not empirically validated learning-time predictions.

Role matching recognizes backend, frontend, full-stack and data/ML roles. Other roles use neutral relevance and retain assessment-specific topics. Goal relevance uses explicit skill mentions. High-readiness candidates receive fewer gap concepts; no score is treated as a hiring probability.

The initial roadmap is unscheduled: no weekly availability is invented. Candidate supplies role, goal, 2/4/8/12 or custom 1–52 weeks, and 1–40 hours/week. A short final verification task is reserved, high-priority work is selected to fit capacity, and activities are sequenced by the four stages. Excess work stays in a collapsed backlog. Empty weeks do not invent filler tasks. Moving tasks beyond weekly capacity is rejected. Actual study attendance and learning gains are not inferred from checkboxes.

## Persistence and APIs

Roadmaps are embedded in existing assessments; store version 2 remains valid. Added fields are `roadmap` and `roadmapVersions`. Each roadmap has ID, candidate/assessment identity, version, timestamps, schedule preferences, compact evidence summary, task list, generation provenance and a cache key. `assessment.tasks` mirrors the current task list for compatibility. Legacy completed tasks are retained with their original notes/status; missing historical effort is not guessed.

- `GET /api/assessments/:id/roadmap`: owner-authorized load/lazy creation for a completed report.
- `POST /api/assessments/:id/roadmap`: validate preferences, regenerate remaining work, archive previous version, retain completed tasks/notes.
- `PATCH /api/assessments/:id/tasks/:taskId`: status, boolean completion, notes (≤2,000 characters), scheduled week or backlog. Ownership, field types and capacity are checked.

Existing per-owner mutation locks cover these routes. Same-preference requests reuse the plan without new inference. Previous cached AI instructions can be reused when returning to prior preferences; current completion state is retained. Checkboxes never regenerate a roadmap.

New interview assessments derive new gaps and reuse the most recent preparation preferences in the same real/demo mode. Old assessments/plans remain untouched; previous completed work does not automatically count as success in the new assessment. The change reason explains the new-evidence transition.

## UI and progress

Action Plan provides scheduling, weekly sections, four-stage task categories, priority/evidence details, completion, status, rescheduling, saved notes, backlog, prior-version summaries and reassessment access. Overview presents the next task, top three priorities, selected duration and saved preparation progress. Skill Analysis and Integrated Readiness link the same roadmap. Progress shows real completion counts by scheduled week, distinct completion days, skills practiced, self-reported mock practice and genuine assessment score history. Task completion never changes baseline/interview/readiness scores.

Demo plans are explicitly labelled fictional, skip AI refinement and remain excluded from real history. The existing cream/brown layout, sidebar, robot, voice controls and dashboard simplification are preserved.

## Optional local AI and performance

Automatic generation is deterministic and immediate. The candidate may enable local AI refinement under Advanced settings when configuring the plan. Only the three selected task summaries, role and goal are sent; not the full résumé or answer history. Output is limited to 650 tokens, uses the existing serialized Ollama queue and transient-only retry behavior, and must satisfy a closed JSON schema and matching task IDs. It can add a separately labelled practice suggestion only. It cannot modify evidence, priorities, effort, schedules, resources or scores. AI-supplied URLs are rejected. Invalid output, HTTP 500 or offline Ollama retains the functional deterministic plan.

Optional live inference uses the existing model timeout and may still be slow on CPU; it is never required for a completed plan. No live Qwen speed or output-quality improvement is claimed in this update.

## Verification

The roadmap suite covers contrasting weaknesses, limited internship experience, high/low component scores, different candidates/roles, shorter schedules and capacity, completed-work/notes retention, corrected follow-ups, owner isolation, persisted JSON, new interview updates, demo labelling, offline inference, invalid JSON/IDs, mocked HTTP 500, and validated AI refinement/cache behavior.

The isolated browser workflow passed schedule creation, notes, completion, reload, changing role/duration/hours while preserving work, weekly Progress and Overview integration, and desktop/mobile horizontal-overflow checks with no page errors. Evidence: `docs/verification/roadmap-browser.json` and `docs/verification/resume-optimization/roadmap-1440.png` / `roadmap-390.png`.

Focused offline API plan configuration measured 14–30 ms across local test runs; these are development observations, not a controlled benchmark. Synthetic test assessments are explicitly fixtures, not claims about real candidate grading accuracy. Live AI refinement was tested with controlled valid/invalid responses, not a fresh long-running Qwen inference.

Known limits: browser identity is not production authentication; single-process JSON persistence; role relevance/effort are transparent heuristics; progress is self-reported; resources are curated rather than an exhaustive search; prior version summaries are displayed and complete snapshots remain in the database. There is no validated causal link between task completion and placement outcomes.

### Final recorded checks

The complete backend run executed 73 tests: 72 passed and one new mocked-AI test exposed an incorrect report ID in its fixture. After correcting that fixture, all 11 roadmap tests passed, including that case and valid AI/cache behavior. The other 62 backend tests had passed in the full run, including the real saved-model and complete offline demo journeys. The isolated browser roadmap workflow passed with zero page errors. This records the actual full-run-plus-focused-rerun sequence rather than claiming a clean rerun of all expensive model checks.
