#!/usr/bin/env node
/*
 * Prepares everything the gap analyst reads.
 *
 * The diffs are author-controlled, so they are escaped and wrapped before the
 * model sees them, exactly as they are on the review path. They reach the model
 * as files it opens with the Read tool rather than as prompt text, which keeps
 * an unbounded diff out of the workflow's expression context entirely.
 *
 *   node gap-prepare.mjs --code-diff <f> --docs-diff <f> --files <f> --out-dir <d>
 *                        [--prompt <f>]
 */

import {mkdirSync, readFileSync, writeFileSync, appendFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {renderPrompt} from './lib/gap-prompt.mjs';
import {block} from './lib/untrusted.mjs';

// The docs side is the smaller half of the question and the code side is where
// a monorepo diff runs away, so they are not capped alike.
const CAP = {code: 200_000, docs: 120_000, files: 20_000};

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
}

function require_(name) {
  const value = arg(name);
  if (!value) throw new Error(`--${name} <file> is required`);
  return value;
}

function wrap({source, dir, name, tag, cap, describe}) {
  const raw = readFileSync(source, 'utf8');
  const path = join(dir, name);
  writeFileSync(path, `${block(tag, raw, {maxChars: cap})}\n`);

  const note = raw.trim() ? describe.present(raw) : describe.empty;
  return `- \`${path}\` — ${note}`;
}

function main() {
  const dir = require_('out-dir');
  mkdirSync(dir, {recursive: true});

  const lines = [
    wrap({
      source: require_('files'),
      dir,
      name: 'changed-files.txt',
      tag: 'changed-files',
      cap: CAP.files,
      describe: {
        present: (raw) => `every path this pull request touches (${raw.trim().split('\n').length})`,
        empty: 'the changed-file list, which came back empty',
      },
    }),
    wrap({
      source: require_('code-diff'),
      dir,
      name: 'code-diff.txt',
      tag: 'code-diff',
      cap: CAP.code,
      describe: {
        present: () => 'the code side of the diff, truncated if long',
        empty: 'the code side of the diff — **empty**: this pull request changes no code',
      },
    }),
    wrap({
      source: require_('docs-diff'),
      dir,
      name: 'docs-diff.txt',
      tag: 'docs-diff',
      cap: CAP.docs,
      describe: {
        present: () => 'the documentation this pull request already carries, truncated if long',
        empty: 'the documentation side of the diff — **empty**: this pull request documents nothing',
      },
    }),
  ];

  const prompt = renderPrompt({inputs: lines.join('\n')});

  const out = arg('prompt');
  if (out) writeFileSync(out, prompt);

  if (process.env.GITHUB_OUTPUT) {
    // A random delimiter: the prompt is composed from repository files, and a
    // fixed one would be a value a file could contain.
    const delimiter = `EOF_${randomUUID()}`;
    appendFileSync(process.env.GITHUB_OUTPUT, `prompt<<${delimiter}\n${prompt}\n${delimiter}\n`);
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `schema=${JSON.stringify(JSON.parse(readFileSync(new URL('./gap-schema.json', import.meta.url), 'utf8')))}\n`,
    );
  }

  console.error(`[gap-prepare] prompt is ${prompt.length} characters\n${lines.join('\n')}`);
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
