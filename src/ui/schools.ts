import type { SchoolPlugin } from '../schools/registry';

/**
 * The school selector.
 *
 * Three names, no menu, no icon. It reads as a museum label that happens to be
 * clickable. Every button is a real button, so Tab, Enter and Space work without
 * a keyboard shim; arrow keys move between names for people who expect a group
 * to behave like one.
 */

export interface SchoolSelectorOptions {
  readonly schools: readonly SchoolPlugin[];
  readonly activeId: string;
  readonly onChange: (school: SchoolPlugin) => void;
}

export interface SchoolSelector {
  readonly element: HTMLElement;
  setActive(id: string): void;
  setBusy(busy: boolean): void;
}

export function createSchoolSelector(options: SchoolSelectorOptions): SchoolSelector {
  const group = document.createElement('div');
  group.className = 'atlas__schools';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Painting school');

  const buttons = new Map<string, HTMLButtonElement>();

  for (const school of options.schools) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'atlas__school';
    button.dataset.school = school.meta.id;
    button.textContent = school.meta.name;
    button.setAttribute('aria-pressed', String(school.meta.id === options.activeId));
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-pressed') === 'true') return;
      options.onChange(school);
    });
    buttons.set(school.meta.id, button);
    group.append(button);
  }

  const setActive = (id: string): void => {
    for (const [schoolId, button] of buttons) {
      button.setAttribute('aria-pressed', String(schoolId === id));
    }
  };

  const setBusy = (busy: boolean): void => {
    // Busy is a state of the group, not of its buttons. Disabling the button
    // that was just used would drop keyboard focus to the document while the
    // paper is down; the change guard already makes extra clicks harmless.
    group.dataset.busy = String(busy);
    group.setAttribute('aria-busy', String(busy));
  };

  group.addEventListener('keydown', (event) => {
    const ordered = [...buttons.values()];
    const current = ordered.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;

    let next: number;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = (current + 1) % ordered.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = (current - 1 + ordered.length) % ordered.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = ordered.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    ordered[next]?.focus();
  });

  return { element: group, setActive, setBusy };
}
