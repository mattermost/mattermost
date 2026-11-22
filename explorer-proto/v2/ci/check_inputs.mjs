#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Validates the workflow_dispatch inputs (passed as INPUT_* environment variables, never interpolated into a shell
// line) and derives the run id. Exit 0 valid, 2 invalid. With --dry-run nothing is written. A target kind the
// coordinator's --verify-spec entry does not accept is invalid here, before any image is pulled.
//   INPUT_TARGET_KIND INPUT_IMAGE INPUT_COMMIT_SHA INPUT_TEST_SOURCE_REF INPUT_SESSION INPUT_CONTROL
//   INPUT_VERIFIER INPUT_TIME_BUDGET_MINUTES GITHUB_RUN_ATTEMPT
import fs from 'node:fs';
import path from 'node:path';

import {
    ALLOWED,
    annotate,
    appendOutput,
    BUDGET_MINUTES,
    ciDir,
    COMMIT_PATTERNS,
    COORDINATOR_TARGET_KINDS,
    EXIT,
    IMAGE_REPOSITORIES,
    isMain,
    parseArgs,
    parseImage,
    REPO_ROOT,
    safeText,
    writeJson,
} from './lib.mjs';

function oneOf(errors, name, value, list) {
    if (!list.includes(value)) {
        errors.push(`${name} must be one of ${list.join(', ')} (got ${safeText(value)})`);
        return false;
    }
    return true;
}

function singleSpec(root, session) {
    const dir = path.join(root, 'explorer-proto/sessions', session, 'generated');
    let specs = [];
    try {
        specs = fs.readdirSync(dir).filter((name) => name.endsWith('.spec.ts'));
    } catch {
        return null;
    }
    return specs.length === 1 ? `explorer-proto/sessions/${session}/generated/${specs[0]}` : null;
}

export function checkInputs(env, {root = REPO_ROOT, coordinatorKinds = COORDINATOR_TARGET_KINDS} = {}) {
    const errors = [];
    const input = (name) => env[`INPUT_${name}`] ?? '';

    const kind = input('TARGET_KIND');
    const kindOk = oneOf(errors, 'target_kind', kind, ALLOWED.target_kind);
    if (kindOk && !coordinatorKinds.includes(kind)) {
        errors.push(
            `target_kind ${kind} cannot run: the coordinator's --verify-spec entry accepts --target ${coordinatorKinds.join(' or ')} only (pilot.mjs verifyInputs), so it would exit 2`,
        );
    }

    const image = parseImage(input('IMAGE'));
    if (!image) {
        errors.push(
            `image must be <repository>:<tag>@sha256:<64 lowercase hex digits>; a tag without a digest is refused (got ${safeText(input('IMAGE'))})`,
        );
    } else if (kindOk && image.repository !== IMAGE_REPOSITORIES[kind]) {
        errors.push(
            `image repository for ${kind} must be ${IMAGE_REPOSITORIES[kind]} (got ${safeText(image.repository)})`,
        );
    }

    const commit = input('COMMIT_SHA');
    if (kindOk && !COMMIT_PATTERNS[kind].test(commit)) {
        errors.push(
            kind === 'main'
                ? `commit_sha for main must be a full 40-character lowercase SHA (got ${safeText(commit)})`
                : `commit_sha for release must be the release tag, for example v12.1.0 or v11.4.0-rc3 (got ${safeText(commit)})`,
        );
    }

    const testSourceRef = input('TEST_SOURCE_REF');
    if (testSourceRef !== '' && !/^[0-9a-f]{40}$/.test(testSourceRef)) {
        errors.push(
            `test_source_ref must be empty or a full 40-character lowercase SHA (got ${safeText(testSourceRef)})`,
        );
    }

    const sessionOk = oneOf(errors, 'session', input('SESSION'), ALLOWED.session);
    const controlOk = oneOf(errors, 'control', input('CONTROL'), ALLOWED.control);
    oneOf(errors, 'verifier', input('VERIFIER'), ALLOWED.verifier);

    const budgetText =
        input('TIME_BUDGET_MINUTES') === '' ? String(BUDGET_MINUTES.default) : input('TIME_BUDGET_MINUTES');
    const budget = /^\d{1,3}$/.test(budgetText) ? Number(budgetText) : NaN;
    if (!(budget >= BUDGET_MINUTES.min && budget <= BUDGET_MINUTES.max)) {
        errors.push(
            `time_budget_minutes must be an integer from ${BUDGET_MINUTES.min} to ${BUDGET_MINUTES.max} (got ${safeText(budgetText)})`,
        );
    }

    const attemptText = env.GITHUB_RUN_ATTEMPT || '1';
    if (!/^\d{1,3}$/.test(attemptText) || Number(attemptText) < 1) {
        errors.push(`GITHUB_RUN_ATTEMPT must be a positive integer (got ${safeText(attemptText)})`);
    }

    let verifySpec = null;
    if (sessionOk) {
        verifySpec = singleSpec(root, input('SESSION'));
        if (!verifySpec) {
            errors.push(`session ${input('SESSION')} must hold exactly one generated spec`);
        }
    }
    if (
        controlOk &&
        !fs.existsSync(path.join(root, 'explorer-proto/v2/orchestrator/controls', `${input('CONTROL')}.json`))
    ) {
        errors.push(`no control definition for ${input('CONTROL')}`);
    }

    if (errors.length > 0) {
        return {ok: false, errors};
    }
    const runId = `${input('SESSION')}-${image.digest_short}-a${Number(attemptText)}`;
    return {
        ok: true,
        errors,
        values: {
            schema: 'explorer-ci-inputs/v1',
            target_kind: kind,
            image: {
                ref: image.ref,
                repository: image.repository,
                tag: image.tag,
                digest: image.digest,
                digest_short: image.digest_short,
            },
            commit_sha: commit,
            test_source_ref: testSourceRef,
            session: input('SESSION'),
            control: input('CONTROL'),
            verifier: input('VERIFIER'),
            time_budget_minutes: budget,
            run_attempt: Number(attemptText),
            run_id: runId,
            artifact_name: `exploratory-${image.digest_short}-${runId}`,
            verify_spec: verifySpec,
        },
    };
}

function main() {
    const {flags} = parseArgs(process.argv.slice(2));
    const result = checkInputs(process.env);
    if (!result.ok) {
        for (const error of result.errors) {
            annotate('error', 'exploratory inputs', error);
        }
        process.stdout.write(
            `inputs: FAIL (${result.errors.length} problem${result.errors.length === 1 ? '' : 's'})\n`,
        );
        return EXIT.USAGE;
    }
    const {values} = result;
    if (flags['dry-run']) {
        process.stdout.write(`inputs: PASS (dry run, nothing written)\n${JSON.stringify(values, null, 2)}\n`);
        return EXIT.OK;
    }
    writeJson(path.join(ciDir(), 'inputs.json'), values);
    appendOutput('run_id', values.run_id);
    appendOutput('digest_short', values.image.digest_short);
    appendOutput('artifact_name', values.artifact_name);
    process.stdout.write(`inputs: PASS (run id ${values.run_id}, ${values.target_kind}, session ${values.session})\n`);
    return EXIT.OK;
}

if (isMain(import.meta.url)) {
    process.exit(main());
}
