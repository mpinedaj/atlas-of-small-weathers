/**
 * The shared GLSL vocabulary.
 *
 * Schools write fragment bodies against these uniforms and helpers. The renderer
 * prepends the header and helpers, so a school shader never repeats `#version`,
 * precision qualifiers, uniform declarations, or the noise functions. The
 * complete contract is documented in `docs/schools.md`.
 */

export type ShaderSlot = 'field' | 'flow' | 'brush' | 'post';

const PALETTE_UNIFORMS = `
uniform vec3 uGround;
uniform vec3 uInk;
uniform vec3 uAccent;
uniform vec3 uHighlight;
uniform vec3 uShadow;
uniform vec3 uWash0;
uniform vec3 uWash1;
uniform vec3 uWash2;
uniform vec3 uWash3;
uniform vec3 uWash4;
uniform vec3 uWash5;
`;

const GESTURE_UNIFORMS = `
uniform float uCondition;
uniform float uWarmth;
uniform float uWindSpeed;
uniform vec2 uWindVector;
uniform float uTension;
uniform float uHumidity;
uniform float uCloud;
uniform float uPressure;
uniform float uRain;
uniform float uLight;
uniform float uStrokeLength;
`;

const BASE_UNIFORMS = `
uniform float uTime;
uniform vec2 uResolution;
uniform float uSeed;
`;

export const COMMON_GLSL = `
const float ATLAS_PI = 3.14159265359;

float atlasHash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float atlasHash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float atlasNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = atlasHash21(i);
  float b = atlasHash21(i + vec2(1.0, 0.0));
  float c = atlasHash21(i + vec2(0.0, 1.0));
  float d = atlasHash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float atlasFbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  mat2 turn = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    value += amplitude * atlasNoise(p);
    p = turn * p + 17.3;
    amplitude *= 0.5;
  }
  return value;
}

/** Divergence-free 2D curl of an fbm potential. */
vec2 atlasCurl(vec2 p, float time) {
  float e = 0.06;
  vec2 drift = vec2(time * 0.035, -time * 0.021);
  float dx = atlasFbm(p + vec2(e, 0.0) + drift) - atlasFbm(p - vec2(e, 0.0) + drift);
  float dy = atlasFbm(p + vec2(0.0, e) + drift) - atlasFbm(p - vec2(0.0, e) + drift);
  return vec2(dy, -dx) / (2.0 * e);
}

float atlasLuma(vec3 colour) {
  return dot(colour, vec3(0.2126, 0.7152, 0.0722));
}

/** Soft, slightly irregular circle: 1 in the centre, 0 at the edge. */
float atlasBloom(vec2 uv, vec2 centre, float radius, float softness) {
  vec2 delta = (uv - centre) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  float distanceToCentre = length(delta);
  return 1.0 - smoothstep(radius * softness, radius, distanceToCentre);
}

vec3 atlasPaper(vec3 colour, vec2 uv, float grain) {
  float fibre = atlasNoise(vec2(uv.x * uResolution.x * 0.65, uv.y * 14.0) + uSeed);
  float speck = atlasHash21(uv * uResolution + uSeed * 19.0) - 0.5;
  return colour * (0.975 + fibre * 0.045 + speck * grain);
}
`;

const SLOT_HEADERS: Readonly<Record<Exclude<ShaderSlot, 'brush'>, string>> = {
  field: `
${BASE_UNIFORMS}
${PALETTE_UNIFORMS}
${GESTURE_UNIFORMS}
in vec2 vUv;
out vec4 fragColor;
`,
  flow: `
${BASE_UNIFORMS}
${PALETTE_UNIFORMS}
${GESTURE_UNIFORMS}
uniform sampler2D uVelocity;
uniform sampler2D uDye;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 fragColor;
`,
  post: `
${BASE_UNIFORMS}
${PALETTE_UNIFORMS}
${GESTURE_UNIFORMS}
uniform sampler2D uField;
uniform sampler2D uDye;
in vec2 vUv;
out vec4 fragColor;
`,
};

const BRUSH_HEADER = `
${BASE_UNIFORMS}
${PALETTE_UNIFORMS}
${GESTURE_UNIFORMS}
in vec2 vUv;
in float vSeed;
in float vAlpha;
in float vSpeed;
in float vAngle;
in float vLife;
out vec4 fragColor;
`;

/**
 * Assemble a complete fragment shader from a school's body.
 *
 * The body is the inside of `main()`: statements only, no signature. This keeps
 * schools short and makes every slot obey the same uniform contract. Helper
 * functions belong in `COMMON_GLSL`, where every school can use them.
 */
export function buildFragment(slot: ShaderSlot, body: string): string {
  const header = slot === 'brush' ? BRUSH_HEADER : SLOT_HEADERS[slot];
  return `#version 300 es
precision highp float;
precision highp sampler2D;
${header}
${COMMON_GLSL}
void main() {
${body}
}`;
}

/** Draws one fullscreen triangle without a vertex buffer. */
export const FULLSCREEN_VERTEX = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = corner;
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`;

/**
 * One brush instance. The state lives in the particle buffer; the quad corner
 * comes from a small static buffer with a divisor of one.
 */
export const BRUSH_VERTEX = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aVelocity;
layout(location = 2) in float aAge;
layout(location = 3) in float aLife;
layout(location = 4) in float aSeed;
layout(location = 5) in float aSize;
layout(location = 6) in vec2 aCorner;

uniform vec2 uResolution;
uniform vec2 uWindVector;
uniform float uWindSpeed;
uniform float uTension;
uniform float uStrokeLength;
uniform float uBrushScale;

out vec2 vUv;
out float vSeed;
out float vAlpha;
out float vSpeed;
out float vAngle;
out float vLife;

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 direction = length(aVelocity) > 0.0001 ? normalize(aVelocity) : uWindVector;
  float speed = clamp(length(aVelocity) * 2.2 + uWindSpeed * 0.35, 0.0, 1.0);

  float width = mix(0.006, 0.019, uTension) * aSize * uBrushScale;
  float stretch = mix(2.2, 11.0, uStrokeLength) * (0.55 + speed * 0.75);
  vec2 local = aCorner * vec2(width * stretch, width);
  local.x /= aspect;

  vec2 tangent = normalize(direction + vec2(0.0001, 0.0));
  vec2 normal = vec2(-tangent.y, tangent.x);
  vec2 offset = tangent * local.x + normal * local.y;
  vec2 position = aPosition + offset;

  gl_Position = vec4(position, 0.0, 1.0);

  float lifeT = clamp(aAge / max(aLife, 0.001), 0.0, 1.0);
  vUv = aCorner;
  vSeed = aSeed;
  vLife = aLife;
  vSpeed = speed;
  vAngle = atan(direction.y, direction.x);
  vAlpha = smoothstep(0.0, 0.06, lifeT) * (1.0 - smoothstep(0.72, 1.0, lifeT));
}
`;

/** Additive force stamps from the same particles, closing the fluid loop. */
export const SPLAT_VERTEX = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aVelocity;
layout(location = 2) in float aAge;
layout(location = 3) in float aLife;
layout(location = 4) in float aSeed;
layout(location = 5) in float aSize;
layout(location = 6) in vec2 aCorner;

uniform vec2 uResolution;
uniform vec2 uWindVector;
uniform float uWindSpeed;

out vec2 vUv;
out vec2 vForce;
out float vAlpha;

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 direction = length(aVelocity) > 0.0001 ? normalize(aVelocity) : uWindVector;
  float strength = clamp(length(aVelocity) * 2.5, 0.0, 1.0);
  vec2 size = vec2(0.018, 0.012) * aSize;
  size.x /= aspect;

  vForce = direction * (0.000012 + strength * 0.000045);
  vAlpha = smoothstep(0.0, 0.08, aAge / max(aLife, 0.001));
  vUv = aCorner;

  gl_Position = vec4(aPosition + aCorner * size, 0.0, 1.0);
}
`;

export const SPLAT_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vForce;
in float vAlpha;
out vec4 fragColor;
void main() {
  float radius = length(vUv);
  float mask = smoothstep(1.0, 0.15, radius);
  fragColor = vec4(vForce * mask * vAlpha, 0.0, 1.0);
}
`;

/** Particles advance on the GPU; the CPU never touches their state. */
export const PARTICLE_UPDATE_VERTEX = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aVelocity;
layout(location = 2) in float aAge;
layout(location = 3) in float aLife;
layout(location = 4) in float aSeed;
layout(location = 5) in float aSize;

uniform sampler2D uVelocity;
uniform float uTime;
uniform float uDt;
uniform vec2 uWindVector;
uniform float uWindSpeed;
uniform float uTension;
uniform float uWarmth;
uniform float uSeed;

out vec2 oPosition;
out vec2 oVelocity;
out float oAge;
out float oLife;
out float oSeed;
out float oSize;

float atlasParticleHash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

void main() {
  vec2 uv = clamp(aPosition * 0.5 + 0.5, vec2(0.0), vec2(1.0));
  vec2 flow = texture(uVelocity, uv).xy;
  vec2 wind = uWindVector * uWindSpeed * 0.6;
  vec2 drift = (flow * 0.55 + wind * 0.22) * uDt;
  drift += vec2(uWarmth * 0.0012, 0.0010 + uTension * 0.0014) * uDt;

  vec2 position = aPosition + drift;
  vec2 velocity = flow * 1.8 + wind * 0.6;

  float age = aAge + uDt;
  float life = aLife;
  float seed = aSeed;
  float size = aSize;
  float cycle = floor(uTime * 0.07 + seed * 7.0);
  bool outside = abs(position.x) > 1.15 || abs(position.y) > 1.15;

  if (age > life || outside) {
    seed = atlasParticleHash11(aSeed * 71.0 + uSeed + cycle * 13.7);
    position = vec2(
      atlasParticleHash11(seed * 3.1 + uSeed * 1.7),
      atlasParticleHash11(seed * 5.7 + uSeed * 2.3)
    ) * 2.2 - 1.1;
    age = 0.0;
    life = mix(6.0, 17.0, atlasParticleHash11(seed * 11.3 + 0.5));
    size = mix(0.45, 1.35, atlasParticleHash11(seed * 17.9 + 0.9));
    velocity = vec2(0.0);
  }

  oPosition = position;
  oVelocity = velocity;
  oAge = age;
  oLife = life;
  oSeed = seed;
  oSize = size;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/** A tiny use of the same hash in the particle shader, without the full library. */
export const PARTICLE_DUMMY_FRAGMENT = `#version 300 es
precision highp float;
out vec4 fragColor;
void main() { fragColor = vec4(0.0); }
`;
