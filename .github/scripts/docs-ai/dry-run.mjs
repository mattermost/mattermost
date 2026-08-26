#!/usr/bin/env node
/*
 * Run the review pipeline locally and print the comment it would post.
 *
 * Shells out to the same scripts the workflow calls, in the same order, so a
 * verdict reproduced here is the verdict CI produces. Use it to tune a persona
 * prompt without pushing a commit and waiting on Actions.
 *
 *   node dry-run.mjs                              # working tree vs origin/master
 *   node dry-run.mjs --base HEAD~3
 *   node dry-run.mjs --files docs/main/foo.mdx    # review whole files
 *   node dry-run.mjs --personas brand-voice       # skip the router
 *   node dry-run.mjs --milestone v11.6
 */

import {execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {additionsDiff, changedPaths, isContentPath} from './lib/diff.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

function run(script, args) {
  return execFileSync('node', [join(HERE, script), ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

function gitDiff(base) {
  const merge = execFileSync('git', ['merge-base', 'HEAD', base], {encoding: 'utf8'}).trim();
  return execFileSync('git', ['diff', merge, '--', 'docs/'], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
}

function main() {
  const files = arg('files');
  const diff = files
    ? additionsDiff(files.split(',').map((f) => f.trim()).filter(Boolean))
    : gitDiff(arg('base', 'origin/master'));

  const touched = changedPaths(diff).filter(isContentPath);
  if (touched.length === 0) {
    console.error('No documentation content changed. Nothing to review.');
    return;
  }
  console.error(`Reviewing ${touched.length} file(s):\n${touched.map((p) => `  ${p}`).join('\n')}\n`);

  const work = mkdtempSync(join(tmpdir(), 'docs-ai-'));
  try {
    const diffPath = join(work, 'pr.diff');
    writeFileSync(diffPath, diff);

    const override = arg('personas');
    const personas = override
      ? override.split(',').map((p) => p.trim()).filter(Boolean)
      : JSON.parse(run('router.mjs', ['--diff', diffPath]));

    const milestone = arg('milestone');
    const results = join(work, 'results');
    for (const id of personas) {
      run('persona-review.mjs', [
        '--persona', id,
        '--diff', diffPath,
        '--out', join(results, `${id}.json`),
        ...(milestone ? ['--milestone', milestone] : []),
      ]);
    }

    console.error('\n--- comment ---\n');
    process.stdout.write(run('report.mjs', ['--results-dir', results, '--dry-run']));
  } finally {
    if (!process.argv.includes('--keep')) rmSync(work, {recursive: true, force: true});
    else console.error(`\nArtifacts kept in ${work}`);
  }
}

main();
