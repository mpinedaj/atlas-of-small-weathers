vec2 velocity = texture(uVelocity, vUv).xy;

// The wind crosses the print from right to left, with foam in the turns.
vec2 gust = atlasCurl(vUv * vec2(3.2, 1.6) + uSeed * 0.012, uTime);
vec2 next = velocity * 0.9;
next += vec2(-1.0, 0.12) * (0.0014 + uWindSpeed * 0.0062);
next += gust * (0.0009 + uRain * 0.0035);
next += uWindVector * uTension * 0.0012;

if (length(next) > 0.9) next = normalize(next) * 0.9;
fragColor = vec4(next, 0.0, 1.0);
