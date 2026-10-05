# Windows setup

## Prerequisites

- Node.js 22 or newer.
- Ollama is **not required to start**. Local practice mode supports the complete journey with review-required rubric estimates.
- On this laptop, Ollama and `qwen3:4b-instruct` are already installed and verified. Leave Ollama running; no reinstall or download is needed. Model weights are not stored in this repository.

## First run

From PowerShell in the repository root:

```powershell
npm.cmd install --prefix server
npm.cmd install --legacy-peer-deps --prefix frontend
.\Start-PlacementIQ.cmd
```

The launcher creates `.env` from the example only if it is missing, installs missing npm dependencies, starts both local services, and stops them on Ctrl+C. Double-clicking the wrapper works too. To check the launcher environment without starting services:

```powershell
.\Start-PlacementIQ.cmd -CheckOnly
```

Open `http://127.0.0.1:3000`. The local API listens on `http://127.0.0.1:8787`.

## Manual run

Use two terminals:

```powershell
# terminal 1
Set-Location server
npm.cmd start

# terminal 2
Set-Location frontend
npm.cmd run dev -- --host 127.0.0.1 --strictPort
```

Use the same browser and origin each time (for example, always `127.0.0.1`, rather than switching to `localhost`). Your browser retains an access key for locally persisted interviews.

## Connect the installed Ollama model

For this laptop, verify the existing service:

```powershell
ollama list
Invoke-RestMethod http://localhost:11434/api/tags
```

No app code changes are needed. Use **Connection & voice → Check connection** in the interview room. If you choose another exact installed tag, update `OLLAMA_MODEL` in `.env` and restart the API. For a different machine that does not have the model, installation and `ollama pull qwen3:4b-instruct` are separate manual setup steps, never performed by this app. If the CLI is not on PATH yet, the Windows default is `$env:LOCALAPPDATA\Programs\Ollama\ollama.exe`.

## Model and endpoint verification

```powershell
ollama list
ollama show qwen3:4b-instruct
Invoke-RestMethod http://127.0.0.1:8787/api/health | ConvertTo-Json -Depth 8
```

The health response reports the actual installed model name, family, quantisation, and advertised capabilities when Ollama supplies them. PlacementIQ uses a conservative 4096-token context by default for the RTX 2050 4 GB environment even though the model artifact may advertise a much larger maximum. Change `OLLAMA_CONTEXT_SIZE` in `.env` only after measuring local latency and memory.

`GET /api/health` and `GET /api/ollama/status` report readiness, exact model tag, capabilities, digest and settings. Backend inference targets `OLLAMA_BASE_URL` (default `http://localhost:11434`) via Ollama's `/api/tags`, `/api/show`, and `/api/generate`. Frontend code never calls Ollama directly. Non-loopback model endpoints are rejected.

There is no cloud fallback. If Ollama is stopped or the model is absent, the interview displays local practice mode. Résumé extraction, source review, GitHub evidence, question selection, pause/resume, hints, skips, scoring, and saved reports remain available. Heuristic rubric grading cannot reliably understand every answer and is flagged for faculty review.

The API serializes model calls with bounded output, a 120-second timeout and at most one retry. The measured run on 3 October 2026 used 4096 context, approximately 10 seconds for résumé extraction, 14 seconds for question planning, and 9–12 seconds per answer. Ollama reported 2.35 GB VRAM allocation and 3.53 GB model footprint; these are its reported values, not whole-system peak measurements. Failed or invalid live responses leave the step pending for retry. An established AI interview will not downgrade grading silently if Ollama disconnects.

The later browser check was slower: 16 seconds for extraction, 24 seconds for question preparation, and 44 seconds for an answer including a 13.5-second model load. Allow the operation to finish; latency varies with other activity and whether the model is already loaded. The presenter reduces rendering to 10 fps during processing.

## Speech

Spoken interviewer output uses the browser's Web Speech synthesis and an available English OS/browser voice. The 3D particle-human face uses speech events for approximate mouth shapes, blinking, and state-based expressions. This is not a pretrained talking-head video model or phoneme-accurate lip-sync system. Speech boundaries and voice quality depend on browser/OS support.

Microphone input uses Vosk locally in a browser Web Worker. Run `scripts/setup-local-voice.ps1` once to install the free English model (already installed on this laptop). Its verified archive is served by the app and excluded from Git. Audio is never sent to a speech service. Click **Microphone · answer by voice**, stop recording, edit the transcript, then submit. Recorded clips of up to 90 seconds / 12 MB are also supported. Aria stops before recording and replay stays disabled during capture. Permission/model errors preserve typed drafts. See `frontend/public/models/README.md` for the source and licence.

## Tests

```powershell
npm.cmd test --prefix server
npm.cmd run evaluate --prefix server
npm.cmd run build --prefix frontend
npm.cmd run verify:live --prefix server
npm.cmd run evaluate:live --prefix server
```

Runtime data is in `server/data/runtime/`. The Profile page shows the interview records independently of placement prediction. Its browser-workspace clear button removes predictions/tasks/preferences only; it preserves interview access and server reports. Export reports from Saved reports before sharing or deleting data. Clearing browser storage removes the access key even though reports remain on disk.

## Troubleshooting

- **Port already in use:** stop the previous PlacementIQ terminal, then rerun. `--strictPort` prevents the frontend silently moving to another origin and losing access to its browser identity.
- **API unavailable:** keep both services running. Look at the launcher output; `npm.cmd start --prefix server` starts the API manually.
- **Scanned PDF:** OCR is not installed. Paste the résumé text or upload a PDF with selectable text/DOCX.
- **GitHub unavailable/rate limited:** retry after the reported reset, optionally configure `GITHUB_TOKEN` on the backend, or continue without GitHub. No code is downloaded for execution.
- **No voice:** use visible dialogue and typed input. Install/select a compatible English Windows voice if desired; speech support is separate from Ollama.
