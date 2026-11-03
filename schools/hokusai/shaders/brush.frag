// A flat block-printed stroke: a hard body, a dry edge and an occasional seal.
vec2 p = vUv;
float body = 1.0 - smoothstep(0.2, 1.0, length(vec2(p.x * 0.34, p.y * 1.75)));
float edge = 1.0 - smoothstep(0.78, 1.0, abs(p.y));
float dry = smoothstep(0.25, 0.75, atlasNoise(vec2(p.x * 2.2 + vSeed * 19.0, p.y * 15.0)));
float alpha = body * edge * (0.48 + dry * 0.72) * vAlpha * 0.005;

vec3 colour = mix(uInk, uWash4, 0.22);
colour = mix(colour, uWash2, smoothstep(0.55, 0.95, atlasNoise(p * 1.7 + vSeed * 7.0)) * 0.24);
colour = mix(colour, uAccent, step(0.94, atlasHash11(vSeed * 11.0)) * 0.72);
colour = mix(colour, uHighlight, dry * 0.1);

fragColor = vec4(colour * alpha, alpha);
