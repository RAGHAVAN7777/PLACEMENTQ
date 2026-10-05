# Conversational interview verification — 4 October 2026

## Implemented

- Aria displays and speaks the actual saved reply returned by the local model. The conversation log includes every submitted answer and assistant reply. No scripted praise replaces a model reply.
- Each answer request includes the current question/rubric, bounded reviewed résumé/project evidence, observed repository excerpts when present, and the latest two exchanges. Qwen selects a follow-up or a relevant remaining topic. Production limit: six core questions and at most two follow-ups; requests remain sequential with a 4096 context.
- Reactions require a selected passage from the current answer and cannot include an extra question. Numbered evidence selections resolve to exact original answer text; invalid responses retry once and then leave the session untouched with an honest error.
- Local Vosk voice input, recording/permission/loading status, editable transcripts, recorded-audio input, mute, replay, interruption and typed answers. Aria stops before microphone access and replay is disabled during capture/transcription. Recording is limited to 90 seconds; permission waits and model loads have explicit timeouts.
- Submitted turns, rubric explanations, exact answer excerpts, model provenance and reports persist locally. Pause/reload retains the question and draft. Reports include the full conversation. Existing hero hashes remain unchanged.

## Actual tests

All student data below is fictional development material, not the user's assessment.

1. **Installed Ollama:** CLI `ollama list` and `/api/tags` confirmed `qwen3:4b-instruct`. No Ollama installation or model download was performed.
2. **Strong/weak HTTP paths:** [Full transcripts](CONVERSATION_TRANSCRIPTS.md), [structured evidence](live-conversation.json). Each isolated path has one base question, a real generated follow-up, and a persisted report. The strong answer earned 4/4 and triggered a copying-versus-aliasing question. The weak answer earned 0.5/4 and triggered a question about a mutable default across calls. Correct subsequent clarification earned 4/4; the original and follow-up count once. These are real model responses, not test doubles. Final run passed; measured calls ranged from roughly 19–51 seconds on this laptop. The interrupted run resumed from its persisted question.
3. **Full browser journey:** Fresh résumé extraction, reviewed claims, GitHub skip, real six-question planning, eight typed submissions including two generated follow-ups, pause/reload/draft recovery, completion redirect, and saved-report viewing. All eight answers used `ollama-rubric-estimate`. The prepared strong fixture earned 26/26 points across six base questions. See [UI transcript](UI_CONVERSATION_TRANSCRIPT.md) and [saved evidence](conversation-ui-journey.json).
4. **Voice:** A Windows-generated test WAV was transcribed in the browser using the local Vosk model. Actual raw transcript: `less and dictionaries or mutable strings and integers are immutable two names can refer to the same list`. The transcript was editable, corrected, and submitted. This illustrates why technical terms need review. Replay and interrupt controls were exercised; actual speech events switched the avatar to speaking.
5. **Microphone limitation:** The in-app preview did not resolve its microphone permission request. The explicit timeout appeared, the answer remained editable, and the interview continued to its report. Physical microphone capture and accent accuracy have therefore **not** been verified. No microphone success is claimed. The same local recognizer was verified using recorded audio.
6. **Checks:** 32 backend tests passed, including no advancement on failed live calls or unusable dialogue, bounded context, exact evidence selection, scoring caps and persistence. TypeScript and production build passed. Vite reports large Three.js/Vosk chunks; Vosk is lazy-loaded when voice input is used. An optional npm audit request was unavailable; it is not reported as passed.

## Review artifacts

- [Report screenshot](conversation-report.png)
- `server/src/verify-conversation-live.mjs` runs isolated sequential live tests. Set `PLACEMENTIQ_DATA_DIR` to an interrupted test directory to resume it.
- `scripts/setup-local-voice.ps1` prepares the verified local English speech model if needed on another checkout. It is already installed here and does not touch Ollama.

The first implementation check exposed quotation drift; numbered evidence selection fixed it. An early browser turn also contained an extra question in its reaction; final validation now rejects that shape. Historical transcripts deliberately retain the words actually generated.
