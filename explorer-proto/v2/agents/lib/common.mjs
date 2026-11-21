// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Paths and small helpers shared by the portability layer. Node built-ins only; no network; no vendor names.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const AGENTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const V2_DIR = path.resolve(AGENTS_DIR, '..');
export const REPO_ROOT = path.resolve(V2_DIR, '../..');
export const ORCH_DIR = path.join(V2_DIR, 'orchestrator');
export const PILOT_CLI = path.join(ORCH_DIR, 'pilot.mjs');
export const ROLES_DIR = path.join(AGENTS_DIR, 'roles');

export const EXIT = {OK: 0, REFUSED: 1, USAGE: 2, COMMAND_FAILED: 3};

export class Refusal extends Error {}

export function toPosix(p) {
    return p.split(path.sep).join('/');
}

export function readJsonFile(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJsonFile(file, value) {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    const tmp = `${file}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, `${JSON.stringify(value, null, 4)}\n`);
    fs.renameSync(tmp, file);
}

/** True when child is the same path as parent or lies below it (both resolved, no symlink following). */
export function isInside(parent, child) {
    const rel = path.relative(path.resolve(parent), path.resolve(child));
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Resolves symlinks of the deepest existing ancestor, so a link that points outside is detected. */
export function realInside(parent, child) {
    const realParent = fs.realpathSync(parent);
    let probe = path.resolve(child);
    const tail = [];
    while (!fs.existsSync(probe)) {
        tail.unshift(path.basename(probe));
        const up = path.dirname(probe);
        if (up === probe) {
            return false;
        }
        probe = up;
    }
    return isInside(realParent, path.join(fs.realpathSync(probe), ...tail));
}

/** Glob to RegExp: `**` crosses directories, `*` and `?` stay inside one segment. Anchored. */
export function globToRegExp(glob) {
    let source = '';
    for (let i = 0; i < glob.length; i++) {
        const c = glob[i];
        if (c === '*' && glob[i + 1] === '*') {
            if (glob[i + 2] === '/') {
                source += '(?:.*/)?';
                i += 2;
            } else {
                source += '.*';
                i += 1;
            }
        } else if (c === '*') {
            source += '[^/]*';
        } else if (c === '?') {
            source += '[^/]';
        } else {
            source += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        }
    }
    return new RegExp(`^${source}$`);
}

export function matchesAnyGlob(posixPath, globs) {
    return globs.find((g) => globToRegExp(g).test(posixPath));
}

export function loadRoleIndex() {
    return readJsonFile(path.join(ROLES_DIR, 'index.json'));
}

export function roleForTaskRole(index, taskRole) {
    return index.roles.find((r) => r.task_roles.includes(taskRole));
}
