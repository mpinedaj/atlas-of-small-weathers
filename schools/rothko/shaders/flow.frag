vec2 velocity = texture(uVelocity, vUv).xy;

// Almost no force: the colour should drift as if it were remembered.
vec2 curl = atlasCurl(vUv * 1.25 + uSeed * 0.01, uTime * 0.12);
vec2 lean = uWindVector * uWindSpeed * 0.0016;
vec2 next = velocity * 0.94 + curl * 0.0018 * (0.35 + uHumidity * 0.35) + lean;

if (length(next) > 0.42) next = normalize(next) * 0.42;
fragColor = vec4(next, 0.0, 1.0);
