# PlacementIQ implementation checkpoint

> Historical checkpoint. For the current audit, verified fixes, and completion roadmap, read [PROJECT_STATUS.md](PROJECT_STATUS.md). The machine paths, installed-model claims, branch name, and test counts below describe earlier environments; this supplied folder currently has no Git repository.

Updated: 4 October 2026. Branch: `feature/placement-prediction`. Work remains in the existing checkout; no commit or deployment was made. Preserve the user's existing landing, particle hero, predictor, and workspace changes.

## Latest request — conversational interview complete

- Actual Qwen reactions and adaptive follow-ups now drive displayed/spoken dialogue. Full conversation and rubric evidence persist in reports; bounded context, sequential inference, six core questions plus at most two follow-ups.
- Local Vosk voice input is installed and tested with recorded audio. Editable transcripts, explicit microphone status/timeouts, replay/mute/interrupt, draft recovery and half-duplex audio controls are implemented. The in-app microphone permission request timed out, so physical capture remains unverified; typed recovery and the full interview passed.
- Final strong/weak live HTTP tests passed. Full UI journey completed eight real graded answers and the saved report. 32 backend tests and production build passed. Hero files unchanged.
- See `docs/verification/CONVERSATION_UPDATE.md`, actual strong/weak transcripts and full UI transcript. Test scores are fictional fixtures, never the user’s results.

## Previous request — completed interview overview

- Completing/reopening an interview now opens `/app/overview?report=<id>` with the actual saved score, rubric points, reviewed claims, skills and next steps. Skill Analysis, Action Plan and Progress consume saved reports. Sample profiles are excluded from student results. The numeric predictor remains separate.
- Workspace colours/type now use warm white/orange with the same Manrope/Instrument Serif family as landing/interview. Hero files and global styles were not edited for this request; hashes are documented in `docs/verification/OVERVIEW_UPDATE.md`.
- Fairness fixes: half-point concept credit; original question plus clarification counted once using the best complete validated attempt; same chosen attempts drive evidence gaps. No arbitrary score floors. Historical scores stay unchanged; comparisons require matching scoring versions.
- Exact ordered ellipsis fragments and typographic quotation differences can restore original evidence quotes. Other invalid positive quotes trigger one sequential model retry; continued failure keeps the draft and records no grade. Both retry success and no-unfair-deduction failure are tested.
- Current checks: **27/27 backend tests**, successful TypeScript/Vite build, real Qwen evaluation **14/14 within developer ranges across 28 valid calls**, **13/14 repeatable**. One partial answer varied 2–3. Two real final-code evidence rechecks scored 4/4 and 5/5, both with a successful quote retry.
- New fictional browser journey: résumé → review → explicit GitHub skip → personalised questions → seven local-model answers (one clarification) → completed saved report **88/100, 23/26, six scored questions**. Completed-session redirect, refresh, live skill/history values, task persistence, empty/error states and desktop/mobile layout checked.
- That UI fixture recorded two answers before the final evidence retry fix. They retain review flags; the isolated final-code recheck proves their correction without rewriting historical evidence. Artifacts: `overview-live-journey.json`, `live-evidence-retry.json`, `live-evaluation-v1.3.json`, `overview-desktop.jpg`, `overview-mobile.jpg`.
- GitHub was retried but still exhausted its public API rate limit. Success remains unverified; explicit skip works. No fabricated repository evidence or failed-model fallback was supplied.
- Final-code live quote check: `node server/src/verify-scoring-live.mjs`. It uses isolated fictional sessions under ignored test-runtime storage. Run sequentially with other inference.

The sections below describe the earlier implementation and its historical verification.

## Current implementation

- `/assessment`: centered upper-body 3D particle human, Aria, using a bundled CC0 MakeHuman-derived mesh. Animated jaw, lip shapes, brows, cheeks, blink, gaze and breathing; no still image used by the presenter. Actual browser speech events control speaking and estimated visemes. Dark charcoal/orange room continues the landing theme; the updated workspace now uses warm white/orange.
- Local PDF/DOCX extraction and paste, source-backed Qwen profile extraction, claim review/corrections, optional bounded public GitHub reader with caching, backend analysis events, domain selection, six bank-backed personalized questions plus at most two validated follow-ups.
- Sequential Qwen rubric grading with verbatim evidence validation, deterministic totals, published 70% hint cap, skip, pause/resume, question-specific draft recovery, duplicate/stale submission protection, and recovery after errors.
- Saved reports, preparation tasks, answer/rubric evidence, model/prompt/bank provenance, export, profile integration, reassessment differences and local faculty view. Original numeric predictor is separate at `/placement-assessment`.
- Live inference failures and invalid outputs never become fabricated AI results. Established live sessions cannot silently switch to practice for planning or grading. Clearly labelled limited practice exists when the model is absent before starting.
- Node API stores sessions/reports atomically under ignored `server/data/runtime`. Local browser owner tokens enforce separation but are not production authentication. Faculty view sees only the current browser's reports.

## Ollama — installed and verified

The user installed `qwen3:4b-instruct`; do not install or download it again. Backend endpoint: `http://localhost:11434`. CLI: `C:\Users\RAGHAVAN S\AppData\Local\Programs\Ollama\ollama.exe`; inherited shells may not yet have it on PATH.

`ollama list`, `/api/tags`, `/api/show`, `/api/ps` and real structured inference verified. Artifact: Qwen3 4.0B Q4_K_M, digest `0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0`, Apache 2.0 licence text. Use 4096 context, `think:false`, bounded prompts/output, temperature 0.1 and one inference at a time. Timeout 120 seconds, at most one retry. No cloud AI.

## Verification completed

- 22/22 backend tests pass; TypeScript/Vite production build passes. Shared Three.js bundle-size advisory remains. `git diff --check` passed.
- Real API end-to-end: résumé → review → explicit GitHub skip → questions → seven model-graded answers including one proposed follow-up → persisted report. API-only extraction ~10 seconds, planning ~14 seconds, grading ~9–12 seconds.
- Live labelled evaluation: 28 valid calls over 14 cases repeated twice; 13/14 within developer reference ranges, 14/14 repeatable scores. Strong Python answer underscored. Fallback evaluation: 12/14 within ranges; lexical limitations documented. These are development checks, not independent grading validation.
- Browser: real extraction, profile confirmation, domain selection, actual Qwen grade, hint cap (2.8/4), skips, pause/resume and draft after refresh, report/history refresh, profile record, faculty view and fresh reassessment. Used explicitly fictional material only. Saved 10/100 browser fixture includes five deliberate skips; not a real student assessment.
- Microsoft Hazel English device voice started, speaking state observed, mute cancelled speech and restored awaiting. Dictation/microphone permission was not exercised.
- Visual checks: desktop 1440×1000, laptop 1366×768, mobile 390×844. Corrected report contrast and mobile heading spacing. Actual screenshots in `docs/verification/`.
- Browser inference was slower: extraction 15.9 s, planning 23.6 s, grading 44.0 s including 13.5 s loading. Ollama reported ~2.35 GB VRAM and ~3.53 GB model footprint; not whole-system peaks.

## Remaining external limitations

- GitHub repeatedly returned its exhausted unauthenticated rate limit, including the final retry. Successful live repository inspection remains unverified; error handling, bounded reader and explicit skip implemented/tested. Retry `node server/src/verify-github.mjs` after reset or configure optional backend `GITHUB_TOKEN`. No fabricated repository data substituted.
- Lip movement uses speech-event-driven estimated visemes, not forced audio phoneme alignment. Voice/dictation depend on browser/OS. Renderer capped near 30 fps, 10 while processing, DPR 1.25; pauses offscreen/hidden. No independent frame-time benchmark.
- Old fictional browser report retains extraction duplicates from before the deduplication fix. New extraction merge has regression coverage; historical report evidence was not rewritten.

## Run and inspect

From the repository root: `.\Start-PlacementIQ.cmd` (or `.\Start-PlacementIQ.cmd -SkipInstall` when dependencies already exist). Open `http://127.0.0.1:3000/assessment`. Keep Ollama running. Launcher starts both local services and stops them on Ctrl+C.

Checks: `npm.cmd test --prefix server`, `npm.cmd run build --prefix frontend`, `npm.cmd run verify:live --prefix server`, `npm.cmd run evaluate:live --prefix server`. Run live scripts sequentially with no interview request in progress.

Evidence: `docs/verification/RESULTS.md`, `live-inference.json`, `live-evaluation.json`, `github-live.json`, and screenshots. Setup, architecture, demo and attribution are in `docs/`. Key code: `frontend/src/features/interview`, `frontend/src/features/reports`, `frontend/src/services/interviewApi.ts`, `server/src`, `server/data/question-bank.v1.json`.

## Integrated readiness completed — 5 October 2026

Original HistGradientBoosting artifacts now run through server Python bridge without retraining or changed preprocessing (31-feature parity verified). Confirmed 23-field baseline, source-backed résumé suggestions, separately saved interview results, four-category matrix, configurable persisted policy, preparation action and history are connected. Overview defaults to integrated readiness; hero/robot designs preserved.

Fresh browser journey completed with fictional profile: baseline 99.87, actual 8-turn qwen3 interview 100, Placement Ready, composite 99.94, company-specific plan started. Result and plan survived backend restart/page reload. Evidence: docs/verification/INTEGRATED_READINESS.md, READINESS_UI_TRANSCRIPT.md, readiness-live-ui.json, readiness-dashboard.png. Tests: 42 backend, 10 targeted readiness, 11 grouped real-artifact acceptance checks, frontend build, original preprocessing parity all passed. Vite large-chunk warning remains.

Inference dependencies are in ml/requirements-inference.txt and project .venv. See integrated readiness document for exact commands, changed files, policy and persistence limitations.
