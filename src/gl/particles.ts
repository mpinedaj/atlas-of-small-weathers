import { createRandom } from '../core/seed';
import { PARTICLE_DUMMY_FRAGMENT, PARTICLE_UPDATE_VERTEX } from './shaders/common';
import { Program, createEmptyVao } from './glUtils';

const STATE_FLOATS = 8;
const STATE_STRIDE = STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT;

const TRANSFORM_FEEDBACK_VARYINGS = [
  'oPosition',
  'oVelocity',
  'oAge',
  'oLife',
  'oSeed',
  'oSize',
] as const;

export interface ParticleStep {
  readonly time: number;
  readonly dt: number;
  readonly velocityTexture: WebGLTexture;
  readonly windVector: readonly [number, number];
  readonly windSpeed: number;
  readonly tension: number;
  readonly warmth: number;
  readonly seed: number;
}

/**
 * A fixed pool of brush particles, advanced entirely on the GPU.
 *
 * Their state is interleaved in two buffers. Each frame the update shader reads
 * the current buffer and writes the next one through transform feedback; the
 * draw pass then reads that new buffer as instanced attributes. No particle
 * state ever crosses into JavaScript, which keeps the CPU free for the
 * occasional resize and the interface.
 */
export class ParticleSystem {
  private readonly gl: WebGL2RenderingContext;
  private readonly capacity: number;
  private readonly buffers: [WebGLBuffer, WebGLBuffer];
  private readonly updateVaos: [WebGLVertexArrayObject, WebGLVertexArrayObject];
  private readonly drawVaos: [WebGLVertexArrayObject, WebGLVertexArrayObject];
  private readonly cornerBuffer: WebGLBuffer;
  private readonly feedback: WebGLTransformFeedback;
  private readonly updateProgram: Program;
  private current = 0;
  private active: number;

  constructor(gl: WebGL2RenderingContext, capacity: number, seed: number) {
    this.gl = gl;
    this.capacity = Math.max(1, Math.floor(capacity));
    this.active = this.capacity;

    const initial = this.createInitialState(seed);
    const bufferA = this.createBuffer(initial);
    const bufferB = this.createBuffer(initial);
    this.buffers = [bufferA, bufferB];

    this.cornerBuffer = this.createCornerBuffer();
    this.updateVaos = [this.createUpdateVao(bufferA), this.createUpdateVao(bufferB)];
    this.drawVaos = [this.createDrawVao(bufferA), this.createDrawVao(bufferB)];

    const feedback = gl.createTransformFeedback();
    if (!feedback) throw new Error('Could not allocate transform feedback');
    this.feedback = feedback;

    this.updateProgram = Program.create(
      gl,
      PARTICLE_UPDATE_VERTEX,
      PARTICLE_DUMMY_FRAGMENT,
      'particles:update',
      TRANSFORM_FEEDBACK_VARYINGS,
    );
  }

  get particleCount(): number {
    return this.capacity;
  }

  get activeCount(): number {
    return this.active;
  }

  /**
   * Draw fewer brushes without reallocating their pool. Adaptive quality uses
   * this; the transform-feedback step still advances every particle so the
   * painting keeps its history when quality climbs again.
   */
  setActiveCount(count: number): void {
    this.active = Math.max(1, Math.min(this.capacity, Math.floor(count)));
  }

  step(options: ParticleStep): void {
    const gl = this.gl;
    this.updateProgram.use();
    this.updateProgram.float('uTime', options.time);
    this.updateProgram.float('uDt', options.dt);
    this.updateProgram.vec2('uWindVector', options.windVector[0], options.windVector[1]);
    this.updateProgram.float('uWindSpeed', options.windSpeed);
    this.updateProgram.float('uTension', options.tension);
    this.updateProgram.float('uWarmth', options.warmth);
    this.updateProgram.float('uSeed', options.seed);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, options.velocityTexture);
    this.updateProgram.int('uVelocity', 0);

    gl.bindVertexArray(this.updateVaos[this.current]!);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.feedback);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.buffers[1 - this.current]!);

    gl.enable(gl.RASTERIZER_DISCARD);
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, this.capacity);
    gl.endTransformFeedback();
    gl.disable(gl.RASTERIZER_DISCARD);

    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.current = 1 - this.current;
  }

  /** Bind the current instance buffer and draw every particle as one quad. */
  drawInstances(): void {
    const gl = this.gl;
    gl.bindVertexArray(this.drawVaos[this.current]!);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.active);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    this.updateProgram.dispose();
    gl.deleteTransformFeedback(this.feedback);
    for (const buffer of this.buffers) gl.deleteBuffer(buffer);
    gl.deleteBuffer(this.cornerBuffer);
    for (const vao of this.updateVaos) gl.deleteVertexArray(vao);
    for (const vao of this.drawVaos) gl.deleteVertexArray(vao);
  }

  private createBuffer(data: Float32Array): WebGLBuffer {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('Could not allocate a particle buffer');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return buffer;
  }

  private createInitialState(seed: number): Float32Array {
    const random = createRandom(seed ^ 0x9e3779b9);
    const data = new Float32Array(this.capacity * STATE_FLOATS);

    for (let i = 0; i < this.capacity; i += 1) {
      const life = random.range(6, 17);
      const offset = i * STATE_FLOATS;
      data[offset] = random.range(-1.05, 1.05);
      data[offset + 1] = random.range(-1.05, 1.05);
      data[offset + 2] = 0;
      data[offset + 3] = 0;
      data[offset + 4] = random() * life;
      data[offset + 5] = life;
      data[offset + 6] = random();
      data[offset + 7] = random.range(0.45, 1.35);
    }
    return data;
  }

  private createCornerBuffer(): WebGLBuffer {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('Could not allocate the brush corner buffer');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return buffer;
  }

  private bindStateAttributes(): void {
    const gl = this.gl;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, STATE_STRIDE, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STATE_STRIDE, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, STATE_STRIDE, 16);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, STATE_STRIDE, 20);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, STATE_STRIDE, 24);
    gl.enableVertexAttribArray(5);
    gl.vertexAttribPointer(5, 1, gl.FLOAT, false, STATE_STRIDE, 28);
  }

  private createUpdateVao(buffer: WebGLBuffer): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = createEmptyVao(gl);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    this.bindStateAttributes();
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);
    return vao;
  }

  private createDrawVao(buffer: WebGLBuffer): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = createEmptyVao(gl);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    this.bindStateAttributes();
    for (let location = 0; location <= 5; location += 1) {
      gl.vertexAttribDivisor(location, 1);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuffer);
    gl.enableVertexAttribArray(6);
    gl.vertexAttribPointer(6, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);
    return vao;
  }
}
