import type { Rgb } from './color';

/** A shader failed to compile or link. The renderer catches this per slot. */
export class ShaderError extends Error {
  readonly label: string;
  readonly log: string;

  constructor(label: string, log: string) {
    super(`Shader "${label}" failed:\n${log}`);
    this.name = 'ShaderError';
    this.label = label;
    this.log = log;
  }
}

export function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
  label: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new ShaderError(label, 'Could not allocate a shader');

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'Unknown compile error';
    gl.deleteShader(shader);
    throw new ShaderError(label, log);
  }
  return shader;
}

/**
 * Compile and link a program.
 *
 * Transform feedback varyings must be declared before linking; the optional
 * list is what the particle update pass captures.
 */
export function linkProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
  label: string,
  transformFeedback?: readonly string[],
): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource, `${label} (vertex)`);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource, `${label} (fragment)`);
  const program = gl.createProgram();
  if (!program) throw new ShaderError(label, 'Could not allocate a program');

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  if (transformFeedback && transformFeedback.length > 0) {
    gl.transformFeedbackVaryings(program, [...transformFeedback], gl.INTERLEAVED_ATTRIBS);
  }
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'Unknown link error';
    gl.deleteProgram(program);
    throw new ShaderError(label, log);
  }
  return program;
}

/** A linked program with cached uniform locations and typed setters. */
export class Program {
  private readonly gl: WebGL2RenderingContext;
  private readonly locations = new Map<string, WebGLUniformLocation | null>();
  readonly program: WebGLProgram;
  readonly label: string;

  constructor(gl: WebGL2RenderingContext, program: WebGLProgram, label: string) {
    this.gl = gl;
    this.program = program;
    this.label = label;
  }

  static create(
    gl: WebGL2RenderingContext,
    vertexSource: string,
    fragmentSource: string,
    label: string,
    transformFeedback?: readonly string[],
  ): Program {
    const program = linkProgram(gl, vertexSource, fragmentSource, label, transformFeedback);
    return new Program(gl, program, label);
  }

  use(): void {
    this.gl.useProgram(this.program);
  }

  private location(name: string): WebGLUniformLocation | null {
    if (this.locations.has(name)) return this.locations.get(name) ?? null;
    const location = this.gl.getUniformLocation(this.program, name);
    this.locations.set(name, location);
    return location;
  }

  float(name: string, value: number): void {
    const location = this.location(name);
    if (location) this.gl.uniform1f(location, value);
  }

  int(name: string, value: number): void {
    const location = this.location(name);
    if (location) this.gl.uniform1i(location, value);
  }

  vec2(name: string, x: number, y: number): void {
    const location = this.location(name);
    if (location) this.gl.uniform2f(location, x, y);
  }

  vec3(name: string, x: number, y: number, z: number): void {
    const location = this.location(name);
    if (location) this.gl.uniform3f(location, x, y, z);
  }

  color(name: string, rgb: Rgb): void {
    const location = this.location(name);
    if (location) this.gl.uniform3f(location, rgb[0], rgb[1], rgb[2]);
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
  }
}

export type TargetFormat = 'rgba8' | 'rgba16f' | 'rg16f' | 'r16f';

interface FormatSpec {
  readonly internal: number;
  readonly format: number;
  readonly type: number;
}

export interface RenderTarget {
  readonly texture: WebGLTexture;
  readonly framebuffer: WebGLFramebuffer;
  readonly width: number;
  readonly height: number;
  readonly format: TargetFormat;
}

function formatSpec(gl: WebGL2RenderingContext, format: TargetFormat): FormatSpec {
  switch (format) {
    case 'rgba8':
      return { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE };
    case 'rgba16f':
      return { internal: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT };
    case 'rg16f':
      return { internal: gl.RG16F, format: gl.RG, type: gl.HALF_FLOAT };
    case 'r16f':
      return { internal: gl.R16F, format: gl.RED, type: gl.HALF_FLOAT };
  }
}

/** Create a texture backed by a framebuffer. Throws when the GPU refuses it. */
export function createTarget(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  format: TargetFormat = 'rgba16f',
  filter: 'linear' | 'nearest' = 'linear',
): RenderTarget {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const spec = formatSpec(gl, format);

  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  if (!texture || !framebuffer) throw new Error('Could not allocate a render target');

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    filter === 'linear' ? gl.LINEAR : gl.NEAREST,
  );
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MAG_FILTER,
    filter === 'linear' ? gl.LINEAR : gl.NEAREST,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, spec.internal, w, h, 0, spec.format, spec.type, null);

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);

  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    gl.deleteTexture(texture);
    gl.deleteFramebuffer(framebuffer);
    throw new Error(`Framebuffer is incomplete (0x${status.toString(16)})`);
  }

  return { texture, framebuffer, width: w, height: h, format };
}

export function deleteTarget(gl: WebGL2RenderingContext, target: RenderTarget): void {
  gl.deleteTexture(target.texture);
  gl.deleteFramebuffer(target.framebuffer);
}

/** Two targets that alternate as read and write. */
export class PingPong {
  private readonly gl: WebGL2RenderingContext;
  private targets: [RenderTarget, RenderTarget];

  constructor(
    gl: WebGL2RenderingContext,
    width: number,
    height: number,
    format: TargetFormat,
    filter: 'linear' | 'nearest' = 'linear',
  ) {
    this.gl = gl;
    this.targets = [
      createTarget(gl, width, height, format, filter),
      createTarget(gl, width, height, format, filter),
    ];
  }

  get read(): RenderTarget {
    return this.targets[0];
  }

  get write(): RenderTarget {
    return this.targets[1];
  }

  get width(): number {
    return this.read.width;
  }

  get height(): number {
    return this.read.height;
  }

  swap(): void {
    this.targets = [this.targets[1], this.targets[0]];
  }

  clear(r = 0, g = 0, b = 0, a = 0): void {
    for (const target of this.targets) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, target.framebuffer);
      this.gl.clearColor(r, g, b, a);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  dispose(): void {
    for (const target of this.targets) deleteTarget(this.gl, target);
  }
}

/** Bind a target for drawing, or the canvas when target is null. */
export function bindTarget(
  gl: WebGL2RenderingContext,
  target: RenderTarget | null,
  width: number,
  height: number,
): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
  gl.viewport(0, 0, width, height);
}

export function createEmptyVao(gl: WebGL2RenderingContext): WebGLVertexArrayObject {
  const vao = gl.createVertexArray();
  if (!vao) throw new Error('Could not allocate a vertex array');
  return vao;
}

/** The fullscreen triangle uses gl_VertexID; no buffers are required. */
export function drawFullscreen(gl: WebGL2RenderingContext, vao: WebGLVertexArrayObject): void {
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
}
