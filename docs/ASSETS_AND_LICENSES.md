# Assets, dependencies, and model licence notes

## Humanoid interviewer

The active interviewer uses the CC0 MakeHuman base mesh and adult female shape targets, cropped to the head, neck, shoulders, and upper chest. The resulting `frontend/src/features/interview/avatar/aria-bust.bin` is sampled into a 3D particle surface and animated by the original `RobotAvatar.tsx` implementation. The avatar is fictional, uses no real person's likeness, and requires no paid asset or runtime download.

Source revision: `a8bc2d54ff0ac92e78ff71431b1023eda42bf482` from the [official MakeHuman repository](https://github.com/makehumancommunity/makehuman). Upstream distinguishes CC0 core assets from its AGPL application code in its [license notes](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md). The bundled derivative uses core mesh/target data. Full source attribution, reconstruction instructions, and the CC0 text are retained in `frontend/src/features/interview/avatar/ATTRIBUTION.md`, `build_asset.py`, and `LICENSE-CC0.txt`.

The legacy `frontend/src/assets/interview/placementiq-humanoid.png` from the earlier implementation is retained in the working repository but is not the active interviewer. The earlier checkpoint attributes it to OpenAI image generation; the current upgrade does not depend on that image or claim to have regenerated it.

Speech uses browser/Windows voices. The face animates jaw opening, lip rounding/spreading, cheeks, brows, eyelids, and gaze. Mouth movement follows utterance events and estimated text-to-viseme shapes; it does not claim audio-based phoneme alignment or measured accurate lip synchronisation.

The existing Lucide icons are provided by `lucide-react` under the ISC licence. Existing Three.js/React dependencies retain their upstream licences. `pdfjs-dist` and `mammoth` are local open-source dependencies; consult their installed package licence files before redistribution.

## Qwen and Ollama

The configured tag is `qwen3:4b-instruct`, already installed by the user. No model weights are committed or redistributed. The installed artifact's `/api/show` response on 3 October 2026 identified Qwen3, 4.0B parameters, Q4_K_M quantization, completion/tools/thinking capabilities, and Apache License 2.0 text. Its digest is recorded in `docs/verification/live-inference.json`. An Ollama tag alone is not sufficient to prove artifact provenance.

- [Ollama's official Qwen3 tags](https://ollama.com/library/qwen3/tags)
- [Qwen3-4B upstream model card and license](https://huggingface.co/Qwen/Qwen3-4B)

Before distributing a packaged model, inspect the exact local artifact with `ollama show qwen3:4b-instruct` and `ollama show --license qwen3:4b-instruct`, and retain its license notice. This repository does not claim model-generated grading is perfectly objective. Actual local latency, reported memory, and evaluation limitations are recorded in `docs/verification/RESULTS.md`.

## Local speech recognition

Voice input uses Apache-2.0 `vosk-browser` 0.0.8 and the official Apache-2.0 small English US 0.15 model from https://alphacephei.com/vosk/models . The checked archive is installed locally, ignored by Git, and served from the application. See `frontend/public/models/README.md` for its SHA-256 and setup script. No audio is uploaded. The Windows-generated test WAV is an explicitly fictional development fixture, not a recording of the user.
