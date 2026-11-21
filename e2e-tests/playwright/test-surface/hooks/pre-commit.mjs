// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console, no-process-exit -- a git hook reports and sets its exit status */

// pre-commit (`test-surface install-hooks`): the lint rules on staged sources next to the config (syntactic, about a
// second). Scanning belongs in pre-push because it reads the working tree, which can hold more than the commit.
// The manifest changes only when testids do. pre-push scans what is pushed.

import {execFileSync, spawnSync} from 'node:child_process';
import path from 'node:path';
import {parseArgs} from 'node:util';

import {loadConfig} from '../src/config.ts';

const {values} = parseArgs({options: {config: {type: 'string'}}});
const config = loadConfig(values.config);
const configDir = path.dirname(config.configPath);
const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], {cwd: configDir, encoding: 'utf8'}).trim();

const inside = (file, dir) => !path.relative(dir, file).startsWith('..');
const staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {cwd: repo, encoding: 'utf8'}).
    split('\n').
    filter((f) => (/\.tsx?$/).test(f) && !(/\.test\.tsx?$/).test(f)).
    map((f) => path.join(repo, f)).
    filter((f) => inside(f, configDir) && config.include.some((dir) => inside(f, dir)));
if (!staged.length) {
    process.exit(0);
}

// the files the config's own eslint config covers (other packages have their own)
const res = spawnSync('npx', ['eslint', '--quiet', ...staged], {cwd: configDir, stdio: 'inherit'});
if (res.status) {
    console.error('\ntestid lint failed (see above). Fix the testids, or commit with --no-verify to skip.');
    process.exit(res.status ?? 1);
}
process.exit(0);
