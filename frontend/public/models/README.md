# Local speech recognition

`vosk-small-en.tar.gz` is installed by `scripts/setup-local-voice.ps1` (run from PowerShell). It is ignored by Git, served by this application, and copied into production builds by Vite. No CDN or external speech API is used at runtime. Typing remains available if it is missing.

Source: [Vosk small English US 0.15](https://alphacephei.com/vosk/models), Apache-2.0. Official ZIP SHA-256: `30f26242c4eb449f948e42cb302dd7a686cb29a3423a8367f99ff41780942498`.

Browser runtime: [vosk-browser](https://github.com/ccoreilly/vosk-browser), Apache-2.0. The model uses CPU/WebAssembly in a Web Worker, independently of Ollama. Model data may be cached by Vosk in this browser. English recognition can mishear names and code: always review the editable transcript before submitting. Audio is not uploaded or stored by PlacementIQ; only submitted text is persisted in the interview.
