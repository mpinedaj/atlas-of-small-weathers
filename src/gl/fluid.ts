import {
  PingPong,
  Program,
  bindTarget,
  createEmptyVao,
  createTarget,
  deleteTarget,
  drawFullscreen,
} from './glUtils';
import type { RenderTarget } from './glUtils';
import {
  ADVECT_DYE_FRAGMENT,
  ADVECT_VELOCITY_FRAGMENT,
  DIVERGENCE_FRAGMENT,
  FLUID_VERTEX,
  GRADIENT_FRAGMENT,
  PRESSURE_FRAGMENT,
} from './shaders/passes';

/**
 * A small, stable Navier–Stokes solver.
 *
 * The fluid never tries to be a game engine. It exists for one job: to make
 * wind visible as something that keeps moving after the weather arrives. Each
 * frame we advect the velocity field, add force, project it back to
 * divergence-free, then carry pigment along it. Pressure is solved with the
 * usual Jacobi iteration; at these resolutions twenty passes are plenty, and
 * the cost stays predictable.
 *
 * Everything is stored at a fraction of the canvas size. The painting can look
 * large while the maths stays soft and cheap — which is also closer to how wet
 * pigment behaves.
 */

export interface FluidOptions {
  /** Simulation resolution as a fraction of the canvas, 0.15–0.5. */
  readonly simScale?: number;
  /** Jacobi iterations for pressure. */
  readonly pressureIterations?: number;
  /** Per-second velocity decay, close to 1. */
  readonly velocityDissipation?: number;
  /** Per-second dye decay, close to 1. */
  readonly dyeDissipation?: number;
  /** How readily dye diffuses, 0–0.5. */
  readonly dyeDiffusion?: number;
}

interface ResolvedOptions {
  simScale: number;
  pressureIterations: number;
  velocityDissipation: number;
  dyeDissipation: number;
  dyeDiffusion: number;
}

const DEFAULTS: ResolvedOptions = {
  simScale: 0.32,
  pressureIterations: 18,
  velocityDissipation: 0.994,
  dyeDissipation: 0.992,
  dyeDiffusion: 0.06,
};

/** Keep the long edge near 480 cells: soft enough for pigment, cheap enough for phones. */
const MAX_LONG_EDGE = 448;
const MIN_EDGE = 64;

export interface FluidSize {
  readonly width: number;
  readonly height: number;
}

export function simulationSize(
  renderWidth: number,
  renderHeight: number,
  simScale = DEFAULTS.simScale,
): FluidSize {
  const scale = Math.max(0.1, Math.min(0.6, simScale));
  const longEdge = Math.max(renderWidth, renderHeight) * scale;
  const fit = longEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / longEdge : 1;
  return {
    width: Math.max(MIN_EDGE, Math.round(renderWidth * scale * fit)),
    height: Math.max(MIN_EDGE, Math.round(renderHeight * scale * fit)),
  };
}

export class FluidSimulation {
  private readonly gl: WebGL2RenderingContext;
  private readonly options: ResolvedOptions;
  private readonly vao: WebGLVertexArrayObject;

  private readonly advectVelocityProgram: Program;
  private readonly divergenceProgram: Program;
  private readonly pressureProgram: Program;
  private readonly gradientProgram: Program;
  private readonly advectDyeProgram: Program;

  private velocityField: PingPong;
  private dyeField: PingPong;
  private pressureField: PingPong;
  private divergenceTarget: RenderTarget;

  private simWidth: number;
  private simHeight: number;

  constructor(
    gl: WebGL2RenderingContext,
    width: number,
    height: number,
    options: FluidOptions = {},
  ) {
    this.gl = gl;
    this.options = {
      ...DEFAULTS,
      ...Object.fromEntries(
        Object.entries(options).filter(([, value]) => typeof value === 'number'),
      ),
    };

    const size = simulationSize(width, height, this.options.simScale);
    this.simWidth = size.width;
    this.simHeight = size.height;

    this.vao = createEmptyVao(gl);
    this.advectVelocityProgram = Program.create(
      gl,
      FLUID_VERTEX,
      ADVECT_VELOCITY_FRAGMENT,
      'fluid:advect-velocity',
    );
    this.divergenceProgram = Program.create(
      gl,
      FLUID_VERTEX,
      DIVERGENCE_FRAGMENT,
      'fluid:divergence',
    );
    this.pressureProgram = Program.create(gl, FLUID_VERTEX, PRESSURE_FRAGMENT, 'fluid:pressure');
    this.gradientProgram = Program.create(gl, FLUID_VERTEX, GRADIENT_FRAGMENT, 'fluid:gradient');
    this.advectDyeProgram = Program.create(
      gl,
      FLUID_VERTEX,
      ADVECT_DYE_FRAGMENT,
      'fluid:advect-dye',
    );

    this.velocityField = new PingPong(gl, this.simWidth, this.simHeight, 'rg16f', 'linear');
    this.dyeField = new PingPong(gl, this.simWidth, this.simHeight, 'rgba16f', 'linear');
    this.pressureField = new PingPong(gl, this.simWidth, this.simHeight, 'r16f', 'nearest');
    this.divergenceTarget = createTarget(gl, this.simWidth, this.simHeight, 'r16f', 'nearest');

    this.clear();
  }

  get size(): FluidSize {
    return { width: this.simWidth, height: this.simHeight };
  }

  get texel(): readonly [number, number] {
    return [1 / this.simWidth, 1 / this.simHeight];
  }

  /** Divergence-free velocity, ready to sample from a vertex shader. */
  get velocityTexture(): WebGLTexture {
    return this.velocityField.read.texture;
  }

  /** Pigment: premultiplied colour in RGB, coverage in A. */
  get dyeTexture(): WebGLTexture {
    return this.dyeField.read.texture;
  }

  get pressureIterations(): number {
    return this.options.pressureIterations;
  }

  setPressureIterations(count: number): void {
    this.options.pressureIterations = Math.max(4, Math.min(48, Math.floor(count)));
  }

  /** Rebuild every target at a new canvas size. The old painting is discarded. */
  resize(renderWidth: number, renderHeight: number): void {
    const size = simulationSize(renderWidth, renderHeight, this.options.simScale);
    if (size.width === this.simWidth && size.height === this.simHeight) return;

    this.disposeTargets();
    this.simWidth = size.width;
    this.simHeight = size.height;
    this.velocityField = new PingPong(this.gl, this.simWidth, this.simHeight, 'rg16f', 'linear');
    this.dyeField = new PingPong(this.gl, this.simWidth, this.simHeight, 'rgba16f', 'linear');
    this.pressureField = new PingPong(this.gl, this.simWidth, this.simHeight, 'r16f', 'nearest');
    this.divergenceTarget = createTarget(this.gl, this.simWidth, this.simHeight, 'r16f', 'nearest');
    this.clear();
  }

  /** Forget the painting but keep the allocation. */
  clear(): void {
    this.velocityField.clear(0, 0, 0, 1);
    this.dyeField.clear(0, 0, 0, 0);
    this.pressureField.clear(0, 0, 0, 1);
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.divergenceTarget.framebuffer);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Semi-Lagrangian advection of velocity. The dt is already tempo-scaled by the
   * renderer, so reduced motion needs no special case here.
   */
  advectVelocity(dt: number): void {
    const gl = this.gl;
    bindTarget(gl, this.velocityField.write, this.simWidth, this.simHeight);
    gl.disable(gl.BLEND);
    this.advectVelocityProgram.use();
    this.advectVelocityProgram.float('uDt', dt);
    this.advectVelocityProgram.float(
      'uDissipation',
      Math.pow(this.options.velocityDissipation, dt * 60),
    );
    this.bindTexture(0, this.velocityField.read.texture);
    this.advectVelocityProgram.int('uVelocity', 0);
    drawFullscreen(gl, this.vao);
    this.velocityField.swap();
  }

  bindVelocityWrite(): void {
    bindTarget(this.gl, this.velocityField.write, this.simWidth, this.simHeight);
  }

  commitVelocity(): void {
    this.velocityField.swap();
  }

  bindDyeWrite(): void {
    bindTarget(this.gl, this.dyeField.write, this.simWidth, this.simHeight);
  }

  commitDye(): void {
    this.dyeField.swap();
  }

  /** Add force from brush particles. Call between bindVelocityWrite and commit. */
  /** Divergence, Jacobi pressure solve, then subtract the gradient. */
  project(): void {
    const gl = this.gl;
    const [texelX, texelY] = this.texel;

    bindTarget(gl, this.divergenceTarget, this.simWidth, this.simHeight);
    gl.disable(gl.BLEND);
    this.divergenceProgram.use();
    this.divergenceProgram.vec2('uTexel', texelX, texelY);
    this.bindTexture(0, this.velocityField.read.texture);
    this.divergenceProgram.int('uVelocity', 0);
    drawFullscreen(gl, this.vao);

    this.pressureProgram.use();
    this.pressureProgram.vec2('uTexel', texelX, texelY);
    this.pressureProgram.int('uPressure', 0);
    this.pressureProgram.int('uDivergence', 1);
    for (let i = 0; i < this.options.pressureIterations; i += 1) {
      bindTarget(gl, this.pressureField.write, this.simWidth, this.simHeight);
      this.bindTexture(0, this.pressureField.read.texture);
      this.bindTexture(1, this.divergenceTarget.texture);
      drawFullscreen(gl, this.vao);
      this.pressureField.swap();
    }

    bindTarget(gl, this.velocityField.write, this.simWidth, this.simHeight);
    this.gradientProgram.use();
    this.gradientProgram.vec2('uTexel', texelX, texelY);
    this.gradientProgram.int('uVelocity', 0);
    this.gradientProgram.int('uPressure', 1);
    this.bindTexture(0, this.velocityField.read.texture);
    this.bindTexture(1, this.pressureField.read.texture);
    drawFullscreen(gl, this.vao);
    this.velocityField.swap();

    this.bindTexture(0, null);
    this.bindTexture(1, null);
  }

  advectDye(dt: number): void {
    const gl = this.gl;
    const [texelX, texelY] = this.texel;
    bindTarget(gl, this.dyeField.write, this.simWidth, this.simHeight);
    gl.disable(gl.BLEND);
    this.advectDyeProgram.use();
    this.advectDyeProgram.float('uDt', dt);
    this.advectDyeProgram.float('uDissipation', Math.pow(this.options.dyeDissipation, dt * 60));
    this.advectDyeProgram.float('uDiffusion', this.options.dyeDiffusion);
    this.advectDyeProgram.vec2('uTexel', texelX, texelY);
    this.advectDyeProgram.int('uDye', 0);
    this.advectDyeProgram.int('uVelocity', 1);
    this.bindTexture(0, this.dyeField.read.texture);
    this.bindTexture(1, this.velocityField.read.texture);
    drawFullscreen(gl, this.vao);
    this.dyeField.swap();
    this.bindTexture(0, null);
    this.bindTexture(1, null);
  }

  private bindTexture(unit: number, texture: WebGLTexture | null): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
  }

  dispose(): void {
    this.advectVelocityProgram.dispose();
    this.divergenceProgram.dispose();
    this.pressureProgram.dispose();
    this.gradientProgram.dispose();
    this.advectDyeProgram.dispose();
    this.gl.deleteVertexArray(this.vao);
    this.disposeTargets();
  }

  private disposeTargets(): void {
    this.velocityField.dispose();
    this.dyeField.dispose();
    this.pressureField.dispose();
    deleteTarget(this.gl, this.divergenceTarget);
  }
}
