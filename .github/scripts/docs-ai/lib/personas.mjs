import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {basename, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import yaml from 'js-yaml';

const GITHUB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const REPO_ROOT = join(GITHUB_DIR, '..');
const PROMPTS_DIR = join(GITHUB_DIR, 'prompts');
const PERSONAS_DIR = join(PROMPTS_DIR, 'personas');

const VALID_SCOPES = ['author', 'review', 'impact'];
const DELIMITER = '---';

let cache = null;

export function registry() {
  if (cache) return cache;

  const files = readdirSync(PERSONAS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort();

  if (files.length === 0) {
    throw new Error(`No persona files found in ${PERSONAS_DIR}`);
  }

  cache = files.map((file) => parsePersona(file, readFileSync(join(PERSONAS_DIR, file), 'utf8')));
  return cache;
}

function splitFrontmatter(raw) {
  const lines = raw.split(/\r?\n/);
  if (lines[0] !== DELIMITER) return null;

  const close = lines.indexOf(DELIMITER, 1);
  if (close === -1) return null;

  return {
    frontmatter: lines.slice(1, close).join('\n'),
    body: lines.slice(close + 1).join('\n'),
  };
}

export function parsePersona(file, raw) {
  const split = splitFrontmatter(raw);
  if (!split) {
    throw new Error(`${file}: missing YAML frontmatter delimited by --- lines`);
  }

  const meta = yaml.load(split.frontmatter);
  const prompt = split.body.trim();

  if (!meta || typeof meta !== 'object') {
    throw new Error(`${file}: frontmatter did not parse to an object`);
  }
  if (!prompt) {
    throw new Error(`${file}: no prompt body after the frontmatter`);
  }

  const expectedId = basename(file, '.md');
  if (meta.id !== expectedId) {
    throw new Error(`${file}: id "${meta.id}" does not match the filename`);
  }
  if (typeof meta.label !== 'string' || !meta.label) {
    throw new Error(`${file}: label is required`);
  }
  if (!Array.isArray(meta.scope) || meta.scope.length === 0) {
    throw new Error(`${file}: scope must be a non-empty array`);
  }
  for (const s of meta.scope) {
    if (!VALID_SCOPES.includes(s)) {
      throw new Error(`${file}: unknown scope "${s}" (expected ${VALID_SCOPES.join(', ')})`);
    }
  }
  // A path that no longer exists matches nothing, so the persona quietly stops
  // being selected for the content it owns. Fail instead of losing coverage.
  const docsPaths = requireStringArray(file, 'docs_paths', meta.docs_paths, {onDisk: true});

  let codeSignals = [];
  if (meta.scope.includes('impact') || meta.code_signals !== undefined) {
    codeSignals = requireStringArray(file, 'code_signals', meta.code_signals);
  }

  if (typeof meta.router_hints !== 'string' || !meta.router_hints.trim()) {
    throw new Error(`${file}: router_hints is required`);
  }

  return {
    id: meta.id,
    label: meta.label,
    scope: meta.scope,
    docsPaths,
    codeSignals,
    routerHints: meta.router_hints.trim(),
    prompt,
    file,
  };
}

function requireStringArray(file, key, value, {onDisk = false} = {}) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${file}: ${key} must be a non-empty array`);
  }

  for (const entry of value) {
    if (typeof entry !== 'string' || !entry.trim()) {
      throw new Error(`${file}: every ${key} entry must be a non-empty string`);
    }
    if (onDisk && !existsSync(join(REPO_ROOT, entry))) {
      throw new Error(`${file}: ${key} entry "${entry}" does not exist in the repository`);
    }
  }

  return value;
}

export function personaIds() {
  return registry().map((p) => p.id);
}

export function personasWithScope(scope) {
  return registry().filter((p) => p.scope.includes(scope));
}

export function getPersona(id) {
  const persona = registry().find((p) => p.id === id);
  if (!persona) {
    throw new Error(`Unknown persona "${id}". Known: ${personaIds().join(', ')}`);
  }
  return persona;
}

export function alwaysOnPersonaIds() {
  return personasWithScope('review')
    .filter((p) => /always applies/i.test(p.routerHints))
    .map((p) => p.id);
}

export function conventions() {
  return readFileSync(join(PROMPTS_DIR, 'conventions.md'), 'utf8').trim();
}

export function reviewContract() {
  return readFileSync(join(PROMPTS_DIR, 'review-contract.md'), 'utf8').trim();
}

export function reviewSystemBlocks(id) {
  const persona = getPersona(id);
  return [
    {type: 'text', text: conventions(), cache_control: {type: 'ephemeral'}},
    {type: 'text', text: reviewContract(), cache_control: {type: 'ephemeral'}},
    {type: 'text', text: persona.prompt, cache_control: {type: 'ephemeral'}},
  ];
}

export {PERSONAS_DIR, PROMPTS_DIR, REPO_ROOT};
