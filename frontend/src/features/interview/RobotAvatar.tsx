import { Component, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { readBust, sampleBust, createIrisPoints } from './avatar/avatarGeometry';
import { particleVertex, particleFragment, surfaceVertex, surfaceFragment } from './avatar/avatarShaders';
import bustUrl from './avatar/aria-bust.bin?url';
import AriaHeadset from './avatar/AriaHeadset';

export type RobotState = 'idle' | 'processing' | 'speaking' | 'listening' | 'awaiting' | 'error' | 'completed';
export interface AvatarSpeechCue { active: boolean; text: string; charIndex: number; startedAt: number; boundaryAt: number; rate: number }
interface Props { state: RobotState; speechRef: RefObject<AvatarSpeechCue>; className?: string; currentText?: string }

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="avatar-unavailable">The 3D presenter needs WebGL.<br />Your interview and voice controls are still available.</div> : this.props.children; }
}

function RenderCadence({ paused, reduced, processing }: { paused: boolean; reduced: boolean; processing: boolean }) {
  const invalidate = useThree((scene) => scene.invalidate);
  useEffect(() => { if (paused) return; invalidate(); const timer = window.setInterval(invalidate, reduced || processing ? 100 : 34); return () => window.clearInterval(timer); }, [paused, reduced, processing, invalidate]);
  return null;
}

function Human({ buffer, state, speechRef, reduced, currentText }: Props & { buffer: ArrayBuffer; reduced: boolean }) {
  const geometry = useMemo(() => readBust(buffer), [buffer]);
  const points = useMemo(() => sampleBust(geometry, 38000), [geometry]);
  const iris = useMemo(createIrisPoints, []);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uJaw: { value: 0 }, uRound: { value: 0 }, uWide: { value: 0 },
    uSmile: { value: 0.15 }, uBlink: { value: 0 }, uBrow: { value: 0 }, uYaw: { value: 0 },
    uNod: { value: 0 }, uMotion: { value: 1 }, uGaze: { value: new THREE.Vector2() },
    uPixelRatio: { value: 1 }, uIris: { value: 0 }
  }), []);
  const irisUniforms = useMemo(() => ({ ...uniforms, uIris: { value: 1 } }), [uniforms]);
  const surfaceMaterial = useRef<THREE.ShaderMaterial>(null);
  const particleMaterial = useRef<THREE.ShaderMaterial>(null);
  const irisMaterial = useRef<THREE.ShaderMaterial>(null);
  const headset = useRef<THREE.Group>(null);
  const frameTime = useRef(0);
  const lastTextTime = useRef(0);
  const lastTextValue = useRef('');

  useFrame(({ clock, pointer, gl }, delta) => {
    frameTime.current += delta;
    if (frameTime.current < 1 / 30) return;
    const dt = Math.min(frameTime.current, 0.1); frameTime.current = 0;
    const time = clock.elapsedTime;
    const cue = speechRef.current;
    
    if (currentText && currentText !== lastTextValue.current) {
      lastTextValue.current = currentText;
      lastTextTime.current = time;
    }
    const timeSinceTextChange = time - lastTextTime.current;
    const expectedDuration = Math.max(2, (lastTextValue.current.length) / 14);
    const recentlySpeakingText = lastTextValue.current && timeSinceTextChange < expectedDuration;

    let jaw = 0;
    let roundTarget = 0;
    let wideTarget = 0;

    if (cue && cue.active && cue.text) {
      const elapsed = Math.max(0, (performance.now() - cue.boundaryAt) / 1000);
      const hasBoundary = cue.boundaryAt > cue.startedAt;
      const tail = cue.text.slice(cue.charIndex);
      const wordLength = tail.search(/\s/) >= 0 ? tail.search(/\s/) : tail.length;
      const offset = Math.floor(elapsed * 13 * cue.rate);
      const index = hasBoundary ? cue.charIndex + Math.min(offset, Math.max(0, wordLength - 1)) : (offset % Math.max(1, cue.text.length));
      const letter = (cue.text[index] || '').toLowerCase();
      const vowel = /[aeiouy]/.test(letter);
      const closed = /[mbp\s.,!?;:]/.test(letter);
      const pulse = 0.78 + Math.sin(elapsed * 22) * 0.14;
      jaw = closed ? 0.05 : (vowel ? 0.92 : 0.48) * pulse;
      roundTarget = /[ouqw]/.test(letter) ? 1 : 0;
      wideTarget = /[eiy]/.test(letter) ? 1 : 0;
    } else if (state === 'speaking' || recentlySpeakingText) {
      const text = lastTextValue.current || 'aria speaking naturally';
      const t = time * 6.5;
      const charOffset = Math.floor(t * 2.1) % text.length;
      const letter = text[charOffset]?.toLowerCase() || 'a';
      const vowel = /[aeiouy]/.test(letter);
      const closed = /[mbp\s.,!?;:]/.test(letter);
      const fadeOut = recentlySpeakingText ? Math.max(0, 1 - Math.pow(timeSinceTextChange / expectedDuration, 4)) : 1;
      const syllable = Math.max(0, Math.sin(t * 1.1)) * (0.5 + 0.3 * Math.sin(t * 0.41));
      const breathGap = 0.6 + 0.4 * Math.sin(t * 0.17 + 0.8);
      if (closed) { jaw = 0.04 * fadeOut; } else { jaw = (vowel ? 0.78 : 0.38) * syllable * breathGap * fadeOut; }
      roundTarget = (/[ouqw]/.test(letter) ? 0.7 : 0) * fadeOut;
      wideTarget = (/[eiy]/.test(letter) ? 0.6 : 0) * fadeOut;
    } else {
      jaw = 0.02 + 0.015 * Math.sin(time * 1.35);
    }

    const blend = (name: 'uJaw' | 'uRound' | 'uWide' | 'uSmile' | 'uBrow' | 'uYaw' | 'uNod', value: number, speed = 12) => { uniforms[name].value = THREE.MathUtils.damp(uniforms[name].value, value, speed, dt); };
    uniforms.uTime.value = time;
    uniforms.uMotion.value = reduced ? 0 : 1;
    uniforms.uPixelRatio.value = gl.getPixelRatio();
    blend('uJaw', jaw, 20); blend('uRound', roundTarget, 17); blend('uWide', wideTarget, 17);
    blend('uSmile', state === 'completed' ? 0.8 : state === 'error' ? 0 : cue?.active ? 0.25 : 0.4);
    blend('uBrow', state === 'processing' ? 0.18 : state === 'error' ? -0.3 : cue?.active ? 0.2 + Math.sin(time * 1.8) * 0.2 : 0.1);
    const blinkCycle = time % 4.9;
    uniforms.uBlink.value = reduced ? 0 : Math.max(0, 1 - Math.abs(blinkCycle - 4.45) / 0.11);
    blend('uYaw', reduced ? 0 : pointer.x * 0.055 + Math.sin(time * 0.43) * 0.038, 3);
    blend('uNod', reduced ? 0 : (state === 'awaiting' ? -0.035 : 0) + Math.sin(time * (cue?.active ? 1.7 : 0.65)) * (cue?.active ? 0.022 : 0.012), 3);
    uniforms.uGaze.value.lerp(new THREE.Vector2(pointer.x, pointer.y), Math.min(1, dt * 3));
    
    if (headset.current) headset.current.rotation.set(-uniforms.uNod.value, uniforms.uYaw.value, 0, 'XYZ');
    for (const material of [surfaceMaterial.current, particleMaterial.current, irisMaterial.current]) {
      if (!material) continue;
      for (const [name, uniform] of Object.entries(uniforms)) {
        if (name !== 'uIris') material.uniforms[name].value = uniform.value;
      }
    }
  });

  return <group position={[0, -0.05, 0]}>
    <ambientLight intensity={1.1}/>
    <directionalLight position={[-3,5,5]} intensity={2.3} color="#f5ddbd"/>
    <directionalLight position={[3,2,-1]} intensity={1.4} color="#8daaa5"/>
    <group ref={headset} position={[0,.2,.03]}><group position={[0,-.2,-.03]}><AriaHeadset/></group></group>
    <mesh geometry={geometry}>
      <shaderMaterial ref={surfaceMaterial} vertexShader={surfaceVertex} fragmentShader={surfaceFragment} uniforms={uniforms} transparent depthWrite />
    </mesh>
    <points geometry={points}>
      <shaderMaterial ref={particleMaterial} vertexShader={particleVertex} fragmentShader={particleFragment} uniforms={uniforms} transparent depthWrite={false} />
    </points>
    <points geometry={iris}>
      <shaderMaterial ref={irisMaterial} vertexShader={particleVertex} fragmentShader={particleFragment} uniforms={irisUniforms} transparent depthWrite={false} />
    </points>
  </group>;
}

export default function RobotAvatar({ state, speechRef, currentText, className = '' }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [reduced, setReduced] = useState(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const controller = new AbortController();
    fetch(bustUrl, { signal: controller.signal }).then((r) => { if (!r.ok) throw new Error('Avatar asset unavailable'); return r.arrayBuffer(); }).then(setBuffer).catch((err) => { if (err.name !== 'AbortError') setError(true); });
    const visibility = () => setHidden(document.hidden);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const preference = () => setReduced(motion.matches);
    document.addEventListener('visibilitychange', visibility); motion.addEventListener('change', preference);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (container.current) observer.observe(container.current);
    return () => { controller.abort(); observer.disconnect(); document.removeEventListener('visibilitychange', visibility); motion.removeEventListener('change', preference); };
  }, []);
  return <div ref={container} className={`aria-avatar ${className}`} role="img" aria-label={`Aria, an animated 3D particle human interviewer, ${state}`} data-avatar-state={state}>
    {error ? <div className="avatar-unavailable">The presenter couldn’t load. You can continue below.</div> : !buffer ? <div className="avatar-loading">MEETING ARIA<span /></div> : <SceneBoundary><Canvas camera={{ position: [0, 0.58, 8.5], fov: 35, near: 0.1, far: 30 }} dpr={[1, 1.25]} gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }} frameloop="demand"><RenderCadence paused={hidden || !visible} reduced={reduced} processing={state === 'processing'} /><Human buffer={buffer} state={state} speechRef={speechRef} reduced={reduced} currentText={currentText} /></Canvas></SceneBoundary>}
  </div>;
}
