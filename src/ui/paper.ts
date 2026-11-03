/**
 * The paper veil.
 *
 * A school change is a change of hand, not a page navigation. Rather than cut
 * between two paintings, the stage fades through bare paper, the new scene is
 * installed while nothing is visible, and the paper lifts again.
 *
 * Reduced motion does not remove the veil; it shortens it to a quick breath.
 */

const DEFAULT_DURATION = 900;
const REDUCED_DURATION = 180;
const FALLBACK_SLACK = 80;

function waitForOpacity(element: HTMLElement, timeout: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      element.removeEventListener('transitionend', onEnd);
      window.clearTimeout(timer);
      resolve();
    };
    const onEnd = (event: TransitionEvent): void => {
      if (event.target === element && event.propertyName === 'opacity') finish();
    };
    const timer = window.setTimeout(finish, timeout);
    element.addEventListener('transitionend', onEnd);
  });
}

/**
 * Fade to paper, run `swap` at the peak, then fade back. Returns when the veil
 * has lifted, so callers can re-enable controls at the right moment.
 */
export async function crossfadeThroughPaper(
  veil: HTMLElement,
  swap: () => void,
  reducedMotion: boolean,
): Promise<void> {
  const duration = reducedMotion ? REDUCED_DURATION : DEFAULT_DURATION;
  veil.style.setProperty('--veil-duration', `${duration}ms`);

  veil.dataset.phase = 'in';
  await waitForOpacity(veil, duration + FALLBACK_SLACK);

  swap();

  // One frame with the new scene hidden lets the browser prepare the first
  // frame before the paper starts lifting.
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  veil.dataset.phase = 'out';
  await waitForOpacity(veil, duration + FALLBACK_SLACK);
}
