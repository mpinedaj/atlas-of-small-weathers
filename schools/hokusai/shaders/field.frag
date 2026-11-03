vec2 p = vUv;
float aspect = uResolution.x / max(uResolution.y, 1.0);
vec2 q = vec2((p.x - 0.5) * aspect, p.y - 0.5);

float horizon = 0.5;
// vUv.y runs upward: the sea is the lower half, the sky the upper half.
float sea = 1.0 - smoothstep(horizon - 0.006, horizon + 0.006, p.y);
float sky = 1.0 - sea;

// Flat blocks of colour: warm paper above, Prussian blue below.
vec3 skyTone = mix(uGround, uWash1, 0.05 + uCloud * 0.18);
vec3 seaTone = mix(uWash3, uWash5, 0.32 + uPressure * 0.34);
vec3 colour = mix(skyTone, seaTone, sea);

// A single flat cloud band, cut across the sky like a printed shape.
float cloudBand =
  smoothstep(0.62, 0.67, p.y) * (1.0 - smoothstep(0.8, 0.86, p.y));
colour = mix(colour, uWash1, cloudBand * sky * (0.22 + uCloud * 0.4));

// The sea is a set of flat bands with a slow swell.
float swell = sin(p.y * 28.0 + sin(p.x * 8.5 - uTime * 0.08 + uSeed * 0.03) * 1.7);
float bandLine = smoothstep(0.94, 1.0, swell);
colour = mix(colour, uWash4, bandLine * sea * 0.4);

// Foam: a few pale lines, never a soft gradient.
float foamLine = abs(sin(p.y * 34.0 + sin(p.x * 6.0 - uTime * 0.06) * 1.9));
float foam = smoothstep(0.968, 0.995, foamLine) * sea;
colour = mix(colour, uHighlight, foam * (0.34 + uRain * 0.24));

// A wave curls in from the lower left, drawn as concentric arcs.
vec2 d = vec2((p.x - 0.3) * aspect, p.y - 0.22);
float radius = length(d);
float angle = atan(d.y, d.x);
float curl = sin(radius * 52.0 - angle * 1.4 + uTime * 0.09);
float crest =
  smoothstep(0.8, 1.0, curl) *
  smoothstep(0.58, 0.18, radius) *
  smoothstep(0.015, 0.06, radius);
colour = mix(colour, uHighlight, crest * sea * (0.46 + uWindSpeed * 0.26));

// Wind is a set of fine ink lines crossing the sky.
float windLine = abs(
  sin(p.y * 42.0 + atlasFbm(p * 2.2 + uSeed * 0.01) * 3.0 - uTime * 0.045)
);
float gust = smoothstep(0.965, 0.995, windLine) * sky;
colour = mix(colour, uInk, gust * (0.12 + uWindSpeed * 0.34));

// Woodblock misregistration: the red block sits a hair to one side.
vec2 shift = vec2(2.4 / max(uResolution.x, 1.0), -1.6 / max(uResolution.y, 1.0));
float shiftedSwell = sin(
  (p.y - shift.y) * 28.0 + sin((p.x - shift.x) * 8.5 + uTime * 0.08 + uSeed * 0.03) * 1.7
);
float redBlock = smoothstep(0.955, 1.0, shiftedSwell) * sea;
colour = mix(colour, uAccent, redBlock * 0.16);

// Darken the corners like a print pulled slightly unevenly.
float edge = smoothstep(1.3, 0.34, length(q * vec2(1.02, 1.0)));
colour *= mix(0.93, 1.0, edge);

fragColor = vec4(colour, 1.0);
