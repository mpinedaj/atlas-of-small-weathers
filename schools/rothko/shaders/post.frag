vec3 field = texture(uField, vUv).rgb;
vec4 dye = texture(uDye, vUv);
float coverage = clamp(dye.a * 1.2, 0.0, 1.0);
vec3 colour = field * (1.0 - coverage) + dye.rgb;

// A soft optical bloom, as if the fields were lit from behind.
float bloom = 0.5 + 0.5 * sin(uTime * 0.012 + uSeed * 0.07);
colour = mix(colour, uHighlight, 0.018 + bloom * 0.012);
colour = mix(colour, uWash0, 0.02);

colour = atlasPaper(colour, vUv, 0.026);
float grain = atlasNoise(vUv * uResolution * 0.28 + uSeed * 3.0);
colour *= 0.985 + grain * 0.025;

vec2 q = (vUv - 0.5) * vec2(1.02, 1.0);
float vignette = smoothstep(0.98, 0.26, length(q));
colour *= mix(0.86, 1.0, vignette);

fragColor = vec4(colour, 1.0);
