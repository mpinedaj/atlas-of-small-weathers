import type { ShareState } from './url';
import { canonicalShareUrl } from './url';

/**
 * The share action.
 *
 * What gets copied is deliberately smaller than the address bar: place, school,
 * seed and mode, with no offline sample or screenshot warm-up. A recipient
 * should open a live painting, not the test harness.
 */

export interface ShareButtonOptions {
  readonly getState: () => ShareState;
}

export interface ShareButton {
  readonly element: HTMLElement;
  destroy(): void;
}

const CONFIRMATION_MS = 2400;

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Older browsers and non-secure contexts still deserve a working button.
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.className = 'atlas__clipboard';
  document.body.append(field);
  field.select();

  const copied = document.execCommand('copy');
  field.remove();
  if (!copied) throw new Error('The clipboard refused the link.');
}

export function createShareButton(options: ShareButtonOptions): ShareButton {
  const wrapper = document.createElement('div');
  wrapper.className = 'atlas__share-wrap';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'atlas__share';
  button.textContent = 'Share';

  const status = document.createElement('span');
  status.className = 'visually-hidden';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  wrapper.append(button, status);

  let timer = 0;
  let busy = false;

  const settle = (message: string, label: string, state: 'copied' | 'error'): void => {
    if (timer) window.clearTimeout(timer);
    button.textContent = label;
    button.dataset.state = state;
    status.textContent = message;
    timer = window.setTimeout(() => {
      button.textContent = 'Share';
      button.dataset.state = 'idle';
      status.textContent = '';
      timer = 0;
    }, CONFIRMATION_MS);
  };

  button.addEventListener('click', () => {
    if (busy) return;
    busy = true;
    const url = canonicalShareUrl(window.location.href, options.getState());

    void copyText(url)
      .then(() => {
        settle(
          'Link copied. It opens the same place, school, seed and mode.',
          'Link copied',
          'copied',
        );
      })
      .catch(() => {
        settle(
          'The clipboard is unavailable. Copy the address bar to share this painting.',
          'Share',
          'error',
        );
      })
      .finally(() => {
        busy = false;
      });
  });

  return {
    element: wrapper,
    destroy(): void {
      if (timer) window.clearTimeout(timer);
    },
  };
}
