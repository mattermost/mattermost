// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/wrap-regex -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// The existing spec under verification: recorded by path and sha256, re-hashed at every stage. A different hash at
// any later stage is a hard failure, never a retry.
import fs from 'node:fs';
import path from 'node:path';

import {REPO_ROOT, sha256File} from '../common.mjs';

export class SpecHashMismatch extends Error {}

/** Resolves a repo-relative spec path that the engine's replay of this session would run. Throws a usage message. */
export function resolveSpec(relative, session) {
    if (!/^[A-Za-z0-9_./-]+\.spec\.ts$/.test(relative) || relative.includes('..') || path.isAbsolute(relative)) {
        throw new Error('--verify-spec must be a repo-relative path to a *.spec.ts file');
    }
    const generated = `explorer-proto/sessions/${session}/generated`;
    if (path.posix.dirname(relative) !== generated) {
        throw new Error(`--verify-spec must be a spec in ${generated}/ (the directory the engine replays)`);
    }
    const abs = path.join(REPO_ROOT, relative);
    if (!fs.existsSync(abs) || !fs.lstatSync(abs).isFile()) {
        throw new Error(`--verify-spec ${relative} is not a file`);
    }
    const siblings = fs.readdirSync(path.dirname(abs)).filter((f) => f.endsWith('.spec.ts'));
    if (siblings.length !== 1) {
        throw new Error(`${generated}/ holds ${siblings.length} specs; the replay would run all of them`);
    }
    return {path: relative, abs, sha256: sha256File(abs)};
}

/** Re-hashes the spec against the hash recorded in run.json; throws SpecHashMismatch when it differs. */
export function assertSpecUnchanged(flags) {
    const now = sha256File(path.join(REPO_ROOT, flags.verifySpec.path));
    if (now !== flags.verifySpec.sha256) {
        throw new SpecHashMismatch('the spec sha256 differs from the hash recorded when the run was created');
    }
    return now;
}

export function specText(flags) {
    return fs.readFileSync(path.join(REPO_ROOT, flags.verifySpec.path), 'utf8');
}

export function testTitleOf(text) {
    const m = /\btest\(\s*(['"`])((?:\\.|(?!\1).)*)\1/s.exec(text);
    if (!m) {
        throw new Error('the spec declares no test(...) with a literal title');
    }
    return m[2];
}

const callOf = (line) => line.trim().replace(/\s*\/\/.*$/, '');

/**
 * Finds the expect call the charter names as the failing assertion. The charter text gives a predicate id (fs-3) and
 * a quoted accessible name; the call is the first awaited expect in the spec whose label carries that id and whose
 * locator names it. Also returns the awaited expects up to and including it, in order.
 */
export function locateAssertion(text, prose) {
    const id = /\b([a-z]{2,3}-\d{1,3})\b/.exec(prose)?.[1];
    const name = /'([^']+)'/.exec(prose)?.[1];
    if (!id || !name) {
        throw new Error('the charter text names no predicate id and quoted name to look for in the spec');
    }
    const lines = text.split('\n');
    const expects = lines
        .map((content, i) => ({line: i + 1, content}))
        .filter(({content}) => /^\s*await expect(?:\.soft)?\(/.test(content));
    const hit = expects.find(
        ({content}) => content.includes(`name: '${name}'`) && new RegExp(`\\b${id}\\)`).test(content),
    );
    if (!hit) {
        throw new Error('no awaited expect in the spec carries the charter predicate id and the declared name');
    }
    const call = callOf(hit.content);
    const matcher = /\.(to[A-Za-z]+)\([^()]*\)\s*;?$/.exec(call)?.[1] ?? null;
    return {
        predicate: id,
        name,
        line: hit.line,
        call,
        matcher,
        expects_up_to_failing: expects.filter((e) => e.line <= hit.line).map((e) => e.line),
    };
}
