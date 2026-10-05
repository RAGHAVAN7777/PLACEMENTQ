import { useMemo } from 'react';
import * as THREE from 'three';

/** A fitted graphite headset with restrained champagne accents. */
export default function AriaHeadset() {
  const band = useMemo(() => new THREE.CatmullRomCurve3(Array.from({length:41},(_,i)=>{
    const angle = i / 40 * Math.PI;
    return new THREE.Vector3(Math.cos(angle)*.92,1.06+Math.sin(angle)*1.25,.04);
  })),[]);
  
  const boom = useMemo(()=>new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.05,.85,.20),new THREE.Vector3(-1.08,.55,.65),
    new THREE.Vector3(-.70,.35,.98),new THREE.Vector3(-.40,.36,1.15),
  ]),[]);

  return <group>
    {/* Thick, flat outer headband (plastic/metal) */}
    <mesh scale={[1, 1, 3.5]}>
      <tubeGeometry args={[band, 64, .08, 16, false]}/>
      <meshStandardMaterial color="#e5e7eb" metalness={0.4} roughness={0.4}/>
    </mesh>
    
    {/* Soft inner headband padding */}
    <mesh scale={[0.96, 0.96, 2.8]} position={[0, -0.02, 0]}>
      <tubeGeometry args={[band, 64, .07, 16, false]}/>
      <meshStandardMaterial color="#111827" roughness={0.9} metalness={0.1}/>
    </mesh>

    {[-1, 1].map(side => <group key={side} position={[side * .92, 1.0, .06]} rotation={[0, side * 1.57, 0]}>
      {/* Main Earcup Shell (Solid outer casing) */}
      <mesh rotation={[1.57, 0, 0]}>
        <cylinderGeometry args={[.42, .42, .25, 32]}/>
        <meshStandardMaterial color="#f3f4f6" roughness={0.3} metalness={0.5}/>
      </mesh>
      
      {/* Outer detail ring */}
      <mesh position={[0, 0, 0.13]}>
        <torusGeometry args={[.32, .035, 16, 48]}/>
        <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.2}/>
      </mesh>

      {/* Inner glowing accent */}
      <mesh position={[0, 0, 0.135]}>
        <circleGeometry args={[.28, 32]}/>
        <meshBasicMaterial color="#3b82f6"/>
      </mesh>

      {/* Thick, soft ear cushion touching the head */}
      <mesh position={[0, 0, -0.15]}>
        <torusGeometry args={[.36, .16, 24, 48]}/>
        <meshStandardMaterial color="#111827" roughness={0.9} metalness={0.1}/>
      </mesh>
      
      {/* Inner fabric covering the speaker driver */}
      <mesh position={[0, 0, -0.12]} rotation={[0, 3.14, 0]}>
        <circleGeometry args={[.35, 32]}/>
        <meshStandardMaterial color="#1f2937" roughness={1.0} metalness={0.0}/>
      </mesh>
    </group>)}

    {/* Microphone boom arm */}
    <mesh>
      <tubeGeometry args={[boom, 32, .035, 12, false]}/>
      <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.4}/>
    </mesh>
    
    {/* Microphone head (solid pop filter) */}
    <mesh position={[-.40, .36, 1.15]} rotation={[1.57, -0.2, 0]}>
      <cylinderGeometry args={[.06, .06, .20, 16]}/>
      <meshStandardMaterial color="#111827" roughness={0.8}/>
    </mesh>
    <mesh position={[-.40, .36, 1.25]} rotation={[1.57, -0.2, 0]}>
      <sphereGeometry args={[.06, 16, 16]}/>
      <meshStandardMaterial color="#111827" roughness={0.8}/>
    </mesh>
  </group>;
}
