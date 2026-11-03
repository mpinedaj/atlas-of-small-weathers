vec2 p = vUv;
float aspect = uResolution.x / max(uResolution.y, 1.0);
vec2 q = vec2((p.x - 0.5) * aspect, p.y - 0.5);
float drift = uTime * 0.005;
vec2 wind = uWindVector * drift;

// The ground of the painting: a warm sky at the top, cooling into the weather.
vec3 colour = mix(uGround, uWash0, 0.5);
float upper = smoothstep(0.35, 1.0, p.y);
colour = mix(colour, uWash2, upper * (0.32 + uCloud * 0.18));
colour = mix(colour, uWash4, max(-uWarmth, 0.0) * 0.28);
colour = mix(colour, uWash1, max(uWarmth, 0.0) * 0.22);

// Two octaves make the difference between haze and a storm mass.
float n1 = atlasFbm(p * vec2(2.2 * aspect, 3.4) + wind + uSeed * 0.013);
float n2 = atlasFbm(p * vec2(5.6 * aspect, 8.0) - wind * 1.6 + 11.0);
float mass = smoothstep(0.42, 0.78, n1 * 0.7 + n2 * 0.3);
mass *= smoothstep(0.32, 0.92, p.y) * (0.25 + uCloud * 0.75);
vec3 cloudTone = mix(uWash3, uWash5, 0.55);
cloudTone = mix(cloudTone, uShadow, 0.3 + uPressure * 0.2);
colour = mix(colour, cloudTone, mass * 0.72);

// Diagonal weather, the long veil Turner drags across the picture.
float bands =
  0.5 +
  0.5 * sin((p.x * 0.8 + p.y) * 14.0 + atlasFbm(p * 3.2 + uSeed) * 2.4 - uTime * 0.08);
float veil = smoothstep(0.55, 0.9, bands) * smoothstep(0.2, 0.9, p.y);
colour = mix(colour, uWash5, veil * (uRain * 0.3 + uHumidity * 0.08));

// The horizon is the source of light; the sun is only a rumour inside it.
float horizon = exp(-pow((p.y - 0.5) * 7.5, 2.0));
vec3 glowColour = mix(uHighlight, uAccent, 0.28 + max(uWarmth, 0.0) * 0.22);
colour += glowColour * horizon * (0.08 + uLight * 0.4);

float sun = atlasBloom(p, vec2(0.63, 0.53), 0.52, 0.04);
colour += uHighlight * sun * uLight * (1.0 - uCloud * 0.72) * 0.28;
colour += uAccent * sun * max(uWarmth, 0.0) * 0.1;

// Below the horizon, the water holds a little of everything above it.
float water = 1.0 - smoothstep(0.4, 0.56, p.y);
float ripple = atlasFbm(p * vec2(7.5 * aspect, 21.0) + vec2(uTime * 0.018, 0.0) + uSeed * 0.02);
vec3 waterTone = mix(uWash3, uShadow, 0.42);
waterTone = mix(waterTone, uWash1, ripple * 0.34 + horizon * 0.3);
colour = mix(colour, waterTone, water * (0.32 + uPressure * 0.22));

float streak =
  exp(-pow((p.y - 0.47) * 22.0, 2.0)) *
  pow(max(1.0 - abs(p.x - 0.62) * 2.0, 0.0), 3.0);
colour += glowColour * streak * water * (0.1 + uLight * 0.3);

float edge = smoothstep(1.35, 0.28, length(q * vec2(1.04, 1.0)));
colour *= mix(0.84, 1.0, edge);

fragColor = vec4(colour, 1.0);
