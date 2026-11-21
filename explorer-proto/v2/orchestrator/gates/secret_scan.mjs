// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/wrap-regex, no-process-env -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

import fs from 'node:fs';
import path from 'node:path';

import {blocked} from './common.mjs';

import {UNSAFE_TEXT_PATTERN} from '../../schemas/shared.mjs';
import {listFiles, PROTO_DIR} from '../lib/common.mjs';

const LEAK_SCAN = path.join(PROTO_DIR, 'infra', 'scripts', 'leak_scan.mjs');

// Index data and coverage reports quote existing tests, which legitimately contain URLs and loopback hosts.
// Generated agent result schemas hold $ref URLs of the non-routable .invalid schema ids.
const ORIGIN_SCAN_SKIP = ['1-index/', '4-select/coverage/', '.state/', '.work/'];

/** Output-relative files whose text matches the unsafe-text pattern (origin, loopback, session material, server id). */
export function originHits(out) {
    const pattern = new RegExp(UNSAFE_TEXT_PATTERN);
    const files = listFiles(out, {
        skip: (rel) =>
            ORIGIN_SCAN_SKIP.some((p) => `${rel}/`.startsWith(p) || rel.startsWith(p)) ||
            /(?:^|\/)agent-schema[^/]*\.json$/.test(rel),
    });
    return files.filter((f) => pattern.test(fs.readFileSync(path.join(out, f), 'utf8')));
}

export default {
    id: 'no-secret-no-origin',
    gate: 'secret_scan',
    description:
        'No licence material (infra leak_scan.mjs) and no origin, loopback host or session material in the artifacts.',
    liveOnly: false,

    async run(ctx) {
        const evidence = [{kind: 'report', ref: ctx.charterFile}];
        const hits = originHits(ctx.out);
        if (hits.length) {
            return {result: 'fail', evidence: hits.slice(0, 3).map((f) => ({kind: 'report', ref: f}))};
        }
        if (!process.env.MM_LICENSE) {
            return blocked('environment', evidence);
        }
        const scan = ctx.exec(['node', LEAK_SCAN, ctx.out], {capture: true});
        const word = /^(PASS|FAIL)/.exec(scan.stdout)?.[1];
        return {result: scan.status === 0 && word === 'PASS' ? 'pass' : 'fail', evidence};
    },
};
