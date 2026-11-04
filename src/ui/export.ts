export interface ExportState {
  readonly city: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly seed: number;
  readonly school: string;
}

export interface ExportButtonOptions {
  readonly getCanvas: () => HTMLCanvasElement | null;
  readonly getState: () => ExportState;
}

export function createExportButton(options: ExportButtonOptions): { element: HTMLButtonElement } {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'atlas__share';
  button.textContent = 'Export';
  button.addEventListener('click', () => {
    const canvas = options.getCanvas();
    if (!canvas) return;
    const state = options.getState();
    const scale = 2;
    const padding = 64 * scale;
    const textBlock = 120 * scale;
    const width = canvas.width * scale + padding * 2;
    const height = canvas.height * scale + padding * 2 + textBlock;
    const poster = document.createElement('canvas');
    poster.width = width;
    poster.height = height;
    const context = poster.getContext('2d');
    if (!context) return;

    context.fillStyle = '#efe7d9';
    context.fillRect(0, 0, width, height);
    context.drawImage(canvas, padding, padding, canvas.width * scale, canvas.height * scale);

    context.fillStyle = '#1b1813';
    context.font = `${24 * scale}px Georgia, serif`;
    context.textAlign = 'left';
    const baseY = canvas.height * scale + padding * 2;
    context.fillText(state.city, padding, baseY);
    context.font = `${14 * scale}px sans-serif`;
    context.fillText(
      `${state.latitude.toFixed(4)}, ${state.longitude.toFixed(4)}  ·  seed ${state.seed}  ·  ${state.school}`,
      padding,
      baseY + 28 * scale,
    );
    context.fillText(new Date().toISOString().slice(0, 10), padding, baseY + 52 * scale);

    poster.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${state.city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${state.seed}.png`;
      link.click();
      URL.revokeObjectURL(url);
    });
  });
  return { element: button };
}
