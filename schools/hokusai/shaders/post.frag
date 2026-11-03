vec3 field = texture(uField, vUv).rgb;
vec4 dye = texture(uDye, vUv);
float coverage = clamp(dye.a * 1.2, 0.0, 1.0);
vec3 colour = field * (1.0 - coverage) + dye.rgb;

// Woodblock misregistration: red and blue blocks do not quite agree.
vec3 shifted = texture(uField, vUv + vec2(0.0022, -0.0014)).rgb;
vec3 shiftedBack = texture(uField, vUv - vec2(0.0016, 0.001)).rgb;
colour.r = mix(colour.r, shifted.r, 0.18);
colour.b = mix(colour.b, shiftedBack.b, 0.14);

// Flatten the atmosphere into printable steps, then let the paper through.
colour = mix(colour, floor(colour * 20.0 + 0.5) / 20.0, 0.2);
colour = atlasPaper(colour, vUv, 0.055);
colour *= 0.985 + 0.03 * atlasNoise(vUv * uResolution * 0.35 + uSeed * 4.0);

float edge = smoothstep(1.26, 0.3, length((vUv - 0.5) * vec2(1.02, 1.0)));
colour *= mix(0.9, 1.0, edge);
colour = mix(colour, uHighlight, 0.015);

fragColor = vec4(colour, 1.0);
