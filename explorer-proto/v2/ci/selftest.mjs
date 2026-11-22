#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Offline self-test of explorer-proto/v2/ci. No Docker, no registry, no GitHub, no install; the only servers are
// loopback stubs. Exit 0 only if every check passes.
//   node explorer-proto/v2/ci/selftest.mjs [--only <name prefix>]
import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import {checkBaseChromeProject, checkConfig, checkExport} from './assert_no_capture.mjs';
import {checkInputs as checkInputsFor} from './check_inputs.mjs';
import {
    checkEntryContract,
    evaluateContract,
    flagsBySubcommand,
    parseCommands,
    parseReadme,
    pilotUsage,
} from './check_entry_contract.mjs';
import {
    budgetPlan,
    loadStageBudgets,
    mapCoordinatorExit,
    MIN_VERIFIER_SECONDS,
    SETUP_ALLOWANCE_SECONDS,
    summarizeDoctor,
    TEARDOWN_RESERVE_SECONDS,
    verifierTimeoutSeconds,
} from './coordinator_plan.mjs';
import {exitForOverall, overallResult, renderSummary} from './final_summary.mjs';
import {
    ADVISORY_SENTENCE,
    BUDGET_MINUTES,
    COORDINATOR_TARGET_KINDS,
    HERE,
    parseArgs,
    readJson,
    REPO_ROOT,
    STAGES,
} from './lib.mjs';
import {lintScripts, lintWorkflow} from './lint_workflow.mjs';
import {buildFacts, readToolchain} from './run_facts.mjs';
import {evaluateConvention, verifyLive, verifyTarget} from './verify_target.mjs';

import {createRequire} from 'node:module';

const FIXTURES = path.join(HERE, 'fixtures');
const WORKFLOW_FILE = path.join(REPO_ROOT, '.github/workflows/e2e-tests-exploratory.yml');
const MAIN_PIN = readJson(path.join(REPO_ROOT, 'explorer-proto/v2/targets/main.json'));
const RELEASE_PIN = readJson(path.join(REPO_ROOT, 'explorer-proto/v2/orchestrator/targets/release.json'));
const MAIN_IMAGE = `${MAIN_PIN.image.ref}@${MAIN_PIN.image.digest}`;
const RELEASE_IMAGE = `${RELEASE_PIN.image.ref}@${RELEASE_PIN.image.digest}`;
const SYNTH = {
    commit: 'abcdef0123456789abcdef0123456789abcdef01',
    digest: `sha256:${'a'.repeat(64)}`,
    image: `mattermostdevelopment/mattermost-enterprise-edition:abcdef0_1234567@sha256:${'a'.repeat(64)}`,
};

// The input unit tests exercise the format rules for both kinds; the coordinator-support rule has its own checks.
const checkInputs = (env, options = {}) => checkInputsFor(env, {coordinatorKinds: ['main', 'release'], ...options});

const checks = [];
const check = (name, fn) => checks.push({name, fn});

const assert = (condition, message) => {
    if (!condition) {
        throw new Error(message);
    }
};
const equal = (actual, expected, message) =>
    assert(
        JSON.stringify(actual) === JSON.stringify(expected),
        `${message}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
    );

const tmpDirs = [];
function tmp(prefix = 'ci-selftest-') {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.push(dir);
    return dir;
}

function cleanEnv(extra = {}) {
    const env = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (!/^(GITHUB_|INPUT_|EXPLORER_|MM_LICENSE|PILOT_|PW_|FAKE_)/.test(key)) {
            env[key] = value;
        }
    }
    return {...env, ...extra};
}

function exec(command, args, {env = {}, cwd = REPO_ROOT, input} = {}) {
    return new Promise((resolve) => {
        const child = spawn(command, args, {env: cleanEnv(env), cwd, stdio: ['pipe', 'pipe', 'pipe']});
        let out = '';
        child.stdout.on('data', (d) => (out += d));
        child.stderr.on('data', (d) => (out += d));
        child.on('close', (code) => resolve({code, out}));
        child.stdin.end(input ?? '');
    });
}
const node = (script, args = [], opts) => exec(process.execPath, [path.join(HERE, script), ...args], opts);
const bash = (script, args = [], opts) => exec('bash', [path.join(HERE, script), ...args], opts);

const goodMain = (over = {}) => ({
    INPUT_TARGET_KIND: 'main',
    INPUT_IMAGE: MAIN_IMAGE,
    INPUT_COMMIT_SHA: MAIN_PIN.sha,
    INPUT_TEST_SOURCE_REF: '',
    INPUT_SESSION: 'bookmarks',
    INPUT_CONTROL: 'release-bookmark-title-changed',
    INPUT_VERIFIER: 'process',
    INPUT_TIME_BUDGET_MINUTES: String(BUDGET_MINUTES.default),
    GITHUB_RUN_ATTEMPT: '1',
    ...over,
});
const goodRelease = (over = {}) =>
    goodMain({INPUT_TARGET_KIND: 'release', INPUT_IMAGE: RELEASE_IMAGE, INPUT_COMMIT_SHA: RELEASE_PIN.ref, ...over});

function listen(handler) {
    return new Promise((resolve) => {
        const server = http.createServer(handler);
        server.listen(0, '127.0.0.1', () =>
            resolve({server, port: server.address().port, close: () => new Promise((r) => server.close(r))}),
        );
    });
}

async function closedPort() {
    const stub = await listen(() => {});
    const {port} = stub;
    await stub.close();
    return port;
}

// ---------- check_inputs ----------
check('inputs: a valid main dispatch is accepted and the run id is derived from digest, session and attempt', () => {
    const result = checkInputs(goodMain({GITHUB_RUN_ATTEMPT: '2'}));
    assert(result.ok, result.errors.join('; '));
    equal(result.values.run_id, `bookmarks-${MAIN_PIN.image.digest.slice(7, 19)}-a2`, 'run id');
    assert(
        result.values.artifact_name.includes(result.values.image.digest_short) &&
            result.values.artifact_name.includes(result.values.run_id),
        'artifact name',
    );
    equal(
        result.values.verify_spec,
        'explorer-proto/sessions/bookmarks/generated/channels_bookmarks_bar_follows_switch.spec.ts',
        'spec',
    );
});

check('inputs: a valid release dispatch is accepted', () => {
    const result = checkInputs(goodRelease());
    assert(result.ok, result.errors.join('; '));
});

check('inputs: a tag without a digest is refused', () => {
    for (const image of [
        'mattermostdevelopment/mattermost-enterprise-edition:2d6c285_fc5e259',
        'mattermostdevelopment/mattermost-enterprise-edition:master',
        `mattermostdevelopment/mattermost-enterprise-edition@${MAIN_PIN.image.digest}`,
        '',
    ]) {
        assert(!checkInputs(goodMain({INPUT_IMAGE: image})).ok, `accepted ${image}`);
    }
});

check('inputs: malformed digests are refused', () => {
    const base = 'mattermostdevelopment/mattermost-enterprise-edition:2d6c285_fc5e259';
    const digests = [
        'sha256:abc',
        `sha256:${'A'.repeat(64)}`,
        `sha256:${'g'.repeat(64)}`,
        `sha256:${'a'.repeat(65)}`,
        `sha512:${'a'.repeat(64)}`,
        `sha256:${'a'.repeat(64)} `,
        ` sha256:${'a'.repeat(64)}`,
    ];
    for (const digest of digests) {
        assert(!checkInputs(goodMain({INPUT_IMAGE: `${base}@${digest}`})).ok, `accepted ${digest}`);
    }
    assert(
        checkInputs(goodMain({INPUT_IMAGE: `${base}@sha256:${'a'.repeat(64)}`})).ok,
        'a well-formed digest is refused',
    );
});

check('inputs: only the repository of the kind is accepted', () => {
    const digest = `@sha256:${'a'.repeat(64)}`;
    for (const image of [
        `evil/mattermost-enterprise-edition:abcdef0${digest}`,
        `docker.io/mattermostdevelopment/mattermost-enterprise-edition:abcdef0${digest}`,
        `registry.example.com/mattermostdevelopment/mattermost-enterprise-edition:abcdef0${digest}`,
        `mattermost/mattermost-enterprise-edition:abcdef0${digest}`,
    ]) {
        assert(
            !checkInputs(goodMain({INPUT_IMAGE: image, INPUT_COMMIT_SHA: SYNTH.commit})).ok,
            `accepted ${image} for main`,
        );
    }
    assert(!checkInputs(goodRelease({INPUT_IMAGE: MAIN_IMAGE})).ok, 'a dev image was accepted for release');
});

check('inputs: commit_sha must match the kind', () => {
    for (const commit of ['2d6c285', MAIN_PIN.sha.toUpperCase(), 'v12.1.0', `${MAIN_PIN.sha}0`, '']) {
        assert(!checkInputs(goodMain({INPUT_COMMIT_SHA: commit})).ok, `main accepted ${commit}`);
    }
    for (const commit of ['12.1.0', 'v12.1', 'v12.1.0; rm -rf /', MAIN_PIN.sha, 'v12.1.0-beta1', '']) {
        assert(!checkInputs(goodRelease({INPUT_COMMIT_SHA: commit})).ok, `release accepted ${commit}`);
    }
    assert(checkInputs(goodRelease({INPUT_COMMIT_SHA: 'v12.1.0'})).ok, 'v12.1.0 refused');
});

check('inputs: session, control and verifier are allowlisted', () => {
    assert(!checkInputs(goodMain({INPUT_SESSION: 'auto-follow'})).ok, 'session');
    assert(!checkInputs(goodMain({INPUT_SESSION: '../bookmarks'})).ok, 'session path');
    assert(!checkInputs(goodMain({INPUT_CONTROL: 'team-admin'})).ok, 'control');
    assert(!checkInputs(goodMain({INPUT_CONTROL: '../x'})).ok, 'control path');
    for (const verifier of ['agent', 'manual', 'cmd:echo', 'Process', '']) {
        assert(!checkInputs(goodMain({INPUT_VERIFIER: verifier})).ok, `verifier ${verifier}`);
    }
    assert(!checkInputs(goodMain({INPUT_TARGET_KIND: 'nightly'})).ok, 'kind');
});

check('inputs: the time budget is bounded to 100..180 whole minutes, empty means 120', () => {
    for (const budget of ['5', '45', '99', '181', '200', '-1', 'abc', '120.5', '1e2', '120x']) {
        assert(!checkInputs(goodMain({INPUT_TIME_BUDGET_MINUTES: budget})).ok, `accepted ${budget}`);
    }
    for (const [budget, expected] of [
        ['100', 100],
        ['180', 180],
        ['120', 120],
        ['', 120],
    ]) {
        const result = checkInputs(goodMain({INPUT_TIME_BUDGET_MINUTES: budget}));
        assert(result.ok && result.values.time_budget_minutes === expected, `budget ${budget}`);
    }
});

check('inputs: a target kind the coordinator entry refuses is rejected before anything is pulled', async () => {
    equal(COORDINATOR_TARGET_KINDS, ['release'], 'the coordinator verify-spec entry accepts release only');
    const main = checkInputsFor(goodMain());
    assert(!main.ok && main.errors.some((e) => e.includes('--target release only')), `main accepted: ${main.errors}`);
    assert(checkInputsFor(goodRelease()).ok, 'release refused');
    const cli = await node('check_inputs.mjs', [], {env: {...goodMain(), EXPLORER_CI_DIR: tmp()}});
    equal(cli.code, 2, `the CLI accepted main: ${cli.out}`);
});

check('inputs: test_source_ref is empty or a full SHA', () => {
    for (const ref of ['master', 'abcdef0', 'refs/heads/x', `${'a'.repeat(40)}x`]) {
        assert(!checkInputs(goodMain({INPUT_TEST_SOURCE_REF: ref})).ok, `accepted ${ref}`);
    }
    assert(checkInputs(goodMain({INPUT_TEST_SOURCE_REF: 'a'.repeat(40)})).ok, 'a full SHA was refused');
});

check('inputs: hostile values are refused and cannot inject a workflow command', async () => {
    const hostile = `x\n::set-output name=pwn::1\n::add-mask::y${'z'.repeat(200)}`;
    const dir = tmp();
    const result = await node('check_inputs.mjs', [], {
        env: {
            ...goodMain({INPUT_IMAGE: hostile, INPUT_CONTROL: hostile, INPUT_COMMIT_SHA: hostile}),
            EXPLORER_CI_DIR: dir,
        },
    });
    equal(result.code, 2, 'exit code');
    const lines = result.out.split('\n').filter(Boolean);
    assert(
        lines.every((l) => l.startsWith('::error title=exploratory inputs::') || l.startsWith('inputs: FAIL')),
        `unexpected output lines: ${lines.join(' | ')}`,
    );
    assert(!result.out.includes('::set-output') && !result.out.includes('::add-mask'), 'a workflow command was echoed');
    assert(!fs.existsSync(path.join(dir, 'inputs.json')), 'inputs.json was written for invalid inputs');
});

check(
    'inputs: the CLI writes inputs.json and the step outputs only when valid, and nothing under --dry-run',
    async () => {
        const dir = tmp();
        const outputFile = path.join(dir, 'out.txt');
        fs.writeFileSync(outputFile, '');
        let result = await node('check_inputs.mjs', ['--dry-run'], {
            env: {...goodRelease(), EXPLORER_CI_DIR: dir, GITHUB_OUTPUT: outputFile},
        });
        equal(result.code, 0, 'dry run exit');
        assert(
            !fs.existsSync(path.join(dir, 'inputs.json')) && fs.readFileSync(outputFile, 'utf8') === '',
            'dry run wrote',
        );
        result = await node('check_inputs.mjs', [], {
            env: {...goodRelease(), EXPLORER_CI_DIR: dir, GITHUB_OUTPUT: outputFile},
        });
        equal(result.code, 0, 'exit');
        const outputs = fs.readFileSync(outputFile, 'utf8');
        assert(
            /^run_id=bookmarks-[0-9a-f]{12}-a1$/m.test(outputs) &&
                /^digest_short=[0-9a-f]{12}$/m.test(outputs) &&
                /^artifact_name=exploratory-/m.test(outputs),
            `outputs: ${outputs}`,
        );
        equal(readJson(path.join(dir, 'inputs.json')).target_kind, 'release', 'inputs.json');
    },
);

check('inputs: every allowlisted session and control exists in the repository', () => {
    const control = path.join(REPO_ROOT, 'explorer-proto/v2/orchestrator/controls/release-bookmark-title-changed.json');
    assert(fs.existsSync(control), 'control definition');
    assert(fs.existsSync(path.join(REPO_ROOT, 'explorer-proto/sessions/bookmarks/charter.json')), 'charter');
});

// ---------- verify_target ----------
check('provenance: the tag convention for main', () => {
    const image = (tag) => ({
        repository: 'mattermostdevelopment/mattermost-enterprise-edition',
        tag,
        digest: SYNTH.digest,
    });
    equal(
        evaluateConvention({kind: 'main', image: image('abcdef0_1234567'), commit: SYNTH.commit}).check.result,
        'pass',
        'mm_ee',
    );
    equal(
        evaluateConvention({kind: 'main', image: image('abcdef0'), commit: SYNTH.commit}).check.result,
        'pass',
        'mm only',
    );
    for (const tag of [
        'abcdef1_1234567',
        'master',
        'latest',
        'abcdef0_12345678',
        'ABCDEF0',
        'abcdef0_',
        'release-12.1',
    ]) {
        equal(evaluateConvention({kind: 'main', image: image(tag), commit: SYNTH.commit}).check.result, 'fail', tag);
    }
});

check('provenance: the tag convention for release', () => {
    const image = (tag) => ({repository: 'mattermost/mattermost-enterprise-edition', tag, digest: SYNTH.digest});
    equal(
        evaluateConvention({kind: 'release', image: image('12.1.0'), commit: 'v12.1.0'}).check.result,
        'pass',
        'version',
    );
    equal(
        evaluateConvention({kind: 'release', image: image('11.4.0-rc3'), commit: 'v11.4.0-rc3'}).check.result,
        'pass',
        'rc',
    );
    for (const tag of ['12.1.1', 'v12.1.0', 'latest', 'release-12.1']) {
        equal(evaluateConvention({kind: 'release', image: image(tag), commit: 'v12.1.0'}).check.result, 'fail', tag);
    }
});

async function verifyCli(args, env = {}) {
    const dir = tmp();
    const result = await node('verify_target.mjs', [...args, '--out', path.join(dir, 'provenance.json')], {env});
    let provenance = null;
    try {
        provenance = readJson(path.join(dir, 'provenance.json'));
    } catch {
        provenance = null;
    }
    return {...result, provenance};
}

check('provenance: the repository main pin verifies offline', async () => {
    const result = await verifyCli(['--kind', 'main', '--image', MAIN_IMAGE, '--commit', MAIN_PIN.sha, '--repo-pin']);
    equal(result.code, 0, `exit ${result.out}`);
    equal(result.provenance.status, 'verified', 'status');
    equal(result.provenance.sources, ['build-record'], 'sources');
    equal(result.provenance.resolved_commit_sha, MAIN_PIN.sha, 'resolved commit');
    equal(result.provenance.enterprise_sha7, MAIN_PIN.image.ref.split('_')[1], 'enterprise sha');
});

check('provenance: the repository release pin verifies offline and resolves the tag to its commit', async () => {
    const result = await verifyCli([
        '--kind',
        'release',
        '--image',
        RELEASE_IMAGE,
        '--commit',
        RELEASE_PIN.ref,
        '--repo-pin',
    ]);
    equal(result.code, 0, `exit ${result.out}`);
    equal(result.provenance.resolved_commit_sha, RELEASE_PIN.sha, 'resolved commit');
});

check('provenance: a tag that does not embed the commit is blocked with exit 3', async () => {
    const result = await verifyCli(['--kind', 'main', '--image', MAIN_IMAGE, '--commit', SYNTH.commit, '--repo-pin']);
    equal(result.code, 3, 'exit');
    equal(result.provenance.status, 'blocked', 'status');
    equal(result.provenance.blocked.kind, 'mismatch', 'kind');
});

check('provenance: a moving alias tag is blocked', async () => {
    const image = `mattermostdevelopment/mattermost-enterprise-edition:master@sha256:${'a'.repeat(64)}`;
    const result = await verifyCli([
        '--kind',
        'main',
        '--image',
        image,
        '--commit',
        SYNTH.commit,
        '--build-record',
        path.join(FIXTURES, 'build-record.main.json'),
    ]);
    equal(result.code, 3, 'exit');
});

check('provenance: a missing build record is blocked and never passes', async () => {
    const result = await verifyCli([
        '--kind',
        'main',
        '--image',
        SYNTH.image,
        '--commit',
        SYNTH.commit,
        '--build-record',
        path.join(os.tmpdir(), 'no-such-record.json'),
    ]);
    equal(result.code, 3, 'exit');
    equal(result.provenance.status, 'blocked', 'status');
    equal(result.provenance.blocked.kind, 'unverifiable', 'kind');
});

check('provenance: no record and no online check is blocked', async () => {
    const result = await verifyCli(['--kind', 'main', '--image', SYNTH.image, '--commit', SYNTH.commit]);
    equal(result.code, 3, 'exit');
    equal(result.provenance.blocked.kind, 'unverifiable', 'kind');
});

check('provenance: a supplied build record verifies offline', async () => {
    const result = await verifyCli([
        '--kind',
        'main',
        '--image',
        SYNTH.image,
        '--commit',
        SYNTH.commit,
        '--build-record',
        path.join(FIXTURES, 'build-record.main.json'),
    ]);
    equal(result.code, 0, result.out);
    const release = await verifyCli([
        '--kind',
        'release',
        '--image',
        `mattermost/mattermost-enterprise-edition:11.4.0-rc3@sha256:${'b'.repeat(64)}`,
        '--commit',
        'v11.4.0-rc3',
        '--build-record',
        path.join(FIXTURES, 'build-record.release.json'),
    ]);
    equal(release.code, 0, release.out);
    equal(release.provenance.resolved_commit_sha, '0123456789abcdef0123456789abcdef01234567', 'release commit');
});

check('provenance: a record that names the same tag with another digest or commit is a mismatch', async () => {
    const otherDigest = `mattermostdevelopment/mattermost-enterprise-edition:abcdef0_1234567@sha256:${'c'.repeat(64)}`;
    const digest = await verifyCli([
        '--kind',
        'main',
        '--image',
        otherDigest,
        '--commit',
        SYNTH.commit,
        '--build-record',
        path.join(FIXTURES, 'build-record.main.json'),
    ]);
    equal(digest.code, 3, 'digest exit');
    equal(digest.provenance.blocked.kind, 'mismatch', 'digest kind');
    const dir = tmp();
    const wrongCommit = path.join(dir, 'record.json');
    fs.writeFileSync(
        wrongCommit,
        JSON.stringify({
            ...readJson(path.join(FIXTURES, 'build-record.main.json')),
            commit_sha: 'abcdef0'.padEnd(40, 'f'),
        }),
    );
    const commit = await verifyCli([
        '--kind',
        'main',
        '--image',
        SYNTH.image,
        '--commit',
        SYNTH.commit,
        '--build-record',
        wrongCommit,
    ]);
    equal(commit.code, 3, 'commit exit');
    equal(commit.provenance.blocked.kind, 'mismatch', 'commit kind');
});

check('provenance: a record for another image is not evidence, an invalid record is a failure', async () => {
    const other = await verifyCli([
        '--kind',
        'main',
        '--image',
        MAIN_IMAGE,
        '--commit',
        MAIN_PIN.sha,
        '--build-record',
        path.join(FIXTURES, 'build-record.main.json'),
    ]);
    equal(other.code, 3, 'other exit');
    equal(other.provenance.blocked.kind, 'unverifiable', 'other kind');
    const bad = await verifyCli([
        '--kind',
        'main',
        '--image',
        SYNTH.image,
        '--commit',
        SYNTH.commit,
        '--build-record',
        path.join(FIXTURES, 'build-record.bad-schema.json'),
    ]);
    equal(bad.code, 3, 'bad exit');
    equal(bad.provenance.blocked.kind, 'mismatch', 'bad kind');
});

check('provenance: a target pin whose build_sha differs from its sha is rejected', async () => {
    const dir = tmp();
    const pin = path.join(dir, 'main.json');
    fs.writeFileSync(pin, JSON.stringify({...MAIN_PIN, image: {...MAIN_PIN.image, build_sha: 'f'.repeat(40)}}));
    const result = await verifyCli([
        '--kind',
        'main',
        '--image',
        MAIN_IMAGE,
        '--commit',
        MAIN_PIN.sha,
        '--build-record',
        pin,
    ]);
    equal(result.code, 3, 'exit');
});

check('provenance: --dry-run touches no network and writes nothing', async () => {
    const dir = tmp();
    const out = path.join(dir, 'provenance.json');
    const result = await node(
        'verify_target.mjs',
        [
            '--kind',
            'main',
            '--image',
            MAIN_IMAGE,
            '--commit',
            MAIN_PIN.sha,
            '--repo-pin',
            '--online',
            '--dry-run',
            '--out',
            out,
        ],
        {env: {EXPLORER_CI_REGISTRY_AUTH_URL: 'http://127.0.0.1:9', EXPLORER_CI_REGISTRY_URL: 'http://127.0.0.1:9'}},
    );
    equal(result.code, 0, result.out);
    assert(!fs.existsSync(out), 'dry run wrote a file');
});

function registryStub({
    digest = SYNTH.digest,
    manifestStatus = 200,
    tokenStatus = 200,
    commitStatus = 200,
    commitSha = SYNTH.commit,
    tagType = 'commit',
    tagCommit = '0123456789abcdef0123456789abcdef01234567',
} = {}) {
    return listen((req, res) => {
        const url = req.url ?? '';
        if (url.startsWith('/token')) {
            res.writeHead(tokenStatus, {'content-type': 'application/json'});
            res.end(JSON.stringify({token: 'stub-token'}));
        } else if (url.startsWith('/v2/')) {
            if (req.headers.authorization !== 'Bearer stub-token') {
                res.writeHead(401).end();
            } else {
                res.writeHead(manifestStatus, manifestStatus === 200 ? {'docker-content-digest': digest} : {}).end();
            }
        } else if (url.startsWith('/repos/mattermost/mattermost/commits/')) {
            res.writeHead(commitStatus, {'content-type': 'application/json'});
            res.end(JSON.stringify({sha: commitSha}));
        } else if (url.startsWith('/repos/mattermost/mattermost/git/ref/tags/')) {
            res.writeHead(200, {'content-type': 'application/json'});
            res.end(JSON.stringify({object: {type: tagType, sha: tagType === 'tag' ? '1'.repeat(40) : tagCommit}}));
        } else if (url.startsWith('/repos/mattermost/mattermost/git/tags/')) {
            res.writeHead(200, {'content-type': 'application/json'});
            res.end(JSON.stringify({object: {type: 'commit', sha: tagCommit}}));
        } else {
            res.writeHead(404).end();
        }
    });
}

async function onlineVerify(stubOptions, args) {
    const stub = await registryStub(stubOptions);
    try {
        const base = `http://127.0.0.1:${stub.port}`;
        return await verifyTarget({
            ...args,
            online: true,
            env: {
                EXPLORER_CI_REGISTRY_AUTH_URL: base,
                EXPLORER_CI_REGISTRY_URL: base,
                GITHUB_API_URL: base,
                GITHUB_TOKEN: 'stub-github-token',
            },
        });
    } finally {
        await stub.close();
    }
}
const synthMain = {
    kind: 'main',
    image: {
        repository: 'mattermostdevelopment/mattermost-enterprise-edition',
        tag: 'abcdef0_1234567',
        digest: SYNTH.digest,
    },
    commit: SYNTH.commit,
};

check('provenance online: the registry digest equal to the input verifies, with no build record', async () => {
    const result = await onlineVerify({}, synthMain);
    equal(result.status, 'verified', JSON.stringify(result.checks));
    equal(result.sources, ['registry-digest'], 'sources');
    assert(
        result.checks.some((c) => c.id === 'commit-exists' && c.result === 'pass'),
        'commit existence',
    );
});

check('provenance online: a different registry digest, a missing tag or a missing commit is a mismatch', async () => {
    for (const [options, label] of [
        [{digest: `sha256:${'d'.repeat(64)}`}, 'digest'],
        [{manifestStatus: 404}, 'tag'],
        [{commitStatus: 404}, 'commit'],
        [{commitSha: 'f'.repeat(40)}, 'commit sha'],
    ]) {
        const result = await onlineVerify(options, synthMain);
        equal(result.status, 'blocked', label);
        equal(result.blocked.kind, 'mismatch', label);
    }
});

check('provenance online: an unavailable registry or token endpoint is blocked as unverifiable', async () => {
    for (const options of [{tokenStatus: 500}, {manifestStatus: 429}]) {
        const result = await onlineVerify(options, synthMain);
        equal(result.status, 'blocked', JSON.stringify(options));
        equal(result.blocked.kind, 'unverifiable', JSON.stringify(options));
    }
    const port = await closedPort();
    const base = `http://127.0.0.1:${port}`;
    const result = await verifyTarget({
        ...synthMain,
        online: true,
        env: {EXPLORER_CI_REGISTRY_AUTH_URL: base, EXPLORER_CI_REGISTRY_URL: base, GITHUB_API_URL: base},
    });
    equal(result.status, 'blocked', 'network down');
    equal(result.blocked.kind, 'unverifiable', 'network down kind');
});

check(
    'provenance online: an unavailable GitHub API does not block when the digest is proven, a failed convention skips the network',
    async () => {
        const registryOnly = await registryStub({});
        const port = await closedPort();
        try {
            const base = `http://127.0.0.1:${registryOnly.port}`;
            const result = await verifyTarget({
                ...synthMain,
                online: true,
                env: {
                    EXPLORER_CI_REGISTRY_AUTH_URL: base,
                    EXPLORER_CI_REGISTRY_URL: base,
                    GITHUB_API_URL: `http://127.0.0.1:${port}`,
                },
            });
            equal(result.status, 'verified', JSON.stringify(result.checks));
            assert(
                result.checks.some((c) => c.id === 'commit-exists' && c.result === 'unavailable'),
                'commit check should be unavailable',
            );
            const skipped = await verifyTarget({
                ...synthMain,
                commit: 'f'.repeat(40),
                online: true,
                env: {EXPLORER_CI_REGISTRY_AUTH_URL: base, EXPLORER_CI_REGISTRY_URL: base},
            });
            equal(skipped.status, 'blocked', 'convention failure');
            assert(
                skipped.checks.some((c) => c.id === 'registry-digest' && c.result === 'skipped'),
                'network should be skipped',
            );
        } finally {
            await registryOnly.close();
        }
    },
);

check('provenance online: a release tag is resolved through the GitHub API, annotated tags included', async () => {
    const release = {
        kind: 'release',
        image: {repository: 'mattermost/mattermost-enterprise-edition', tag: '11.4.0-rc3', digest: SYNTH.digest},
        commit: 'v11.4.0-rc3',
    };
    for (const tagType of ['commit', 'tag']) {
        const result = await onlineVerify({tagType}, release);
        equal(result.status, 'verified', `${tagType}: ${JSON.stringify(result.checks)}`);
        equal(result.resolved_commit_sha, '0123456789abcdef0123456789abcdef01234567', `${tagType} commit`);
    }
});

check('provenance online: a release record and GitHub that disagree on the tag commit are blocked', async () => {
    const stub = await registryStub({tagCommit: 'e'.repeat(40)});
    try {
        const base = `http://127.0.0.1:${stub.port}`;
        const result = await verifyTarget({
            kind: 'release',
            image: {
                repository: 'mattermost/mattermost-enterprise-edition',
                tag: '11.4.0-rc3',
                digest: `sha256:${'b'.repeat(64)}`,
            },
            commit: 'v11.4.0-rc3',
            recordFile: path.join(FIXTURES, 'build-record.release.json'),
            online: true,
            env: {EXPLORER_CI_REGISTRY_AUTH_URL: base, EXPLORER_CI_REGISTRY_URL: base, GITHUB_API_URL: base},
        });
        equal(result.status, 'blocked', JSON.stringify(result.checks));
        equal(result.blocked.kind, 'mismatch', 'kind');
    } finally {
        await stub.close();
    }
});

async function liveCase(config, provenance, baseHost) {
    const stub = await listen((req, res) => {
        res.writeHead(config ? 200 : 500, {'content-type': 'application/json'});
        res.end(JSON.stringify(config ?? {}));
    });
    try {
        return await verifyLive({baseUrl: `http://${baseHost ?? '127.0.0.1'}:${stub.port}`, provenance});
    } finally {
        await stub.close();
    }
}
const verifiedProvenance = (over = {}) => ({
    status: 'verified',
    target_kind: 'main',
    resolved_commit_sha: SYNTH.commit,
    enterprise_sha7: '1234567',
    image: {tag: 'abcdef0_1234567'},
    ...over,
});

check('provenance live: the server build hash must equal the target commit', async () => {
    equal(
        (
            await liveCase(
                {BuildHash: SYNTH.commit, BuildHashEnterprise: '1234567'.padEnd(40, '0')},
                verifiedProvenance(),
            )
        ).status,
        'verified',
        'match',
    );
    equal(
        (
            await liveCase(
                {BuildHash: 'f'.repeat(40), BuildHashEnterprise: '1234567'.padEnd(40, '0')},
                verifiedProvenance(),
            )
        ).status,
        'blocked',
        'hash mismatch',
    );
    equal(
        (
            await liveCase(
                {BuildHash: SYNTH.commit, BuildHashEnterprise: '7654321'.padEnd(40, '0')},
                verifiedProvenance(),
            )
        ).status,
        'blocked',
        'enterprise mismatch',
    );
    equal((await liveCase({}, verifiedProvenance())).status, 'blocked', 'no hash');
    equal((await liveCase(null, verifiedProvenance())).status, 'blocked', 'server error');
});

check(
    'provenance live: release checks the version, a blocked pre-run provenance and a non-loopback URL never pass',
    async () => {
        const release = verifiedProvenance({target_kind: 'release', enterprise_sha7: null, image: {tag: '12.1.0'}});
        equal(
            (await liveCase({BuildHash: SYNTH.commit, Version: '12.1.0'}, release)).status,
            'verified',
            'release match',
        );
        equal(
            (await liveCase({BuildHash: SYNTH.commit, Version: '12.2.0'}, release)).status,
            'blocked',
            'version mismatch',
        );
        equal(
            (await liveCase({BuildHash: SYNTH.commit}, {...verifiedProvenance(), status: 'blocked'})).status,
            'blocked',
            'blocked provenance',
        );
        equal(
            (
                await verifyLive({
                    baseUrl: 'http://example.com:8065',
                    provenance: verifiedProvenance(),
                    fetchImpl: () => {
                        throw new Error('must not fetch');
                    },
                })
            ).status,
            'blocked',
            'non-loopback',
        );
        equal(
            (await verifyLive({baseUrl: 'https://127.0.0.1:8065', provenance: verifiedProvenance()})).status,
            'blocked',
            'https',
        );
    },
);

// ---------- assert_no_capture ----------
const realConfig = fs.readFileSync(path.join(REPO_ROOT, 'explorer-proto/playwright.config.ts'), 'utf8');
const baseConfig = fs.readFileSync(path.join(REPO_ROOT, 'e2e-tests/playwright/playwright.config.ts'), 'utf8');

check(
    'capture: the real explorer config has screenshot, video and trace off, and the chrome project sets none',
    async () => {
        equal(checkConfig(realConfig), [], 'explorer config');
        equal(checkBaseChromeProject(baseConfig), [], 'chrome project');
        equal((await node('assert_no_capture.mjs')).code, 0, 'CLI');
    },
);

check('capture: a config that enables screenshot, video or trace fails', () => {
    for (const [from, to] of [
        ["screenshot: 'off'", "screenshot: 'on'"],
        ["screenshot: 'off'", "screenshot: 'only-on-failure'"],
        ["video: 'off'", "video: 'retain-on-failure'"],
        ["video: 'off'", "video: {mode: 'on'}"],
        ["trace: 'off'", "trace: 'retain-on-failure'"],
        ["trace: 'off'", 'trace: process.env.TRACE'],
    ]) {
        assert(realConfig.includes(from), `fixture drifted: ${from}`);
        assert(checkConfig(realConfig.replace(from, to)).length > 0, `accepted ${to}`);
    }
});

check('capture: a config with a key missing or only commented out fails', () => {
    for (const key of ['screenshot', 'video', 'trace']) {
        const removed = realConfig.replace(new RegExp(`^\\s*${key}: 'off',\\n`, 'm'), '');
        assert(removed !== realConfig && checkConfig(removed).length > 0, `${key} missing was accepted`);
        const commented = realConfig.replace(new RegExp(`^(\\s*)${key}: 'off',`, 'm'), `$1// ${key}: 'off',`);
        assert(checkConfig(commented).length > 0, `${key} commented out was accepted`);
    }
});

check('capture: a chrome project that sets capture, or one that cannot be read, fails closed', () => {
    equal(checkBaseChromeProject(fs.readFileSync(path.join(FIXTURES, 'chrome-use.ok.ts'), 'utf8')), [], 'ok fixture');
    assert(
        checkBaseChromeProject(fs.readFileSync(path.join(FIXTURES, 'chrome-use.capture.ts'), 'utf8')).length > 0,
        'capture fixture accepted',
    );
    assert(checkBaseChromeProject('export default {};').length > 0, 'unreadable accepted');
});

check('capture: an export with a png, webm, zip, trace or symlink fails; a clean one passes', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'run.json'), '{}');
    fs.mkdirSync(path.join(dir, 'nested'));
    fs.writeFileSync(path.join(dir, 'nested', 'summary.md'), 'ok');
    equal(checkExport(dir), {problems: [], files: 2}, 'clean');
    for (const name of ['shot.png', 'nested/clip.webm', 'trace.zip', 'a.TRACE', 'x.har', 'p.jpeg']) {
        const bad = tmp();
        fs.mkdirSync(path.join(bad, 'nested'));
        fs.writeFileSync(path.join(bad, name), 'x');
        assert(checkExport(bad).problems.length === 1, `${name} accepted`);
    }
    const link = tmp();
    fs.symlinkSync(os.tmpdir(), path.join(link, 'l'));
    assert(checkExport(link).problems.length === 1, 'symlink accepted');
    assert(checkExport(path.join(dir, 'missing')).problems.length === 1, 'missing dir accepted');
});

// ---------- run_facts ----------
function factsRoot({lock = 'lock-a', pin = '1.62.1', spec = 'spec body'} = {}) {
    const root = tmp('ci-root-');
    const write = (rel, text) => {
        fs.mkdirSync(path.dirname(path.join(root, rel)), {recursive: true});
        fs.writeFileSync(path.join(root, rel), text);
    };
    write('explorer-proto/sessions/bookmarks/generated/x.spec.ts', spec);
    write('e2e-tests/playwright/package-lock.json', lock);
    write('e2e-tests/playwright/package.json', JSON.stringify({devDependencies: {'@playwright/test': pin}}));
    return root;
}
const factsInputs = () =>
    checkInputs(goodMain({})).values && {
        ...checkInputs(goodMain({})).values,
        verify_spec: 'explorer-proto/sessions/bookmarks/generated/x.spec.ts',
    };

check('facts: the three revisions are recorded and the coordinator revision is GITHUB_SHA', () => {
    const root = factsRoot();
    const sha = 'c'.repeat(40);
    const built = buildFacts({
        inputs: factsInputs(),
        env: {GITHUB_SHA: sha, GITHUB_REPOSITORY: 'o/r'},
        root,
        now: 5000,
    });
    assert(built.ok, JSON.stringify(built));
    equal(
        [built.facts.target_commit, built.facts.coordinator_revision, built.facts.test_source_revision],
        [MAIN_PIN.sha, sha, sha],
        'revisions',
    );
    equal(built.facts.coordinator_revision_source, 'GITHUB_SHA', 'source');
    equal(built.facts.started_epoch_s, 5, 'epoch');
    equal(
        built.facts.verify_spec_sha256_start,
        crypto.createHash('sha256').update('spec body').digest('hex'),
        'spec hash',
    );
});

check('facts: a test source revision is compatible only with an identical Playwright pin and lock', () => {
    const root = factsRoot();
    const other = 'e'.repeat(40);
    const inputs = {...factsInputs(), test_source_ref: other};
    const write = (rel, text) => {
        fs.mkdirSync(path.dirname(path.join(root, '.test-source', rel)), {recursive: true});
        fs.writeFileSync(path.join(root, '.test-source', rel), text);
    };
    write('e2e-tests/playwright/package-lock.json', 'lock-a');
    write('e2e-tests/playwright/package.json', JSON.stringify({devDependencies: {'@playwright/test': '1.62.1'}}));
    const same = buildFacts({inputs, env: {GITHUB_SHA: 'c'.repeat(40)}, root});
    assert(same.ok, JSON.stringify(same));
    equal(same.facts.test_source_revision, other, 'revision');
    write('e2e-tests/playwright/package-lock.json', 'lock-b');
    assert(!buildFacts({inputs, env: {GITHUB_SHA: 'c'.repeat(40)}, root}).ok, 'a different lock was accepted');
    write('e2e-tests/playwright/package-lock.json', 'lock-a');
    write('e2e-tests/playwright/package.json', JSON.stringify({devDependencies: {'@playwright/test': '1.63.0'}}));
    assert(!buildFacts({inputs, env: {GITHUB_SHA: 'c'.repeat(40)}, root}).ok, 'a different pin was accepted');
    fs.rmSync(path.join(root, '.test-source'), {recursive: true});
    assert(!buildFacts({inputs, env: {GITHUB_SHA: 'c'.repeat(40)}, root}).ok, 'a missing test source was accepted');
});

check('facts: a missing spec is blocked', () => {
    const root = factsRoot();
    assert(
        !buildFacts({
            inputs: {...factsInputs(), verify_spec: 'explorer-proto/sessions/bookmarks/generated/none.spec.ts'},
            env: {GITHUB_SHA: 'c'.repeat(40)},
            root,
        }).ok,
        'missing spec',
    );
});

function toolchainRoot({
    version = '1.62.1',
    headless = '1234',
    chromium = '1234',
    cache = ['chromium-1234', 'chromium_headless_shell-1234'],
} = {}) {
    const root = tmp('ci-tool-');
    const write = (rel, text) => {
        fs.mkdirSync(path.dirname(path.join(root, rel)), {recursive: true});
        fs.writeFileSync(path.join(root, rel), text);
    };
    const modules = 'e2e-tests/playwright/node_modules';
    write(`${modules}/@playwright/test/package.json`, JSON.stringify({version}));
    write(
        `${modules}/playwright-core/browsers.json`,
        JSON.stringify({
            browsers: [
                {name: 'chromium', revision: chromium},
                {name: 'chromium-headless-shell', revision: headless},
            ],
        }),
    );
    write('explorer-proto/v2/targets/main.json', JSON.stringify(MAIN_PIN));
    write('explorer-proto/v2/orchestrator/targets/release.json', JSON.stringify(RELEASE_PIN));
    const browsers = tmp('ci-browsers-');
    for (const dir of cache) {
        fs.mkdirSync(path.join(browsers, dir));
    }
    return {root, env: {PLAYWRIGHT_BROWSERS_PATH: browsers}};
}

check('facts: the toolchain is recorded and matches the target pin', () => {
    const {root, env} = toolchainRoot({cache: ['chromium-1234', 'chromium_headless_shell-1234', 'firefox-1']});
    const result = readToolchain({root, kind: 'main', env});
    assert(result.ok, result.problems.join('; '));
    equal(
        [
            result.toolchain.playwright_version,
            result.toolchain.chromium_revision,
            result.toolchain.chromium_headless_shell_revision,
        ],
        ['1.62.1', '1234', '1234'],
        'versions',
    );
    equal(result.toolchain.extra_browsers_present, ['firefox-1'], 'extra browsers are reported, not installed');
});

check('facts: a Playwright version or browser revision off the pin, or a missing browser, is blocked', () => {
    assert(!readToolchain({...toolchainRoot({version: '1.63.0'}), kind: 'main'}).ok, 'version');
    const wrongRevision = toolchainRoot({headless: '9999', cache: ['chromium-1234', 'chromium_headless_shell-9999']});
    assert(!readToolchain({...wrongRevision, kind: 'main'}).ok, 'revision');
    const missing = toolchainRoot({cache: ['chromium-1234']});
    assert(!readToolchain({...missing, kind: 'release'}).ok, 'missing headless shell');
    const none = toolchainRoot();
    fs.rmSync(path.join(none.root, 'e2e-tests/playwright/node_modules'), {recursive: true});
    assert(!readToolchain({...none, kind: 'main'}).ok, 'not installed');
});

check('facts: the CLI init against the real checkout reports git HEAD when GITHUB_SHA is unset', async () => {
    const dir = tmp();
    const inputs = await node('check_inputs.mjs', [], {env: {...goodRelease(), EXPLORER_CI_DIR: dir}});
    equal(inputs.code, 0, inputs.out);
    const result = await node('run_facts.mjs', ['init'], {env: {EXPLORER_CI_DIR: dir}});
    equal(result.code, 0, result.out);
    const head = (await exec('git', ['rev-parse', 'HEAD'])).out.trim();
    const facts = readJson(path.join(dir, 'run-facts.json'));
    equal([facts.coordinator_revision, facts.coordinator_revision_source], [head, 'local git HEAD'], 'revision');
    equal(
        (await node('run_facts.mjs', ['get', 'image.digest'], {env: {EXPLORER_CI_DIR: dir}})).out.trim(),
        RELEASE_PIN.image.digest,
        'get',
    );
    equal(
        (await node('run_facts.mjs', ['get', 'nope.nothing'], {env: {EXPLORER_CI_DIR: dir}})).code,
        2,
        'get of a missing fact',
    );
});

// ---------- ci_status ----------
check('status: record, show and run keep exit codes and map them to results', async () => {
    const dir = tmp();
    const env = {EXPLORER_CI_DIR: dir};
    const run = (args) => node('ci_status.mjs', args, {env});
    equal((await run(['record', 'inputs', 'PASS', 'ok'])).code, 0, 'record');
    equal((await run(['run', 'facts', '--', process.execPath, '-e', 'process.exit(0)'])).code, 0, 'run 0');
    equal(
        (await run(['run', 'provenance', '--', process.execPath, '-e', 'process.exit(3)'])).code,
        3,
        'run 3 keeps its code',
    );
    equal((await run(['run', 'coordinator', '--', process.execPath, '-e', 'process.exit(30)'])).code, 30, 'run 30');
    equal(
        (await run(['run', 'leak-scan', '--blocked-codes', '2', '--', process.execPath, '-e', 'process.exit(2)'])).code,
        2,
        'run 2',
    );
    equal((await run(['run', 'export', '--', process.execPath, '-e', 'process.exit(1)'])).code, 1, 'run 1');
    equal(
        (await run(['run', 'teardown', '--', process.execPath, '-e', 'process.kill(process.pid, "SIGTERM")'])).code,
        1,
        'run killed',
    );
    const stages = readJson(path.join(dir, 'ci-status.json')).stages;
    const results = Object.entries(stages)
        .map(([k, v]) => `${k}=${v.result}`)
        .sort();
    equal(
        results,
        [
            'coordinator=PENDING',
            'export=FAIL',
            'facts=PASS',
            'inputs=PASS',
            'leak-scan=BLOCKED',
            'provenance=BLOCKED',
            'teardown=FAIL',
        ],
        'ledger',
    );
    equal((await run(['record', 'nonsense', 'PASS'])).code, 2, 'unknown stage');
    equal((await run(['record', 'inputs', 'GREAT'])).code, 2, 'unknown result');
});

check('status: the overall result is the worst stage and an unrecorded stage is incomplete', () => {
    const all = (result) => ({stages: Object.fromEntries(STAGES.map(([id]) => [id, {result}]))});
    equal(overallResult(all('PASS')), 'PASS', 'pass');
    equal(overallResult({stages: {}}), 'INCOMPLETE', 'empty');
    const with1 = (result) => {
        const ledger = all('PASS');
        ledger.stages.coordinator = {result};
        return ledger;
    };
    equal(overallResult(with1('FAIL')), 'FAIL', 'fail');
    equal(overallResult(with1('BLOCKED')), 'BLOCKED', 'blocked');
    equal(overallResult(with1('PENDING')), 'PENDING', 'pending');
    equal(overallResult(with1('SKIPPED')), 'INCOMPLETE', 'skipped');
    const both = all('PASS');
    both.stages.gate = {result: 'BLOCKED'};
    both.stages.coordinator = {result: 'FAIL'};
    equal(overallResult(both), 'FAIL', 'fail beats blocked');
    equal(
        [
            exitForOverall('PASS'),
            exitForOverall('BLOCKED'),
            exitForOverall('PENDING'),
            exitForOverall('FAIL'),
            exitForOverall('INCOMPLETE'),
        ],
        [0, 3, 30, 1, 1],
        'exit codes',
    );
});

// ---------- final_summary ----------
const passLedger = () => ({stages: Object.fromEntries(STAGES.map(([id]) => [id, {result: 'PASS', detail: 'ok'}]))});
const sampleFacts = (root) => ({
    target_kind: 'main',
    target_commit: MAIN_PIN.sha,
    coordinator_revision: 'c'.repeat(40),
    test_source_revision: 'c'.repeat(40),
    image: {repository: 'r/x', tag: 't', digest: MAIN_PIN.image.digest},
    session: 'bookmarks',
    control: 'release-bookmark-title-changed',
    verifier: 'process',
    run_id: 'bookmarks-aaaa-a1',
    verify_spec: 'spec.ts',
    verify_spec_sha256_start: crypto.createHash('sha256').update('body').digest('hex'),
    toolchain: {playwright_version: '1.62.1', chromium_revision: '1234', chromium_headless_shell_revision: '1234'},
    root,
});

check('summary: every required row is present and the advisory sentence closes the summary', () => {
    const root = tmp();
    fs.writeFileSync(path.join(root, 'spec.ts'), 'body');
    const text = renderSummary({
        facts: sampleFacts(root),
        ledger: passLedger(),
        provenance: {status: 'verified', sources: ['build-record'], live: {status: 'verified'}},
        root,
    });
    for (const label of [
        'Target commit',
        'Image digest',
        'Coordinator revision',
        'Compatible test source revision',
        'Playwright',
        'Chromium revision',
        'Licence check',
        'Verifier delivery mode',
        'Spec hash unchanged',
        'Teardown',
    ]) {
        assert(text.includes(`| ${label} |`), `missing row ${label}`);
    }
    assert(
        text.includes('| Spec hash unchanged | yes |') &&
            text.includes('| Licence check | PASS |') &&
            text.includes('**Overall: PASS**'),
        'values',
    );
    for (const [, label] of STAGES) {
        assert(text.includes(label), `missing stage ${label}`);
    }
    equal(text.trimEnd().split('\n').pop(), ADVISORY_SENTENCE, 'last line');
});

check('summary: a changed spec file shows the hash as not unchanged', () => {
    const root = tmp();
    fs.writeFileSync(path.join(root, 'spec.ts'), 'other body');
    assert(
        renderSummary({facts: sampleFacts(root), ledger: passLedger(), provenance: null, root}).includes(
            '| Spec hash unchanged | NO |',
        ),
        'flag',
    );
});

check(
    'summary: a blocked licence is reported as blocked, not as a pass, with no credential in the output',
    async () => {
        const synthetic = `SYNTHETIC-${crypto.randomBytes(24).toString('hex')}`;
        const dir = tmp();
        fs.writeFileSync(
            path.join(dir, 'ci-status.json'),
            JSON.stringify({
                stages: {
                    licence: {result: 'BLOCKED', detail: 'the licence secret is not available to this run'},
                    gate: {result: 'BLOCKED', detail: 'the licence secret is not available to this run'},
                },
            }),
        );
        const summaryFile = path.join(dir, 'step-summary.md');
        const result = await node('final_summary.mjs', ['--github-summary-file', summaryFile], {
            env: {EXPLORER_CI_DIR: dir, MM_LICENSE: synthetic},
        });
        equal(result.code, 3, 'exit code');
        const text = fs.readFileSync(summaryFile, 'utf8');
        assert(
            text.includes('**Overall: BLOCKED**') &&
                text.includes('| Licence check | BLOCKED |') &&
                text.includes('This is not a pass.'),
            'blocked is not shown',
        );
        assert(!text.includes(synthetic) && !result.out.includes(synthetic), 'credential in output');
        assert(text.trimEnd().endsWith(ADVISORY_SENTENCE), 'advisory sentence');
    },
);

check('summary: the coordinator summary is included only after a passing leak scan', () => {
    const sample = fs.readFileSync(path.join(FIXTURES, 'pilot-summary.sample.md'), 'utf8');
    const root = tmp();
    const base = {facts: sampleFacts(root), provenance: null, pilotSummary: sample, root};
    assert(renderSummary({...base, ledger: passLedger()}).includes('Controlled failure'), 'not included after PASS');
    const ledger = passLedger();
    ledger.stages['leak-scan'] = {result: 'FAIL', detail: 'exit 1'};
    const text = renderSummary({...base, ledger});
    assert(!text.includes('Controlled failure') && text.includes('Withheld'), 'included after a failed scan');
});

// ---------- leak scan ----------
check(
    'leak scan: a leaked-looking string or fragment in an export fails, a clean export passes, no value is printed',
    async () => {
        const synthetic = `SYNTHETIC${crypto
            .randomBytes(40)
            .toString('base64')
            .replace(/[^A-Za-z0-9]/g, 'x')}`;
        const scan = path.join(REPO_ROOT, 'explorer-proto/infra/scripts/leak_scan.mjs');
        const dir = tmp();
        fs.mkdirSync(path.join(dir, 'ci'));
        fs.writeFileSync(path.join(dir, 'ci/run-facts.json'), '{"ok": true}');
        const env = {MM_LICENSE: synthetic};
        let result = await exec(process.execPath, [scan, dir], {env});
        equal(result.code, 0, `clean: ${result.out}`);
        fs.writeFileSync(path.join(dir, 'ci/note.txt'), `prefix ${synthetic} suffix`);
        result = await exec(process.execPath, [scan, dir], {env});
        equal(result.code, 1, 'full value');
        assert(!result.out.includes(synthetic), 'the value was printed');
        fs.writeFileSync(path.join(dir, 'ci/note.txt'), `fragment ${synthetic.slice(10, 50)} end`);
        equal((await exec(process.execPath, [scan, dir], {env})).code, 1, 'fragment');
        equal((await exec(process.execPath, [scan, dir], {})).code, 2, 'unset credential cannot scan');
        fs.rmSync(path.join(dir, 'ci/note.txt'));
        const ledgerDir = tmp();
        const blocked = await node(
            'ci_status.mjs',
            ['run', '--blocked-codes', '2', 'leak-scan', '--', process.execPath, scan, dir],
            {env: {EXPLORER_CI_DIR: ledgerDir}},
        );
        equal(blocked.code, 2, 'wrapper keeps the code');
        equal(
            readJson(path.join(ledgerDir, 'ci-status.json')).stages['leak-scan'].result,
            'BLOCKED',
            'an unset credential is blocked, not passed',
        );
    },
);

// ---------- workflow lint ----------
const yamlLib = (() => {
    try {
        return createRequire(path.join(REPO_ROOT, 'e2e-tests/playwright/package.json'))('yaml');
    } catch {
        return null;
    }
})();
const workflowText = fs.readFileSync(WORKFLOW_FILE, 'utf8');
const lint = (text) => lintWorkflow({text, yamlLib}).errors;

check('workflow: the real workflow and scripts pass the lint', () => {
    assert(yamlLib, 'the yaml package is not available in e2e-tests/playwright/node_modules');
    equal(lint(workflowText), [], 'workflow');
    equal(lintScripts(HERE), [], 'scripts');
});

check('workflow: only the licence-bearing steps receive the licence, and only as MM_LICENSE', () => {
    const {secretsMap} = lintWorkflow({text: workflowText, yamlLib});
    equal(
        secretsMap.map((e) => e.step).sort(),
        ['ci/coordinator', 'ci/export', 'ci/leak-scan', 'ci/stack-gate', 'ci/verify-target'],
        'steps',
    );
    for (const entry of secretsMap.filter((e) => e.step !== 'ci/verify-target')) {
        equal(Object.keys(entry.env), ['MM_LICENSE'], entry.step);
        equal(entry.refs, ['secrets.MM_E2E_TEST_LICENSE_ONPREM_ENT'], entry.step);
    }
});

check('workflow: unsafe edits are caught by the lint', () => {
    const mutants = {
        'unpinned action': (t) => t.replace(/actions\/checkout@[0-9a-f]{40}/, 'actions/checkout@v4'),
        'sha used nowhere else': (t) =>
            t.replace(/actions\/upload-artifact@[0-9a-f]{40}/, `actions/upload-artifact@${'a'.repeat(40)}`),
        'pin without version comment': (t) => t.replace(/(upload-artifact@[0-9a-f]{40})\s+# v7\.0\.0/, '$1'),
        'extra trigger': (t) => t.replace('on:\n  workflow_dispatch:', 'on:\n  pull_request:\n  workflow_dispatch:'),
        'write permission': (t) =>
            t.replace('permissions:\n      contents: read', 'permissions:\n      contents: write'),
        'workflow permissions': (t) => t.replace('permissions: {}', 'permissions:\n  contents: read'),
        'continue-on-error on the job': (t) =>
            t.replace('    runs-on: ubuntu-24.04\n', '    runs-on: ubuntu-24.04\n    continue-on-error: true\n'),
        'floating runner': (t) => t.replace('runs-on: ubuntu-24.04', 'runs-on: ubuntu-latest'),
        'cancelling concurrency': (t) => t.replace('cancel-in-progress: false', 'cancel-in-progress: true'),
        'no budget timeout': (t) =>
            t.replace('timeout-minutes: ${{ inputs.time_budget_minutes }}', 'timeout-minutes: 360'),
        'licence in another step': (t) =>
            t.replace(
                '      - name: ci/containment\n        timeout-minutes: 10\n',
                '      - name: ci/containment\n        timeout-minutes: 10\n        env:\n          MM_LICENSE: ${{ secrets.MM_E2E_TEST_LICENSE_ONPREM_ENT }}\n',
            ),
        'licence under another variable': (t) =>
            t.replace(
                'MM_LICENSE: ${{ secrets.MM_E2E_TEST_LICENSE_ONPREM_ENT }}',
                'LICENSE_COPY: ${{ secrets.MM_E2E_TEST_LICENSE_ONPREM_ENT }}',
            ),
        'another secret': (t) =>
            t.replace(
                'MM_LICENSE: ${{ secrets.MM_E2E_TEST_LICENSE_ONPREM_ENT }}',
                'MM_LICENSE: ${{ secrets.ANTHROPIC_API_KEY }}',
            ),
        'licence at job level': (t) =>
            t.replace(
                '    env:\n      EXPLORER_CI_DIR',
                '    env:\n      MM_LICENSE: ${{ secrets.MM_E2E_TEST_LICENSE_ONPREM_ENT }}\n      EXPLORER_CI_DIR',
            ),
        'licence in a run line': (t) =>
            t.replace(
                'run: bash explorer-proto/v2/ci/stack_gate.sh',
                'run: bash explorer-proto/v2/ci/stack_gate.sh ${{ secrets.MM_E2E_TEST_LICENSE_ONPREM_ENT }}',
            ),
        'licence given to the upload action': (t) =>
            t.replace(
                'retention-days: 14',
                'retention-days: 14\n          token: ${{ secrets.MM_E2E_TEST_LICENSE_ONPREM_ENT }}',
            ),
        'set -x': (t) =>
            t.replace(
                'run: bash explorer-proto/v2/ci/stack_gate.sh',
                'run: bash -x explorer-proto/v2/ci/stack_gate.sh',
            ),
        'echo of the licence': (t) =>
            t.replace(
                'run: bash explorer-proto/v2/ci/containment.sh',
                'run: |\n          echo "$MM_LICENSE"\n          bash explorer-proto/v2/ci/containment.sh',
            ),
        'inline logic': (t) =>
            t.replace(
                'run: bash explorer-proto/v2/ci/containment.sh',
                'run: |\n          set -e\n          a=1\n          b=2\n          bash explorer-proto/v2/ci/containment.sh',
            ),
        'expression in a run line': (t) =>
            t.replace(
                'run: bash explorer-proto/v2/ci/containment.sh',
                'run: bash explorer-proto/v2/ci/containment.sh ${{ inputs.image }}',
            ),
        'leak scan not always': (t) =>
            t.replace(
                "      - name: ci/leak-scan\n        id: leak\n        if: ${{ always() && steps.checkout.outcome == 'success' }}",
                '      - name: ci/leak-scan\n        id: leak',
            ),
        'teardown not always': (t) =>
            t.replace(
                "      - name: ci/teardown\n        if: ${{ always() && steps.checkout.outcome == 'success' }}",
                '      - name: ci/teardown',
            ),
        'upload everything': (t) =>
            t.replace('path: ${{ env.EXPLORER_CI_DIR }}/export', 'path: ${{ env.EXPLORER_CI_DIR }}/*'),
        'short retention': (t) => t.replace('retention-days: 14', 'retention-days: 90'),
        'continue-on-error on a step': (t) =>
            t.replace(
                '      - name: ci/coordinator\n',
                '      - name: ci/coordinator\n        continue-on-error: true\n',
            ),
        'duplicate key': (t) => t.replace('permissions: {}\n', 'permissions: {}\npermissions: {}\n'),
        'status lane input': (t) =>
            t.replace(
                '      - name: ci/final-summary\n',
                '      - name: ci/final-summary\n        with:\n          triage-lanes: x\n',
            ),
        'a missing input': (t) => t.replace(/      verifier:\n[\s\S]*?(?=      time_budget_minutes:)/, ''),
        'the old 45 minute default': (t) => t.replace('        default: 120', '        default: 45'),
        'export without the licence': (t) =>
            t.replace(
                "      - name: ci/export\n        id: export\n        if: ${{ always() && steps.checkout.outcome == 'success' }}\n        env:\n          MM_LICENSE: ${{ secrets.MM_E2E_TEST_LICENSE_ONPREM_ENT }}\n",
                "      - name: ci/export\n        id: export\n        if: ${{ always() && steps.checkout.outcome == 'success' }}\n",
            ),
        'licence in the teardown': (t) =>
            t.replace(
                '      - name: ci/teardown\n',
                '      - name: ci/teardown\n        env:\n          MM_LICENSE: ${{ secrets.MM_E2E_TEST_LICENSE_ONPREM_ENT }}\n',
            ),
    };
    for (const [label, mutate] of Object.entries(mutants)) {
        const mutated = mutate(workflowText);
        assert(mutated !== workflowText, `mutant did not apply: ${label}`);
        assert(lint(mutated).length > 0, `the lint accepted: ${label}`);
    }
});

check('workflow: every repository path the workflow runs exists, and every input and step is documented', () => {
    const readme = fs.readFileSync(path.join(HERE, 'README.md'), 'utf8');
    for (const [, rel] of workflowText.matchAll(/(explorer-proto\/[\w./-]+\.(?:mjs|sh|ts))/g)) {
        assert(fs.existsSync(path.join(REPO_ROOT, rel)), `workflow refers to a missing file ${rel}`);
    }
    const inputs = Object.keys(yamlLib.parse(workflowText).on.workflow_dispatch.inputs);
    for (const name of inputs) {
        assert(readme.includes(`\`${name}\``), `README does not document input ${name}`);
    }
    for (const file of fs.readdirSync(HERE).filter((f) => /\.(sh|mjs)$/.test(f))) {
        assert(readme.includes(file), `README does not mention ${file}`);
    }
    for (const [, rel] of readme.matchAll(/`((?:explorer-proto|\.github)\/[\w./-]+)`/g)) {
        assert(fs.existsSync(path.join(REPO_ROOT, rel)), `README cites a missing path ${rel}`);
    }
});

// ---------- scripts ----------
check('scripts: every shell script parses and every module is valid JavaScript', async () => {
    for (const file of fs.readdirSync(HERE)) {
        if (file.endsWith('.sh')) {
            equal((await exec('bash', ['-n', path.join(HERE, file)])).code, 0, `bash -n ${file}`);
        } else if (file.endsWith('.mjs')) {
            equal((await exec(process.execPath, ['--check', path.join(HERE, file)])).code, 0, `node --check ${file}`);
        }
    }
});

const PILOT_REAL = path.join(REPO_ROOT, 'explorer-proto/v2/orchestrator/pilot.mjs');
const ORCH_RUNS = path.join(REPO_ROOT, 'explorer-proto/infra/.run/orch');
const SPEC = 'explorer-proto/sessions/bookmarks/generated/channels_bookmarks_bar_follows_switch.spec.ts';
const fixtureRunDirs = [];

async function readyCiDir(env = {}) {
    const dir = tmp();
    const base = {...goodRelease(), EXPLORER_CI_DIR: dir, ...env};
    equal((await node('check_inputs.mjs', [], {env: base})).code, 0, 'inputs');
    equal((await node('run_facts.mjs', ['init'], {env: {EXPLORER_CI_DIR: dir}})).code, 0, 'facts');
    return dir;
}

const runFlags = (facts, image = facts.image.ref) => [
    'run',
    '--target',
    facts.target_kind,
    '--live',
    '--verifier=process',
    '--run-id',
    facts.run_id,
    '--verify-spec',
    facts.verify_spec,
    '--engine-charter',
    `session:${facts.session}`,
    '--control',
    facts.control,
    '--image',
    image,
];

check('scripts: the --dry-run sequence runs every step without Docker, npm, a registry or a licence', async () => {
    const dir = await readyCiDir();
    const stubs = tmp('ci-stubs-');
    const log = path.join(stubs, 'calls.log');
    for (const name of ['docker', 'npm', 'npx', 'curl', 'git-lfs']) {
        fs.writeFileSync(path.join(stubs, name), `#!/bin/sh\necho "${name} $*" >> "${log}"\nexit 97\n`, {mode: 0o755});
    }
    const env = {EXPLORER_CI_DIR: dir, PATH: `${stubs}:${process.env.PATH}`};
    const verify = await node('verify_target.mjs', ['--from-inputs', '--repo-pin', '--online', '--dry-run'], {env});
    equal(verify.code, 0, verify.out);
    for (const script of [
        'setup_workspace.sh',
        'pull_images.sh',
        'containment.sh',
        'stack_gate.sh',
        'run_coordinator.sh',
        'export_run.sh',
    ]) {
        const result = await bash(script, ['--dry-run'], {env});
        equal(result.code, 0, `${script}: ${result.out}`);
        assert(result.out.includes('+ ') || script === 'pull_images.sh', `${script} printed no command`);
    }
    assert(!fs.existsSync(log), `a dry run invoked a tool: ${fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : ''}`);
    assert(!fs.existsSync(path.join(dir, 'ci-status.json')), 'a dry run recorded a stage');
});

check('scripts: the dry-run coordinator commands are the verified headless entry, flag for flag', async () => {
    const dir = await readyCiDir();
    const result = await bash('run_coordinator.sh', ['--dry-run'], {env: {EXPLORER_CI_DIR: dir}});
    equal(result.code, 0, result.out);
    const facts = readJson(path.join(dir, 'run-facts.json'));
    equal(
        result.out.trim().split('\n'),
        [
            `+ node ${PILOT_REAL} doctor --image ${RELEASE_IMAGE}`,
            `+ node ${PILOT_REAL} ${[...runFlags(facts), '--verifier-timeout', '2280'].join(' ')}`,
        ],
        'commands',
    );
});

check(
    'scripts: the real orchestrator accepts the workflow run command as a dry run and records its inputs',
    async () => {
        const dir = await readyCiDir();
        const facts = readJson(path.join(dir, 'run-facts.json'));
        const printed = (await bash('run_coordinator.sh', ['--dry-run'], {env: {EXPLORER_CI_DIR: dir}})).out
            .trim()
            .split('\n')[1];
        const args = printed.replace(/^\+ node \S+ /, '').split(' ');
        const dry = (list, out = path.join(tmp(), 'run')) => ({
            out,
            run: exec(process.execPath, [
                PILOT_REAL,
                ...list.map((a) => (a === '--live' ? '--dry-run' : a)),
                '--out',
                out,
            ]),
        });
        const {out, run} = dry(args);
        const accepted = await run;
        equal(accepted.code, 0, accepted.out);
        const plan = readJson(path.join(out, 'plan.json'));
        const saved = readJson(path.join(out, 'run.json'));
        equal(
            [plan.image, plan.session, plan.control, plan.spec.path, plan.verifier.mode, plan.verifier.timeout_seconds],
            [
                {reference: RELEASE_IMAGE, source: 'override'},
                'bookmarks',
                facts.control,
                facts.verify_spec,
                'process',
                2280,
            ],
            'plan',
        );
        equal(saved.verifier_timeout_seconds, 2280, 'verifier timeout reached run.json');
        const infra = plan.commands.map((c) => c.join(' ')).filter((c) => /infra\/scripts\/(gate|up)\.sh/.test(c));
        assert(infra.length === 2 && infra.every((c) => !c.includes('--target')), `infra commands: ${infra}`);
        const swap = (from, to) => args.map((a) => (a === from ? to : a));
        const refused = [
            ['a main target', swap('release', 'main')],
            ['an image without a digest', swap(RELEASE_IMAGE, RELEASE_IMAGE.split('@')[0])],
            ['a zero verifier timeout', swap('2280', '0')],
        ];
        for (const [label, list] of refused) {
            const result = await dry(list).run;
            equal(result.code, 2, `${label}: ${result.out.split('\n')[0]}`);
        }
    },
);

// Stands in only for the exit code of `run` and `doctor`: the flags of `run` are replayed through the real
// orchestrator as a dry run, so a flag the real parser refuses fails here with its own exit 2.
function fakePilot() {
    const dir = tmp('ci-pilot-');
    const file = path.join(dir, 'pilot.mjs');
    fs.writeFileSync(
        file,
        `import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const args = process.argv.slice(2);
if (process.env.FAKE_LOG) {
    fs.appendFileSync(process.env.FAKE_LOG, args.join(' ') + '\\n');
}
if (args[0] === 'doctor') {
    const code = Number(process.env.FAKE_DOCTOR_EXIT ?? 0);
    process.stdout.write(code === 0 ? 'PASS node version: v24\\ndoctor: PASS (0 failing)\\n' : 'PASS node version: v24\\nFAIL docker reachable (linux/amd64): docker server not reachable\\ndoctor: FAIL (1 failing)\\n');
    process.exit(code);
}
if (args[0] === 'run') {
    const replay = args.map((a) => (a === '--live' ? '--dry-run' : a)).concat(['--out', process.env.FAKE_OUT]);
    const real = spawnSync(process.execPath, [process.env.FAKE_REAL_PILOT, ...replay], {encoding: 'utf8'});
    if (real.status !== 0) {
        process.stderr.write(real.stderr);
        process.exit(real.status);
    }
    process.exit(Number(process.env.FAKE_RUN_EXIT ?? 0));
}
process.exit(2);
`,
    );
    return file;
}

const fakeEnv = (dir, extra = {}) => ({
    EXPLORER_CI_DIR: dir,
    EXPLORER_CI_PILOT: fakePilot(),
    FAKE_REAL_PILOT: PILOT_REAL,
    FAKE_OUT: path.join(tmp(), 'run'),
    ...extra,
});

check(
    'scripts: the coordinator exit code is mapped to the ledger, 3 and 30 fail the job and are not passes',
    async () => {
        const synthetic = `SYNTHETIC-${crypto.randomBytes(24).toString('hex')}`;
        const cases = [
            [0, 'PASS', 0],
            [1, 'FAIL', 1],
            [3, 'BLOCKED', 3],
            [30, 'PENDING', 30],
            [20, 'FAIL', 20],
            [21, 'FAIL', 21],
            [22, 'FAIL', 22],
            [2, 'FAIL', 2],
            [124, 'FAIL', 1],
            [137, 'FAIL', 1],
            [77, 'FAIL', 77],
        ];
        for (const [code, result, exit] of cases) {
            const dir = await readyCiDir();
            const log = path.join(dir, 'pilot-calls.log');
            const run = await bash('run_coordinator.sh', [], {
                env: fakeEnv(dir, {MM_LICENSE: synthetic, FAKE_RUN_EXIT: String(code), FAKE_LOG: log}),
            });
            equal(run.code, exit, `exit for ${code}: ${run.out}`);
            const stages = readJson(path.join(dir, 'ci-status.json')).stages;
            equal([stages.doctor.result, stages.coordinator.result], ['PASS', result], `ledger for ${code}`);
            assert(
                stages.coordinator.detail.startsWith(`exit ${code}:`),
                `detail for ${code}: ${stages.coordinator.detail}`,
            );
            assert(!run.out.includes(synthetic), 'the licence was printed');
            const calls = fs.readFileSync(log, 'utf8').trim().split('\n');
            equal(calls.length, 2, 'doctor, then run');
            assert(calls[0].startsWith('doctor --image '), `doctor first: ${calls[0]}`);
            assert(calls[1].endsWith('--verifier-timeout 2280'), `verifier timeout: ${calls[1]}`);
            if (code !== 0) {
                assert(run.out.includes('::error title=exploratory coordinator::'), `no clear message for ${code}`);
            }
        }
    },
);

check('scripts: a failing doctor stops the step before the run, blocked and not a pass', async () => {
    for (const [doctorExit, result, exit] of [
        [3, 'BLOCKED', 3],
        [2, 'FAIL', 1],
    ]) {
        const dir = await readyCiDir();
        const log = path.join(dir, 'pilot-calls.log');
        const run = await bash('run_coordinator.sh', [], {
            env: fakeEnv(dir, {MM_LICENSE: 'SYNTHETIC-x', FAKE_DOCTOR_EXIT: String(doctorExit), FAKE_LOG: log}),
        });
        equal(run.code, exit, `exit for doctor ${doctorExit}: ${run.out}`);
        const stages = readJson(path.join(dir, 'ci-status.json')).stages;
        equal([stages.doctor.result, stages.coordinator.result], [result, 'SKIPPED'], 'ledger');
        assert(stages.doctor.detail.includes('docker reachable (linux/amd64)'), `detail: ${stages.doctor.detail}`);
        equal(fs.readFileSync(log, 'utf8').trim().split('\n').length, 1, 'run was not called');
        assert(run.out.includes('FAIL docker reachable'), 'the per-item doctor lines are in the log');
    }
});

check('scripts: without the licence secret the coordinator and the stack gate report blocked, not a pass', async () => {
    const dir = await readyCiDir();
    const coordinator = await bash('run_coordinator.sh', [], {env: fakeEnv(dir, {FAKE_RUN_EXIT: '0'})});
    equal(coordinator.code, 3, 'coordinator exit');
    const gate = await bash('stack_gate.sh', [], {env: {EXPLORER_CI_DIR: dir}});
    equal(gate.code, 3, 'gate exit');
    const stages = readJson(path.join(dir, 'ci-status.json')).stages;
    equal(
        [stages.coordinator.result, stages.gate.result, stages.licence.result],
        ['BLOCKED', 'BLOCKED', 'BLOCKED'],
        'ledger',
    );
});

check('scripts: a time budget that leaves too little for the verifier fails before doctor and the run', async () => {
    const dir = await readyCiDir();
    const factsFile = path.join(dir, 'run-facts.json');
    fs.writeFileSync(factsFile, JSON.stringify({...readJson(factsFile), started_epoch_s: 1000}));
    const log = path.join(dir, 'pilot-calls.log');
    const run = await bash('run_coordinator.sh', [], {
        env: fakeEnv(dir, {MM_LICENSE: 'SYNTHETIC-x', FAKE_RUN_EXIT: '0', FAKE_LOG: log}),
    });
    equal(run.code, 1, 'exit');
    equal(readJson(path.join(dir, 'ci-status.json')).stages.coordinator.result, 'FAIL', 'ledger');
    assert(!fs.existsSync(log), 'doctor or run was called');
});

check('plan: the time budget arithmetic follows the real stage budgets', () => {
    const stages = loadStageBudgets();
    const plan = budgetPlan(stages);
    const sum = ['target', 'baseline', 'control', 'dispatch', 'collect'].reduce(
        (n, k) => n + stages[k].time_seconds,
        0,
    );
    equal(plan.coordinatorSeconds, sum, 'coordinator seconds');
    assert(stages.dispatch.time_seconds >= 2400, 'dispatch budget is the raised one');
    assert(plan.worstCaseMinutes > 45, `45 minutes would be feasible: ${plan.worstCaseMinutes}`);
    assert(BUDGET_MINUTES.default >= plan.worstCaseMinutes, 'the default does not cover the worst case');
    assert(BUDGET_MINUTES.min >= plan.minimumMinutes, 'the minimum leaves less than the default verifier timeout');
    assert(
        BUDGET_MINUTES.min * 60 - SETUP_ALLOWANCE_SECONDS - TEARDOWN_RESERVE_SECONDS - plan.otherStagesSeconds >= 1500,
        'minimum window',
    );
    equal(plan.verifierCapSeconds, stages.dispatch.time_seconds - 120, 'cap');
});

check('plan: the verifier timeout is capped by the dispatch budget and refused below the floor', () => {
    const plan = budgetPlan(loadStageBudgets());
    const window = (minutes) => minutes * 60 - SETUP_ALLOWANCE_SECONDS - TEARDOWN_RESERVE_SECONDS;
    equal(verifierTimeoutSeconds(plan, window(BUDGET_MINUTES.default)), {ok: true, seconds: 2280}, 'default');
    equal(verifierTimeoutSeconds(plan, window(BUDGET_MINUTES.max)), {ok: true, seconds: 2280}, 'max');
    const min = verifierTimeoutSeconds(plan, window(BUDGET_MINUTES.min));
    assert(min.ok && min.seconds >= 1500, `min budget: ${JSON.stringify(min)}`);
    assert(!verifierTimeoutSeconds(plan, window(45)).ok, '45 minutes was accepted');
    assert(!verifierTimeoutSeconds(plan, plan.otherStagesSeconds + MIN_VERIFIER_SECONDS - 1).ok, 'floor');
    assert(verifierTimeoutSeconds(plan, plan.otherStagesSeconds + MIN_VERIFIER_SECONDS).ok, 'floor is inclusive');
    assert(!verifierTimeoutSeconds(plan, -5).ok, 'negative window');
});

check('plan: every documented exit code has its own mapping and only 0 passes', () => {
    const expected = {
        0: ['PASS', 0],
        1: ['FAIL', 1],
        2: ['FAIL', 2],
        3: ['BLOCKED', 3],
        20: ['FAIL', 20],
        21: ['FAIL', 21],
        22: ['FAIL', 22],
        30: ['PENDING', 30],
        124: ['FAIL', 1],
        137: ['FAIL', 1],
    };
    for (const [code, [result, exit]] of Object.entries(expected)) {
        const mapped = mapCoordinatorExit(Number(code));
        equal([mapped.result, mapped.exit], [result, exit], `code ${code}`);
        assert(!mapped.detail.includes('unexpected'), `code ${code} is unmapped`);
        assert(mapped.detail.length <= 200, `detail of ${code} is too long for the ledger`);
    }
    assert(mapCoordinatorExit(2).message.includes('workflow bug'), 'usage is named a workflow bug');
    assert(mapCoordinatorExit(30).message.includes('not a pass'), 'pending is not a pass');
    assert(mapCoordinatorExit(3).message.includes('not a pass'), 'blocked is not a pass');
    assert(mapCoordinatorExit(99).detail.includes('unexpected'), 'unknown code');
});

check('plan: the doctor output is summarised per item without values', () => {
    const text =
        'PASS node version: v24.11.1 (needs 24 or newer)\nFAIL explorer-proto/node_modules symlink: create: ln -s x y\nSKIP docker reachable (linux/amd64): --no-docker\ndoctor: FAIL (1 failing)\n';
    equal(
        summarizeDoctor(text),
        {pass: 1, fail: 1, skip: 1, failing: ['explorer-proto/node_modules symlink'], complete: true},
        'summary',
    );
    assert(!summarizeDoctor('PASS a: b\n').complete, 'a truncated doctor output is incomplete');
});

check('entry contract: the workflow scripts pass only flags the coordinator documents and prints', () => {
    const result = checkEntryContract();
    equal(result.errors, [], 'errors');
    equal(
        result.used.run,
        [
            'target',
            'live',
            'verifier',
            'run-id',
            'verify-spec',
            'engine-charter',
            'control',
            'image',
            'verifier-timeout',
        ],
        'run flags',
    );
    equal(
        [result.used.export, result.used.summary, result.used.doctor],
        [['run-id', 'out'], ['run-id', 'github'], ['image']],
        'others',
    );
    equal(result.restricted, true, 'the --verify-spec restriction to release was read from pilot.mjs');
});

check('entry contract: an unknown flag, a test flag, a bad value or a missing flag is a finding', () => {
    const root = REPO_ROOT;
    const orch = (rel) => fs.readFileSync(path.join(root, 'explorer-proto/v2/orchestrator', rel), 'utf8');
    const base = {
        usage: pilotUsage(root),
        readme: orch('README.md'),
        pilotSource: orch('pilot.mjs'),
        handoffSource: orch('lib/verify/handoff.mjs'),
        coordinatorKinds: ['release'],
    };
    const digest = `sha256:${'a'.repeat(64)}`;
    const runLine = `+ node /x/pilot.mjs run --target release --live --verifier=process --run-id r-1 --verify-spec s.spec.ts --engine-charter session:bookmarks --control c --image r/x:1@${digest} --verifier-timeout 2280`;
    const lines = (...extra) =>
        parseCommands(
            [
                runLine,
                '+ node /x/pilot.mjs doctor --image r/x:1@' + digest,
                '+ node /x/pilot.mjs export --run-id r-1 --out /o',
                '+ node /x/pilot.mjs summary --run-id r-1 --github > /f',
                ...extra,
            ].join('\n'),
        );
    equal(evaluateContract({...base, commands: lines()}).errors, [], 'the reference commands');
    const mutate = (from, to) =>
        parseCommands(
            [
                runLine,
                '+ node /x/pilot.mjs doctor',
                '+ node /x/pilot.mjs export --run-id r --out o',
                '+ node /x/pilot.mjs summary --run-id r --github',
            ]
                .join('\n')
                .replace(from, to),
        );
    const cases = {
        'an unknown flag': mutate('--verifier-timeout 2280', '--verifier-timeout 2280 --turbo'),
        'a misspelt flag': mutate('--verifier=process', '--verifer=process'),
        'a test flag': mutate('--live', '--live --recover-fixture'),
        'a dry run': mutate('--live', '--dry-run'),
        'a digestless image': mutate(`@${digest}`, ''),
        'a zero timeout': mutate('--verifier-timeout 2280', '--verifier-timeout 0'),
        'a main target': mutate('--target release', '--target main'),
        'a missing documented flag': mutate(' --control c', ''),
        'an unknown subcommand': mutate('doctor', 'inspect'),
        'a flag of another subcommand': mutate('summary --run-id r --github', 'summary --run-id r --out o'),
    };
    for (const [label, commands] of Object.entries(cases)) {
        assert(evaluateContract({...base, commands}).errors.length > 0, `accepted ${label}`);
    }
    const dropped = base.usage.replace('--verifier-timeout <seconds>', '');
    assert(evaluateContract({...base, usage: dropped, commands: lines()}).errors.length > 0, 'usage without the flag');
    const undocumented = base.readme.replaceAll('--verifier-timeout', '--verifier-limit');
    assert(evaluateContract({...base, readme: undocumented, commands: lines()}).errors.length > 0, 'README without it');
    assert(
        evaluateContract({...base, coordinatorKinds: ['release', 'main'], commands: lines()}).errors.length > 0,
        'main accepted although pilot.mjs refuses it',
    );
    assert(
        evaluateContract({...base, handoffSource: 'const DEFAULT_TIMEOUT_SECONDS = 900;', commands: lines()}).errors
            .length > 0,
        'a changed default verifier timeout',
    );
    const documented = parseReadme(base.readme);
    equal(
        [documented.codes, [...documented.headlessRun].sort()],
        [
            [0, 1, 2, 3, 20, 21, 22, 30],
            ['control', 'engine-charter', 'image', 'live', 'run-id', 'target', 'verifier', 'verify-spec'],
        ],
        'README parse',
    );
    const usage = flagsBySubcommand(base.usage);
    assert(
        usage.run.has('verifier-timeout') && usage.doctor.has('image') && usage.summary.has('github'),
        'usage parse',
    );
});

function fakeInfra({gateExit = 0, licenceLine = "IsLicensed === 'true': PASS", downExit = 0} = {}) {
    const dir = tmp('ci-infra-');
    fs.writeFileSync(
        path.join(dir, 'gate.sh'),
        `#!/usr/bin/env bash\necho "[DIRECT  ] PASS stack up"\necho "[DIRECT  ] ${licenceLine.includes('PASS') ? 'PASS' : 'FAIL'} ${licenceLine}"\nexit ${gateExit}\n`,
        {mode: 0o755},
    );
    fs.writeFileSync(path.join(dir, 'down.sh'), `#!/usr/bin/env bash\necho down\nexit ${downExit}\n`, {mode: 0o755});
    return dir;
}

async function gateCase({gateOptions, buildHash, license = 'SYNTHETIC-lic'}) {
    const dir = await readyCiDir();
    const provenance = await node('verify_target.mjs', ['--from-inputs', '--repo-pin'], {env: {EXPLORER_CI_DIR: dir}});
    equal(provenance.code, 0, provenance.out);
    const stub = await listen((req, res) => {
        res.writeHead(200, {'content-type': 'application/json'});
        res.end(
            JSON.stringify({
                BuildHash: buildHash ?? RELEASE_PIN.sha,
                Version: RELEASE_PIN.server_version,
            }),
        );
    });
    try {
        const run = await bash('stack_gate.sh', [], {
            env: {
                EXPLORER_CI_DIR: dir,
                EXPLORER_CI_INFRA_SCRIPTS: fakeInfra(gateOptions),
                PILOT_PORT: String(stub.port),
                MM_LICENSE: license,
            },
        });
        return {run, stages: readJson(path.join(dir, 'ci-status.json')).stages, dir};
    } finally {
        await stub.close();
    }
}

check('scripts: the stack gate records gate, licence and live provenance, and tears the stack down', async () => {
    const pass = await gateCase({});
    equal(pass.run.code, 0, pass.run.out);
    equal(
        [pass.stages.gate.result, pass.stages.licence.result, pass.stages['provenance-live'].result],
        ['PASS', 'PASS', 'PASS'],
        'pass ledger',
    );
    assert(pass.run.out.includes('down'), 'no teardown');
    assert(!pass.run.out.includes('SYNTHETIC-lic'), 'licence printed');
    const mismatch = await gateCase({buildHash: 'f'.repeat(40)});
    equal(mismatch.run.code, 3, 'a build hash mismatch is blocked');
    equal(mismatch.stages['provenance-live'].result, 'BLOCKED', 'mismatch ledger');
    const unlicensed = await gateCase({
        gateOptions: {gateExit: 1, licenceLine: "IsLicensed === 'true': FAIL (setup failure)"},
    });
    equal(unlicensed.run.code, 1, 'unlicensed exit');
    equal(
        [unlicensed.stages.gate.result, unlicensed.stages.licence.result, unlicensed.stages['provenance-live'].result],
        ['FAIL', 'FAIL', 'SKIPPED'],
        'unlicensed ledger',
    );
    const failedDown = await gateCase({gateOptions: {downExit: 1}});
    equal(failedDown.run.code, 1, 'a failed teardown fails the step');
});

// A real orchestrator run directory without Docker: the dry run of the exact workflow flags, under a digest nobody
// else uses, so the directory can be removed afterwards without touching anyone's run.
async function fixtureRun() {
    const image = `mattermost/mattermost-enterprise-edition:12.1.0@sha256:${crypto.randomBytes(32).toString('hex')}`;
    const dir = await readyCiDir({INPUT_IMAGE: image});
    const facts = readJson(path.join(dir, 'run-facts.json'));
    const runDir = path.join(ORCH_RUNS, facts.run_id);
    assert(!fs.existsSync(runDir), `refusing to reuse the run directory ${runDir}`);
    fixtureRunDirs.push(runDir);
    const args = runFlags(facts).map((a) => (a === '--live' ? '--dry-run' : a));
    const done = await exec(process.execPath, [PILOT_REAL, ...args, '--verifier-timeout', '2280']);
    equal(done.code, 0, done.out);
    return {dir, runDir, facts};
}

check('scripts: the export step runs the real pilot export and summary on a run directory', async () => {
    const {dir} = await fixtureRun();
    const synthetic = `SYNTHETIC-${crypto.randomBytes(24).toString('hex')}`;
    const ok = await bash('export_run.sh', [], {env: {EXPLORER_CI_DIR: dir, MM_LICENSE: synthetic}});
    equal(ok.code, 0, ok.out);
    assert(!ok.out.includes(synthetic), 'the licence was printed');
    const exported = fs.readdirSync(path.join(dir, 'export'), {recursive: true}).map((f) => String(f));
    for (const name of [
        'run.json',
        'plan.json',
        'commands.json',
        'export-manifest.json',
        'ci/run-facts.json',
        'ci/ci-status.json',
    ]) {
        assert(exported.includes(name), `export lacks ${name}: ${exported.join(', ')}`);
    }
    const manifest = readJson(path.join(dir, 'export/export-manifest.json'));
    equal(
        [manifest.leak_scan.unsafe_text, manifest.leak_scan.licence],
        ['PASS', 'PASS'],
        'the orchestrator scanned its own copy',
    );
    const summary = fs.readFileSync(path.join(dir, 'pilot-summary.md'), 'utf8');
    assert(/^### Explorer pilot: INCOMPLETE \(run /.test(summary), `summary: ${summary.split('\n')[0]}`);
    assert(!exported.includes('pilot-summary.md'), 'the coordinator summary is not part of the export');
    equal(readJson(path.join(dir, 'ci-status.json')).stages.export.result, 'PASS', 'export ledger');
    equal(readJson(path.join(dir, 'ci-status.json')).stages['capture-export'].result, 'PASS', 'capture ledger');
});

check('scripts: a missing licence is blocked (exit 3, nothing exported) and a leak is a failure (exit 1)', async () => {
    const {dir, facts} = await fixtureRun();
    const blocked = await bash('export_run.sh', [], {env: {EXPLORER_CI_DIR: dir}});
    equal(blocked.code, 3, blocked.out);
    equal(readJson(path.join(dir, 'ci-status.json')).stages.export.result, 'BLOCKED', 'blocked ledger');
    equal(
        fs.readdirSync(path.join(dir, 'export'), {recursive: true}).map(String).sort(),
        ['ci', 'ci/ci-status.json', 'ci/run-facts.json'],
        'only the ci facts remain',
    );

    const leaked = await bash('export_run.sh', [], {env: {EXPLORER_CI_DIR: dir, MM_LICENSE: facts.verify_spec}});
    equal(leaked.code, 1, leaked.out);
    const stages = readJson(path.join(dir, 'ci-status.json')).stages;
    equal(stages.export.result, 'FAIL', 'leak ledger');
    assert(!fs.existsSync(path.join(dir, 'export/run.json')), 'the leaking copy was kept');
});

check('scripts: without a coordinator run directory the export is skipped, not failed or passed', async () => {
    const dir = await readyCiDir({
        INPUT_IMAGE: `mattermost/mattermost-enterprise-edition:12.1.0@sha256:${crypto.randomBytes(32).toString('hex')}`,
    });
    const run = await bash('export_run.sh', [], {env: {EXPLORER_CI_DIR: dir, MM_LICENSE: 'SYNTHETIC-x'}});
    equal(run.code, 0, run.out);
    equal(readJson(path.join(dir, 'ci-status.json')).stages.export.result, 'SKIPPED', 'ledger');
    assert(fs.readFileSync(path.join(dir, 'pilot-summary.md'), 'utf8').includes('never started'), 'summary file');
});

check(
    'scripts: image and workspace scripts refuse without facts, and the lockfile guard is part of the setup',
    async () => {
        const dir = tmp();
        const pull = await bash('pull_images.sh', ['--dry-run'], {env: {EXPLORER_CI_DIR: dir}});
        assert(pull.code !== 0, 'pull_images ran without facts');
        const setup = fs.readFileSync(path.join(HERE, 'setup_workspace.sh'), 'utf8');
        assert(
            /npm ci/.test(setup) &&
                /git diff --exit-code -- ':\(glob\)\*\*\/package-lock\.json'/.test(setup) &&
                /playwright install chromium/.test(setup),
            'setup commands',
        );
        assert(
            !/install (--with-deps )?[^\n]*(firefox|webkit)/.test(setup) &&
                !/npm (i|install)\b(?! -)/.test(setup) &&
                !/-g\b/.test(setup),
            'forbidden install',
        );
        const pulls = fs.readFileSync(path.join(HERE, 'pull_images.sh'), 'utf8');
        assert(
            pulls.includes('docker pull --platform linux/amd64') &&
                pulls.includes('RepoDigests') &&
                pulls.includes('EXPECTED_PG_IMAGE'),
            'pull commands',
        );
    },
);

async function main() {
    const {flags} = parseArgs(process.argv.slice(2));
    const only = typeof flags.only === 'string' ? flags.only : '';
    let passed = 0;
    const failures = [];
    for (const {name, fn} of checks) {
        if (only && !name.startsWith(only)) {
            continue;
        }
        try {
            await fn();
            passed++;
            process.stdout.write(`PASS  ${name}\n`);
        } catch (error) {
            failures.push(name);
            process.stdout.write(`FAIL  ${name}\n      ${String(error.message).split('\n')[0].slice(0, 400)}\n`);
        }
    }
    for (const dir of [...tmpDirs, ...fixtureRunDirs]) {
        fs.rmSync(dir, {recursive: true, force: true});
    }
    process.stdout.write(`\nci selftest: ${passed} passed, ${failures.length} failed\n`);
    return failures.length === 0 ? 0 : 1;
}

main().then((code) => process.exit(code));
