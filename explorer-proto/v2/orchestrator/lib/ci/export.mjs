// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-process-env -- the licence scan needs MM_LICENSE in the scanner's environment; only PASS or FAIL is reported */

// `pilot.mjs export --run-id <id> --out <dir>`: copies a sanitized, allowlisted subset of a run directory for CI
// artifacts. Logs and any file outside the allowlist are never read. The copy is scanned for unsafe text and, through
// infra/scripts/leak_scan.mjs, for the licence; a FAIL (or a missing licence to scan with) removes the copy again.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {EXIT, INFRA_DIR, listFiles, readJson, REPO_ROOT, sha256Text, toPosix, writeCanonical} from '../common.mjs';
import {validate} from '../schemas.mjs';
import {unsafeFindings} from '../verify/trace.mjs';

const ATTEMPT = '0-target/attempt-[1-9][0-9]*';
const SUPERSEDED = 'superseded/after-attempt-[1-9][0-9]*';
const CORE = [
    'run\\.json',
    'plan\\.json',
    'commands\\.json',
    'summary\\.json',
    'summary\\.md',
    '0-target/(?:status|target|target-check)\\.json',
    `${ATTEMPT}/(?:attempt|setup|target|target-check)\\.json`,
    '1-baseline/baseline\\.json',
    '2-control/(?:control|failure-trace)\\.json',
    'verify/(?:agent-task|agent-result|dispatch|process)\\.json',
    'collect/(?:collect|agent-result\\.errors)\\.json',
];
const ALLOWLIST = [
    ...CORE.map((p) => new RegExp(`^${p}$`)),
    new RegExp(
        `^${SUPERSEDED}/(?:summary\\.(?:json|md)|1-baseline/baseline\\.json|2-control/(?:control|failure-trace)\\.json|verify/(?:agent-result|dispatch|process)\\.json|collect/collect\\.json)$`,
    ),
];
const LOCAL_PATH = /(?<![A-Za-z0-9<])\/(?:tmp|home|agent|var|root|Users|mnt|opt|workspace)\/[^\s"']+/g;
const SCRATCH_PATH = /\/[^\s"']*pilot-verifier-[A-Za-z0-9]+/g;

const isAllowed = (rel) => ALLOWLIST.some((re) => re.test(rel));

/** Replaces machine-specific path prefixes so an exported file carries no local directory layout. */
export function sanitizeText(text, runDir) {
    return text
        .split(runDir)
        .join('<run>')
        .split(REPO_ROOT)
        .join('<repo>')
        .replace(SCRATCH_PATH, '<scratch>')
        .split(os.homedir())
        .join('<home>')
        .replace(LOCAL_PATH, '<path>');
}

function manifestSession(runDir) {
    const status = path.join(runDir, '0-target', 'status.json');
    if (!fs.existsSync(status)) {
        return {session_name: null, bookmark_titles: {}, fixture_fingerprint: null, attempts: 0};
    }
    const doc = readJson(status);
    const setupFile = path.join(runDir, '0-target', `attempt-${doc.current_attempt}`, 'setup.json');
    const setup = doc.current_attempt !== null && fs.existsSync(setupFile) ? readJson(setupFile) : null;
    return {
        session_name: setup?.manifest_session_check?.session_name ?? null,
        bookmark_titles: setup?.manifest_session_check?.bookmark_titles ?? {},
        fixture_fingerprint: setup?.fixture_fingerprint ?? null,
        attempts: doc.attempts.length,
    };
}

function emptyOrMissing(dir) {
    return !fs.existsSync(dir) || (fs.statSync(dir).isDirectory() && fs.readdirSync(dir).length === 0);
}

function licenceScan(out) {
    if (!process.env.MM_LICENSE) {
        return 'not_run';
    }
    const done = spawnSync('node', [path.join(INFRA_DIR, 'scripts', 'leak_scan.mjs'), out], {encoding: 'utf8'});
    return /^PASS/.test(done.stdout ?? '') ? 'PASS' : 'FAIL';
}

/** Copies the allowlisted files, scans them, and writes export-manifest.json. Returns the exit code. */
export function exportRun({runDir, out}) {
    if (out === runDir || out.startsWith(`${runDir}${path.sep}`) || runDir.startsWith(`${out}${path.sep}`)) {
        process.stderr.write('export: --out must be a directory outside the run directory\n');
        return EXIT.USAGE;
    }
    if (!emptyOrMissing(out)) {
        process.stderr.write('export: --out exists and is not empty\n');
        return EXIT.USAGE;
    }
    const run = readJson(path.join(runDir, 'run.json'));
    if (!run.verify_spec) {
        process.stderr.write('export: the run is not a verify-spec run\n');
        return EXIT.USAGE;
    }
    const files = listFiles(runDir, {
        skip: (rel, entry) => entry.isSymbolicLink() || (!entry.isDirectory() && !isAllowed(rel)),
    }).filter(isAllowed);

    fs.mkdirSync(out, {recursive: true});
    const exported = [];
    for (const rel of files) {
        const text = sanitizeText(fs.readFileSync(path.join(runDir, rel), 'utf8'), runDir);
        const dest = path.join(out, rel);
        fs.mkdirSync(path.dirname(dest), {recursive: true});
        fs.writeFileSync(dest, text);
        exported.push({path: toPosix(rel), sha256: sha256Text(text)});
    }

    const summary = fs.existsSync(path.join(runDir, 'summary.json'))
        ? readJson(path.join(runDir, 'summary.json'))
        : null;
    const dispatchFile = path.join(runDir, 'verify', 'dispatch.json');
    const delivery = fs.existsSync(dispatchFile) ? (readJson(dispatchFile).delivery ?? null) : null;
    const manifest = {
        schema: 'explorer-export-manifest/v1',
        run_id: run.run_id,
        verdict: summary?.verdict ?? 'incomplete',
        spec: {path: run.verify_spec.path, sha256: run.verify_spec.sha256},
        task_sha256: delivery?.task_sha256 ?? null,
        trace_sha256: delivery?.trace_sha256 ?? null,
        files: exported,
        manifest_session: manifestSession(runDir),
        leak_scan: {unsafe_text: 'PASS', licence: 'not_run'},
    };

    let unsafe = 'PASS';
    for (const file of exported) {
        if (unsafeFindings(fs.readFileSync(path.join(out, file.path), 'utf8'), {allowSlugs: true}).length > 0) {
            unsafe = 'FAIL';
        }
    }
    const licence = licenceScan(out);
    manifest.leak_scan = {unsafe_text: unsafe, licence};
    const shape = validate('orch#export-manifest', manifest);
    if (!shape.ok) {
        throw new Error(`internal: export manifest invalid: ${shape.errors[0]}`);
    }
    const failed = unsafe === 'FAIL' || licence === 'FAIL';
    if (failed || licence === 'not_run') {
        fs.rmSync(out, {recursive: true, force: true});
        process.stdout.write(
            `export: ${failed ? 'FAIL' : 'BLOCKED'} leak scan (unsafe text ${unsafe}, licence ${licence}); nothing was exported\n`,
        );
        return failed ? EXIT.FAIL : EXIT.BLOCKED;
    }
    writeCanonical(path.join(out, 'export-manifest.json'), manifest);
    process.stdout.write(
        `export: ${exported.length} files, leak scan PASS (unsafe text ${unsafe}, licence ${licence}) -> ${out}\n`,
    );
    return EXIT.OK;
}
