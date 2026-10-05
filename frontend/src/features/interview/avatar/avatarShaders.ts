// Both the quiet surface and the particles share these real vertex deformations.
// Speech never moves a photograph: jaw, lip, eyelid and brow vertices change in 3D.
const deformation = /* glsl */ `
  uniform float uTime;
  uniform float uJaw;
  uniform float uRound;
  uniform float uWide;
  uniform float uSmile;
  uniform float uBlink;
  uniform float uBrow;
  uniform float uYaw;
  uniform float uNod;
  uniform float uMotion;
  uniform vec2 uGaze;
  float gauss(float x, float scale) { return exp(-x*x / scale); }
  vec3 deform(vec3 p) {
    float front = smoothstep(0.48, 0.84, p.z);
    float lips = gauss(p.x, 0.065) * gauss(p.y - 0.505, 0.012) * front;
    float lower = (1.0 - smoothstep(0.49, 0.515, p.y));
    float jaw = (1.0 - smoothstep(0.47, 0.6, p.y)) * smoothstep(-0.1, 0.26, p.y) * gauss(p.x, 0.32) * front;
    p.y -= uJaw * (0.045 * jaw + 0.055 * lips * lower);
    p.y += uJaw * 0.012 * lips * (1.0 - lower);
    p.x *= 1.0 + lips * (uWide * 0.12 - uRound * 0.10);
    p.z += lips * uRound * 0.025;
    float corners = gauss(abs(p.x) - 0.20, 0.006) * gauss(p.y - 0.51, 0.015) * front;
    p.y += uSmile * 0.055 * corners;
    float cheek = gauss(abs(p.x) - 0.40, 0.035) * gauss(p.y - 0.76, 0.07) * front;
    p.y += uSmile * 0.018 * cheek;
    float eye = gauss(abs(p.x) - 0.285, 0.018) * gauss(p.y - 1.1067, 0.009) * front;
    p.y = mix(p.y, 1.105, eye * uBlink * 0.98);
    float brow = gauss(abs(p.x) - 0.30, 0.027) * gauss(p.y - 1.31, 0.018) * front;
    p.y += uBrow * 0.037 * brow;
    float breathe = sin(uTime * 1.35) * 0.010 * uMotion;
    p.y += breathe * (1.0 - smoothstep(-0.4, 0.6, p.y));
    p.z += breathe * (1.0 - smoothstep(-0.4, 0.6, p.y));
    float head = smoothstep(-0.3, 0.45, p.y);
    float yaw = uYaw * head, nod = uNod * head;
    vec3 pivot = vec3(0.0, 0.20, 0.03);
    p -= pivot;
    p.xz = mat2(cos(yaw), -sin(yaw), sin(yaw), cos(yaw)) * p.xz;
    p.yz = mat2(cos(nod), -sin(nod), sin(nod), cos(nod)) * p.yz;
    return p + pivot;
  }
`;

export const particleVertex = /* glsl */ `
  ${deformation}
  attribute vec2 variation;
  uniform float uPixelRatio;
  uniform float uIris;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec3 source = position;
    if (uIris > 0.5) { source.xy += uGaze * 0.012; }
    vec3 p = deform(source);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    float key = max(dot(n, normalize(vec3(-0.7, 0.6, 1.2))), 0.0);
    float rim = pow(1.0 - max(n.z, 0.0), 2.0);
    float face = smoothstep(-0.3, 0.5, position.y);
    float fade = smoothstep(-1.9, -0.30, position.y);
    float flicker = 0.94 + 0.06 * sin(uTime * 1.6 * uMotion + variation.x * 30.0);
    vec3 pearl = vec3(0.85, 0.86, 0.83);
    vec3 copper = vec3(1.0, 0.39, 0.12);
    float warmth = clamp(rim * 0.62 + (1.0-face) * 0.3 + smoothstep(-0.1, 0.9, position.x) * 0.24, 0.0, 0.80);
    vColor = mix(pearl, copper, warmth) * (0.44 + key * 0.62);
    vAlpha = (0.31 + key * 0.56 + rim * 0.20) * fade * flicker;
    vAlpha *= smoothstep(-0.12, 0.2, n.z);
    float socket = exp(-pow((abs(position.x)-0.285)/0.13, 4.0) - pow((position.y-1.1067)/0.049, 4.0));
    vAlpha *= 1.0 - socket * 0.65 * (1.0-uBlink);
    float size = mix(1.0, 1.45, variation.y) + (1.0-face) * 0.40;
    if (uIris > 0.5) {
      vColor = mix(vec3(0.20, 0.27, 0.25), vec3(0.52, 0.37, 0.22), variation.x);
      vAlpha = 0.44 * (1.0 - smoothstep(0.25, 0.85, uBlink));
      size = 1.1;
    }
    gl_PointSize = clamp(size * uPixelRatio * 7.0 / -mv.z, 0.8, 3.5);
    gl_Position = projectionMatrix * mv;
  }
`;

export const particleFragment = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float radius = length(gl_PointCoord - 0.5) * 2.0;
    if (radius > 1.0) discard;
    float dotShape = 1.0 - smoothstep(0.3, 1.0, radius);
    gl_FragColor = vec4(vColor, vAlpha * dotShape);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const surfaceVertex = /* glsl */ `
  ${deformation}
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(deform(position), 1.0);
  }
`;

export const surfaceFragment = /* glsl */ `
  uniform float uBlink;
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vec3 n = normalize(vNormal);
    float key = max(dot(n, normalize(vec3(-0.8, 0.8, 1.2))), 0.0);
    float rim = pow(1.0 - max(n.z, 0.0), 3.0);
    vec3 shade = vec3(0.004, 0.005, 0.005) + key * vec3(0.016, 0.018, 0.017);
    shade += rim * vec3(0.11, 0.043, 0.018);
    float socket = exp(-pow((abs(vPosition.x)-0.285)/0.13, 4.0) - pow((vPosition.y-1.1067)/0.048, 4.0));
    shade *= 1.0 - socket * 0.85 * (1.0-uBlink);
    float fade = smoothstep(-1.9, -0.55, vPosition.y);
    gl_FragColor = vec4(shade, fade);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
