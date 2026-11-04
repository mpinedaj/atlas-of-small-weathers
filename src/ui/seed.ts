import { normaliseSeed } from '../core/seed';

/**
 * The seed stepper.
 *
 * A seed is a small number that changes the painting completely. The control is
 * deliberately quiet — a minus, the number, a plus — and every part is a real
 * button, so keyboard and switch access work without a custom gesture.
 */

export interface SeedStepperOptions {
  readonly seed: number;
  readonly onChange: (seed: number) => void;
}

export interface SeedStepper {
  readonly element: HTMLElement;
  setSeed(seed: number): void;
  setBusy(busy: boolean): void;
}

const MAX_SEED = 0xfffffffe;

/** One step, clamped to the positive range the renderer understands. */
export function stepSeed(seed: number, delta: number): number {
  const next = Math.trunc(normaliseSeed(seed)) + delta;
  if (!Number.isFinite(next) || next < 1) return 1;
  if (next > MAX_SEED) return 1;
  return next;
}

export function createSeedStepper(options: SeedStepperOptions): SeedStepper {
  const group = document.createElement('div');
  group.className = 'atlas__seed-control';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Seed');

  const label = document.createElement('span');
  label.className = 'atlas__seed-label';
  label.setAttribute('aria-hidden', 'true');
  label.textContent = 'seed';

  const previous = document.createElement('button');
  previous.type = 'button';
  previous.className = 'atlas__seed-step';
  previous.setAttribute('aria-label', 'Previous seed');
  previous.textContent = '−';

  const value = document.createElement('output');
  value.className = 'atlas__seed-value';
  value.setAttribute('aria-live', 'polite');
  value.setAttribute('aria-atomic', 'true');
  value.textContent = String(normaliseSeed(options.seed));

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'atlas__seed-step';
  next.setAttribute('aria-label', 'Next seed');
  next.textContent = '+';

  group.append(label, previous, value, next);

  let seed = normaliseSeed(options.seed);
  let busy = false;

  const setSeed = (nextSeed: number): void => {
    seed = normaliseSeed(nextSeed);
    value.textContent = String(seed);
  };

  const change = (delta: number, event: MouseEvent): void => {
    if (busy) return;
    const amount = delta * (event.shiftKey ? 10 : 1);
    const nextSeed = stepSeed(seed, amount);
    if (nextSeed === seed) return;
    setSeed(nextSeed);
    options.onChange(nextSeed);
  };

  previous.addEventListener('click', (event) => change(-1, event));
  next.addEventListener('click', (event) => change(1, event));

  return {
    element: group,
    setSeed,
    setBusy(isBusy: boolean): void {
      busy = isBusy;
      group.dataset.busy = String(isBusy);
      previous.setAttribute('aria-disabled', String(isBusy));
      next.setAttribute('aria-disabled', String(isBusy));
    },
  };
}
