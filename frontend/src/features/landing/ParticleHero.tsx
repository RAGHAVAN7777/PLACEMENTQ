import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Utilities ──────────────────────────────────────────────────────────────
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const COLOR_ORANGE = new THREE.Color('#FF7A20');
const COLOR_WHITE = new THREE.Color('#F4F4F0');
const COLOR_AMBER = new THREE.Color('#FFB067');

// Common fragment shader for crisp circular points
const crispPointFragmentShader = `
  varying vec3 vColor;
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    // Crisp edge with slight anti-aliasing
    float alpha = (1.0 - smoothstep(0.43, 0.5, dist));
    gl_FragColor = vec4(vColor, alpha * 0.9);
  }
`;

// ─── Torus Ring ─────────────────────────────────────────────────────────────
function TorusRing({ count, pixelRatio }: { count: number, pixelRatio: number }) {
  const pointsRef = useRef<THREE.Points>(null!);
  const materialRef = useRef<THREE.ShaderMaterial>(null!);

  const { positions, colors, sizes } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    const rng = seededRandom(101);

    const R = 2.1; // major radius
    const r = 0.16; // tube radius

    for (let i = 0; i < count; i++) {
      const u = rng() * Math.PI * 2;
      const v = rng() * Math.PI * 2;

      // Tight, thin ring
      const noise = (rng() - 0.5) * 0.1;
      let currentR = r + noise;

      const x = (R + currentR * Math.cos(v)) * Math.cos(u);
      const y = (R + currentR * Math.cos(v)) * Math.sin(u);
      const z = rng() * (0.40 + 0.25 * Math.pow(Math.max(0, Math.cos(u * 60.0)), 5));

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      const mix = rng();
      const c = COLOR_ORANGE.clone();
      if (mix < 0.15) c.lerp(COLOR_AMBER, rng());
      if (mix < 0.02) c.copy(COLOR_WHITE);

      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;

      // Base point size between 1 and 2.5 CSS pixels
      siz[i] = 1.0 + rng() * 1.5;
    }
    return { positions: pos, colors: col, sizes: siz };
  }, [count]);

  const vertexShader = `
    attribute vec3 aColor;
    attribute float aSize;
    varying vec3 vColor;
    uniform float uTime;
    uniform float uPixelRatio;
    uniform vec2 uMouse;
    uniform float uAspect;

    vec3 hueShift(vec3 color, float hueAdjust) {
      const vec3 k = vec3(0.57735, 0.57735, 0.57735);
      float cosAngle = cos(hueAdjust);
      return vec3(color * cosAngle + cross(k, color) * sin(hueAdjust) + k * dot(k, color) * (1.0 - cosAngle));
    }

    void main() {
      vColor = hueShift(aColor, uTime * 0.25);
      
      vec3 pos = position;

      // Centre ring spinning like a spiral
      float r = length(pos.xy);
      float twist = sin(r * 3.0 - uTime * 1.5) * 0.4;
      float s = sin(twist);
      float c = cos(twist);
      float nx = pos.x * c - pos.y * s;
      float ny = pos.x * s + pos.y * c;
      pos.x = nx;
      pos.y = ny;

      // Very subtle surface motion
      float dist = length(pos.xy);
      pos.z += sin(dist * 5.0 - uTime) * 0.02;
      
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      vec4 projected = projectionMatrix * mvPosition;

      // Mouse ripple effect
      vec2 screenPos = projected.xy / projected.w;
      vec2 aspect = vec2(uAspect, 1.0);
      float distToMouse = distance(screenPos * aspect, uMouse * aspect);
      
      float finalSize = aSize;
      if (distToMouse < 0.6 && distToMouse > 0.0) {
        // Wave pattern
        float ripple = sin(distToMouse * 25.0 - uTime * 8.0);
        float rippleFade = smoothstep(0.6, 0.0, distToMouse);
        
        // Gentle position displacement
        vec2 dir = normalize(screenPos - uMouse);
        projected.xy += dir * ripple * rippleFade * 0.015 * projected.w;
        
        // Size modulation for depth illusion
        finalSize += ripple * rippleFade * 1.5;
      }
      
      // Constant screen-space size, converting to framebuffer pixels exactly once
      gl_PointSize = max(0.1, finalSize) * uPixelRatio;
      gl_Position = projected;
    }
  `;

  useFrame((state, delta) => {
    if (!pointsRef.current || !materialRef.current) return;
    pointsRef.current.rotation.x = 0; // Modest tilt
    pointsRef.current.rotation.y = 0;
    pointsRef.current.rotation.z += delta * 0.08; // Faster rotation
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    materialRef.current.uniforms.uMouse.value.copy(state.pointer);
    materialRef.current.uniforms.uAspect.value = state.size.width / state.size.height;
  });

  return (
    <points ref={pointsRef} position={[0, 0, 0]}> {/* Positioned right and down */}
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={crispPointFragmentShader}
        uniforms={{
          uTime: { value: 0 },
          uPixelRatio: { value: pixelRatio },
          uMouse: { value: new THREE.Vector2(-10, -10) },
          uAspect: { value: 1.0 }
        }}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </points>
  );
}

// ─── White Structures ───────────────────────────────────────────────────────
function WhiteStructures({ count, pixelRatio }: { count: number, pixelRatio: number }) {
  const pointsRef = useRef<THREE.Points>(null!);
  const materialRef = useRef<THREE.ShaderMaterial>(null!);

  const { positions, colors, sizes } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    const rng = seededRandom(202);

    for (let i = 0; i < count; i++) {
      const cluster = Math.floor(rng() * 4);
      let cx = 0, cy = 0, cz = 0;

      cx = [-5.9, -4.1, 4.1, 5.9][cluster];
      const edge = Math.floor(rng() * 4);
      const along = rng() - 0.5;
      pos[i * 3] = cx + (edge < 2 ? (edge === 0 ? -0.45 : 0.45) : along * 0.9);
      pos[i * 3 + 1] = cy + (edge < 2 ? along * 1.8 : (edge === 2 ? -0.9 : 0.9));
      pos[i * 3 + 2] = cz + Math.floor(rng() * 7) * 0.13;
      col[i * 3] = COLOR_WHITE.r;
      col[i * 3 + 1] = COLOR_WHITE.g;
      col[i * 3 + 2] = COLOR_WHITE.b;

      siz[i] = 1.0 + rng() * 1.0; // small crisp points
    }
    return { positions: pos, colors: col, sizes: siz };
  }, [count]);

  const vertexShader = `
    attribute vec3 aColor;
    attribute float aSize;
    varying vec3 vColor;
    uniform float uPixelRatio;
    uniform vec2 uMouse;
    uniform float uAspect;
    uniform float uTime;
    
    vec3 hueShift(vec3 color, float hueAdjust) {
      const vec3 k = vec3(0.57735, 0.57735, 0.57735);
      float cosAngle = cos(hueAdjust);
      return vec3(color * cosAngle + cross(k, color) * sin(hueAdjust) + k * dot(k, color) * (1.0 - cosAngle));
    }

    void main() {
      vColor = hueShift(aColor, uTime * 0.25);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vec4 projected = projectionMatrix * mvPosition;

      // Mouse ripple effect
      vec2 screenPos = projected.xy / projected.w;
      vec2 aspect = vec2(uAspect, 1.0);
      float distToMouse = distance(screenPos * aspect, uMouse * aspect);
      
      float finalSize = aSize;
      if (distToMouse < 0.6 && distToMouse > 0.0) {
        float ripple = sin(distToMouse * 25.0 - uTime * 8.0);
        float rippleFade = smoothstep(0.6, 0.0, distToMouse);
        vec2 dir = normalize(screenPos - uMouse);
        projected.xy += dir * ripple * rippleFade * 0.015 * projected.w;
        finalSize += ripple * rippleFade * 1.5;
      }

      gl_PointSize = max(0.1, finalSize) * uPixelRatio;
      gl_Position = projected;
    }
  `;

  useFrame((state) => {
    if (!pointsRef.current || !materialRef.current) return;
    pointsRef.current.rotation.x = 0;
    pointsRef.current.rotation.y = 0;
    pointsRef.current.rotation.z = 0;
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    materialRef.current.uniforms.uMouse.value.copy(state.pointer);
    materialRef.current.uniforms.uAspect.value = state.size.width / state.size.height;
  });

  return (
    <points ref={pointsRef} position={[0, 0, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={crispPointFragmentShader}
        uniforms={{ 
          uPixelRatio: { value: pixelRatio },
          uMouse: { value: new THREE.Vector2(-10, -10) },
          uAspect: { value: 1.0 },
          uTime: { value: 0 }
        }}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </points>
  );
}

// ─── Directional Streams ────────────────────────────────────────────────────
function DirectionalStreams({ count, pixelRatio }: { count: number, pixelRatio: number }) {
  const pointsRef = useRef<THREE.Points>(null!);
  const materialRef = useRef<THREE.ShaderMaterial>(null!);

  const { positions, colors, offsets, speeds, sizes } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const off = new Float32Array(count);
    const spd = new Float32Array(count);
    const siz = new Float32Array(count);
    const rng = seededRandom(303);

    for (let i = 0; i < count; i++) {
      const streamIdx = Math.floor(rng() * 4);
      const side = rng() < 0.5 ? -1.0 : 1.0;
      pos[i * 3] = side; // Use X to store direction/side
      pos[i * 3 + 1] = [-1.5, -0.95, 0.95, 1.5][streamIdx] + (rng() - 0.5) * 0.15;
      pos[i * 3 + 2] = rng() * 0.12;
      const c = rng() < 0.05 ? COLOR_WHITE : COLOR_ORANGE;
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;

      off[i] = rng() * 100;
      spd[i] = 1.0 + rng() * 2.0; // Steady, controlled speed
      siz[i] = 1.0 + rng() * 1.5;
    }
    return { positions: pos, colors: col, offsets: off, speeds: spd, sizes: siz };
  }, [count]);

  const vertexShader = `
    attribute vec3 aColor;
    attribute float aOffset;
    attribute float aSpeed;
    attribute float aSize;
    varying vec3 vColor;
    uniform float uTime;
    uniform float uPixelRatio;
    uniform vec2 uMouse;
    uniform float uAspect;
    
    vec3 hueShift(vec3 color, float hueAdjust) {
      const vec3 k = vec3(0.57735, 0.57735, 0.57735);
      float cosAngle = cos(hueAdjust);
      return vec3(color * cosAngle + cross(k, color) * sin(hueAdjust) + k * dot(k, color) * (1.0 - cosAngle));
    }

    void main() {
      vColor = hueShift(aColor, uTime * 0.25);
      
      vec3 pos = position;
      float side = pos.x; // -1.0 or +1.0
      
      // Moving from outside towards the center
      float dist = 12.0 - mod(aOffset + uTime * aSpeed, 12.0);
      pos.x = side * dist;
      
      // Coherent paths, no flying towards camera
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      vec4 projected = projectionMatrix * mvPosition;
      
      // Mouse ripple effect
      vec2 screenPos = projected.xy / projected.w;
      vec2 aspect = vec2(uAspect, 1.0);
      float distToMouse = distance(screenPos * aspect, uMouse * aspect);
      
      float finalSize = aSize;
      if (distToMouse < 0.6 && distToMouse > 0.0) {
        float ripple = sin(distToMouse * 25.0 - uTime * 8.0);
        float rippleFade = smoothstep(0.6, 0.0, distToMouse);
        vec2 dir = normalize(screenPos - uMouse);
        projected.xy += dir * ripple * rippleFade * 0.015 * projected.w;
        finalSize += ripple * rippleFade * 1.5;
      }
      
      // Fade out at edges to prevent sudden popping
      float fade = (1.0 - smoothstep(9.0, 12.0, abs(pos.x)));
      vColor *= fade;
      if (length(pos.xy) < 1.94) vColor = vec3(0.0);
      
      gl_PointSize = max(0.1, finalSize) * uPixelRatio;
      gl_Position = projected;
    }
  `;

  useFrame((state) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    materialRef.current.uniforms.uMouse.value.copy(state.pointer);
    materialRef.current.uniforms.uAspect.value = state.size.width / state.size.height;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
        <bufferAttribute attach="attributes-aOffset" args={[offsets, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={crispPointFragmentShader}
        uniforms={{
          uTime: { value: 0 },
          uPixelRatio: { value: pixelRatio },
          uMouse: { value: new THREE.Vector2(-10, -10) },
          uAspect: { value: 1.0 }
        }}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </points>
  );
}

// ─── Camera Setup & Mouse Parallax ──────────────────────────────────────────
function SceneSetup() {
  const { camera, size } = useThree();
  useEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    const halfWidth = size.width < 640 ? 5.6 : 9.4;
    const halfHeight = halfWidth * size.height / size.width;
    camera.left = -halfWidth; camera.right = halfWidth;
    camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.position.set(0, 0, 20);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

export default function ParticleHero() {
  const [webglFailed, setWebglFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1;

  const mobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const counts = mobile ? { ring: 6500, structures: 3500, streams: 3000 } : { ring: 14000, structures: 8000, streams: 7000 };
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    let inView = true;
    const update = () => setVisible(inView && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; update(); });
    observer.observe(element);
    document.addEventListener('visibilitychange', update);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);


  if (webglFailed) {
    return (
      <div className="particle-fallback">
        <div style={{ width: '100%', height: '100%', background: '#030407' }} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="hero-canvas-container">
      <Canvas
        orthographic
        frameloop={reducedMotion || paused || !visible ? 'demand' : 'always'}
        aria-hidden="true"
        dpr={dpr}
        gl={{ alpha: false, antialias: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, 10], fov: 45, near: 1, far: 100 }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color('#030407'), 1);
        }}
        onError={() => setWebglFailed(true)}
      >
        <SceneSetup />

        <group position={[0.6, -0.5, 0]} rotation={[0, 0, 0.46]}>
          <group rotation={[-0.78, 0, 0]}>
            <gridHelper args={[60, 60, '#162038', '#11192c']}
              position={[0, 0, -0.2]} rotation={[Math.PI / 2, 0, 0]} />
            <TorusRing count={counts.ring} pixelRatio={dpr} />
            <WhiteStructures count={counts.structures} pixelRatio={dpr} />
            <DirectionalStreams count={counts.streams} pixelRatio={dpr} />
          </group>
        </group>
      </Canvas>
      <button type="button" className="piq-motion" onClick={() => setPaused(v => !v)}
        aria-label={paused ? 'Resume scene animation' : 'Pause scene animation'}>
        {paused ? 'Play scene' : 'Pause scene'}
      </button>
    </div>
  );
}
