import { useCallback, useEffect, useRef, useState } from 'react';
import type { AvatarSpeechCue } from './RobotAvatar';

/** Browser speech events drive the face. These are estimated visemes, not forced audio alignment. */
export function useInterviewerSpeech(text: string, muted: boolean, enabled: boolean) {
  const speechRef = useRef<AvatarSpeechCue>({ active: false, text: '', charIndex: 0, startedAt: 0, boundaryAt: 0, rate: 0.94 });
  const [speaking, setSpeaking] = useState(false);
  const [voiceName, setVoiceName] = useState('');
  const [speechError, setSpeechError] = useState('');
  const [finishedText, setFinishedText] = useState('');
  const lastAutoText = useRef('');
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const generation = useRef(0);
  const latest = useRef({ text, muted, enabled });
  latest.current = { text, muted, enabled };
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const stop = useCallback(() => {
    generation.current += 1;
    speechRef.current.active = false;
    setSpeaking(false);
    if (supported) window.speechSynthesis.cancel();
    utteranceRef.current = null;
  }, [supported]);

  const replay = useCallback(() => {
    const value = latest.current;
    stop();
    if (!supported || value.muted || !value.text || document.hidden) return;
    const id = generation.current;
    const utterance = new SpeechSynthesisUtterance(value.text);
    const englishVoices = window.speechSynthesis.getVoices().filter((voice) => voice.lang.startsWith('en'));
    const local = englishVoices.filter((voice) => voice.localService);
    const candidates = local.length ? local : englishVoices;
    const voice = candidates.find((item) => /zira|hazel|heera|samantha|susan|female|aria|jenny/i.test(item.name)) || candidates[0];
    if (voice) { utterance.voice = voice; utterance.lang = voice.lang; setVoiceName(`${voice.name}${voice.localService ? ' · device voice' : ' · browser voice'}`); }
    else { utterance.lang = 'en-IN'; setVoiceName('System default voice'); }
    utterance.rate = 0.94;
    utterance.pitch = 1.04;
    setSpeechError('');
    utterance.onstart = () => {
      if (id !== generation.current) return;
      const now = performance.now();
      speechRef.current = { active: true, text: value.text, charIndex: 0, startedAt: now, boundaryAt: now, rate: utterance.rate };
      setSpeaking(true);
      setFinishedText('');
    };
    utterance.onboundary = (event) => {
      if (id !== generation.current) return;
      speechRef.current.charIndex = event.charIndex;
      speechRef.current.boundaryAt = performance.now();
    };
    utterance.onpause = () => {
      if (id !== generation.current) return;
      speechRef.current.active = false;
      setSpeaking(false);
    };
    utterance.onresume = () => {
      if (id !== generation.current) return;
      speechRef.current.active = true;
      speechRef.current.boundaryAt = performance.now();
      setSpeaking(true);
    };
    const finish = () => { if (id === generation.current) { speechRef.current.active = false; setSpeaking(false); utteranceRef.current = null; } };
    utterance.onend = () => { if (id === generation.current) setFinishedText(value.text); finish(); };
    utterance.onerror = (event) => {
      finish();
      if (id === generation.current && !['canceled', 'interrupted'].includes(event.error)) setSpeechError(event.error === 'not-allowed' ? 'Press Replay to enable voice.' : 'Voice is unavailable. You can continue with the text below.');
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [stop, supported]);

  useEffect(() => {
    stop();
    if (muted || !enabled || lastAutoText.current === text) return;
    const timer = window.setTimeout(() => {
      lastAutoText.current = text;
      replay();
    }, 250);
    return () => { window.clearTimeout(timer); stop(); };
  }, [text, muted, enabled, replay, stop]);

  useEffect(() => {
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hide);
    return () => { document.removeEventListener('visibilitychange', hide); stop(); };
  }, [stop]);

  return { speechRef, speaking, supported, replay, stop, voiceName, speechError, finishedText };
}
