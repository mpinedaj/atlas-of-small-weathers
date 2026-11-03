import type { Condition } from '../core/types';
import { FluidSimulation } from './fluid';
import { hexToRgb } from './color';
import {
  Program,
  ShaderError,
  bindTarget,
  createEmptyVao,
  createTarget,
  deleteTarget,
  drawFullscreen,
} from './glUtils';
import type { RenderTarget } from './glUtils';
import { ParticleSystem } from './particles';
import type { PaintingScene } from './scene';
import {
  BRUSH_VERTEX,
  FULLSCREEN_VERTEX,
  SPLAT_FRAGMENT,
  SPLAT_VERTEX,
  buildFragment,
} from './shaders/common';
import type { ShaderSlot } from './shaders/common';
import { DEFAULT_SHADERS } from './shaders/defaults';

/**
 * The painting engine.
 *
 * One canvas, one fluid field, one pool of brush particles and four school
 * fragment shaders. The renderer is deliberately unaware of weather, cities and
 * schools-as-plugins: it receives a resolved `PaintingScene` and paints it.
 *
 * There are two ways to run it. Live mode requests a frame as fast as the
 * display allows and advances the simulation by real elapsed time. Still mode
 * runs a fixed number of warm-up frames at 1/60 s and then draws once, which is
 * what screenshots and visual tests use: same weather, same seed, same pixels.
 */

export type QualityTier = 'high' | 'medium' | 'low';

export interface RenderStats {
  readonly fps: number;
  readonly frame: number;
  readonly particles: number;
  readonly quality: QualityTier;
  /** Backing-store scale after adaptive quality, 0.6–1. */
  readonly renderScale: number;
  readonly width: number;
  readonly height: number;
  /** Slots that fell back to the house shader. */
  readonly degraded: readonly ShaderSlot[];
}

export interface RendererOptions {
  /** Fixed tier, or `auto` to adapt to the measured frame rate. Default `auto`. */
  readonly quality?: QualityTier | 'auto';
  /** Slow the painting rather than stop it. */
  readonly reducedMotion?: boolean;
  /** Run a fixed warm-up and draw a single frame. */
  readonly still?: boolean;
  /** Warm-up length in still mode. */
  readonly warmupFrames?: number;
  readonly onReady?: (stats: RenderStats) => void;
  readonly onStats?: (stats: RenderStats) => void;
  readonly onContextLost?: (reason: string) => void;
}

export class WebGLUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebGLUnavailableError';
  }
}

interface QualityProfile {
  readonly particles: number;
  readonly simScale: number;
  readonly pressure: number;
}

const PROFILES: Readonly<Record<QualityTier, QualityProfile>> = {
  high: { particles: 3400, simScale: 0.34, pressure: 20 },
  medium: { particles: 2200, simScale: 0.29, pressure: 16 },
  low: { particles: 1100, simScale: 0.23, pressure: 12 },
};

const CONDITION_VALUE: Readonly<Record<Condition, number>> = {
  clear: 0,
  cloudy: 0.2,
  fog: 0.4,
  rain: 0.62,
  snow: 0.82,
  storm: 1,
};

const MIN_SCALE = 0.62;
const MAX_WARMUP = 900;

function defaultTier(): QualityTier {
  if (typeof window === 'undefined') return 'medium';
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const small = window.innerWidth < 760;
  if (coarse || small) return 'medium';
  return 'high';
}

export class AtlasRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly options: RendererOptions;
  private readonly vao: WebGLVertexArrayObject;
  private readonly baseTier: QualityTier;
  private readonly baseParticles: number;
  private readonly adaptiveQuality: boolean;

  private scene: PaintingScene;
  private programs: {
    field: Program;
    flow: Program;
    brush: Program;
    post: Program;
    splat: Program;
  };
  private degraded: ShaderSlot[] = [];

  private fluid!: FluidSimulation;
  private particles: ParticleSystem;
  private fieldTarget: RenderTarget | null = null;

  private renderWidth = 1;
  private renderHeight = 1;
  private adaptiveScale = 1;
  private frame = 0;
  private time = 0;
  private fps = 60;
  private lastFrameTime = 0;
  private lastStatsAt = 0;
  private raf = 0;
  private stopped = true;
  private ready = false;
  private disposed = false;

  private warmupTotal = 0;
  private warmupRemaining = 0;

  constructor(canvas: HTMLCanvasElement, scene: PaintingScene, options: RendererOptions = {}) {
    this.canvas = canvas;
    this.scene = scene;
    this.options = options;

    const contextAttributes: WebGLContextAttributes = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: options.still === true,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false,
    };
    const gl = canvas.getContext('webgl2', contextAttributes);
    if (!gl) {
      throw new WebGLUnavailableError('WebGL2 is not available in this browser.');
    }
    if (!gl.getExtension('EXT_color_buffer_float')) {
      throw new WebGLUnavailableError('WebGL2 float render targets are not supported.');
    }
    gl.getExtension('OES_texture_float_linear');
    this.gl = gl;

    const requested = options.quality ?? 'auto';
    this.adaptiveQuality = requested === 'auto';
    this.baseTier = requested === 'auto' ? defaultTier() : requested;
    this.baseParticles = PROFILES[this.baseTier].particles;

    this.measureCanvas();
    this.vao = createEmptyVao(gl);
    this.programs = this.buildPrograms(scene);

    this.fluid = new FluidSimulation(gl, this.renderWidth, this.renderHeight, {
      simScale: PROFILES[this.baseTier].simScale,
      pressureIterations: PROFILES[this.baseTier].pressure,
    });
    this.fieldTarget = createTarget(gl, this.renderWidth, this.renderHeight, 'rgba16f', 'linear');
    this.particles = new ParticleSystem(gl, this.baseParticles, scene.seed);

    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.dataset.atlasReady = 'false';
    canvas.dataset.atlasMode = 'webgl';
  }

  get stats(): RenderStats {
    return {
      fps: Math.round(this.fps),
      frame: this.frame,
      particles: this.particles.activeCount,
      quality: this.baseTier,
      renderScale: Number(this.adaptiveScale.toFixed(2)),
      width: this.renderWidth,
      height: this.renderHeight,
      degraded: [...this.degraded],
    };
  }

  get isReady(): boolean {
    return this.ready;
  }

  /**
   * Swap schools without touching the canvas element. Programs are rebuilt and
   * the pigment is cleared; the palette, seed and weather are taken from the new
   * scene. A school whose shaders cannot compile degrades slot by slot.
   */
  setScene(scene: PaintingScene): void {
    if (this.disposed) return;
    const gl = this.gl;
    this.disposePrograms();
    this.scene = scene;
    this.degraded = [];
    this.programs = this.buildPrograms(scene);
    this.particles.dispose();
    this.particles = new ParticleSystem(gl, this.baseParticles, scene.seed);
    this.particles.setActiveCount(
      Math.max(1, Math.round(this.baseParticles * (0.7 + this.adaptiveScale * 0.3))),
    );
    this.fluid.setPressureIterations(PROFILES[this.baseTier].pressure);
    this.fluid.clear();
    this.frame = 0;
    this.time = 0;
    this.ready = false;
    this.canvas.dataset.atlasReady = 'false';

    // Still mode stops itself once the warm-up is painted. Swapping the scene
    // has to start a fresh, equally deterministic warm-up, or the new school
    // would appear as an empty canvas.
    if (this.options.still && this.stopped) {
      this.stopped = false;
      this.startStill();
    }
  }

  start(): void {
    if (this.disposed || !this.stopped) return;
    this.stopped = false;
    if (this.options.still) {
      this.startStill();
      return;
    }
    this.lastFrameTime = 0;
    this.raf = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.stopped = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.disposePrograms();
    this.particles.dispose();
    this.fluid.dispose();
    if (this.fieldTarget) deleteTarget(this.gl, this.fieldTarget);
    this.fieldTarget = null;
    this.gl.deleteVertexArray(this.vao);
  }

  private readonly loop = (now: number): void => {
    if (this.stopped) return;
    const elapsed = this.lastFrameTime === 0 ? 1 / 60 : (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;

    const realDt = Math.max(0, Math.min(0.05, elapsed));
    const tempo = this.options.reducedMotion ? 0.34 : 1;
    this.time += realDt * tempo;
    this.fps = this.fps * 0.92 + (1 / Math.max(realDt, 0.001)) * 0.08;

    this.adaptQuality();
    this.renderFrame(realDt * tempo, this.time);

    if (!this.ready) this.markReady();
    this.emitStats(now);
    this.raf = requestAnimationFrame(this.loop);
  };

  private startStill(): void {
    const requested = this.options.warmupFrames ?? 240;
    this.warmupTotal = Math.max(0, Math.min(MAX_WARMUP, Math.floor(requested)));
    this.warmupRemaining = this.warmupTotal;

    // Headless browsers sometimes throttle animation frames. If the page is
    // hidden we finish the warm-up immediately rather than waiting forever.
    if (typeof document !== 'undefined' && document.hidden) {
      this.finishStill();
      return;
    }
    this.raf = requestAnimationFrame(this.stillTick);
  }

  private readonly stillTick = (): void => {
    if (this.stopped) return;
    const perTick = 6;
    for (let i = 0; i < perTick && this.warmupRemaining > 0; i += 1) {
      this.time += 1 / 60;
      this.stepSimulation(1 / 60, this.time);
      this.warmupRemaining -= 1;
      this.frame += 1;
    }

    if (this.warmupRemaining > 0) {
      this.raf = requestAnimationFrame(this.stillTick);
      return;
    }
    this.finishStill();
  };

  private finishStill(): void {
    while (this.warmupRemaining > 0) {
      this.time += 1 / 60;
      this.stepSimulation(1 / 60, this.time);
      this.warmupRemaining -= 1;
      this.frame += 1;
    }
    this.measureCanvas();
    this.composite(this.time);
    this.markReady();
    this.stopped = true;
  }

  private renderFrame(dt: number, time: number): void {
    this.measureCanvas();
    this.stepSimulation(dt, time);
    this.composite(time);
    this.frame += 1;
  }

  private stepSimulation(dt: number, time: number): void {
    const gl = this.gl;
    const size = this.fluid.size;
    const scene = this.scene;
    const gestures = scene.gestures;

    this.particles.step({
      time,
      dt,
      velocityTexture: this.fluid.velocityTexture,
      windVector: gestures.windVector,
      windSpeed: gestures.windSpeed,
      tension: gestures.tension,
      warmth: gestures.warmth,
      seed: scene.seed,
    });

    this.fluid.advectVelocity(dt);

    // The school's flow pass turns weather into force. It reads the advected
    // field and the pigment, and writes the field that will carry this frame.
    this.fluid.bindVelocityWrite();
    gl.disable(gl.BLEND);
    this.programs.flow.use();
    this.applyUniforms(this.programs.flow, time, size.width, size.height);
    const [texelX, texelY] = this.fluid.texel;
    this.programs.flow.vec2('uTexel', texelX, texelY);
    this.bindTexture(0, this.fluid.velocityTexture);
    this.bindTexture(1, this.fluid.dyeTexture);
    this.programs.flow.int('uVelocity', 0);
    this.programs.flow.int('uDye', 1);
    drawFullscreen(gl, this.vao);
    this.fluid.commitVelocity();

    // Particles add their own local turbulence, then the field is projected.
    this.fluid.bindVelocityWrite();
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    this.programs.splat.use();
    this.applyUniforms(this.programs.splat, time, size.width, size.height);
    this.particles.drawInstances();
    gl.disable(gl.BLEND);
    this.fluid.commitVelocity();

    this.fluid.project();
    this.fluid.advectDye(dt);

    // Brushes are pigment, not force: additive, premultiplied, into the dye buffer.
    this.fluid.bindDyeWrite();
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    this.programs.brush.use();
    this.applyUniforms(this.programs.brush, time, size.width, size.height);
    this.programs.brush.float('uBrushScale', 1 + (1 - this.adaptiveScale) * 0.3);
    this.particles.drawInstances();
    gl.disable(gl.BLEND);
    this.fluid.commitDye();

    this.bindTexture(0, null);
    this.bindTexture(1, null);
  }

  private composite(time: number): void {
    const gl = this.gl;
    const width = this.renderWidth;
    const height = this.renderHeight;
    const fieldTarget = this.fieldTarget;
    if (!fieldTarget) return;

    bindTarget(gl, fieldTarget, width, height);
    gl.disable(gl.BLEND);
    this.programs.field.use();
    this.applyUniforms(this.programs.field, time, width, height);
    drawFullscreen(gl, this.vao);

    bindTarget(gl, null, width, height);
    gl.disable(gl.BLEND);
    this.programs.post.use();
    this.applyUniforms(this.programs.post, time, width, height);
    this.bindTexture(0, fieldTarget.texture);
    this.bindTexture(1, this.fluid.dyeTexture);
    this.programs.post.int('uField', 0);
    this.programs.post.int('uDye', 1);
    drawFullscreen(gl, this.vao);
    this.bindTexture(0, null);
    this.bindTexture(1, null);
  }

  private applyUniforms(program: Program, time: number, width: number, height: number): void {
    const { palette, gestures, seed } = this.scene;
    const washCount = Math.max(1, palette.washes.length);

    program.float('uTime', time);
    program.vec2('uResolution', width, height);
    program.float('uSeed', seed % 4096);
    program.float('uCondition', CONDITION_VALUE[this.scene.condition]);

    program.color('uGround', hexToRgb(palette.ground));
    program.color('uInk', hexToRgb(palette.ink));
    program.color('uAccent', hexToRgb(palette.accent));
    program.color('uHighlight', hexToRgb(palette.highlight));
    program.color('uShadow', hexToRgb(palette.shadow));
    for (let i = 0; i < 6; i += 1) {
      const hex = palette.washes[Math.min(i, washCount - 1)] ?? palette.ground;
      program.color(`uWash${i}`, hexToRgb(hex));
    }

    program.float('uWarmth', gestures.warmth);
    program.float('uWindSpeed', gestures.windSpeed);
    program.vec2('uWindVector', gestures.windVector[0], gestures.windVector[1]);
    program.float('uTension', gestures.tension);
    program.float('uHumidity', gestures.humidityVeil);
    program.float('uCloud', gestures.cloudMass);
    program.float('uPressure', gestures.pressureWeight);
    program.float('uRain', gestures.rainGrain);
    program.float('uLight', gestures.light);
    program.float('uStrokeLength', gestures.strokeLength);
  }

  private bindTexture(unit: number, texture: WebGLTexture | null): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
  }

  private measureCanvas(): void {
    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = rect.width || this.canvas.clientWidth || 1;
    const cssHeight = rect.height || this.canvas.clientHeight || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(cssWidth * dpr * this.adaptiveScale));
    const height = Math.max(1, Math.floor(cssHeight * dpr * this.adaptiveScale));
    if (width === this.renderWidth && height === this.renderHeight && this.fieldTarget) return;

    this.renderWidth = width;
    this.renderHeight = height;
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;

    if (this.fluid) this.fluid.resize(width, height);
    if (this.fieldTarget) {
      deleteTarget(this.gl, this.fieldTarget);
      this.fieldTarget = null;
    }
    this.fieldTarget = createTarget(this.gl, width, height, 'rgba16f', 'linear');
  }

  private adaptQuality(): void {
    if (!this.adaptiveQuality || this.frame < 90 || this.frame % 90 !== 0) return;

    if (this.fps < 45 && this.adaptiveScale > MIN_SCALE) {
      this.adaptiveScale = Math.max(MIN_SCALE, this.adaptiveScale - 0.1);
      this.measureCanvas();
    } else if (this.fps > 57 && this.adaptiveScale < 1) {
      this.adaptiveScale = Math.min(1, this.adaptiveScale + 0.05);
      this.measureCanvas();
    }

    this.particles.setActiveCount(
      Math.max(1, Math.round(this.baseParticles * (0.7 + this.adaptiveScale * 0.3))),
    );
  }

  private emitStats(now: number): void {
    if (!this.options.onStats || now - this.lastStatsAt < 500) return;
    this.lastStatsAt = now;
    this.options.onStats(this.stats);
  }

  private markReady(): void {
    if (this.ready) return;
    this.ready = true;
    this.canvas.dataset.atlasReady = 'true';
    const stats = this.stats;
    this.options.onReady?.(stats);
    this.canvas.dispatchEvent(new CustomEvent<RenderStats>('atlas:ready', { detail: stats }));
  }

  private buildPrograms(scene: PaintingScene): AtlasRenderer['programs'] {
    const build = (slot: ShaderSlot, vertex: string): Program => {
      const body = scene.shaders[slot];
      try {
        return Program.create(
          this.gl,
          vertex,
          buildFragment(slot, body),
          `${scene.schoolId}:${slot}`,
        );
      } catch (error) {
        if (!(error instanceof ShaderError)) throw error;
        this.degraded.push(slot);
        return Program.create(
          this.gl,
          vertex,
          buildFragment(slot, DEFAULT_SHADERS[slot]),
          `house:${slot}`,
        );
      }
    };

    return {
      field: build('field', FULLSCREEN_VERTEX),
      flow: build('flow', FULLSCREEN_VERTEX),
      brush: build('brush', BRUSH_VERTEX),
      post: build('post', FULLSCREEN_VERTEX),
      splat: Program.create(this.gl, SPLAT_VERTEX, SPLAT_FRAGMENT, 'particles:splat'),
    };
  }

  private disposePrograms(): void {
    this.programs.field.dispose();
    this.programs.flow.dispose();
    this.programs.brush.dispose();
    this.programs.post.dispose();
    this.programs.splat.dispose();
  }

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.stop();
    this.options.onContextLost?.('WebGL context lost.');
  };
}
