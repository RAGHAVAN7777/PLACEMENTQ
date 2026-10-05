import * as THREE from 'three';

/** Local, cropped CC0 human geometry. See ATTRIBUTION.md beside this file. */
export function readBust(buffer: ArrayBuffer): THREE.BufferGeometry {
  const header = new Uint32Array(buffer, 0, 2);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buffer, 8, header[0] * 3).slice(), 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(buffer, 8 + header[0] * 12, header[1]).slice(), 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function seededRandom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/** Area-weighted sampling concentrates detail around the face and dissolves the torso. */
export function sampleBust(mesh: THREE.BufferGeometry, count = 44000): THREE.BufferGeometry {
  const random = seededRandom(74109);
  const positions = mesh.getAttribute('position');
  const normals = mesh.getAttribute('normal');
  const index = mesh.index!;
  const cumulative = new Float32Array(index.count / 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const edge = new THREE.Vector3(), cross = new THREE.Vector3();
  let area = 0;
  for (let triangle = 0; triangle < cumulative.length; triangle++) {
    a.fromBufferAttribute(positions, index.getX(triangle * 3));
    b.fromBufferAttribute(positions, index.getX(triangle * 3 + 1));
    c.fromBufferAttribute(positions, index.getX(triangle * 3 + 2));
    const y = (a.y + b.y + c.y) / 3;
    const z = (a.z + b.z + c.z) / 3;
    const face = y > 0.15 && z > 0.35;
    const weight = face ? 5.2 : y > 0.15 ? 1.6 : 0.65;
    area += cross.crossVectors(edge.subVectors(b, a), c.clone().sub(a)).length() * weight;
    cumulative[triangle] = area;
  }
  const points = new Float32Array(count * 3);
  const pointNormals = new Float32Array(count * 3);
  const variations = new Float32Array(count * 2);
  const na = new THREE.Vector3(), nb = new THREE.Vector3(), nc = new THREE.Vector3();
  const point = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let n = 0; n < count; n++) {
    const target = random() * area;
    let low = 0, high = cumulative.length - 1;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (cumulative[mid] < target) low = mid + 1;
      else high = mid;
    }
    const ia = index.getX(low * 3), ib = index.getX(low * 3 + 1), ic = index.getX(low * 3 + 2);
    a.fromBufferAttribute(positions, ia); b.fromBufferAttribute(positions, ib); c.fromBufferAttribute(positions, ic);
    na.fromBufferAttribute(normals, ia); nb.fromBufferAttribute(normals, ib); nc.fromBufferAttribute(normals, ic);
    const r = Math.sqrt(random()), s = random();
    const wa = 1 - r, wb = r * (1 - s), wc = r * s;
    point.copy(a).multiplyScalar(wa).addScaledVector(b, wb).addScaledVector(c, wc);
    normal.copy(na).multiplyScalar(wa).addScaledVector(nb, wb).addScaledVector(nc, wc).normalize();
    // Lift dots slightly off the dark surface, retaining the sculpted silhouette.
    point.addScaledVector(normal, 0.0025);
    point.toArray(points, n * 3);
    normal.toArray(pointNormals, n * 3);
    variations[n * 2] = random();
    variations[n * 2 + 1] = random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(pointNormals, 3));
  geometry.setAttribute('variation', new THREE.BufferAttribute(variations, 2));
  geometry.computeBoundingSphere();
  return geometry;
}

/** Irises are rendered as fine radial fibres rather than two glowing dots. */
export function createIrisPoints(): THREE.BufferGeometry {
  const random = seededRandom(3402);
  const positions: number[] = [], normals: number[] = [], variations: number[] = [];
  for (const sign of [-1, 1]) {
    for (let i = 0; i < 470; i++) {
      const angle = random() * Math.PI * 2;
      const radius = 0.021 + Math.sqrt(random()) * 0.026;
      positions.push(sign * 0.285 + Math.cos(angle) * radius, 1.1067 + Math.sin(angle) * radius, 0.908 - radius * radius * 2);
      normals.push(0, 0, 1);
      variations.push(random(), 0.7 + random() * 0.3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('variation', new THREE.Float32BufferAttribute(variations, 2));
  return geometry;
}
