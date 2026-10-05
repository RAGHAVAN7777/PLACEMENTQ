# PlacementIQ evidence interview architecture

## Product boundaries

PlacementIQ now has four deliberately separate outputs:

1. **Placement prediction** — the pre-existing browser-side ML estimate from numeric profile fields.
2. **Evidence profile** — resume claims, repository file observations, and interview-demonstrated areas, each labelled by source.
3. **Interview assessment** — rubric points earned only on questions actually asked in the current session.
4. **Preparation plan** — tasks derived from missing rubric concepts; it is guidance, not a causal promise of placement improvement.

The interview score is stored as its own report. It is never copied into `mock_interview_score` or another feature used by the placement model.

## Local components

```text
React interview room
  │ device-scoped owner token + typed API
  ▼
Node local API (127.0.0.1:8787)
  ├─ PDF/DOCX text extraction (pdfjs-dist / mammoth)
  ├─ bounded GitHub reader (public REST API; no code execution)
  ├─ persistent state-machine coordinator
  ├─ versioned question bank + deterministic score aggregation
  ├─ JSON persistence (atomic replacement; ignored by Git)
  └─ single-request Ollama queue
       ▼
     qwen3:4b-instruct at localhost:11434
```

The coordinator owns state transitions, the six-question target, the two-follow-up ceiling, pause/resume, valid question IDs, hint caps, score bounds, and final arithmetic. Its bounded actions select bank questions, inspect supported sources, probe gaps, and end the session. This is an inspectable state-machine agent; it does not give the LLM control of arbitrary tools or execute repository code.

Pretrained Qwen extracts explicit claims, personalizes bank-backed questions, grades open answers against criteria, and proposes a bounded follow-up or advancement. PlacementIQ does not train or fine-tune Qwen. Structured JSON is validated, score-clamped, and required to cite excerpts occurring in the student's answer. Model failures or invalid grading stop the current step without recording a replacement grade; the student can retry. When Ollama is absent before an interview starts, labelled rule-based practice remains available. An interview already using Qwen cannot silently downgrade if the model disappears. Per-answer provenance records which pathway was actually used.

The model's thinking mode is disabled for these short structured tasks. Input prompts have an 11,000-character hard ceiling; résumé source selection is capped at 6,500 characters. Each call requests 1,000–1,200 output tokens within the 4096 context. The default timeout is 120 seconds with at most one retry. Calls share one inference queue. Reports preserve prompt/coordinator versions, exact question/rubric snapshots, model tag and (where available) digest and settings. Latency and token counts are saved with session inference metrics.

## Agent flow

1. Extract text locally; reject unreadable/scanned files rather than inventing content.
2. Build a provisional claim profile. Every extracted item retains a resume source passage.
3. Let the student edit and confirm claims.
4. Optionally inspect at most two public repositories. Read a bounded, prioritised set of README, manifest, source, and test files. Never clone or execute code.
5. Stream analysis events while the backend extracts the profile, joins repository evidence, ranks starting domains, and persists the result.
6. Ask one model-personalized bank-backed question at a time. The grading response proposes a follow-up for clarification or a harder example within the same rubric. Code permits at most two, never follows up on a follow-up, and preserves rubric/difficulty identifiers.
7. Grade each criterion, validate evidence excerpts, apply the published hint cap, and aggregate in deterministic code.
8. Persist the report, compare it with the latest assessment in the same starting domain and scoring version, open the saved overview, and expose the evidence record to the local faculty view.

Scoring version 1.2 counts an original question and its clarification as one rubric. The best complete validated attempt contributes once, preserving its hint cap; criteria from contradictory attempts are not combined. Gaps and preparation tasks use the same selected attempts. Half-point partial credit is permitted for correct incomplete concepts; no arbitrary floor or placement threshold changes an interview score. Exact quotes are required. If the model abbreviates a quote with an ellipsis, only sufficiently long fragments occurring in order within a bounded original source span can be restored; invented or reordered fragments still fail validation. Historical reports are not rewritten.

Ordinary straight/curly quotation-mark differences are normalised for comparison while the saved excerpt retains the original text. If a positive criterion still has no valid source quote, the coordinator makes one sequential evidence-format retry. If that also fails, no answer or score is recorded: the user keeps their draft and can retry. Model formatting failures must not become student deductions. Retry metrics retain both inference timings.

The workspace loads owner-scoped saved reports for Overview, Skill Analysis, Action Plan and Progress. Interview completion redirects to `/app/overview?report=<id>`. Empty, loading, unavailable and missing-report states never substitute a sample profile. The previous numeric predictor remains separate; missing CGPA, coding, aptitude or college-tier values are not inferred from unrelated interview answers. Workspace theme overrides are scoped to `.app-layout`; landing and hero styles are preserved.

## Trust and ownership

- Resume text, repository content, and answers are delimited as untrusted data in prompts.
- Raw resume text and reports are stored under `server/data/runtime/`, which is ignored by Git.
- The original project had no accounts. This upgrade creates a random owner token in browser localStorage and enforces it on every session/report endpoint. It prevents accidental cross-browser access but is **not production authentication**.
- The faculty route can review reports owned by the current local browser identity only. A real multi-user deployment needs institution-managed authentication and roles.

## Persistence and reproducibility

The store records question-bank, prompt, coordinator, and model identifiers. Writes use a temporary file followed by rename. Sessions are resumable after browser refresh and server restart. The question bank and rubrics live in `server/data/question-bank.v1.json`.

The Profile page retrieves the owner's persisted interview records without injecting them into the original prediction feature store. Saved reports have direct links, JSON export, per-criterion explanations, source passages, and per-skill reassessment comparisons. The local faculty view exposes the same ownership-scoped evidence.

## Avatar and speech

The head-to-upper-torso interviewer is a bundled CC0 MakeHuman-derived bust rendered as Three.js particle geometry centred in the room. Facial geometry animates rather than displaying a still image. The speech controller supplies real utterance state and browser boundary events, with approximate text-to-viseme shapes when detailed timing is unavailable. Facial motion is an expressive rendering aid; no appearance/emotion signal enters scoring. No remote asset is fetched at runtime. Device pixel ratio is capped and hidden/offscreen scenes pause; reduced motion limits ambient motion while retaining functional speech cues. See asset attribution for the upstream mesh and rebuild script.

## API surface

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Local service status, Ollama installation/capabilities, setup state, limits |
| `GET /api/ollama/status` | Refresh configured model readiness |
| `GET /api/sessions` | List current owner's saved sessions |
| `GET /api/question-bank` | Question metadata and published scoring policy |
| `POST /api/sessions` | Create a persistent interview |
| `GET /api/sessions/:id` | Restore owned session state |
| `POST /api/sessions/:id/resume` | Validate and extract PDF, DOCX, or pasted text |
| `PATCH /api/sessions/:id/profile` | Save reviewed source-backed claims |
| `POST /api/github/preview` | Resolve public repository/profile choices |
| `POST /api/sessions/:id/github` | Inspect selected sources or skip |
| `POST /api/sessions/:id/analyze` | Stream genuine NDJSON coordinator progress |
| `POST /api/sessions/:id/start` | Confirm starting domain and create bounded questions |
| `POST /api/sessions/:id/answer` | Record answer/skip, grade, adapt, save completed report |
| `POST /api/sessions/:id/hint` | Reveal hint and record the scoring cap |
| `POST /api/sessions/:id/report` | Recover report finalization after an interruption |
| `POST /api/sessions/:id/pause` / `resume` | Persist pause state |
| `GET /api/reports` / `GET /api/reports/:id` | Read only the current owner's reports |

Session/report requests carry `X-PlacementIQ-Owner`. The random browser token is a local bearer key, not a login. Keep the API on loopback for this course project.

## Conversation loop (1.4)

Each answer makes one sequential structured local model request that returns rubric criteria, an answer-specific reaction, response kind, selected answer-evidence IDs, and an adaptive follow-up or next-topic ID. Numbered source passages are copied by the server into exact excerpts. The server validates bounds and source grounding before atomically saving the answer and assistant reply. A failed call leaves the question and draft resumable. Full conversation and rubric evidence are copied into the final report. Context is bounded to the latest two answers and short reviewed/observed project excerpts; six base questions plus at most two follow-ups remain the production limit.

Local voice capture uses the Vosk WebAssembly worker and a locally served English model. No speech API receives audio. Capture is half-duplex: speech synthesis stops before permission/capture, replay is disabled during capture/transcription, and only reviewed text is submitted. Recording stops after 90 seconds, permission waits after 15 seconds, and model loading after 60 seconds. Typing, replay, mute and interrupt controls remain explicit. Windows/browser speech events drive the existing particle avatar; visemes are approximate.
