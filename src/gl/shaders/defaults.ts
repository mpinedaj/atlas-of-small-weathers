import type { ShaderSet } from '../../core/types';

/**
 * The house painting, used before a school is chosen and as the fallback when a
 * school shader fails to compile. It is deliberately quiet: Turner, Rothko and
 * Hokusai are the voices; this is the paper they arrive on.
 */

const field = `
vec2 p = vUv;
float aspect = uResolution.x / max(uResolution.y, 1.0);
vec2 q = vec2((p.x - 0.5) * aspect, p.y - 0.5);
float t = uTime * 0.004;

vec3 sky = mix(uGround, uWash0, 0.32 + 0.18 * (1.0 - uLight));
sky = mix(sky, uWash1, smoothstep(0.0, 1.0, p.y) * (0.14 + uHumidity * 0.22));

vec3 warm = mix(uWash2, uHighlight, 0.42);
vec3 cool = mix(uWash3, uShadow, 0.45);
sky = mix(sky, warm, max(uWarmth, 0.0) * 0.24);
sky = mix(sky, cool, max(-uWarmth, 0.0) * 0.22);

vec2 drift = uWindVector * uTime * 0.004;
float n = atlasFbm(p * vec2(2.1 * aspect, 2.4) + drift + uSeed * 0.013);
float n2 = atlasFbm(p * vec2(5.2 * aspect, 5.8) - drift * 1.7 + 5.0);
float cloud = smoothstep(0.38, 0.78, n * 0.7 + n2 * 0.3) * uCloud;
vec3 cloudTone = mix(uWash1, uShadow, smoothstep(0.18, 0.92, n2) * 0.58);
sky = mix(sky, cloudTone, cloud * 0.55);

float low = smoothstep(0.56, 0.0, p.y);
sky = mix(sky, mix(uShadow, uWash4, 0.28), low * uPressure * 0.42);

float veil = atlasFbm(p * vec2(7.0 * aspect, 8.0) + vec2(0.0, -uTime * 0.02) + uSeed);
sky = mix(sky, uWash5, smoothstep(0.56, 0.92, veil) * uHumidity * 0.12);

vec2 sun = vec2(0.68, 0.72);
float glow = atlasBloom(p, sun, 0.62, 0.06);
sky += uHighlight * glow * uLight * (1.0 - uCloud) * 0.26;
sky += uAccent * glow * max(uWarmth, 0.0) * 0.1;

float edge = smoothstep(1.3, 0.25, length(q * vec2(1.06, 1.0)));
sky *= mix(0.86, 1.0, edge);

fragColor = vec4(sky, 1.0);
`;

const flow = `
vec2 velocity = texture(uVelocity, vUv).xy;
vec2 drift = vec2(uTime * 0.009, -uTime * 0.005);
vec2 c = atlasCurl(vUv * vec2(3.1, 2.3) + drift + uSeed * 0.011, uTime);
float gust = 0.35 + 0.65 * atlasNoise(vUv * 4.0 + vec2(uTime * 0.025, 0.0));

vec2 force = c * (0.018 + uHumidity * 0.045 + uCloud * 0.02) * gust;
force += uWindVector * (0.006 + uWindSpeed * 0.085) * mix(0.55, 1.0, uTension);
force += uWindVector * uRain * 0.018 * atlasNoise(vUv * 22.0 + uTime * 0.4);
force += vec2(0.0, -0.0016 * uWarmth);

vec2 next = velocity + force;
float speed = length(next);
if (speed > 1.5) next = next / speed * 1.5;
fragColor = vec4(next, 0.0, 1.0);
`;

const brush = `
vec2 p = vUv;
float capsule = 1.0 - smoothstep(0.18, 1.0, length(vec2(p.x * 0.52, p.y * 1.75)));
float bristle = atlasNoise(vec2(p.x * 6.5 + vSeed * 17.0, p.y * 24.0 + vAngle * 1.7));
float edge = 1.0 - smoothstep(0.62, 1.0, abs(p.y));
float body = capsule * (0.42 + bristle * 0.9) * edge;
float alpha = body * vAlpha * 0.008;

vec3 colour = mix(uWash0, uWash2, atlasHash11(vSeed * 13.0));
colour = mix(colour, uWash4, smoothstep(0.2, 0.9, bristle) * 0.36);
colour = mix(colour, uAccent, step(0.86, atlasHash11(vSeed * 7.0)) * 0.32);
colour = mix(colour, uInk, vSpeed * 0.2);
colour *= 0.9 + 0.2 * atlasNoise(vec2(p.x * 3.0, p.y * 10.0) + vSeed);

fragColor = vec4(colour * alpha, alpha);
`;

const post = `
vec3 field = texture(uField, vUv).rgb;
vec4 dye = texture(uDye, vUv);
float coverage = clamp(dye.a, 0.0, 1.0);
vec3 colour = field * (1.0 - coverage) + dye.rgb;

colour = atlasPaper(colour, vUv, 0.055);

float granulate = atlasNoise(vUv * uResolution * 0.8 + uSeed * 3.0);
colour *= 1.0 - (1.0 - granulate) * coverage * 0.12;

float glow = atlasBloom(vUv, vec2(0.64, 0.7), 0.75, 0.08);
colour += uHighlight * glow * uLight * 0.045;

vec2 q = (vUv - 0.5) * vec2(1.05, 1.0);
float vignette = smoothstep(0.88, 0.22, length(q));
colour *= mix(0.8, 1.0, vignette);

fragColor = vec4(colour, 1.0);
`;

export const DEFAULT_SHADERS: ShaderSet = { field, flow, brush, post };
