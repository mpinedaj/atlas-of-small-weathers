vec2 p = vUv;
float aspect = uResolution.x / max(uResolution.y, 1.0);
vec2 q = vec2((p.x - 0.5) * aspect, p.y - 0.5);

// A slow warp keeps the fields from looking like rectangles of paint.
float warp = atlasFbm(p * vec2(2.1 * aspect, 2.8) + uSeed * 0.011) - 0.5;
float py = p.y + warp * 0.022;
float px = p.x + (atlasFbm(p * 3.7 + 31.0 + uSeed * 0.007) - 0.5) * 0.018;

vec3 colour = uGround * (0.88 + 0.08 * smoothstep(0.0, 1.0, p.y));

// Three fields, each a different distance from the ground: a pale threshold,
// a saturated middle, and a deeper panel above it.
vec3 upper = mix(uWash1, uWash2, 0.3 + 0.24 * atlasNoise(p * 2.0 + uSeed * 0.01));
vec3 middle = mix(uWash3, uWash4, 0.3 + 0.24 * atlasNoise(p * 3.0 + 7.0));
vec3 lower = mix(uWash4, uWash2, 0.34 + 0.22 * atlasNoise(p * 2.4 + 19.0));

float feather = 0.055;
float xMask = smoothstep(0.08, 0.2, px) * (1.0 - smoothstep(0.8, 0.92, px));
float upperMask =
  smoothstep(0.1 - feather, 0.1 + feather, py) * (1.0 - smoothstep(0.32 - feather, 0.32 + feather, py));
float middleMask =
  smoothstep(0.36 - feather, 0.36 + feather, py) * (1.0 - smoothstep(0.64 - feather, 0.64 + feather, py));
float lowerMask =
  smoothstep(0.68 - feather, 0.68 + feather, py) * (1.0 - smoothstep(0.9 - feather, 0.9 + feather, py));

colour = mix(colour, upper, upperMask * xMask * 0.92);
colour = mix(colour, middle, middleMask * xMask * 0.96);
colour = mix(colour, lower, lowerMask * xMask * 0.84);

// The fields glow from inside; the glow is the only thing that moves quickly.
float glow = 0.0;
glow += exp(-pow(length(q - vec2(0.0, -0.29)) * 3.4, 2.0)) * 0.45;
glow += exp(-pow(length(q - vec2(0.0, 0.01)) * 3.0, 2.0)) * 0.75;
glow += exp(-pow(length(q - vec2(0.0, 0.3)) * 3.3, 2.0)) * 0.4;
float breath = 0.5 + 0.5 * sin(uTime * 0.015 + uSeed * 0.1);
colour += uHighlight * glow * (0.035 + uLight * 0.055) * (0.72 + breath * 0.28);
colour += uAccent * glow * 0.02;

// Weather changes the temperature of the room, not the arrangement.
float weather = max(uCloud * 0.5, uRain * 0.6);
colour = mix(colour, uShadow, weather * 0.09 + uPressure * 0.035);
colour = mix(colour, uWash1, max(uWarmth, 0.0) * 0.05);
colour = mix(colour, uWash4, max(-uWarmth, 0.0) * 0.06);

// The outer edge is darker, as if the canvas turned away from the light.
float edge = smoothstep(1.28, 0.32, length(q * vec2(1.02, 1.0)));
colour *= mix(0.82, 1.0, edge);

fragColor = vec4(colour, 1.0);
