// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// A repository's files, read through a tree: read() returns a file's text, or
// null if it does not exist; list() returns the file names in a directory. A
// tree is the working tree or a commit, so the same planning code can describe
// the run in progress and the commit it started from.
import {execFileSync} from 'child_process';
import fs from 'fs';
import path from 'path';

function git(root, ...args) {
    return execFileSync('git', args, {cwd: root, encoding: 'utf8', maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'pipe']});
}

// What git says when a path is not in a commit, as opposed to a commit or blob
// it cannot read, which a partial clone can hit when a fetch fails.
const NOT_IN_COMMIT = /does not exist in|exists on disk, but not in|Not a valid object name|not a tree object/;

function readGit(root, ...args) {
    try {
        return git(root, ...args);
    } catch (e) {
        if (NOT_IN_COMMIT.test(String(e.stderr))) {
            return null;
        }
        throw new Error(`git ${args.join(' ')} failed: ${String(e.stderr || e.message).trim()}`);
    }
}

function tryGit(root, ...args) {
    try {
        return git(root, ...args);
    } catch {
        return null;
    }
}

export function revParse(root, rev) {
    const sha = tryGit(root, 'rev-parse', '--verify', '--quiet', `${rev}^{commit}`);
    return sha ? sha.trim() : null;
}

export function mergeBase(root, a, b) {
    const sha = tryGit(root, 'merge-base', a, b);
    return sha ? sha.trim() : null;
}

/** The files the working tree changes since rev, committed or not. */
export function changedFiles(root, rev) {
    return git(root, 'diff', '--name-only', rev).split('\n').filter(Boolean);
}

export function isAncestor(root, ancestor, descendant) {
    try {
        execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {cwd: root, stdio: 'ignore'});
        return true;
    } catch {
        return false;
    }
}

export function workingTree(root) {
    return {
        read(rel) {
            try {
                return fs.readFileSync(path.join(root, rel), 'utf8');
            } catch (e) {
                if (e.code === 'ENOENT') {
                    return null;
                }
                throw e;
            }
        },
        list(relDir) {
            try {
                return fs.readdirSync(path.join(root, relDir), {withFileTypes: true}).
                    filter((entry) => entry.isFile()).
                    map((entry) => entry.name).
                    sort();
            } catch (e) {
                if (e.code === 'ENOENT') {
                    return [];
                }
                throw e;
            }
        },
    };
}

/**
 * The tree of commit rev. Reading a file the commit does not have returns null;
 * a commit that is not in the clone at all is an error, since every answer
 * built on it would be wrong.
 */
export function commitTree(root, rev) {
    const sha = revParse(root, rev);
    if (!sha) {
        throw new Error(`commit ${rev} is not in this clone; fetch it (git fetch origin ${rev}) or the full history (git fetch --unshallow)`);
    }
    const cache = new Map();
    return {
        rev: sha,
        read(rel) {
            if (!cache.has(rel)) {
                cache.set(rel, readGit(root, 'show', `${sha}:${rel}`));
            }
            return cache.get(rel);
        },
        list(relDir) {
            const out = readGit(root, 'ls-tree', '--name-only', `${sha}:${relDir}`);
            return out ? out.split('\n').filter(Boolean).sort() : [];
        },
    };
}

/**
 * Trees for any number of commits, each read at most once. The plan reads
 * en.json at every locale's baseline commit, and those are usually all the same.
 */
export function commitTrees(root) {
    const trees = new Map();
    return (rev) => {
        if (!trees.has(rev)) {
            trees.set(rev, commitTree(root, rev));
        }
        return trees.get(rev);
    };
}
