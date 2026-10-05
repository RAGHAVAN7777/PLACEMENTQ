# PlacementIQ faculty demo script

1. Run `Start-PlacementIQ.cmd` and open `http://127.0.0.1:3000`.
2. On the landing page, select **Tell Your Success**. Show the centred animated particle-human face and upper torso. Replay its greeting to demonstrate mouth and expression motion tied to speech. Mute it and show that the text remains visible. Explain that mouth shapes are approximate because browser voices do not provide a reliable phoneme track.
3. Upload a text-based PDF/DOCX resume or choose the pasted-text alternative. Show validation, local progress, and the scanned-PDF limitation.
4. On profile review, expand the skills/projects sections. Edit one claim and show its retained source passage. Explain that unsupported model passages are discarded.
5. Paste a public GitHub profile or repository URL. Select one or two repositories. Show the explicit statement that files do not prove authorship. Alternatively demonstrate **Continue without GitHub**.
6. During analysis, call out the backend-driven events: reading resume, identifying project evidence, building the profile, and preparing the bounded path.
7. On domain selection, compare claimed resume evidence with observed repository evidence and select the suggested domain.
8. Answer one question strongly, one partially, request one hint, and skip one. Demonstrate typed input, optional dictation, pause/resume, the 70% hint cap, and the two-follow-up maximum.
9. Complete the interview. In the report, show the deterministic total, per-skill results, answer excerpts, missing evidence, preparation tasks, provenance versions, and interpretation limits.
10. Open **Saved reports** and refresh the page to demonstrate persistence. Open **Profile** to show a separate interview assessment record. Export the selected report as JSON. Start a reassessment in the same domain and show recorded per-skill differences while explaining that question paths can differ.
11. Open **Faculty Evidence** from the workspace. Expand the résumé source passages, repository file observations, submitted answers, and per-criterion explanations. Explain that the current course project is single-device: the view is owner-scoped but is not institution-grade authentication.
12. Open **Placement Predictor** to show that the original ML prediction remains useful and separate; the interview score was not inserted into an unrelated ML feature.

## Honest live-model note

Ollama and `qwen3:4b-instruct` are installed and real inference has been verified. Show **LOCAL AI CONNECTED** and the configured endpoint before starting. Reports record the actual grading method for every answer. The live development evaluation matched 13 of 14 labelled ranges, with one underscored Python answer. Present that limitation alongside the successful pipeline; this is not independently validated assessment accuracy. GitHub's unauthenticated rate limit blocked the live repository check on 3 October; skip it if still limited, and never claim files were inspected when they were not.

## Clearly labelled demonstration material

For a demonstration without personal documents, paste the following fictional profile. Do not present it as a real student's record:

```text
DEVELOPMENT DEMO — FICTIONAL PROFILE
Name: Demo Student
Education: Third-year B.Tech Computer Science student.
Skills: Python, SQL, machine learning, Git.
Project: Placement Study, a Python classifier predicting placement from academic and skill features.
Removed salary_package_lpa because salary is measured after placement and leaks the target.
Used a held-out test split, precision, recall, and a confusion matrix to evaluate the model.
Project: Library Records, a SQL project using LEFT JOIN to include books with no recorded loans.
Experience: Built local course projects; no employment experience claimed.
```

The GitHub step requires a real public URL supplied by the presenter. Select the current project only if it has a public repository; otherwise skip GitHub and demonstrate that honest absence. Do not imply the fictional profile authored an unrelated repository.

For a compact faculty demo, complete one question, pause and refresh, resume, request one hint, and finish the bounded session with typed answers or explicit skips. A skip must remain zero/insufficient evidence; it must not create a demonstrated skill. Keep the original browser/origin so its ownership key survives throughout the demo.

## Reproduce the checks

```powershell
npm.cmd test --prefix server
npm.cmd run evaluate --prefix server
npm.cmd run build --prefix frontend
npm.cmd run verify:live --prefix server
npm.cmd run evaluate:live --prefix server
```

The labelled cases and fallback results are under `server/data/`; measured live results are in `docs/verification/`. Read the exact recorded totals. These small development checks do not establish human-rater agreement or population-level grading validity.
