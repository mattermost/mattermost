// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {CONFIG_PATH, REPO_DIR, SRC_DIR} from './paths.ts';
import {compareStrings} from './snapshot.ts';

/**
 * Engine files: every `.ts` and `.json` file under explorer-proto/src (recursive), plus
 * explorer-proto/playwright.config.ts. Paths are repo-relative with '/' separators, sorted in code-unit order.
 * The hash is sha256 of the `sha256sum` listing of those files in that order (`<hex>  <path>\n` per file), so
 * `sha256sum <files in order> | sha256sum` recomputes it from the repository root.
 */
export function engineHashFiles(): string[] {
    const out: string[] = [];
    const visit = (dir: string) => {
        for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                visit(full);
            } else if (entry.isFile() && /\.(ts|json)$/.test(entry.name)) {
                out.push(full);
            }
        }
    };
    visit(SRC_DIR);
    out.push(CONFIG_PATH);
    return out.map((f) => path.relative(REPO_DIR, f).split(path.sep).join('/')).sort(compareStrings);
}

export function engineHash(): {files: string[]; listing: string; sha256: string} {
    const files = engineHashFiles();
    const listing = files
        .map(
            (f) =>
                `${crypto
                    .createHash('sha256')
                    .update(fs.readFileSync(path.join(REPO_DIR, f)))
                    .digest('hex')}  ${f}\n`,
        )
        .join('');
    return {files, listing, sha256: crypto.createHash('sha256').update(listing).digest('hex')};
}
