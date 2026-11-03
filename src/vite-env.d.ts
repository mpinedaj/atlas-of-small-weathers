/// <reference types="vite/client" />

/** Read-only state for visual tests and curious people in the console. */
interface AtlasDebugState {
  readonly mode: 'webgl' | 'fallback';
  readonly ready: boolean;
  readonly school: string;
  /** Discovered school ids, in selector order. */
  readonly schools: readonly string[];
  readonly seed: number;
  readonly city: string;
  readonly weather: string;
  readonly stats?: unknown;
}

declare global {
  interface Window {
    __atlas?: AtlasDebugState;
  }
}

export {};
