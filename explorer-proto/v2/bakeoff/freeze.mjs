#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Records the v2 freeze: git SHA, hashes of schemas, gate modules, protocol files and inputs -> FREEZE.json.
//   node freeze.mjs [--dry-run]    print the record (dirty trees allowed), write nothing
//   node freeze.mjs                write FREEZE.json; refuses a dirty tree, missing required paths or an existing file
//   node freeze.mjs --verify       recompute every hash and compare with FREEZE.json
// Never creates or pushes a git tag; tag the recorded SHA by hand if wanted. The record holds no timestamps.
// Edit freeze.config.json (gate module locations, inputs) BEFORE freezing; the config is itself hashed.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
    BAKEOFF_DIR,
    canonicalJson,
    FREEZE_FILE,
    isMain,
    parseArgs,
    readJson,
    relativeToRepo,
    REPO_ROOT,
    RULES_FILE,
    sha256File,
    sha256Text,
    writeJson,
} from './common.mjs';

const CONFIG_FILE = path.join(BAKEOFF_DIR, 'freeze.config.json');

function git(args) {
    return execFileSync('git', ['-C', REPO_ROOT, ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
}

function listFiles(dir, extensions) {
    const abs = path.join(REPO_ROOT, dir);
    if (!fs.existsSync(abs)) {
        return null;
    }
    const found = [];
    const visit = (current) => {
        for (const entry of fs
            .readdirSync(current, {withFileTypes: true})
            .sort((a, b) => a.name.localeCompare(b.name))) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'node_modules') {
                    visit(full);
                }
            } else if (!extensions || extensions.includes(path.extname(entry.name))) {
                found.push(relativeToRepo(full));
            }
        }
    };
    visit(abs);
    return found;
}

export function collectFiles(config) {
    const files = {};
    const problems = [];
    for (const d of config.directories) {
        const list = listFiles(d.dir, d.extensions);
        if (list === null || list.length === 0) {
            problems.push(`required ${d.role} path has no files: ${d.dir}`);
            continue;
        }
        for (const f of list) {
            files[f] = null;
        }
    }
    for (const input of config.inputs) {
        if (fs.existsSync(path.join(REPO_ROOT, input.path))) {
            files[input.path] = null;
        } else if (input.required) {
            problems.push(`required input is missing: ${input.path}`);
        }
    }
    for (const excluded of config.exclude) {
        delete files[excluded];
    }
    files[relativeToRepo(CONFIG_FILE)] = null;
    for (const f of Object.keys(files).sort()) {
        files[f] = sha256File(path.join(REPO_ROOT, f));
    }
    return {files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))), problems};
}

export function aggregate(files) {
    return sha256Text(
        Object.entries(files)
            .map(([f, h]) => `${f}\t${h}\n`)
            .join(''),
    );
}

function versionOf(pkgFile) {
    const file = path.join(REPO_ROOT, pkgFile);
    return fs.existsSync(file) ? readJson(file).version : null;
}

function dirtyPaths(config) {
    const roots = [
        ...new Set([...config.directories.map((d) => d.dir), ...config.inputs.map((i) => path.dirname(i.path))]),
    ];
    return git(['status', '--porcelain', '--', ...roots])
        .split('\n')
        .filter(Boolean);
}

function buildRecord(config, files) {
    const rules = readJson(RULES_FILE);
    let commitExists = true;
    try {
        git(['cat-file', '-e', `${rules.version_a.commit}^{commit}`]);
    } catch {
        commitExists = false;
    }
    return {
        schema: 'explorer-freeze/v1',
        version_a: {name: rules.version_a.name, commit: rules.version_a.commit, commit_exists_locally: commitExists},
        version_b: {name: 'v2', frozen_sha: git(['rev-parse', 'HEAD'])},
        tooling: {
            node: process.version,
            playwright_test: versionOf('e2e-tests/playwright/node_modules/@playwright/test/package.json'),
            ajv: versionOf('e2e-tests/playwright/node_modules/ajv/package.json'),
        },
        files,
        aggregate_sha256: aggregate(files),
    };
}

function verify(config) {
    const frozen = readJson(FREEZE_FILE);
    const {files} = collectFiles(config);
    let failed = false;
    const say = (ok, text) => {
        failed ||= !ok;
        process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${text}\n`);
    };
    for (const [f, hash] of Object.entries(frozen.files)) {
        say(files[f] === hash, files[f] === undefined ? `${f} (missing)` : f);
    }
    for (const f of Object.keys(files)) {
        if (!(f in frozen.files)) {
            say(false, `${f} (not in the freeze)`);
        }
    }
    try {
        git(['merge-base', '--is-ancestor', frozen.version_b.frozen_sha, 'HEAD']);
        say(true, 'frozen SHA is an ancestor of HEAD');
    } catch {
        say(false, 'frozen SHA is not an ancestor of HEAD');
    }
    return failed ? 1 : 0;
}

function main(argv) {
    const {flags} = parseArgs(argv, {booleans: ['dry-run', 'verify']});
    try {
        const config = readJson(CONFIG_FILE);
        if (flags.verify) {
            return verify(config);
        }
        const {files, problems} = collectFiles(config);
        const record = buildRecord(config, files);
        if (flags['dry-run']) {
            process.stdout.write(canonicalJson(record));
            for (const p of problems) {
                process.stderr.write(`would refuse: ${p}\n`);
            }
            return 0;
        }
        if (fs.existsSync(FREEZE_FILE)) {
            throw new Error('FREEZE.json already exists; a freeze is never overwritten');
        }
        const dirty = dirtyPaths(config);
        const refusals = [...problems, ...dirty.map((l) => `uncommitted change: ${l}`)];
        if (refusals.length) {
            throw new Error(`refusing to freeze:\n${refusals.map((l) => `  ${l}`).join('\n')}`);
        }
        writeJson(FREEZE_FILE, record);
        process.stdout.write(
            `wrote ${relativeToRepo(FREEZE_FILE)} (frozen_sha ${record.version_b.frozen_sha}); no tag was created\n`,
        );
        return 0;
    } catch (e) {
        process.stderr.write(`${e.message}\n`);
        return 2;
    }
}

if (isMain(import.meta.url)) {
    process.exitCode = main(process.argv.slice(2));
}
