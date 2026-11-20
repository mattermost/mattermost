// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console, no-process-exit -- a git hook reports and sets its exit status */

// pre-push (`test-surface install-hooks`): scans, checks and regenerates (about 30 s) when the push changes the
// scanned sources or the outputs. The scan reads the working tree, so it stops first when the tree holds edits
// under the scanned directories that the pushed commit doesn't; a hook can't add commits to the push, so when the
// manifest or generated page objects change it stops the push and says what to commit.

import {execFileSync, spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

import {loadConfig} from '../src/config.ts';

const {values} = parseArgs({options: {config: {type: 'string'}}});
const config = loadConfig(values.config);
const cli = fileURLToPath(new URL('../bin/test-surface.mjs', import.meta.url));
const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], {cwd: path.dirname(config.configPath), encoding: 'utf8'}).trim();
const git = (...args) => execFileSync('git', args, {cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']});
const outputs = [config.output.report, config.output.generated].filter(Boolean).map((p) => path.relative(repo, p));
const sources = config.include.map((d) => path.relative(repo, d));

// what this push adds; a branch without an upstream yet is always checked
let changed = null;
try {
    changed = git('diff', '--name-only', '@{push}..HEAD').split('\n').filter(Boolean);
} catch {
    changed = null;
}
const watched = [...sources, ...outputs];
if (changed && !changed.some((f) => watched.some((w) => f === w || f.startsWith(`${w}/`)))) {
    process.exit(0);
}

// the scan would read edits the pushed commit doesn't have
const uncommitted = [...git('diff', '--name-only', 'HEAD', '--', ...sources).split('\n'), ...git('ls-files', '--others', '--exclude-standard', '--', ...sources).split('\n')].
    filter((f) => (/\.(tsx?|jsx?)$/).test(f));
if (uncommitted.length) {
    console.error(`test-surface: the working tree has edits the push doesn't, which the scan would read:\n    ${uncommitted.slice(0, 10).join('\n    ')}${uncommitted.length > 10 ? `\n    …and ${uncommitted.length - 10} more` : ''}\n\nCommit them, or set them aside, and push again (or push with --no-verify to skip the check).`);
    process.exit(1);
}
const run = (cmd) => spawnSync(process.execPath, [cli, cmd, '--config', config.configPath, '--quiet'], {stdio: 'inherit'}).status;
if (run('scan') || (config.output.generated && run('generate'))) {
    console.error('\ntest-surface found errors (see above). Fix them, or push with --no-verify to skip.');
    process.exit(1);
}
const dirty = git('status', '--porcelain', '--', ...outputs).trim();
if (dirty) {
    console.error(`\nThe manifest or generated page objects changed:\n${dirty}\n\nCommit them and push again:\n    git add ${outputs.join(' ')} && git commit -m "Regenerate test surface"`);
    process.exit(1);
}
process.exit(0);
