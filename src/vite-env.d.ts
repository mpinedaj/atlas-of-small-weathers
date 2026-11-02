/// <reference types="vite/client" />

/** Read-only state for visual tests and curious people in the console. */
interface AtlasDebugState {
  readonly mode: 'webgl' | 'fallback';
  readonly ready: boolean;
  readonly school: string;
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
