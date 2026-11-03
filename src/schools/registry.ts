import type {
  DataToGesture,
  School,
  SchoolMeta,
  ShaderSet,
  ShaderSlot,
  WeatherSnapshot,
} from '../core/types';
import { defaultMapping } from '../data';

/**
 * School discovery.
 *
 * A school is a folder under `/schools`. Nothing is registered by hand: the
 * registry globs metadata, palettes, optional mappings and optional shaders at
 * build time. That is the whole plugin surface, and it is the reason adding a
 * school never requires editing core code.
 *
 * A malformed school is not allowed to paint. It is reported with a list of
 * problems and left out of the selector, while the rest of the atlas boots.
 */

export interface SchoolPlugin extends School {
  /** Repository-relative folder, e.g. `schools/turner`. */
  readonly directory: string;
}

export interface SchoolIssue {
  readonly folder: string;
  readonly path: string;
  readonly issues: readonly string[];
}

export interface DiscoveryResult {
  readonly schools: readonly SchoolPlugin[];
  readonly errors: readonly SchoolIssue[];
}

export class SchoolValidationError extends Error {
  readonly issues: readonly string[];

  constructor(label: string, issues: readonly string[]) {
    super(`${label}:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'SchoolValidationError';
    this.issues = issues;
  }
}

const SLOTS: readonly ShaderSlot[] = ['field', 'flow', 'brush', 'post'];
const GESTURE_KEYS = new Set<string>(Object.keys(defaultMapping));
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const DEFAULT_SCHOOL = 'turner';

type MetaModule = { default: unknown };
type PaletteModule = { palette?: unknown };
type MappingModule = { mapping?: unknown };
type ShaderModule = string;

const metaModules = import.meta.glob('../../schools/*/school.json', {
  eager: true,
}) as Record<string, MetaModule>;
const paletteModules = import.meta.glob('../../schools/*/palette.ts', {
  eager: true,
}) as Record<string, PaletteModule>;
const mappingModules = import.meta.glob('../../schools/*/mapping.ts', {
  eager: true,
}) as Record<string, MappingModule>;
const shaderModules = import.meta.glob('../../schools/*/shaders/*.frag', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, ShaderModule>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, field: string, maxLength: number, issues: string[]): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push(`"${field}" must be a non-empty string.`);
    return '';
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    issues.push(`"${field}" must be ${maxLength} characters or fewer.`);
  }
  return trimmed;
}

/**
 * Validate `school.json` without trusting it. The returned object is a clean
 * copy; unknown keys are ignored so a future field cannot break an old core.
 */
export function parseSchoolMeta(value: unknown, folderId?: string): SchoolMeta {
  if (!isRecord(value)) {
    throw new SchoolValidationError('school.json', ['The document must be a JSON object.']);
  }

  const issues: string[] = [];
  const id = text(value.id, 'id', 40, issues);
  const name = text(value.name, 'name', 60, issues);
  const author = text(value.author, 'author', 80, issues);
  const license = text(value.license, 'license', 40, issues);
  const description = text(value.description, 'description', 280, issues);
  const version = text(value.version, 'version', 32, issues);

  if (id && !ID_PATTERN.test(id)) {
    issues.push('"id" must be lowercase letters, digits and hyphens.');
  }
  if (id && folderId && id !== folderId) {
    issues.push(`"id" must match its folder name ("${folderId}").`);
  }
  if (version && !SEMVER.test(version)) {
    issues.push('"version" must be a semantic version, e.g. "0.1.0".');
  }

  let references: string[] = [];
  if (!Array.isArray(value.references) || value.references.length === 0) {
    issues.push('"references" must be a non-empty array of strings.');
  } else {
    references = value.references
      .filter((reference): reference is string => typeof reference === 'string')
      .map((reference) => reference.trim())
      .filter(Boolean);
    if (references.length !== value.references.length) {
      issues.push('"references" must contain only non-empty strings.');
    }
    if (references.length > 6) {
      issues.push('"references" may contain at most six entries.');
    }
  }

  if (issues.length > 0) {
    throw new SchoolValidationError(folderId ? `school "${folderId}"` : 'school.json', issues);
  }

  return { id, name, author, license, description, references, version };
}

function folderFromPath(path: string): string | null {
  const parts = path.split('/');
  const index = parts.lastIndexOf('schools');
  const folder = index >= 0 ? parts[index + 1] : undefined;
  return folder ?? null;
}

function groupByFolder<T>(modules: Record<string, T>): Map<string, T> {
  const grouped = new Map<string, T>();
  for (const [path, module] of Object.entries(modules)) {
    const folder = folderFromPath(path);
    if (folder) grouped.set(folder, module);
  }
  return grouped;
}

function parsePalette(module: PaletteModule | undefined, issues: string[]): School['palette'] {
  if (!module || typeof module.palette !== 'function') {
    issues.push('palette.ts must export a function named "palette".');
    return () => {
      throw new Error('This school has no palette.');
    };
  }
  return module.palette as School['palette'];
}

function parseMapping(
  module: MappingModule | undefined,
  issues: string[],
): Partial<DataToGesture> | undefined {
  if (!module) return undefined;
  if (!isRecord(module.mapping)) {
    issues.push('mapping.ts must export an object named "mapping".');
    return undefined;
  }

  const mapping: Partial<DataToGesture> = {};
  for (const [key, value] of Object.entries(module.mapping)) {
    if (!GESTURE_KEYS.has(key)) {
      issues.push(`mapping.ts overrides unknown gesture "${key}".`);
      continue;
    }
    if (typeof value !== 'function') {
      issues.push(`mapping.${key} must be a function.`);
      continue;
    }
    (mapping as Record<string, unknown>)[key] = value as (weather: WeatherSnapshot) => unknown;
  }
  return mapping;
}

function parseShaders(
  folder: string,
  modules: Map<string, string>,
  issues: string[],
): Partial<ShaderSet> {
  const shaders: Partial<Record<ShaderSlot, string>> = {};
  const folderMarker = `/${folder}/`;

  for (const [path, source] of modules) {
    if (!path.includes(folderMarker)) continue;
    const file = path.split('/').pop() ?? path;
    const slot = file.replace(/\.frag$/, '');
    if (!SLOTS.includes(slot as ShaderSlot)) {
      issues.push(`shaders/${file} is not a known slot (${SLOTS.join(', ')}).`);
      continue;
    }
    if (typeof source !== 'string' || source.trim().length === 0) {
      issues.push(`shaders/${file} is empty.`);
      continue;
    }
    shaders[slot as ShaderSlot] = source;
  }

  return shaders;
}

/** Discover and validate every school folder. */
export function discoverSchools(): DiscoveryResult {
  const metas = groupByFolder(metaModules);
  const palettes = groupByFolder(paletteModules);
  const mappings = groupByFolder(mappingModules);
  const shadersByFolder = new Map<string, Map<string, string>>();
  for (const [path, source] of Object.entries(shaderModules)) {
    const folder = folderFromPath(path);
    if (!folder) continue;
    const bucket = shadersByFolder.get(folder) ?? new Map<string, string>();
    bucket.set(path, source);
    shadersByFolder.set(folder, bucket);
  }

  const schools: SchoolPlugin[] = [];
  const errors: SchoolIssue[] = [];

  for (const [folder, module] of metas) {
    const issues: string[] = [];
    let meta: SchoolMeta | null = null;
    try {
      meta = parseSchoolMeta(module.default, folder);
    } catch (error) {
      if (error instanceof SchoolValidationError) issues.push(...error.issues);
      else issues.push(error instanceof Error ? error.message : String(error));
    }

    const palette = parsePalette(palettes.get(folder), issues);
    const mapping = parseMapping(mappings.get(folder), issues);
    const shaders = parseShaders(folder, shadersByFolder.get(folder) ?? new Map(), issues);

    if (!meta || issues.length > 0) {
      errors.push({ folder, path: `schools/${folder}`, issues });
      continue;
    }

    schools.push({
      meta,
      palette,
      ...(mapping ? { mapping } : {}),
      ...(Object.keys(shaders).length > 0 ? { shaders } : {}),
      directory: `schools/${folder}`,
    });
  }

  schools.sort((a, b) => a.meta.name.localeCompare(b.meta.name));

  return { schools, errors };
}

/** All valid schools, or an empty list with errors the interface can report. */
export function getSchools(): DiscoveryResult {
  return discoverSchools();
}

/** The school a first visit opens with, if it exists. */
export function defaultSchool(schools: readonly SchoolPlugin[]): SchoolPlugin | undefined {
  return schools.find((school) => school.meta.id === DEFAULT_SCHOOL) ?? schools[0];
}

/** Find one school by URL-safe id. */
export function findSchool(
  schools: readonly SchoolPlugin[],
  id: string | null,
): SchoolPlugin | undefined {
  if (!id) return undefined;
  return schools.find((school) => school.meta.id === id);
}

export { DEFAULT_SCHOOL };
