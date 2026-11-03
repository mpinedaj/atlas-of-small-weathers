vec2 velocity = texture(uVelocity, vUv).xy;
vec2 drift = vec2(uTime * 0.012, -uTime * 0.006);
vec2 curl = atlasCurl(vUv * vec2(2.6, 1.8) + drift + uSeed * 0.01, uTime);
float gust = 0.4 + 0.6 * atlasNoise(vUv * 3.6 + vec2(uTime * 0.02, 0.0));

vec2 force = curl * (0.02 + uHumidity * 0.05) * gust;
force += uWindVector * (0.01 + uWindSpeed * 0.1) * (0.5 + uTension);
force += vec2(0.0, -uPressure * 0.004);
force += uWindVector * uRain * 0.02 * atlasNoise(vUv * 18.0 + uTime * 0.5);

vec2 next = velocity + force;
float speed = length(next);
if (speed > 1.6) next = next / speed * 1.6;
fragColor = vec4(next, 0.0, 1.0);
