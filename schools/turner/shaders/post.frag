vec3 field = texture(uField, vUv).rgb;
vec4 dye = texture(uDye, vUv);
float coverage = clamp(dye.a * 1.35, 0.0, 1.0);
vec3 colour = field * (1.0 - coverage) + dye.rgb;

// Varnish: a little warmth in the light, a little green in the shadow.
colour = mix(colour, uHighlight, 0.035);
colour *= vec3(1.02, 1.0, 0.965);
colour = mix(colour, uWash0, 0.03);

colour = atlasPaper(colour, vUv, 0.07);
float grain = atlasNoise(vUv * uResolution * 0.55 + uSeed * 5.0);
colour *= 0.94 + grain * 0.1;

float bloom = atlasBloom(vUv, vec2(0.63, 0.53), 0.62, 0.06);
colour += mix(uHighlight, uAccent, 0.2) * bloom * uLight * 0.08;

float weave = sin(vUv.x * 180.0) * sin(vUv.y * 180.0);
colour *= 1.0 + weave * 0.012;

vec2 q = (vUv - 0.5) * vec2(1.04, 1.0);
float vignette = smoothstep(0.92, 0.2, length(q));
colour *= mix(0.78, 1.0, vignette);

fragColor = vec4(colour, 1.0);
