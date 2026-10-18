> **Unified assessment update:** Start at `/assessment`: résumé → optional GitHub → candidate verification → saved baseline → interview → integrated dashboard. New assessments use 40% baseline / 60% interview readiness (not a calibrated placement probability). See [implementation, schema, routes, tests and demonstration guide](docs/UNIFIED_ASSESSMENT.md).

# PlacementIQ

Current implementation status, audit results, and completion priorities are in [PROJECT_STATUS.md](PROJECT_STATUS.md). The older checkpoint and verification documents contain historical results; they do not establish what is installed on a new machine.

PlacementIQ is a local-first student preparation project with two deliberately separate experiences:

- an existing numeric placement-prediction model; and
- an evidence-grounded AI interview using resume claims, bounded public GitHub evidence, reviewed rubrics, and a local Qwen model through Ollama.

The interview is diagnostic preparation support. It does not prove authorship, predict hiring outcomes, or guarantee that a recommended activity will cause placement success.

## AI evidence interview

- Centred, animated 3D particle-human interviewer with a moving mouth, blinking, expressions, and event-linked speaking/listening states.
- Local PDF/DOCX extraction, pasted-text fallback, source-backed claim review, and explicit scanned-PDF handling.
- Optional bounded GitHub inspection with caching and rate-limit messages; downloaded code is never executed.
- Six-question adaptive interview with at most two justified follow-ups, pause/resume, hints, skips, actual generated spoken replies, persistent conversation history, and editable local Vosk transcription.
- An exact installed model tag through a configurable local Ollama endpoint; there is no cloud fallback.
- Criterion-level grading validated and totalled in deterministic code, persistent reports, reassessment differences, and a local faculty evidence view.
- Versioned bank of 16 questions across Python, SQL, machine learning, project explanation, frontend, backend, algorithms, and cloud/DevOps. The newer domains have limited question depth.
- Completing an interview opens the overview with its actual saved score, reviewed evidence, skills and next actions. The workspace uses the landing/interview typography and warm palette; sample profiles are excluded from student results.
- Clarifications count once per original question, using the best complete validated attempt. Half-point partial credit and grounded evidence checks avoid unjustified deductions without adding score floors or treating interview scores as placement probabilities.

See the [architecture](docs/ARCHITECTURE.md), [Windows setup](docs/SETUP_WINDOWS.md), [demo script](docs/DEMO_SCRIPT.md), and [asset/model licence notes](docs/ASSETS_AND_LICENSES.md).

## Existing ML project

The original pipeline uses 100,000 records across 26 source columns, excludes `student_id` and the outcome-leaking `salary_package_lpa`, builds engineered features, and benchmarks 12 classifiers. The recorded champion run reports 85.66% held-out accuracy and 0.9363 ROC-AUC on a 20,000-record test split.

These are empirical results for the included dataset and split. Dataset provenance is not verified. A k-NN neighbourhood audit found 69.73% local label consistency; this is a descriptive diagnostic, not proof of the Bayes error rate, a theoretical accuracy ceiling, or the percentage of learnable signal captured.

The alternative 0.39 threshold raises measured test-split recall to 92.04% with 418 fewer false negatives relative to 0.50. It does not establish real-world benefit or identify who is qualified.

## Quick start on Windows

Prerequisite: Node.js 22.18+ (including native TypeScript test support). The numeric predictor also requires Python and the packages in `ml/requirements-inference.txt`. **Your installed Ollama model is connected through the backend.** If Ollama is unavailable before starting, the app clearly labels its limited rule-based practice mode; an existing live interview stops for retry instead of silently changing grading methods.

```powershell
npm.cmd install --prefix server
npm.cmd install --prefix frontend
# Use a Python version supported by the pinned scikit-learn release:
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r ml/requirements-inference.txt
.\Start-PlacementIQ.cmd
```

Or double-click `Start-PlacementIQ.cmd`; it creates `.env` only if missing and installs missing npm dependencies. Open `http://127.0.0.1:3000`; the local API runs at `http://127.0.0.1:8787` by default. Internet is needed for first-time dependency installation and public GitHub inspection.

Run `ollama list` and set `OLLAMA_MODEL` in `.env` to an exact installed completion-capable tag. The example defaults to `qwen3:4b-instruct`; this checkout was verified with `qwen3.5:9b`. The backend uses `http://localhost:11434` with a 4096 context and one inference request at a time. The launcher never installs Ollama or downloads weights. New installations can follow the separate Windows setup instructions. Existing sessions retain their original model when the default changes.

The avatar uses a bundled CC0 human bust rendered as animated particles; no still image is used by the interview. Browser speech start/end and word events drive approximate mouth shapes. This is expressive speech-linked animation, not measured phoneme-accurate lip sync. Available voices and offline speech support depend on your browser and Windows installation.

## Verification

```powershell
npm.cmd run check
npm.cmd run verify:readiness
python ml/verify_inference.py
npm.cmd run evaluate --prefix server
# Explicitly run real local inference, sequentially, using fictional test data:
npm.cmd run verify:live --prefix server
npm.cmd run evaluate:live --prefix server
```

The labelled fallback evaluation and its actual checked-in result are in `server/data/evaluation-set.v1.json` and `server/data/evaluation-results.v1.json`. The tiny set checks guardrails and repeatability only; it does not establish model-grading accuracy.

Historical Qwen verification completed the résumé-to-report journey and a small repeated grading evaluation. The latest recorded end-to-end run (11 October 2026, `qwen3.5:9b`) completed eight answers including two follow-ups. The separate historical scoring evaluation produced 28 valid responses: all 14 cases were within developer reference ranges, with identical scores in 13/14 repeated cases. One partial answer varied between 2 and 3 points. The current rule-based fallback evaluation passes only 12/14 reference ranges. These are small development checks, not independent grading validation. See [current status](PROJECT_STATUS.md), [original measured results](docs/verification/RESULTS.md), and [the overview update](docs/verification/OVERVIEW_UPDATE.md).

## Optional ML research commands

```powershell
# Retrain the original benchmark pipeline (requires a separate Python environment)
python ml/train.py

# Open the reproducibility notebook
jupyter notebook placement_prediction_course_project.ipynb
```

The baseline now runs the original saved placement-model artifacts through the backend Python inference bridge. Integrated assessments and linked interview reports persist under the ignored `server/data/runtime/` directory. The live interview score is never inserted into an old ML feature. See [integrated readiness setup, policy, persistence and verification](docs/verification/INTEGRATED_READINESS.md).

Model explanations show ordered prediction differences from an explicit synthetic reference. They are order-dependent, not SHAP values or causal estimates. The model scenario search returns bounded hypothetical changes and explicitly reports when its target cannot be reached. The separate browser simulator uses illustrative readiness points, not trained-model probabilities.

## Repository map

- `frontend/` — React 19, TypeScript, Three.js UI.
- `server/` — local Node API, coordinator, persistence, Ollama adapter, GitHub reader, question bank, and tests.
- `ml/` — original model training and evaluation artifacts.
- `docs/` — architecture, setup, demo, asset, and licence documentation.
- `ML_PROJECT_REPORT.md` — original course-project report with claims qualified to the evidence available.

## Conversational interview verification

See [actual strong/weak local model transcripts](docs/verification/CONVERSATION_TRANSCRIPTS.md). Run `node server/src/verify-conversation-live.mjs` for the isolated, sequential HTTP tests. The app asks six core questions and up to two adaptive follow-ups. It retains submitted turns, selected source evidence and rubric explanations in the saved report. Failed live calls never substitute scripted dialogue.
# Resume processing and faculty demonstration

The interview interface now includes structured PDF/DOCX review, fast deterministic extraction with content caching, and **Try Demo Interview** with beginner/intermediate/advanced candidates, editable answer auto-fill, and full-demo pause/continue/exit controls. Demo assessments remain clearly labelled and use the existing grading and placement model.

See [setup, performance evidence, demo instructions and known limits](docs/RESUME_AND_DEMO.md) and [current project status](PROJECT_STATUS.md).

