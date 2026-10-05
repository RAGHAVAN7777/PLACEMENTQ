# Verification — 3 October 2026

All student material used in these checks was explicitly fictional. No personal résumé was used. No model was installed or downloaded during verification.

## Local model

- Installed CLI `ollama list` and `GET http://localhost:11434/api/tags` both confirmed `qwen3:4b-instruct`.
- `/api/show`: Qwen3 4.0B, Q4_K_M; completion, tools and thinking capabilities; Apache 2.0 licence text. Calls explicitly use `think: false`.
- First real schema-constrained response: 7.25 seconds including 4.59 seconds loading; 59 output tokens.
- Context: 4096. Inference requests were sequential. `/api/ps` reported 2,345,297,510 bytes in VRAM and 3,525,081,824 bytes model footprint. These are Ollama's reported allocations, not measured system peaks.

## End-to-end live API run

`npm.cmd run verify:live --prefix server` passed. See [raw measured results](live-inference.json).

Résumé text → source-backed model extraction → profile confirmation → explicit GitHub skip → streamed analysis → model-personalized questions → pause/resume → seven Qwen-graded answers including one model-proposed follow-up → deterministic totals → persisted report and report recovery endpoint.

Extraction took 10.2 seconds; question preparation 14.0 seconds; grading 9.2–11.7 seconds per answer. This synthetic fixture's score is a pipeline check, not an evaluation of a real student. Generic project reference text did not establish actual project experience and received little or no credit.

## Labelled grading evaluation

`npm.cmd run evaluate:live --prefix server`: 14 developer-labelled cases, each run twice with the real local model. See [per-call results](live-evaluation.json).

- 28/28 valid responses and successful score validation.
- 13/14 cases within their reference ranges on both runs.
- 14/14 cases repeated the same score.
- A strong Python mutability answer scored 3/4 rather than the labelled 3.5–4 range. This is a real model limitation, not rounded away.
- Instruction-injection cases scored zero through deterministic guardrails. Model output does not control final arithmetic.
- Rule-based fallback: 12/14 cases within range, 14/14 repeatable. It overcredited incorrect SQL with rubric vocabulary and undercredited a correct ML paraphrase. It is explicitly review-required.

The labels are developer-assigned, not independently faculty-reviewed. The small set is not an accuracy benchmark or calibration study. Matching scores do not imply identical explanations.

## Engineering checks

- 22/22 server tests passed: PDF/DOCX extraction, source validation, score bounds/hints, ownership, state transitions, real disk restart persistence, duplicate/stale submissions, malformed model responses, sequential inference, GitHub errors/rate limits, profile deduplication, and no advancement or silent switch to practice after failed live inference.
- TypeScript and Vite production build passed. Vite retains its advisory about the existing shared Three.js chunk size.
- GitHub live API checks returned HTTP 403 with zero remaining unauthenticated requests, including the final retry. Successful live repository inspection remains unverified; error handling and explicit skip were verified. No repository data was fabricated. [Recorded retry](github-live.json); rerun with `node server/src/verify-github.mjs` after the limit resets.

## Browser and avatar

The original still image has been replaced by a locally bundled CC0 human bust, sampled into 38,000 particles. Real geometry deforms for jaw/lips, brows, cheeks, blinking and subtle head motion. The stage is centered and follows the existing charcoal/orange landing theme.

The browser successfully started the installed Microsoft Hazel English device voice and exposed the speaking state. Mute returned the avatar to awaiting and cancelled playback. Replay and visible dialogue are available. Word-boundary timing drives estimated mouth shapes; accurate audio phoneme alignment is not claimed. Ambient rendering is capped around 30 fps (10 during processing), DPR at 1.25, and stops while hidden or outside the viewport. No independent GPU frame-time benchmark was performed.

Browser checks used a separate fictional student: pasted résumé, real extraction and question planning, profile confirmation, GitHub failure and skip, pause/resume with draft retained on refresh, real answer grading with a hint, five deliberate skips, completion, report refresh, profile record, faculty evidence view, and a fresh reassessment from history. The strong first answer received 2.8/4 after the published 70% hint cap. Skips were recorded as insufficient evidence. The saved 10/100 fixture report is a workflow test, not student performance data. This older fixture retains claims extracted before the deduplication fix; the new-session merge is covered by a regression test.

With the browser open, extraction took 15.9 seconds, planning 23.6 seconds, and grading 44.0 seconds including a 13.5-second model load. These differ from the earlier API-only run; latency depends on load and model residency. The 10-fps processing cap was added afterwards to reduce rendering work, with no claimed inference speedup.

Visually inspected at 1440×1000, 1366×768, and 390×844. No horizontal overflow in the checked room layouts. Fixed a saved-report stylesheet conflict and mobile heading spacing during inspection. Screenshots: [desktop room](interview-desktop.jpg), [laptop room](interview-laptop.jpg), [mobile room](interview-mobile.jpg), [saved report](report-desktop.jpg).

Dictation permission and microphone audio were not exercised; typed answers remain fully functional. Local owner tokens are not production authentication, and the faculty view is restricted to the same browser identity.
