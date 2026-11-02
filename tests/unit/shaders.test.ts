import { describe, expect, it } from 'vitest';

import { DEFAULT_SHADERS } from '../../src/gl/shaders/defaults';
import { COMMON_GLSL, FULLSCREEN_VERTEX, buildFragment } from '../../src/gl/shaders/common';

describe('shader assembly', () => {
  it('wraps every slot body inside main and declares the shared contract once', () => {
    for (const slot of ['field', 'flow', 'brush', 'post'] as const) {
      const source = buildFragment(slot, DEFAULT_SHADERS[slot]);

      expect(source.startsWith('#version 300 es')).toBe(true);
      expect(source.match(/#version/g)).toHaveLength(1);
      expect(source.match(/void main\(\)/g)).toHaveLength(1);
      expect(source).toContain('uniform vec3 uGround');
      expect(source).toContain('uniform float uWarmth');
      expect(source).toContain('uniform vec2 uWindVector');
      expect(source).toContain('atlasFbm');
    }
  });

  it('gives flow and post the textures they are allowed to read', () => {
    const flow = buildFragment('flow', DEFAULT_SHADERS.flow);
    const post = buildFragment('post', DEFAULT_SHADERS.post);

    expect(flow).toContain('uniform sampler2D uVelocity');
    expect(flow).toContain('uniform sampler2D uDye');
    expect(post).toContain('uniform sampler2D uField');
    expect(post).toContain('uniform sampler2D uDye');
    expect(post).not.toContain('uniform sampler2D uVelocity');
  });

  it('keeps the brush slot aware of per-particle varyings', () => {
    const brush = buildFragment('brush', DEFAULT_SHADERS.brush);

    expect(brush).toContain('in float vSeed');
    expect(brush).toContain('in float vAlpha');
    expect(brush).toContain('in float vAngle');
    expect(brush).toContain('in float vLife');
  });

  it('keeps noise helpers platform-stable and free of loops that depend on uniforms', () => {
    expect(COMMON_GLSL).toContain('atlasHash21');
    expect(COMMON_GLSL).toContain('atlasCurl');
    expect(COMMON_GLSL).toContain('for (int i = 0; i < 5; i++)');
    expect(FULLSCREEN_VERTEX).toContain('gl_VertexID');
  });
});
