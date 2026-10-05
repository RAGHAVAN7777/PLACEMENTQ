import { useEffect, useRef, useState } from 'react';
import type { Model, KaldiRecognizer } from 'vosk-browser';

// Vosk runs in a local Web Worker. Audio never leaves this browser.
export function useLocalVoiceInput(value: string, onTranscript: (text: string) => void, disabled: boolean, onActivity: (active: boolean) => void) {
  const [status, setStatus] = useState<'idle'|'loading'|'permission'|'recording'|'transcribing'|'review'>('idle');
  const [error, setError] = useState('');
  const latest = useRef({ value, onTranscript, onActivity });
  latest.current = { value, onTranscript, onActivity };
  const model = useRef<Model | null>(null);
  const generation = useRef(0);
  const resources = useRef<{ stream?: MediaStream; audio?: AudioContext; processor?: ScriptProcessorNode; source?: AudioNode; recognizer?: KaldiRecognizer; timer?: number; pending?: number; drain?: () => void; finish?: () => void }>({});
  const supported = typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof window.AudioContext === 'function';
  const dispose = () => {
    const r = resources.current;
    clearTimeout(r.timer); r.stream?.getTracks().forEach(t => t.stop());
    r.source?.disconnect(); r.processor?.disconnect(); if (r.processor) r.processor.onaudioprocess = null;
    void r.audio?.close().catch(() => {}); r.recognizer?.remove(); resources.current = {};
  };
  const cancel = () => { generation.current++; dispose(); setStatus('idle'); latest.current.onActivity(false); };
  const finish = async () => {
    const r = resources.current;
    if (!r.recognizer) { cancel(); return; }
    setStatus('transcribing'); r.stream?.getTracks().forEach(t => t.stop()); r.source?.disconnect(); r.processor?.disconnect();
    const token = generation.current;
    try {
      if (r.pending) await new Promise<void>((resolve, reject) => { const timer = window.setTimeout(() => reject(new Error('Transcription timed out')), 15000); r.drain = () => { clearTimeout(timer); resolve(); }; });
      if (token !== generation.current) return;
      await new Promise<void>((resolve, reject) => { const timer = window.setTimeout(() => reject(new Error('Transcription timed out')), 15000); r.finish = () => { clearTimeout(timer); resolve(); }; r.recognizer!.retrieveFinalResult(); });
    } catch {
      if (token === generation.current) setError('Local transcription timed out. Your partial transcript is kept; edit it or type your answer.');
    }
    if (token !== generation.current) return;
    dispose(); setStatus('review'); latest.current.onActivity(false);
  };
  const begin = async (file?: File) => {
    if (disabled) return;
    const token = ++generation.current;
    setError(''); setStatus('loading'); latest.current.onActivity(true);
    const initial = latest.current.value.trim();
    let finalText = '';
    const publish = (partial = '') => latest.current.onTranscript([initial, finalText, partial].filter(Boolean).join(' ').slice(0, 4000));
    try {
      if (!model.current) {
        const { Model: LocalModel } = await import('vosk-browser');
        const loaded = new LocalModel('/models/vosk-small-en.tar.gz', -1);
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(() => { loaded.terminate(); reject(new Error('Local speech model could not load. Run scripts/setup-local-voice.ps1 if the model is missing.')); }, 60000);
          loaded.on('load', message => { clearTimeout(timer); if ('result' in message && message.result) resolve(); else { loaded.terminate(); reject(new Error('Local speech model could not load. Run scripts/setup-local-voice.ps1.')); } });
          loaded.on('error', () => { clearTimeout(timer); loaded.terminate(); reject(new Error('Local speech model is unavailable.')); });
        });
        if (token !== generation.current) { loaded.terminate(); return; }
        model.current = loaded;
      }
      if (token !== generation.current) return;
      const audio = new AudioContext({ sampleRate: 16000 }); resources.current.audio = audio;
      const recognizer = new model.current.KaldiRecognizer(audio.sampleRate); resources.current.recognizer = recognizer;
      const consumed = () => { const r = resources.current; if (r.pending) { r.pending--; if (!r.pending) r.drain?.(); } else r.finish?.(); };
      recognizer.on('result', message => {
        if (token !== generation.current || message.event !== 'result') return;
        finalText = [finalText, message.result.text].filter(Boolean).join(' '); publish();
        if (resources.current.finish && !finalText) setError('No speech was detected. Try again or type your answer.');
        consumed();
      });
      recognizer.on('partialresult', message => { if (token === generation.current && message.event === 'partialresult') { publish(message.result.partial); consumed(); } });
      recognizer.on('error', () => { if (token === generation.current) { cancel(); setError('Local transcription failed. Your current transcript is kept; edit it or type your answer.'); } });
      if (file) {
        if (file.size > 12 * 1024 * 1024) throw new Error('Choose an audio file smaller than 12 MB.');
        const buffer = await audio.decodeAudioData(await file.arrayBuffer());
        if (buffer.duration > 90) throw new Error('Use an audio clip of 90 seconds or less.');
        if (token !== generation.current) return;
        setStatus('transcribing');
        // Yield between chunks so UI stays responsive; inference happens in the worker.
        const samples = buffer.getChannelData(0);
        for (let offset = 0; offset < samples.length; offset += 4096) {
          if (token !== generation.current) return;
          resources.current.pending = 1;
          await new Promise<void>((resolve, reject) => { const timer = window.setTimeout(() => reject(new Error('Local transcription timed out.')), 15000); resources.current.drain = () => { clearTimeout(timer); resolve(); }; recognizer.acceptWaveformFloat(samples.slice(offset, offset + 4096), buffer.sampleRate); });
        }
        await finish();
      } else {
        // Cancelled TTS is given time to leave the speaker buffer before capture.
        await new Promise(resolve => window.setTimeout(resolve, 180));
        if (token !== generation.current) return;
        setStatus('permission');
        let expired = false;
        let permissionTimer: number | undefined;
        const request = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }, video: false }).then(stream => {
          if (expired || token !== generation.current) { stream.getTracks().forEach(t => t.stop()); throw new Error('Microphone request cancelled.'); }
          return stream;
        });
        const stream = await Promise.race([request, new Promise<MediaStream>((_, reject) => { permissionTimer = window.setTimeout(() => { expired = true; reject(new Error('Microphone permission did not respond. Allow microphone access in your browser and try again, or use recorded audio.')); }, 15000); })]).finally(() => clearTimeout(permissionTimer));
        if (token !== generation.current) { stream.getTracks().forEach(t => t.stop()); return; }
        resources.current.stream = stream;
        await audio.resume();
        const source = audio.createMediaStreamSource(stream);
        const processor = audio.createScriptProcessor(4096, 1, 1);
        resources.current.source = source; resources.current.processor = processor;
        processor.onaudioprocess = event => { if (token === generation.current) { resources.current.pending = (resources.current.pending || 0) + 1; recognizer.acceptWaveform(event.inputBuffer); } };
        source.connect(processor); processor.connect(audio.destination); // Output is silence, never microphone monitoring.
        setStatus('recording');
        resources.current.timer = window.setTimeout(() => void finish(), 90000);
      }
    } catch (err) {
      if (token !== generation.current) return;
      dispose(); setStatus('idle'); latest.current.onActivity(false);
      setError(err instanceof DOMException && err.name === 'NotAllowedError' ? 'Microphone permission was declined. You can type your answer or use a recorded audio file.' : err instanceof Error ? `${err.message} Your draft is kept; typing still works.` : 'Local voice input is unavailable. Please type your answer.');
    }
  };
  useEffect(() => { if (disabled) cancel(); }, [disabled]);
  useEffect(() => { const hide = () => { if (document.hidden) cancel(); }; document.addEventListener('visibilitychange', hide); return () => { generation.current++; dispose(); model.current?.terminate(); document.removeEventListener('visibilitychange', hide); }; }, []);
  return { status, error, supported, listening: status === 'recording', active: ['loading','permission','recording','transcribing'].includes(status), toggle: () => status === 'recording' ? void finish() : void begin(), stop: cancel, fromFile: (file: File) => void begin(file) };
}
