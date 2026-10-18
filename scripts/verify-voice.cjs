// Optional local Vosk runtime smoke test against the Vite development server.
// Supply a generated WAV fixture; this does not test microphone hardware.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PLACEMENTIQ_UI_TEST_URL || 'http://127.0.0.1:3001';

(async () => {
  const fixture = await fs.readFile(process.env.PLACEMENTIQ_VOICE_FIXTURE || 'server/data/test-runtime/voice-audit/fixture.wav');
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage();
    await page.route('**/__voice_fixture.wav', route => route.fulfill({ body: fixture, contentType: 'audio/wav' }));
    await page.goto(base);
    const result = await page.evaluate(async () => {
      // Direct URL imports bypass Vite's source-level CommonJS interop rewrite.
      const vosk = await import('/node_modules/.vite/deps/vosk-browser.js');
      const { Model } = vosk.default || vosk;
      const model = new Model('/models/vosk-small-en.tar.gz', -1);
      let audio;
      let recognizer;
      try {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Model load timed out')), 60000);
          model.on('load', message => { clearTimeout(timer); message.result ? resolve() : reject(new Error('Model load failed')); });
          model.on('error', () => { clearTimeout(timer); reject(new Error('Model load failed')); });
        });
        audio = new AudioContext({ sampleRate: 16000 });
        const buffer = await audio.decodeAudioData(await (await fetch('/__voice_fixture.wav')).arrayBuffer());
        recognizer = new model.KaldiRecognizer(buffer.sampleRate);
        const transcript = [];
        let resolveChunk;
        let rejectChunk;
        const consume = message => {
          if (message.result?.text) transcript.push(message.result.text);
          resolveChunk?.();
        };
        recognizer.on('result', consume);
        recognizer.on('partialresult', consume);
        recognizer.on('error', () => rejectChunk?.(new Error('Recognition failed')));
        const submit = action => new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Recognition timed out')), 15000);
          resolveChunk = () => { clearTimeout(timer); resolve(); };
          rejectChunk = error => { clearTimeout(timer); reject(error); };
          action();
        });
        const samples = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i += 4096) {
          await submit(() => recognizer.acceptWaveformFloat(samples.slice(i, i + 4096), buffer.sampleRate));
        }
        await submit(() => recognizer.retrieveFinalResult());
        return { transcript: transcript.join(' '), durationSeconds: buffer.duration, sampleRate: buffer.sampleRate };
      } finally {
        recognizer?.remove();
        await audio?.close();
        model.terminate();
      }
    });
    assert.match(result.transcript, /test/);
    assert.match(result.transcript, /speech/);
    const evidence = { timestamp: new Date().toISOString(), passed: true,
      fixture: 'Windows synthesized: Hello. This is a test of local speech recognition. Thank you.',
      scope: 'Real local Vosk model and browser worker; synthetic WAV only, no microphone or quality validation.', ...result };
    await fs.writeFile(path.resolve('docs/verification/voice-runtime.json'), JSON.stringify(evidence, null, 2) + '\n');
    console.log(JSON.stringify(evidence, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
