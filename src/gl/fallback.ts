import { createRandom } from '../core/seed';
import { hexToRgb, luminance } from './color';
import type { Rgb } from './color';
import type { PaintingScene } from './scene';

/**
 * The painting without a GPU.
 *
 * Some machines cannot allocate a WebGL2 context with float render targets.
 * Rather than show a black square, we paint the same weather with the 2D canvas:
 * broad washes for cloud, long curved strokes for wind, vertical runs for rain,
 * paper grain and a vignette. It is simpler than the fluid, but it is still a
 * painting, and it obeys the same seed and palette.
 */

export interface PainterOptions {
  readonly reducedMotion?: boolean;
  readonly still?: boolean;
  readonly warmupFrames?: number;
  readonly onReady?: () => void;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function rgba(colour: Rgb, alpha: number): string {
  return `rgba(${Math.round(colour[0] * 255)}, ${Math.round(colour[1] * 255)}, ${Math.round(
    colour[2] * 255,
  )}, ${alpha})`;
}

export class CanvasPainter {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private scene: PaintingScene;
  private readonly options: PainterOptions;

  private base: HTMLCanvasElement;
  private pigment: HTMLCanvasElement;
  private pigmentContext: CanvasRenderingContext2D;
  private grain: HTMLCanvasElement;
  private random = createRandom(0);
  private strokes = 0;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private raf = 0;
  private lastTime = 0;

  constructor(canvas: HTMLCanvasElement, scene: PaintingScene, options: PainterOptions = {}) {
    this.canvas = canvas;
    this.scene = scene;
    this.options = options;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('The 2D canvas is unavailable.');
    this.ctx = context;

    this.base = document.createElement('canvas');
    this.pigment = document.createElement('canvas');
    const pigmentContext = this.pigment.getContext('2d');
    if (!pigmentContext) throw new Error('The 2D canvas is unavailable.');
    this.pigmentContext = pigmentContext;

    this.grain = this.createGrain();
    canvas.dataset.atlasMode = 'fallback';
    canvas.dataset.atlasReady = 'false';
    this.resize();
  }

  start(): void {
    if (this.options.still) {
      const frames = Math.max(60, Math.min(600, this.options.warmupFrames ?? 240));
      this.addStrokes(frames * 4);
      this.paint();
      this.markReady();
      return;
    }
    if (this.raf) return;
    this.lastTime = 0;
    this.raf = requestAnimationFrame(this.animate);
  }

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /**
   * Install a new scene without replacing the canvas: school, seed and weather
   * changes reuse the same 2D surface. Pigment is lifted, the palette is washed
   * again, and still mode paints one deterministic frame before reporting ready.
   */
  setScene(scene: PaintingScene): void {
    this.scene = scene;
    this.grain = this.createGrain();
    this.pigmentContext.clearRect(0, 0, this.width, this.height);
    this.random = createRandom(scene.seed);
    this.strokes = 0;
    this.renderBase();

    if (this.options.still) {
      const frames = Math.max(60, Math.min(600, this.options.warmupFrames ?? 240));
      this.addStrokes(frames * 4);
      this.paint();
      this.markReady();
      return;
    }

    this.paint();
  }

  dispose(): void {
    this.stop();
    this.canvas.removeAttribute('data-atlas-mode');
    this.canvas.removeAttribute('data-atlas-ready');
  }

  private readonly animate = (now: number): void => {
    const elapsed = this.lastTime === 0 ? 1 / 60 : (now - this.lastTime) / 1000;
    this.lastTime = now;
    const tempo = this.options.reducedMotion ? 0.34 : 1;
    const budget = Math.max(0, Math.min(0.05, elapsed)) * 60 * tempo;
    const count = Math.min(6, Math.max(1, Math.round(budget)));
    this.addStrokes(count);
    this.paint();
    this.raf = requestAnimationFrame(this.animate);
  };

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = rect.width || this.canvas.clientWidth || window.innerWidth;
    const cssHeight = rect.height || this.canvas.clientHeight || window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, Math.floor(cssWidth * this.dpr));
    this.height = Math.max(1, Math.floor(cssHeight * this.dpr));

    for (const surface of [this.canvas, this.base, this.pigment]) {
      surface.width = this.width;
      surface.height = this.height;
    }

    const priorStrokes = this.strokes;
    this.strokes = 0;
    this.random = createRandom(this.scene.seed);
    this.renderBase();
    this.addStrokes(Math.min(priorStrokes, 1200));
  }

  private paint(): void {
    const ctx = this.ctx;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.base, 0, 0);
    ctx.drawImage(this.pigment, 0, 0);

    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = ctx.createPattern(this.grain, 'repeat') ?? 'transparent';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    this.paintVignette(ctx);
  }

  private renderBase(): void {
    const { palette, gestures, condition } = this.scene;
    const ctx = this.base.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = palette.ground;
    ctx.fillRect(0, 0, this.width, this.height);

    const washy = palette.washes.map(hexToRgb);
    const top = washy[Math.min(1, washy.length - 1)] ?? hexToRgb(palette.ground);
    const bottom = washy[Math.min(3, washy.length - 1)] ?? hexToRgb(palette.shadow);

    const sky = ctx.createLinearGradient(0, 0, this.width * 0.25, this.height);
    sky.addColorStop(0, rgba(top, 0.82));
    sky.addColorStop(0.58, rgba(bottom, 0.5));
    sky.addColorStop(1, rgba(hexToRgb(palette.ground), 0.92));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.width, this.height);

    const random = createRandom(this.scene.seed ^ 0x51ed);
    const washCount = 3 + Math.round(gestures.cloudMass * 3);
    ctx.globalCompositeOperation = 'multiply';
    for (let i = 0; i < washCount; i += 1) {
      const x = random.range(0, this.width);
      const y = random.range(0, this.height * 0.78);
      const radius = random.range(this.width * 0.18, this.width * 0.55);
      const colour = washy[random.int(0, Math.max(0, washy.length - 1))] ?? top;
      const alpha = random.range(0.05, 0.16) + gestures.cloudMass * 0.06;
      const wash = ctx.createRadialGradient(x, y, 0, x, y, radius);
      wash.addColorStop(0, rgba(colour, alpha));
      wash.addColorStop(0.65, rgba(colour, alpha * 0.55));
      wash.addColorStop(1, rgba(colour, 0));
      ctx.fillStyle = wash;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (condition === 'rain' || condition === 'storm') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = rgba(hexToRgb(palette.shadow), 0.16 + gestures.rainGrain * 0.22);
      ctx.fillRect(0, this.height * 0.18, this.width, this.height * 0.82);
    }

    if (gestures.light > 0.25) {
      ctx.globalCompositeOperation = 'screen';
      const glowX = this.width * random.range(0.52, 0.78);
      const glowY = this.height * random.range(0.12, 0.32);
      const glowRadius = this.width * random.range(0.24, 0.4);
      const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowRadius);
      glow.addColorStop(0, rgba(hexToRgb(palette.highlight), 0.24 * gestures.light));
      glow.addColorStop(1, rgba(hexToRgb(palette.highlight), 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  private addStrokes(count: number): void {
    const ctx = this.pigmentContext;
    const { palette, gestures, condition } = this.scene;
    const washy = palette.washes.map(hexToRgb);
    const dark = hexToRgb(palette.shadow);
    const accent = hexToRgb(palette.accent);
    const scale = this.dpr;

    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < count; i += 1) {
      const x = this.random.range(-0.12, 1.12) * this.width;
      const y = this.random.range(0.04, 1.04) * this.height;
      const angle =
        Math.atan2(gestures.windVector[1], gestures.windVector[0]) +
        this.random.range(-0.5, 0.5) +
        Math.sin(y * 0.004 + this.strokes * 0.03) * (0.2 + gestures.tension * 0.5);
      const length =
        this.width * (0.04 + gestures.strokeLength * 0.2) * this.random.range(0.35, 1.1);
      const bend = length * this.random.range(-0.32, 0.32);
      const width = scale * this.random.range(1.2, 3.6 + gestures.tension * 5);

      const tone = this.strokeTone(washy, gestures.warmth);
      const alpha = this.random.range(0.015, 0.045) * (0.7 + gestures.humidityVeil * 0.5);

      ctx.strokeStyle = this.random.chance(0.08) ? rgba(accent, alpha * 1.6) : rgba(tone, alpha);
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        x + Math.cos(angle) * length * 0.5 + Math.cos(angle + Math.PI / 2) * bend,
        y + Math.sin(angle) * length * 0.5 + Math.sin(angle + Math.PI / 2) * bend,
        x + Math.cos(angle) * length,
        y + Math.sin(angle) * length,
      );
      ctx.stroke();

      if (condition === 'rain' || gestures.rainGrain > 0.35) {
        if (this.random.chance(0.12 + gestures.rainGrain * 0.3)) {
          const dripLength = length * this.random.range(0.4, 1.6);
          ctx.strokeStyle = rgba(dark, alpha * 0.9);
          ctx.lineWidth = Math.max(0.6, width * 0.28);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + this.random.range(-2, 2) * scale, y + dripLength);
          ctx.stroke();
        }
      }

      this.strokes += 1;
    }

    // Lift the oldest pigment now and then so the painting keeps breathing
    // instead of turning into mud.
    if (this.strokes > 420 && this.strokes % 90 < count) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0, 0, 0, ${0.03 + gestures.rainGrain * 0.04})`;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  private strokeTone(washes: readonly Rgb[], warmth: number): Rgb {
    const bias = clamp01(0.5 + warmth * 0.28);
    const index = Math.round(bias * (washes.length - 1));
    const low = washes[Math.max(0, index - 1)];
    const high = washes[Math.min(washes.length - 1, index)];
    if (!low || !high) return [0.2, 0.18, 0.16];
    return luminance(low) > luminance(high) ? high : low;
  }

  private paintVignette(ctx: CanvasRenderingContext2D): void {
    const vignette = ctx.createRadialGradient(
      this.width * 0.5,
      this.height * 0.5,
      Math.min(this.width, this.height) * 0.2,
      this.width * 0.5,
      this.height * 0.5,
      Math.max(this.width, this.height) * 0.72,
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(24, 20, 16, 0.34)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  private createGrain(): HTMLCanvasElement {
    const size = 128;
    const surface = document.createElement('canvas');
    surface.width = size;
    surface.height = size;
    const ctx = surface.getContext('2d');
    if (!ctx) return surface;
    const image = ctx.createImageData(size, size);
    const random = createRandom(this.scene.seed ^ 0x9e37);
    for (let i = 0; i < image.data.length; i += 4) {
      const value = 108 + Math.floor(random() * 56);
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    return surface;
  }

  private markReady(): void {
    this.canvas.dataset.atlasReady = 'true';
    this.options.onReady?.();
    this.canvas.dispatchEvent(new CustomEvent('atlas:ready'));
  }
}
