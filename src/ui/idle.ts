/**
 * The idle fade.
 *
 * The interface is a museum label: present when you look for it, absent while
 * you look at the painting. After a few quiet seconds the chrome fades; any
 * pointer, key, wheel or focus brings it back. It never fades while a panel is
 * open, while focus is inside it, or when reduced motion asks for stillness.
 */

export interface IdleOptions {
  readonly root: HTMLElement;
  readonly timeoutMs?: number;
  /** A panel is open, a scene is changing, or anything else that must stay visible. */
  readonly isBusy?: () => boolean;
  readonly reducedMotion?: boolean | MediaQueryList;
}

export interface IdleController {
  wake(): void;
  destroy(): void;
}

const DEFAULT_TIMEOUT_MS = 6000;

export function createIdle(options: IdleOptions): IdleController {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const root = options.root;

  const motion =
    typeof options.reducedMotion === 'boolean'
      ? null
      : (options.reducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)'));
  let reduced =
    typeof options.reducedMotion === 'boolean' ? options.reducedMotion : (motion?.matches ?? false);

  let timer = 0;
  let idle = false;

  const setIdle = (value: boolean): void => {
    if (idle === value) return;
    idle = value;
    root.dataset.idle = String(value);
  };

  const canIdle = (): boolean => {
    if (reduced) return false;
    if (options.isBusy?.()) return false;
    return !root.contains(document.activeElement);
  };

  const clear = (): void => {
    if (timer) window.clearTimeout(timer);
    timer = 0;
  };

  const schedule = (): void => {
    clear();
    if (!canIdle()) {
      setIdle(false);
      return;
    }
    timer = window.setTimeout(() => {
      timer = 0;
      if (canIdle()) setIdle(true);
    }, timeoutMs);
  };

  const wake = (): void => {
    setIdle(false);
    schedule();
  };

  const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

  for (const name of events) {
    document.addEventListener(name, wake, { passive: true });
  }

  const onFocusIn = (): void => {
    wake();
  };

  const onFocusOut = (): void => {
    // Let the browser move focus before deciding whether it stayed inside.
    window.setTimeout(schedule, 0);
  };

  const onMotionChange = (event: MediaQueryListEvent): void => {
    reduced = event.matches;
    wake();
  };

  const onVisibility = (): void => {
    if (document.hidden) clear();
    else schedule();
  };

  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('focusout', onFocusOut);
  document.addEventListener('visibilitychange', onVisibility);
  motion?.addEventListener('change', onMotionChange);

  root.dataset.idle = 'false';
  schedule();

  return {
    wake,
    destroy(): void {
      clear();
      for (const name of events) document.removeEventListener(name, wake);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('visibilitychange', onVisibility);
      motion?.removeEventListener('change', onMotionChange);
      setIdle(false);
    },
  };
}
