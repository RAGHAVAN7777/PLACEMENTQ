# Interview startup, fallback and navigation

Updated 17 October 2026. This supersedes the question-generation and demo behavior described in the earlier resume optimization notes.

## Diagnosis and recovery

The local Ollama log recorded `CUDA error: shared object initialization failed`, runner exit `0xc0000409`, and HTTP 500 on `/api/generate` at 15:19:56 IST. This is evidence of a CUDA runner initialization crash, not proof of insufficient VRAM. The actual machine reports an RTX 4050 Laptop GPU with 6 GB VRAM and installed `qwen3.5:9b`; Qwen3 4B is not installed. RTX 2050/4 GB performance therefore remains unverified.

The installed model succeeded with CPU inference. Local `.env` now sets `OLLAMA_NUM_GPU=0` as a reversible workaround while retaining the selected model. Remove that override after the Ollama/driver CUDA fault is resolved and retest. Restart PlacementIQ to load configuration changes. CPU generation remains slower than a healthy, appropriately sized GPU model.

`ollama.mjs` now reads error bodies and classifies CUDA initialization, memory allocation, model availability, parameter compatibility and transient service failures. Logs contain categories, status, model, request size, context/output limits, timeout, process memory and timing; they do not contain raw error bodies, resumes or candidate answers. Only explicitly transient failures receive bounded delayed retries. Invalid JSON, CUDA crashes and potentially still-running timed-out requests are not blindly retried. The serialized queue releases after errors; duplicate startup and answer requests cannot initiate parallel inference or reset an existing interview.

## Final behavior

- Real interviews generate original personalized questions from a compact reviewed profile, rubric concepts and a bounded recent answer. The first question is generated first. Subsequent questions are generated as needed; adaptive follow-ups continue to come from the existing grading pipeline. The scoring contract still uses the established rubrics.
- If generation is unavailable or invalid, the question falls back to the local bank with a visible notice. A topic rotation and randomized within-topic selection diversify real interview paths. The bank now also includes teamwork, API idempotency, object authorization and testing/resource-cost questions. Demo paths remain stable for prepared answers.
- Question fallback does not manufacture an AI grade. Existing live sessions retain their live grading requirement; if grading fails, the answer is not penalized or silently given a fabricated grade. Sessions operating without a model use the existing review-required rule-based estimates. Demo always uses those explicitly labelled practice estimates.
- Demo runs without Ollama: curated technical/behavioral questions, prepared answers, adaptive rule-based clarification, full automation and pause/continue/exit. Placement prediction still calls the saved Python model with explicitly fictional inputs. Demo records remain excluded from real history lists.
- Semantic review has moved into **Advanced extraction settings**. It only runs for detected ambiguity, can be disabled, uses the existing bounded cache, and is always skipped for demo. Clear structured resumes make no semantic inference request.
- **Demo Interview** is now in the dashboard and interview top navigation. Its dropdown selects Beginner, Intermediate or Advanced. The former large upload-page promotion is removed. Active demos have a compact status/control strip.
- Dashboard cards have consistent spacing, responsive columns and wrapping links. Detailed baseline factors are expandable, keeping the primary results readable. The existing theme, robot, voice input and model functionality remain.

## Measurements and verification

A single synthetic CPU comparison on the installed 9B model measured six-question generation at **107,474 ms**, versus one-question generation at **37,865 ms**. Both outputs passed structural checks. This is a startup-workload comparison, not an equal-work throughput benchmark or proof of question quality. The experimental one-question request used a smaller context; the final implementation shares the configured context with grading to avoid context-induced reloads.

The actual final personalized generation path measured **35,244 ms** for the first question and **17,887 ms** for the second. Model load time was **15,415 ms** initially and **21 ms** on the second request. Both questions referred to the fictional task-planner project. The second transition was a skip, so this is not a complete live grading benchmark. An isolated offline demo startup measured **17 ms**, excluding UI pacing and resume review.

Evidence: [paired generation experiment](verification/resume-optimization/question-start.json), [live personalized questions](verification/resume-optimization/personalized-start.json), and [offline browser verification](verification/resume-optimization/demo-offline-browser.json).

The full regression run passed **58 backend tests and 9 frontend tests**, followed by the production build. An additional all-levels offline demo test then passed with the five-test startup suite, giving **68 distinct passing tests**. Coverage includes HTTP 500 classification, bounded transient retries, duplicate startup, retained interview identity, answer deduplication, visible fallback, personalized next-question generation, diverse domains, offline demo completion for all three profiles, semantic gating, PDF/DOCX extraction, persistence, scoring and saved ML inference. Browser verification completed the offline demo, restored the real draft, launched the advanced profile from the dashboard dropdown, and checked desktop/mobile horizontal overflow. Existing large speech/3D bundle warnings remain.

## Modified files

Backend: `server/src/ollama.mjs`, `config.mjs`, `coordinator.mjs`, `server.mjs`, `demo.mjs`, `server/data/question-bank.v1.json`, local `.env`, and `.env.example` documentation.

Frontend: `components/layout/DemoLauncher.tsx` and `.css`, `AppLayout.tsx`, `WorkspaceTheme.css`, `features/interview/InterviewPage.tsx`, `ResumeDemo.css`, `services/interviewApi.ts`, `features/overview/OverviewPage.tsx`, and `features/readiness/ReadinessPage.tsx`.

Verification: `server/tests/startup-reliability.test.mjs`, updated workflow tests, `scripts/benchmark-question-start.mjs`, `verify-personalized-start.mjs`, `run-demo-ui.cjs`, and `verify-demo-ui.cjs`. The historical live-demo script is disabled because demos now deliberately run offline.

Remaining work: repair and verify the local CUDA runtime/driver, test the intended 4B model on the intended 4 GB GPU, broaden semantic question-quality evaluation, and validate a complete live graded interview under the final CPU configuration. The automated grader tests and two-question live smoke test do not replace that last validation.
