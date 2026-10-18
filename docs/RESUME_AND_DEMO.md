# Resume optimization and faculty demo

**Latest behavior:** See [17 October startup and navigation fixes](INTERVIEW_STARTUP_FIXES.md). Demo is now fully offline; its selector is in the top navigation. Semantic review is automatic only for ambiguous extraction and controlled through advanced settings. Real questions are personalized on demand with a labelled bank fallback.

Updated 17 October 2026. These changes extend the existing Node backend, React interface, JSON persistence, saved Python placement model, and interview coordinator. The robot, voice controls, manual interview and assessment logic remain in place.

## What changed

The principal measured delay was an unconditional resume LLM extraction request. Parsing also ran on the API thread, PDF text was flattened without column ordering, and generation repeatedly checked model availability. Resume ingestion now uses deterministic structured extraction by default, without a model call. Existing PDF.js and Mammoth libraries remain compatible with this Node backend; a second Python parsing service was unnecessary.

PDF and DOCX parsing runs in two reusable workers with bounded queues and a timeout. PDF coordinates preserve ordinary column reading order; DOCX paragraphs and table text retain their reading order. A SHA-256 content cache is scoped to the candidate owner, bounded to 32 entries and expires after 15 minutes. Concurrent identical requests share parsing work. Cached resume text remains in process memory; normal reviewed session data continues to use the existing local persistence.

Structured extraction covers contacts, education, explicit grades, programming languages, skills, projects and descriptions, experience, certifications, achievements, links and inferred domains. Strict schema validation, evidence passages, confidence labels, alias normalization and duplicate removal protect the existing interview profile contract. Missing values stay empty. Domains are identified as inferred, and edits are marked as student corrections. The review screen allows correcting extracted details and claim descriptions before interview planning.

Optional semantic review sends bounded relevant passages to the configured local Ollama model, with email and phone redacted. It is intended for ambiguous descriptions. Model unavailability leaves deterministic review usable. Timing logs contain processing durations and cache flags rather than resume content. The upload interface shows Uploading, Extracting, Analyzing and Completed; completion follows persisted backend processing.

Ollama keeps its existing model configuration, warm-model settings and serialized inference queue. Generation preflight checks have a short cache; validated reusable planning output has an owner-scoped bounded cache. Evaluation remains personalized and uncached, with bounded relevant interview context. Independent GitHub inspections can run concurrently.

## Measured performance

Measurements use a short fictional resume on this machine, recorded on 16 October. Times include local parsing, extraction and persistence, not browser upload/network latency.

| Fixture | First processing | Repeated processing |
| --- | ---: | ---: |
| Pasted text, previous pipeline | 156.4 seconds | Not measured |
| Pasted text, optimized | 18 ms | 8–11 ms |
| Generated text PDF, optimized | 1,215 ms | 7–19 ms |
| Generated DOCX, optimized | 321 ms | 6–7 ms |

All nine optimized runs used zero LLM calls and retained the checked email and explicit CGPA. The previous single run includes model waiting/retry overhead; it is not a universal speedup estimate. Larger and unusual documents require broader benchmarking. Evidence: [before](verification/resume-optimization/before.json), [after](verification/resume-optimization/after.json). Run `node scripts/benchmark-resume.mjs` from the repository root to measure the current pipeline. The historical baseline script is disabled to prevent overwriting old measurements with new code.

## Faculty demonstration

1. Open the interview interface, choose Beginner, Intermediate or Advanced, and select **Try Demo Interview**. Each candidate is fictional and clearly labelled.
2. Review the sample resume manually, or select **Run Full Demo** to progress through extraction, review, domain selection, interview, grading and the final report.
3. **Auto-Fill Demo Answer** inserts an editable answer for the current question. Prepared answers cover the bank; an uncovered adaptive question uses a bounded local model request. An unavailable model produces an actionable error instead of an unrelated answer.
4. **Pause demo** stops progression after the current request finishes. **Continue demo** resumes. **Exit Demo** restores the real session and unsaved draft; exit waits for any active request to finish.

Demo sessions, reports and numeric assessments carry a demo marker and are excluded from normal history lists. Answers use the existing evaluation pipeline; scores are not assigned by demo code. The final placement prediction calls the saved Python model with explicitly fictional numeric inputs, not values claimed to be measured from the resume.

## Verification and limits

- Final `npm run check` passed 53 backend tests, 9 frontend tests and the production build on 17 October. The subsequently added real-file layout test passed separately with all five resume/demo tests: 63 distinct passing tests in total. Coverage includes real two-column PDF files, DOCX tables, empty/scanned PDF rejection, malformed uploads, owner-scoped caching, strict schema, evidence provenance, saved stream completion and demo isolation. The build retains the existing large speech/3D bundle warning.
- The browser demo completed pause, answer editing, automated grading, real Python placement inference, labelled reporting and restoration of the real unsaved draft with no page errors. See [browser evidence](verification/resume-optimization/demo-browser.json).
- A complete live Ollama demo passed with the installed `qwen3.5:9b`; its recorded result was 100 through the existing grading pipeline, with no follow-up required in that run. A separate partial-answer practice integration test verifies adaptive follow-ups. See [live evidence](verification/resume-optimization/demo-live.json). This single result is functional evidence, not independent evidence of grading accuracy.
- The requested Qwen3 4B model is not installed. Existing `qwen3.5:9b` configuration was preserved; no model was silently downloaded or replaced. Live planning took about 47.5 seconds in the recorded run. Resume latency improvements do not imply that every live inference finishes in seconds.
- Scanned documents require pasted text; OCR is not included. Arbitrary overlapping columns, unusual headings and complex tables can still require manual correction. Confidence labels are extraction heuristics, not calibrated probabilities.

Remaining project work is tracked in [PROJECT_STATUS.md](../PROJECT_STATUS.md): broader extraction fixtures, rubric validation, real microphone checks, model validity and calibration, and production identity/storage and release hardening.
