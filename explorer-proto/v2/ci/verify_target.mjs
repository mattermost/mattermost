#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Commit-to-image provenance. Fails closed: exit 3 (blocked) unless the association is established, never a pass.
//   verify_target.mjs [verify] --from-inputs [--repo-pin] [--build-record <file>] [--online] [--dry-run] [--out <file>]
//   verify_target.mjs [verify] --kind main|release --image <ref@sha256:..> --commit <sha|tag> [same options]
//   verify_target.mjs live [--base-url http://127.0.0.1:8065] [--provenance <file>] [--dry-run]
// Exit 0 verified, 2 usage, 3 blocked.
//
// Source of truth. The repository has no queryable build record. What exists, and what this script uses:
//   1. The tag convention of the build pipelines. Main: `<mm sha[0:7]>_<enterprise sha[0:7]>` from the delivery
//      pipeline (.github/e2e-tests-workflows.md) or `<mm sha[0:7]>` from the Enterprise CI job (enterprise repo,
//      .github/workflows/ci-template.yml, `TAG="${MM_SHA:0:7}"`). Release: the version of the release tag.
//   2. The digest that tag resolves to: a build record (explorer-build-record/v1, or a repository target pin such as
//      explorer-proto/v2/targets/main.json), checked offline, or the Docker Hub registry API, checked online.
//   3. After the stack is up, the server inside the image reports its own BuildHash (`live`).
// Limits: tags are mutable and the registry attests no commit, so (1) and (2) say that the tag that embeds the commit
// currently has this digest; (3) is what ties the bytes to the commit. A build record is only as trustworthy as who
// wrote it. A release tag is resolved to a commit only through a record or the GitHub API.
import path from 'node:path';

import {
    annotate,
    ciDir,
    COMMIT_PATTERNS,
    EXIT,
    IMAGE_REPOSITORIES,
    isMain,
    parseArgs,
    parseImage,
    readJson,
    REPO_ROOT,
    SOURCE_REPOSITORY,
    TARGET_FILES,
    writeJson,
} from './lib.mjs';

export const LIMITS = [
    'Image tags are mutable and the registry attests no commit: the tag convention plus the digest it resolves to says the tag that embeds the commit has this digest.',
    'The server build hash reported by the running image is the check that ties the bytes to the commit; it only runs once the stack is up.',
    'A build record is only as trustworthy as whoever wrote it; a repository target pin was reviewed by a human, a record supplied at dispatch time is self-attested.',
    'A release tag is resolved to its commit only through a build record or the GitHub API; neither available means blocked.',
];

const MANIFEST_ACCEPT = [
    'application/vnd.oci.image.index.v1+json',
    'application/vnd.oci.image.manifest.v1+json',
    'application/vnd.docker.distribution.manifest.list.v2+json',
    'application/vnd.docker.distribution.manifest.v2+json',
].join(', ');

function check(id, result, detail) {
    return {id, result, detail};
}

export function evaluateConvention({kind, image, commit}) {
    if (kind === 'main') {
        const match = /^([0-9a-f]{7})(?:_([0-9a-f]{7}))?$/.exec(image.tag);
        if (!match) {
            return {
                check: check('tag-convention', 'fail', 'the tag is not <mm sha7>_<enterprise sha7> or <mm sha7>'),
                enterprise7: null,
            };
        }
        if (match[1] !== commit.slice(0, 7)) {
            return {
                check: check('tag-convention', 'fail', 'the first seven characters of the tag differ from the commit'),
                enterprise7: null,
            };
        }
        return {check: check('tag-convention', 'pass', 'the tag embeds the commit'), enterprise7: match[2] ?? null};
    }
    const version = commit.replace(/^v/, '');
    if (image.tag !== version) {
        return {
            check: check('tag-convention', 'fail', 'the image tag differs from the release tag without its v'),
            enterprise7: null,
        };
    }
    return {check: check('tag-convention', 'pass', 'the image tag is the release version'), enterprise7: null};
}

/** Normalizes an explorer-build-record/v1 or an explorer-target/v2 file to one shape. */
export function normalizeRecord(raw) {
    if (raw?.schema === 'explorer-build-record/v1') {
        return {
            repository: raw.repository,
            tag: raw.tag,
            digest: raw.digest,
            commit_sha: raw.commit_sha,
            release_tag: raw.release_tag ?? null,
            source: raw.source ?? 'build record',
        };
    }
    if (raw?.schema === 'explorer-target/v2' && raw.image?.ref) {
        const [repository, ...tagParts] = raw.image.ref.split(':');
        if (raw.image.build_sha && raw.image.build_sha !== raw.sha) {
            return null;
        }
        return {
            repository,
            tag: tagParts.join(':'),
            digest: raw.image.digest,
            commit_sha: raw.sha,
            release_tag: raw.kind === 'release' ? raw.ref : null,
            source: 'repository target pin',
        };
    }
    return null;
}

export function evaluateRecord({record, kind, image, commit}) {
    const normalized = normalizeRecord(record);
    if (!normalized) {
        return {
            check: check('build-record', 'fail', 'the record is not a valid explorer-build-record/v1 or target pin'),
        };
    }
    const covers =
        normalized.digest === image.digest ||
        (normalized.repository === image.repository && normalized.tag === image.tag);
    if (!covers) {
        return {check: check('build-record', 'unavailable', 'the record describes a different image')};
    }
    const sameImage =
        normalized.repository === image.repository &&
        normalized.tag === image.tag &&
        normalized.digest === image.digest;
    const sameCommit = kind === 'main' ? normalized.commit_sha === commit : normalized.release_tag === commit;
    if (!sameImage || !sameCommit) {
        return {
            check: check(
                'build-record',
                'fail',
                `${normalized.source} names the same image with a different ${sameImage ? 'commit' : 'tag or digest'}`,
            ),
        };
    }
    return {
        check: check('build-record', 'pass', `${normalized.source} binds the tag, the digest and the commit`),
        commit_sha: normalized.commit_sha,
    };
}

async function http(url, {method = 'GET', headers = {}} = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            return {res: await fetch(url, {method, headers, signal: AbortSignal.timeout(15000)})};
        } catch {
            // retry once, then report the network as unavailable
        }
    }
    return {error: true};
}

export async function registryDigest({repository, tag}, env = process.env) {
    const auth = env.EXPLORER_CI_REGISTRY_AUTH_URL || 'https://auth.docker.io';
    const base = env.EXPLORER_CI_REGISTRY_URL || 'https://registry-1.docker.io';
    const tokenResponse = await http(`${auth}/token?service=registry.docker.io&scope=repository:${repository}:pull`);
    if (tokenResponse.error) {
        return {status: 'unavailable', detail: 'the registry token endpoint is unreachable'};
    }
    if (!tokenResponse.res.ok) {
        return {status: 'unavailable', detail: `the registry token endpoint answered HTTP ${tokenResponse.res.status}`};
    }
    let token = '';
    try {
        token = (await tokenResponse.res.json()).token ?? '';
    } catch {
        token = '';
    }
    if (!token) {
        return {status: 'unavailable', detail: 'the registry issued no pull token'};
    }
    const manifest = await http(`${base}/v2/${repository}/manifests/${tag}`, {
        method: 'HEAD',
        headers: {Authorization: `Bearer ${token}`, Accept: MANIFEST_ACCEPT},
    });
    if (manifest.error) {
        return {status: 'unavailable', detail: 'the registry is unreachable'};
    }
    if (manifest.res.status === 404) {
        return {status: 'not_found', detail: 'the registry has no such tag'};
    }
    if (!manifest.res.ok) {
        return {status: 'unavailable', detail: `the registry answered HTTP ${manifest.res.status}`};
    }
    const digest = manifest.res.headers.get('docker-content-digest') ?? '';
    if (!/^sha256:[0-9a-f]{64}$/.test(digest)) {
        return {status: 'unavailable', detail: 'the registry sent no digest'};
    }
    return {status: 'ok', digest};
}

async function githubJson(pathname, env) {
    const api = env.GITHUB_API_URL || 'https://api.github.com';
    const headers = {Accept: 'application/vnd.github+json', 'User-Agent': 'explorer-ci'};
    if (env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    }
    const response = await http(`${api}/repos/${SOURCE_REPOSITORY}${pathname}`, {headers});
    if (response.error) {
        return {status: 'unavailable', detail: 'the GitHub API is unreachable'};
    }
    if (response.res.status === 404 || response.res.status === 422) {
        return {status: 'not_found', detail: 'GitHub has no such object'};
    }
    if (!response.res.ok) {
        return {status: 'unavailable', detail: `the GitHub API answered HTTP ${response.res.status}`};
    }
    try {
        return {status: 'ok', body: await response.res.json()};
    } catch {
        return {status: 'unavailable', detail: 'the GitHub API sent no JSON'};
    }
}

export async function githubCommit(sha, env = process.env) {
    const result = await githubJson(`/commits/${sha}`, env);
    if (result.status === 'ok' && result.body?.sha !== sha) {
        return {status: 'not_found', detail: 'GitHub resolved the commit to a different SHA'};
    }
    return result.status === 'ok' ? {status: 'ok', sha} : result;
}

export async function githubTagCommit(tag, env = process.env) {
    const ref = await githubJson(`/git/ref/tags/${tag}`, env);
    if (ref.status !== 'ok') {
        return ref;
    }
    let object = ref.body?.object;
    if (object?.type === 'tag') {
        const tagObject = await githubJson(`/git/tags/${object.sha}`, env);
        if (tagObject.status !== 'ok') {
            return tagObject;
        }
        object = tagObject.body?.object;
    }
    return object?.type === 'commit' && /^[0-9a-f]{40}$/.test(object.sha)
        ? {status: 'ok', sha: object.sha}
        : {status: 'unavailable', detail: 'the tag does not point at a commit'};
}

export async function verifyTarget({
    kind,
    image,
    commit,
    recordFile = null,
    online = false,
    dryRun = false,
    env = process.env,
}) {
    const checks = [];
    const sources = [];

    const convention = evaluateConvention({kind, image, commit});
    checks.push(convention.check);

    let recordCommit = null;
    if (recordFile) {
        let record = null;
        try {
            record = readJson(recordFile);
        } catch {
            checks.push(check('build-record', 'unavailable', 'the build record is missing or is not JSON'));
        }
        if (record) {
            const evaluated = evaluateRecord({record, kind, image, commit});
            checks.push(evaluated.check);
            recordCommit = evaluated.commit_sha ?? null;
            if (evaluated.check.result === 'pass') {
                sources.push('build-record');
            }
        }
    }

    let onlineCommit = null;
    if (online && !dryRun && convention.check.result === 'pass') {
        const registry = await registryDigest(image, env);
        if (registry.status === 'ok') {
            const same = registry.digest === image.digest;
            checks.push(
                check(
                    'registry-digest',
                    same ? 'pass' : 'fail',
                    same ? 'the tag resolves to the input digest' : 'the tag resolves to a different digest',
                ),
            );
            if (same) {
                sources.push('registry-digest');
            }
        } else {
            checks.push(
                check('registry-digest', registry.status === 'not_found' ? 'fail' : 'unavailable', registry.detail),
            );
        }
        if (kind === 'main') {
            const found = await githubCommit(commit, env);
            checks.push(
                check(
                    'commit-exists',
                    found.status === 'ok' ? 'pass' : found.status === 'not_found' ? 'fail' : 'unavailable',
                    found.detail ?? 'the commit exists in the source repository',
                ),
            );
        } else {
            const tagged = await githubTagCommit(commit, env);
            onlineCommit = tagged.status === 'ok' ? tagged.sha : null;
            checks.push(
                check(
                    'release-tag-commit',
                    tagged.status === 'ok' ? 'pass' : tagged.status === 'not_found' ? 'fail' : 'unavailable',
                    tagged.detail ?? 'the release tag resolves to a commit',
                ),
            );
        }
    } else if (online) {
        checks.push(
            check('registry-digest', 'skipped', dryRun ? 'dry run: no network' : 'skipped: the tag convention failed'),
        );
    }

    if (kind === 'release' && recordCommit && onlineCommit && recordCommit !== onlineCommit) {
        checks.push(
            check(
                'release-tag-commit',
                'fail',
                'the build record and GitHub resolve the release tag to different commits',
            ),
        );
    }

    const resolved = kind === 'main' ? commit : (recordCommit ?? onlineCommit);
    if (kind === 'release' && !resolved && !dryRun) {
        checks.push(
            check('release-commit-resolved', 'unavailable', 'the release tag could not be resolved to a commit'),
        );
    }

    const failed = checks.find((c) => c.result === 'fail');
    const digestProven = sources.length > 0;
    let status = 'verified';
    let blocked = null;
    if (failed) {
        status = 'blocked';
        blocked = {kind: 'mismatch', reason: `${failed.id}: ${failed.detail}`};
    } else if (!dryRun && (!digestProven || (kind === 'release' && !resolved))) {
        const missing = checks.filter((c) => c.result === 'unavailable').map((c) => `${c.id}: ${c.detail}`);
        status = 'blocked';
        blocked = {
            kind: 'unverifiable',
            reason:
                missing.length > 0 ? missing.join('; ') : 'no build record and no online registry check were available',
        };
    } else if (dryRun) {
        status = 'dry-run';
    }

    return {
        schema: 'explorer-ci-provenance/v1',
        status,
        blocked,
        target_kind: kind,
        commit,
        resolved_commit_sha: resolved ?? null,
        enterprise_sha7: convention.enterprise7,
        image: {repository: image.repository, tag: image.tag, digest: image.digest},
        sources,
        checks,
        limits: LIMITS,
        live: null,
    };
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

export async function verifyLive({baseUrl, provenance, fetchImpl = fetch}) {
    const checks = [];
    let url;
    try {
        url = new URL(baseUrl);
    } catch {
        return {status: 'blocked', checks: [check('base-url', 'fail', 'the base URL is not a URL')]};
    }
    if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname)) {
        return {status: 'blocked', checks: [check('base-url', 'fail', 'the server is only queried on loopback')]};
    }
    if (provenance?.status !== 'verified') {
        return {status: 'blocked', checks: [check('provenance', 'fail', 'the pre-run provenance is not verified')]};
    }
    let config = null;
    try {
        const response = await fetchImpl(`${url.origin}/api/v4/config/client?format=old`, {
            signal: AbortSignal.timeout(15000),
        });
        config = response.ok ? await response.json() : null;
    } catch {
        config = null;
    }
    if (!config?.BuildHash) {
        return {
            status: 'blocked',
            checks: [check('server-config', 'unavailable', 'the server reported no build hash')],
        };
    }
    const hashMatches = config.BuildHash === provenance.resolved_commit_sha;
    checks.push(
        check(
            'build-hash',
            hashMatches ? 'pass' : 'fail',
            hashMatches
                ? 'the server build hash equals the target commit'
                : 'the server build hash differs from the target commit',
        ),
    );
    if (provenance.enterprise_sha7) {
        const ok = String(config.BuildHashEnterprise ?? '').startsWith(provenance.enterprise_sha7);
        checks.push(
            check(
                'build-hash-enterprise',
                ok ? 'pass' : 'fail',
                ok ? 'the enterprise build hash matches the tag' : 'the enterprise build hash differs from the tag',
            ),
        );
    }
    if (provenance.target_kind === 'release') {
        const core = /^\d+\.\d+\.\d+/.exec(provenance.image.tag)?.[0];
        const ok = Boolean(core) && config.Version === core;
        checks.push(
            check(
                'server-version',
                ok ? 'pass' : 'fail',
                ok ? 'the server version matches the release tag' : 'the server version differs from the release tag',
            ),
        );
    }
    return {status: checks.every((c) => c.result === 'pass') ? 'verified' : 'blocked', checks};
}

function printChecks(prefix, checks) {
    for (const c of checks) {
        process.stdout.write(`${prefix} ${c.result.toUpperCase().padEnd(11)} ${c.id}: ${c.detail}\n`);
    }
}

function inputsFromFlags(flags) {
    if (flags['from-inputs']) {
        const inputs = readJson(path.join(ciDir(), 'inputs.json'));
        return {kind: inputs.target_kind, image: parseImage(inputs.image.ref), commit: inputs.commit_sha};
    }
    return {kind: flags.kind, image: parseImage(flags.image), commit: flags.commit};
}

async function runVerify(flags) {
    let args;
    try {
        args = inputsFromFlags(flags);
    } catch {
        process.stderr.write('inputs.json is missing: run check_inputs.mjs first\n');
        return EXIT.USAGE;
    }
    const {kind, image, commit} = args;
    if (
        !IMAGE_REPOSITORIES[kind] ||
        !image ||
        image.repository !== IMAGE_REPOSITORIES[kind] ||
        !COMMIT_PATTERNS[kind]?.test(commit ?? '')
    ) {
        process.stderr.write(
            'usage: verify_target.mjs --kind main|release --image <repo:tag@sha256:digest> --commit <sha|tag>\n',
        );
        return EXIT.USAGE;
    }
    const recordFile = flags['build-record']
        ? path.resolve(flags['build-record'])
        : flags['repo-pin']
          ? path.join(REPO_ROOT, TARGET_FILES[kind])
          : null;
    const result = await verifyTarget({
        kind,
        image,
        commit,
        recordFile,
        online: Boolean(flags.online),
        dryRun: Boolean(flags['dry-run']),
    });
    printChecks('provenance', result.checks);
    if (!flags['dry-run']) {
        writeJson(flags.out ? path.resolve(flags.out) : path.join(ciDir(), 'provenance.json'), result);
    }
    if (result.status === 'blocked') {
        annotate('error', 'exploratory provenance', `blocked (${result.blocked.kind}): ${result.blocked.reason}`);
        process.stdout.write('provenance: BLOCKED\n');
        return EXIT.BLOCKED;
    }
    process.stdout.write(
        `provenance: ${result.status === 'dry-run' ? 'DRY RUN (offline checks only)' : `VERIFIED via ${result.sources.join(' + ')}`}\n`,
    );
    return EXIT.OK;
}

async function runLive(flags) {
    const file = flags.provenance ? path.resolve(flags.provenance) : path.join(ciDir(), 'provenance.json');
    let provenance = null;
    try {
        provenance = readJson(file);
    } catch {
        provenance = null;
    }
    const baseUrl = flags['base-url'] || `http://127.0.0.1:${process.env.PILOT_PORT || '8065'}`;
    if (flags['dry-run']) {
        process.stdout.write(`provenance-live: DRY RUN (would query ${baseUrl}/api/v4/config/client?format=old)\n`);
        return EXIT.OK;
    }
    const live = await verifyLive({baseUrl, provenance});
    printChecks('provenance-live', live.checks);
    if (provenance) {
        writeJson(file, {...provenance, live});
    }
    if (live.status !== 'verified') {
        annotate('error', 'exploratory provenance', 'blocked: the running server does not confirm the target commit');
        process.stdout.write('provenance-live: BLOCKED\n');
        return EXIT.BLOCKED;
    }
    process.stdout.write('provenance-live: VERIFIED\n');
    return EXIT.OK;
}

async function main() {
    const argv = process.argv.slice(2);
    const sub = argv[0] === 'live' || argv[0] === 'verify' ? argv.shift() : 'verify';
    const {flags} = parseArgs(argv);
    return sub === 'live' ? runLive(flags) : runVerify(flags);
}

if (isMain(import.meta.url)) {
    main().then((code) => process.exit(code));
}
