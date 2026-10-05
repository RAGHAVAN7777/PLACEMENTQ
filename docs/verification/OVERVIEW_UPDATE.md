# Saved interview overview — 4 October 2026

## Implemented

- Interview completion and reopening a completed session navigate to `/app/overview?report=<saved-id>`.
- The overview reads the actual owner-scoped saved report: score, rubric points, reviewed résumé claims, answered prompts, hints, repository sources, skill results and preparation actions.
- Sample-profile snapshots are excluded from student workspace results. Empty and unavailable states do not substitute demo scores. No CGPA, college tier, aptitude or coding score is invented from unrelated answers.
- Skill Analysis, Action Plan and Progress use saved interview evidence. Suggested actions can be added to the persistent task list.
- Warm white surfaces, restrained orange accents, Manrope/Instrument Serif typography and responsive spacing connect the workspace to the existing landing/interview theme.
- The existing numeric placement predictor remains available separately. Interview scores are not relabelled as hiring eligibility or placement probabilities.

## Fair scoring changes

- A base question and clarification share one denominator. The strongest complete validated attempt counts once, retaining its hint cap. Preparation gaps use the same selected attempts.
- The grader explicitly accepts equivalent wording and half-point partial credit for correct incomplete reasoning; grammar, style and answer length are not grading criteria.
- Quote abbreviations are restored only when sufficiently long fragments occur in order within a short actual answer span. Straight/curly quotation marks are normalised for comparison; the saved quote retains the source text.
- A positive criterion with an unverifiable quote triggers one sequential model retry. If evidence is still invalid, the answer is not recorded or penalised; its draft remains available for retry.
- Historical reports retain their recorded scores and policy. Comparisons require the same starting domain and scoring version. No arbitrary score floor is applied.

## Verification

- Backend: **27/27 tests pass**, including partial credit, follow-up grouping, quote restoration, one-retry success, and failed evidence never advancing the session.
- Frontend: TypeScript and Vite production build pass. Existing Three.js bundle-size advisory remains.
- `ollama list` and the local API confirm installed `qwen3:4b-instruct`. No model installation/download occurred. Context remains 4096; inference is sequential.
- Live rubric set: **28 valid calls**, **14/14 cases within developer reference ranges**, **13/14 identical repeated scores**. One partial answer varied between 2 and 3 points. This is a small development set, not an independent accuracy benchmark. See `live-evaluation-v1.3.json`; the pre-fix result is retained separately.
- Two real coordinator rechecks of answers affected by quote formatting returned **4/4** and **5/5**, each after an evidence-format retry. See `live-evidence-retry.json`; repeat with `node server/src/verify-scoring-live.mjs`.
- Browser journey with explicitly fictional data: real résumé extraction, claim review, optional GitHub skip, personalised Python/project/SQL questions, seven actual model-graded answers including a clarification, and a persisted **88/100 (23/26)** report. Six base questions count once despite seven attempts. See `overview-live-journey.json`.
- Two answers in that UI fixture were recorded before the final retry fix. They remain flagged for review; historical scores were not silently rewritten. Their final-code rechecks are recorded separately above.
- Completed-session redirect and refresh display the matching report, score, one reviewed project and skill breakdown. Empty workspace, saved skill/history views, action-plan persistence and service-unavailable handling were checked.
- Mobile 390×844 and laptop 1366×900 checks: no horizontal overflow. Actual screenshots: `overview-mobile.jpg`, `overview-desktop.jpg`.
- GitHub retry still returned its exhausted public API rate limit. Successful live repository inspection remains unverified; the explicit skip works. See `github-live.json`.

## Hero preservation

These SHA-256 hashes match the start of this request. Pre-existing changes in these files were preserved; this update did not edit them or global styles.

| File | SHA-256 |
| --- | --- |
| `LandingPage.tsx` | `576D7F06BBAF839F00425FBD8EB1BE70E2E2738EE33A5D4494087AF80FE96122` |
| `LandingPage.css` | `D84411055F8D9C1262A4D5E0022D86923F627E2CACE19110966D7D862598257A` |
| `ParticleHero.tsx` | `C5A4CACF10C427284924663906655C5A07A2C34F9EBD846426B78206EE2BF38F` |
