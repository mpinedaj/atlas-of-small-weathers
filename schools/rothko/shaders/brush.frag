// A soft cloud of pigment rather than a bristle mark.
vec2 p = vUv;
float body = 1.0 - smoothstep(0.1, 1.0, length(p * vec2(0.52, 1.15)));
float grain = smoothstep(0.2, 0.85, atlasNoise(p * 2.3 + vSeed * 17.0));
float alpha = body * (0.32 + 0.68 * grain) * vAlpha * 0.006;

vec3 colour = mix(uWash1, uWash4, smoothstep(-0.8, 0.8, p.y));
colour = mix(colour, uAccent, 0.1 + 0.05 * atlasHash11(vSeed * 3.0));
colour = mix(colour, uHighlight, 0.12 * smoothstep(0.45, 0.9, grain));
colour = mix(colour, uInk, 0.04);

fragColor = vec4(colour * alpha, alpha);
