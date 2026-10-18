## Personalized roadmap update — 18 October 2026

Action Plan now generates assessment-specific four-stage preparation tasks, supports capacity-aware schedules, notes/status/rescheduling, preserves versions and completed work, and connects Overview/Skills/Readiness/Progress. Optional local AI is bounded and falls back to the deterministic plan. See [implementation and verification](docs/PERSONALIZED_ROADMAP.md).

# Unified workflow update — 17 October 2026

The current implementation connects new candidate verification, actual baseline inference, adaptive interview, 40/60 readiness and dashboard pages through the same saved assessment. Offline demo records remain separate. Current profile and preparation progress persist in store version 2. Historical snapshots retain their original policy. See [complete integration notes](docs/UNIFIED_ASSESSMENT.md) for authoritative current behavior, run instructions and limitations. Earlier checkpoints below describe previous states.

# PlacementIQ — current status and completion plan

## Latest 17 October update: startup reliability and navigation

Real interviews now generate personalized questions on demand with a visible, diverse bank fallback on generation failure. Demo Mode works offline with labelled practice scoring. Demo level selection is in the top navigation; dashboard spacing and expandable details reduce clutter. The CUDA initialization crash was identified in Ollama's log, and a verified CPU workaround was applied locally. The full 67-test suite and production build passed; an additional all-levels demo test also passed (68 distinct tests). Offline browser completion and desktop/mobile navigation checks passed. See [diagnosis, timings, modified files and remaining validation](docs/INTERVIEW_STARTUP_FIXES.md).

## 17 October 2026 update: resume processing and faculty demo

Implemented deterministic structured PDF/DOCX extraction, reusable parsing workers, owner-scoped content caching, editable evidence-aware review, honest streamed progress, three fictional demo candidates, answer auto-fill, and full demo controls. Demo results use existing grading and the saved placement model, remain labelled, and are excluded from normal histories. The existing UI, robot, voice controls and model configuration are preserved.

Measured short-fixture first processing: PDF 1.215 seconds, DOCX 0.321 seconds, pasted text 18 ms; cached repeats 6–19 ms. Browser demonstration and a full live Ollama interview passed. Complex layouts still need review; scanned PDFs need pasted text; live model inference remains substantially slower than deterministic extraction. See [implementation, measurements, usage and limitations](docs/RESUME_AND_DEMO.md).

The audit below remains a dated record of broader project status and remaining release work.

Updated: 16 October 2026. Audit and repairs performed on this Windows checkout; browser/readiness checks and dependency audits were recorded on 14 October, offline transcription and the final test/build checks on 16 October, and the real Ollama journey on 11 October. Earlier checkpoint documents are historical.

## Current status

**Working local prototype with a verified numeric assessment flow and local AI interview flow. It is not yet a validated recruitment system or a production multi-user service.** No defensible completion percentage can be assigned without agreed release criteria.

| Area | Status and evidence | Remaining work |
| --- | --- | --- |
| Numeric assessment | Saved Python model runs through the API. All 31 processed features match the saved inference pipeline. Form submission, persistence, ownership, and immutable baseline checks pass. | Verify dataset provenance, external validity, calibration, and subgroup performance before interpreting probabilities for real students. |
| Integrated readiness | Baseline and interview remain separate; the policy matrix, pending states, and saved policy reload are verified. | Faculty must approve weights and thresholds; these are product policy, not learned hiring rules. |
| Local AI interview | Real `qwen3.5:9b` résumé extraction, question planning, eight submitted answers including two follow-ups, and saved report passed on 11 October. Sessions retain their selected model. | Independent rubric validation, more questions, and latency testing across supported machines. |
| Practice fallback | Available when starting without Ollama, explicitly marked for review. Developer evaluation: 12/14 within reference ranges, 14/14 repeatable. | Incorrect SQL with rubric words is overcredited; a correct ML paraphrase is undercredited. Keyword matching cannot establish semantic correctness. |
| Explanations and scenarios | Real model responses render with correct units. Ordered reference-path effects sum to the prediction. Search reports unreachable targets. | Validate explanation stability and scenario plausibility; neither output establishes causality or minimum effort. |
| Model Lab | Charts and rankings now read the saved evaluation JSON, including all 101 ROC points and correct cutoff results. | Feature importance was exported through a RandomForest fallback and is labelled accordingly; obtain champion-specific diagnostics if needed. |
| GitHub evidence | Rate-limit handling and explicit skip are implemented. The 16 October live public-repository retry was still rate limited. | Complete one successful live inspection after reset or with a configured backend token. |
| Voice and avatar | Mouth-motion regression repaired. Offline model installed with verified SHA-256 and included in the build. Actual browser-worker transcription of a generated English WAV passed on 16 October. | Verify real microphone permissions, capture controls, recognition quality, playback, and OS voices. Browser answers currently omit measured recording duration. |
| Reports | Current backend metric names and nullable metrics render correctly. Historical estimated speech timing is labelled. Typed answers no longer invent words per minute. | Wire measured recording duration if delivery diagnostics are wanted; validate any communication measures separately. |
| Packaging/security | Build and automated suites pass. Launcher refuses occupied ports without killing another application. | Five moderate production dependency findings across two advisory chains, large speech bundle, release/CI setup, and production identity/storage design. |

## Repairs completed

- Aligned explanation and counterfactual TypeScript contracts with the actual Python/API response. Removed the accidental extra percentage multiplication, stale response displays, and silent error states; added input bounds, retry feedback, and target-reached handling.
- Replaced misleading SHAP-like rescaled effects with ordered model prediction differences from an explicit synthetic reference. Labels disclose order dependence, reference choice, and historical approximations.
- Separated illustrative browser readiness points from trained-model probabilities. Baseline mirroring uses server-confirmed inputs. Weighted contribution clamps and backlog improvement handling are corrected.
- Corrected report speech-field mismatches that could crash rendering. Optional measured timing is distinguished from legacy estimates and text heuristics.
- Validate selected Ollama models before changing configuration, require the local owner for model changes, and pin queued/interview inference to the session model. Existing live sessions do not silently downgrade on re-extraction failure.
- Replaced stale Model Lab metrics, invented ROC geometry, arbitrary rankings, and incorrect cutoff values with artifact-backed data. Removed unsupported hiring-eligibility claims. The 418 figure describes fewer false negatives, not all reclassified records.
- Fixed mouth-motion responsiveness, resilient speech-model download handling, and the launcher's destructive occupied-port behavior.
- Added a root verification entry point, regression coverage, fictional acceptance fixtures instead of personal report IDs, and revised Windows setup instructions.

Model weights were not retrained. Personal runtime records and `.env` were preserved. Test records are isolated under ignored `server/data/test-runtime/`. This checkout has no Git metadata, so changes have not been committed or published.

## Verification evidence

| Check | Result | Reproduce / evidence |
| --- | --- | --- |
| Backend automated tests | 49 passed | `npm.cmd test --prefix server` |
| Frontend automated tests | 9 passed | `npm.cmd test --prefix frontend` |
| TypeScript and production build | Passed; Vosk vendor size warning remains | `npm.cmd run build` |
| Saved-model inference parity | All 31 processed features passed | `python ml/verify_inference.py` |
| Integrated readiness acceptance | 11 checks passed using real baseline inference and explicitly synthetic interview scores | [readiness-acceptance.json](docs/verification/readiness-acceptance.json), `npm.cmd run verify:readiness` |
| Browser regression | Four flows: Model Lab, full assessment, scenarios/mobile, legacy and typed report metrics; no page errors | [ui-results.json](docs/verification/audit-2026-10-14/ui-results.json), `scripts/verify-ui.cjs` |
| Launcher collision | Refuses launch and preserves the existing listener | `node scripts/verify-launcher.mjs` |
| Real Ollama integration | Passed on 11 October with a fictional student | [live-inference.json](docs/verification/live-inference.json) |
| Offline voice runtime | Passed on 16 October: local Vosk model transcribed a 5.88-second generated WAV correctly | [voice-runtime.json](docs/verification/voice-runtime.json), `node scripts/verify-voice.cjs` |
| Rule-based practice evaluation | 12/14 within reference range, 14/14 repeatable; not fully passing | [evaluation-results.v1.json](server/data/evaluation-results.v1.json) |
| GitHub live inspection | Blocked by external API rate limit again on 16 October | [github-live.json](docs/verification/github-live.json) |
| Production dependency audit | No high/critical; server: 3 moderate, frontend: 2 moderate | [server audit](docs/verification/audit-2026-10-14/server-dependency-audit.json), [frontend audit](docs/verification/audit-2026-10-14/frontend-dependency-audit.json) |

The moderate findings are dependency chains through `mammoth → argparse → sprintf-js` and `vosk-browser → uuid`. The recorded audit offers no straightforward compatible fix: the Mammoth suggestion is a major downgrade, and the Vosk chain has no automatic fix. Do not force a downgrade or override merely to clear the audit count; verify a maintained update or replacement with document/transcription regression tests.

Browser verification uses an installed Playwright/Chromium and isolated services; see [setup instructions](docs/SETUP_WINDOWS.md#browser-regression-check). These checks cover specified flows, not every device, input, or accessibility requirement. Real audio capture has not been verified. The saved model benchmark is **85.66% accuracy, 0.9363 ROC-AUC on 20,000 records**; this is a recorded dataset result, not verified real-world placement accuracy.

## Prioritized work to complete it

### 1. Finish local-demo acceptance

1. The offline speech model is installed and its browser runtime passed a generated-audio smoke test. Next test physical microphone permission allowed/denied, short recording, transcript editing, cancellation, and browser/OS speech output. Preserve typed input when voice is unavailable. On a fresh machine, run `scripts/setup-local-voice.ps1` first.
2. Repeat the GitHub live check successfully after the API reset or using a backend token; keep skip and rate-limit behavior in the demo.
3. Run the full journey on a fresh supported Windows environment using only the documented steps. Demonstrate restart/reload, reports, evidence review, failures/retry, and the separation between baseline probability and interview score.
4. Verify keyboard access, focus, small screens, reduced motion, and screen-reader labels across the complete interview. Current browser automation is a useful regression sample, not an accessibility audit.

Done when: a second machine can reproduce the documented workflow, core and optional paths are honestly labelled, and no manual repair is required during the demo.

### 2. Establish assessment quality

1. Expand the 16-question bank across eight domains with reviewed difficulty levels and alternative answers. Build an independent, blinded faculty-scored evaluation set, including negation, paraphrases, incorrect keyword-rich answers, and partially correct responses.
2. Measure live-model grading agreement, repeatability, bias, and failure rates. Keep keyword fallback as review-required practice; semantic mistakes cannot be solved by adjusting expected test ranges.
3. Establish dataset source/licence, outcome definition, split integrity, leakage checks, calibration and subgroup metrics. Test on an independently collected cohort before making external placement claims.
4. Have faculty approve readiness weights and thresholds. Review realistic scenario bounds and immutable features; test whether explanation conclusions change materially with reference or feature order.

Done when: agreed quality criteria are met on independent data and documented limitations match the actual product behavior.

### 3. Prepare a deployable multi-user release

1. Design authenticated users, faculty roles, authorization and recovery. A local browser access key is not a complete institutional identity system.
2. Replace or harden file persistence for the intended concurrency; add migrations, backups, retention, export and deletion workflows with ownership tests.
3. Resolve the dependency advisory chains through vetted maintained versions/replacements. Measure and reduce the Vosk download and bundle cost without suppressing warnings.
4. Add Git version control, reproducible dependency installation, CI for the existing checks, a release configuration, monitoring, and failure diagnostics. Benchmark inference latency and resource budgets on the actual deployment hardware.

Done when: access controls, persistence/recovery, dependency remediation, deployment verification, and support ownership are demonstrated for the chosen deployment environment.
