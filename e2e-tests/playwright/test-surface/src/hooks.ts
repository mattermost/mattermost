// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HOOKS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../hooks');
const MARKER = '# test-surface hook';

/**
 * Installs the opt-in git hooks for one config: pre-commit lints the staged testids, pre-push scans, checks and
 * regenerates. They read the config's paths, so the same hooks serve the webapp and a plugin repo. Existing hooks
 * are kept: ours run first and then call them.
 */
export function installHooks(configPath: string, log: (s: string) => void): void {
    const hooksDir = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], {cwd: path.dirname(configPath), encoding: 'utf8'}).trim();
    const dir = path.resolve(path.dirname(configPath), hooksDir);
    fs.mkdirSync(dir, {recursive: true});
    for (const name of ['pre-commit', 'pre-push']) {
        const target = path.join(dir, name);
        let previous = '';
        if (fs.existsSync(target)) {
            if (fs.readFileSync(target, 'utf8').includes(MARKER)) {
                log(`${name}: already installed`);
                continue;
            }
            fs.renameSync(target, `${target}.local`);
            previous = `\nif [ -x "${target}.local" ]; then "${target}.local" "$@" || exit $?; fi\n`;
        }
        fs.writeFileSync(target, `#!/bin/sh\n${MARKER}\nnode "${path.join(HOOKS, `${name}.mjs`)}" --config "${configPath}" || exit $?\n${previous}`, {mode: 0o755});
        log(`${name}: installed (${target})`);
    }
}
