#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Writes and reads <ci dir>/run-facts.json: the three revisions, the validated inputs and the toolchain.
//   run_facts.mjs init       [--root <repo>] [--dry-run]   after check_inputs
//   run_facts.mjs toolchain  [--root <repo>] [--dry-run]   after `npm ci` and `playwright install chromium`
//   run_facts.mjs get <dotted.path>
// Exit 0 ok, 2 usage or missing input, 3 blocked (the test source or the toolchain does not match its pin).
//   Coordinator revision: GITHUB_SHA, the tree this workflow runs from (pilot.mjs, infra, explorer-proto).
//   Target commit: the commit the image under test was built from (input, verified by verify_target.mjs).
//   Compatible test source revision: test_source_ref when given, else the coordinator revision. A different
//   revision is accepted only when its Playwright package.json pin and package-lock.json equal the ones in use.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
    annotate,
    ciDir,
    EXIT,
    isMain,
    parseArgs,
    readJson,
    REPO_ROOT,
    sha256File,
    TARGET_FILES,
    writeJson,
} from './lib.mjs';

const FACTS = 'run-facts.json';
const LOCK = 'e2e-tests/playwright/package-lock.json';
const PKG = 'e2e-tests/playwright/package.json';

export function factsPath(env = process.env) {
    return path.join(ciDir(env), FACTS);
}

function gitHead(root) {
    const out = spawnSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'});
    return out.status === 0 ? out.stdout.trim() : null;
}

function playwrightPin(root, rel = PKG) {
    return readJson(path.join(root, rel)).devDependencies?.['@playwright/test'] ?? null;
}

export function buildFacts({inputs, env, root, now = Date.now()}) {
    const problems = [];
    const envSha = env.GITHUB_SHA ?? '';
    const local = !/^[0-9a-f]{40}$/.test(envSha);
    const coordinator = local ? gitHead(root) : envSha;
    if (!coordinator) {
        problems.push('the coordinator revision cannot be determined');
    }

    let testSource = coordinator;
    if (inputs.test_source_ref) {
        testSource = inputs.test_source_ref;
        const other = path.join(root, '.test-source');
        const sameLock = (() => {
            try {
                return (
                    sha256File(path.join(other, LOCK)) === sha256File(path.join(root, LOCK)) &&
                    playwrightPin(other) === playwrightPin(root)
                );
            } catch {
                return false;
            }
        })();
        if (testSource !== coordinator && !sameLock) {
            problems.push(
                'test_source_ref has a different Playwright pin or package-lock.json than the coordinator revision; only a revision with the same lock is compatible',
            );
        }
    }

    const specFile = path.join(root, inputs.verify_spec);
    if (!fs.existsSync(specFile)) {
        problems.push('the spec to verify is missing');
    }
    if (problems.length > 0) {
        return {ok: false, problems};
    }
    return {
        ok: true,
        facts: {
            schema: 'explorer-ci-run-facts/v1',
            target_kind: inputs.target_kind,
            target_commit: inputs.commit_sha,
            coordinator_revision: coordinator,
            coordinator_revision_source: local ? 'local git HEAD' : 'GITHUB_SHA',
            test_source_revision: testSource,
            image: inputs.image,
            session: inputs.session,
            control: inputs.control,
            verifier: inputs.verifier,
            time_budget_minutes: inputs.time_budget_minutes,
            run_id: inputs.run_id,
            run_attempt: inputs.run_attempt,
            verify_spec: inputs.verify_spec,
            verify_spec_sha256_start: sha256File(specFile),
            playwright_lock_sha256: fs.existsSync(path.join(root, LOCK)) ? sha256File(path.join(root, LOCK)) : null,
            workflow: {
                repository: env.GITHUB_REPOSITORY ?? null,
                run_id: env.GITHUB_RUN_ID ?? null,
                workflow_ref: env.GITHUB_WORKFLOW_REF ?? null,
            },
            started_epoch_s: Math.floor(now / 1000),
            node_version: process.version,
        },
    };
}

export function readToolchain({root, kind, env}) {
    const problems = [];
    const modules = path.join(root, 'e2e-tests/playwright/node_modules');
    let version = null;
    let revisions = {};
    try {
        version = readJson(path.join(modules, '@playwright/test/package.json')).version;
        const browsers = readJson(path.join(modules, 'playwright-core/browsers.json')).browsers;
        const revision = (name) => browsers.find((b) => b.name === name)?.revision ?? null;
        revisions = {chromium: revision('chromium'), chromium_headless_shell: revision('chromium-headless-shell')};
    } catch {
        problems.push('the locked Playwright packages are not installed');
    }

    const target = readJson(path.join(root, TARGET_FILES[kind]));
    if (version !== null && version !== target.playwright_version) {
        problems.push(`Playwright ${version} differs from the ${kind} target pin ${target.playwright_version}`);
    }
    if (revisions.chromium_headless_shell && revisions.chromium_headless_shell !== target.browser_build?.revision) {
        problems.push(
            `${target.browser_build?.name} revision ${revisions.chromium_headless_shell} differs from the ${kind} target pin ${target.browser_build?.revision}`,
        );
    }

    const cache = env.PLAYWRIGHT_BROWSERS_PATH || path.join(env.HOME || os.homedir(), '.cache/ms-playwright');
    let installed = [];
    try {
        installed = fs.readdirSync(cache);
    } catch {
        installed = [];
    }
    for (const dir of [
        `chromium-${revisions.chromium}`,
        `chromium_headless_shell-${revisions.chromium_headless_shell}`,
    ]) {
        if (!installed.includes(dir)) {
            problems.push(`browser build ${dir} is not installed`);
        }
    }
    const extra = installed.filter((name) => /^(firefox|webkit|chromium-tip)/.test(name));

    const npm = spawnSync('npm', ['--version'], {encoding: 'utf8'});
    return {
        ok: problems.length === 0,
        problems,
        toolchain: {
            playwright_version: version,
            chromium_revision: revisions.chromium ?? null,
            chromium_headless_shell_revision: revisions.chromium_headless_shell ?? null,
            extra_browsers_present: extra,
            npm_version: npm.status === 0 ? npm.stdout.trim() : null,
            pinned_playwright_version: target.playwright_version,
            pinned_browser_revision: target.browser_build?.revision ?? null,
        },
    };
}

function get(dotted) {
    let value = readJson(factsPath());
    for (const key of String(dotted).split('.')) {
        value = value?.[key];
    }
    if (value === undefined || value === null || typeof value === 'object') {
        return null;
    }
    return String(value);
}

function main() {
    const [command, ...rest] = process.argv.slice(2);
    const {flags, positional} = parseArgs(rest);
    const root = path.resolve(flags.root || REPO_ROOT);
    const dry = Boolean(flags['dry-run']);

    if (command === 'get') {
        let value = null;
        try {
            value = get(positional[0]);
        } catch {
            value = null;
        }
        if (value === null) {
            process.stderr.write('no such fact\n');
            return EXIT.USAGE;
        }
        process.stdout.write(`${value}\n`);
        return EXIT.OK;
    }

    if (command === 'init') {
        let inputs;
        try {
            inputs = readJson(path.join(ciDir(), 'inputs.json'));
        } catch {
            process.stderr.write('inputs.json is missing: run check_inputs.mjs first\n');
            return EXIT.USAGE;
        }
        const built = buildFacts({inputs, env: process.env, root});
        if (!built.ok) {
            for (const problem of built.problems) {
                annotate('error', 'exploratory facts', problem);
            }
            return EXIT.BLOCKED;
        }
        const f = built.facts;
        if (!dry) {
            writeJson(factsPath(), f);
        }
        process.stdout.write(
            `target commit ${f.target_commit}\ncoordinator revision ${f.coordinator_revision}\ntest source revision ${f.test_source_revision}\n${dry ? '(dry run, nothing written)\n' : ''}`,
        );
        return EXIT.OK;
    }

    if (command === 'toolchain') {
        let facts;
        try {
            facts = readJson(factsPath());
        } catch {
            process.stderr.write('run-facts.json is missing: run `run_facts.mjs init` first\n');
            return EXIT.USAGE;
        }
        const result = readToolchain({root, kind: facts.target_kind, env: process.env});
        for (const problem of result.problems) {
            annotate('error', 'exploratory toolchain', problem);
        }
        if (!dry && result.ok) {
            writeJson(factsPath(), {...facts, toolchain: result.toolchain});
        }
        const t = result.toolchain;
        process.stdout.write(
            `Playwright ${t.playwright_version}; chromium ${t.chromium_revision}; chromium-headless-shell ${t.chromium_headless_shell_revision}; node ${process.version}\n`,
        );
        return result.ok ? EXIT.OK : EXIT.BLOCKED;
    }

    process.stderr.write('usage: run_facts.mjs <init|toolchain|get> ...\n');
    return EXIT.USAGE;
}

if (isMain(import.meta.url)) {
    process.exit(main());
}
