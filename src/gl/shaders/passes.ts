/** Core fluid passes. These are not school surface; they are the physics. */

const VERTEX = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = corner;
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`;

const HEADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
`;

export const FLUID_VERTEX = VERTEX;

export const ADVECT_VELOCITY_FRAGMENT = `${HEADER}
uniform sampler2D uVelocity;
uniform float uDt;
uniform float uDissipation;
void main() {
  vec2 velocity = texture(uVelocity, vUv).xy;
  vec2 coord = clamp(vUv - velocity * uDt, vec2(0.0), vec2(1.0));
  vec2 next = texture(uVelocity, coord).xy * uDissipation;
  float speed = length(next);
  if (speed > 1.8) next = next / speed * 1.8;
  fragColor = vec4(next, 0.0, 1.0);
}
`;

export const DIVERGENCE_FRAGMENT = `${HEADER}
uniform sampler2D uVelocity;
uniform vec2 uTexel;
void main() {
  float left = texture(uVelocity, vUv - vec2(uTexel.x, 0.0)).x;
  float right = texture(uVelocity, vUv + vec2(uTexel.x, 0.0)).x;
  float bottom = texture(uVelocity, vUv - vec2(0.0, uTexel.y)).y;
  float top = texture(uVelocity, vUv + vec2(0.0, uTexel.y)).y;
  float divergence = 0.5 * ((right - left) + (top - bottom));
  fragColor = vec4(divergence, 0.0, 0.0, 1.0);
}
`;

export const PRESSURE_FRAGMENT = `${HEADER}
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexel;
void main() {
  float left = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float right = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float bottom = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float top = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  float divergence = texture(uDivergence, vUv).x;
  float value = (left + right + bottom + top - divergence) * 0.25;
  fragColor = vec4(value, 0.0, 0.0, 1.0);
}
`;

export const GRADIENT_FRAGMENT = `${HEADER}
uniform sampler2D uVelocity;
uniform sampler2D uPressure;
uniform vec2 uTexel;
void main() {
  vec2 velocity = texture(uVelocity, vUv).xy;
  float left = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float right = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float bottom = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float top = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  vec2 gradient = vec2(right - left, top - bottom) * 0.5;
  fragColor = vec4(velocity - gradient, 0.0, 1.0);
}
`;

export const ADVECT_DYE_FRAGMENT = `${HEADER}
uniform sampler2D uDye;
uniform sampler2D uVelocity;
uniform vec2 uTexel;
uniform float uDt;
uniform float uDissipation;
uniform float uDiffusion;
void main() {
  vec2 velocity = texture(uVelocity, vUv).xy;
  vec2 coord = clamp(vUv - velocity * uDt, vec2(0.0), vec2(1.0));
  vec4 centre = texture(uDye, coord);
  vec4 blur =
    texture(uDye, coord + vec2(uTexel.x, 0.0)) +
    texture(uDye, coord - vec2(uTexel.x, 0.0)) +
    texture(uDye, coord + vec2(0.0, uTexel.y)) +
    texture(uDye, coord - vec2(0.0, uTexel.y));
  vec4 dye = mix(centre, blur * 0.25, uDiffusion);
  fragColor = dye * uDissipation;
}
`;
