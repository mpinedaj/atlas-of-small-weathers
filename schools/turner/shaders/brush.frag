// vUv is the quad in -1…1: long in x, thin in y.
vec2 p = vUv;
float capsule = 1.0 - smoothstep(0.22, 1.0, length(vec2(p.x * 0.4, p.y * 1.55)));
float bristle = atlasNoise(vec2(p.x * 2.6 + vSeed * 13.0, p.y * 16.0 + vAngle * 0.7));
float dry = smoothstep(0.18, 0.62, bristle);
float edge = 1.0 - smoothstep(0.58, 1.0, abs(p.y));
float body = capsule * edge * (0.2 + dry * 1.15);
float alpha = body * vAlpha * 0.009;

vec3 colour = mix(uWash1, uWash3, atlasHash11(vSeed * 9.0 + 0.3));
colour = mix(colour, uWash4, smoothstep(0.35, 0.9, bristle) * 0.45);
colour = mix(colour, uHighlight, max(uWarmth, 0.0) * 0.18 * smoothstep(0.5, 0.95, bristle));
colour = mix(colour, uAccent, step(0.88, atlasHash11(vSeed * 5.0)) * 0.5);
colour = mix(colour, uInk, vSpeed * 0.12);
colour *= 0.92 + 0.16 * atlasNoise(vec2(p.x * 2.0, p.y * 9.0) + vSeed);

fragColor = vec4(colour * alpha, alpha);
