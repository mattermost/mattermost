// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Stage 1, index: run the coverage-index extractor for the current checkout into <out>/1-index/data.
// Static analysis only; it runs in dry mode too.
import path from 'node:path';

import {V2_DIR} from '../common.mjs';
import {validate} from '../schemas.mjs';

const SAMPLE = 50;

export default {
    index: 1,
    name: 'index',
    modes: ['author', 'both'],

    async inputs() {
        const {defaultIndexDir, gitSha} = await import('../../../index/extract.mjs');
        return [{checkout: gitSha(path.resolve(V2_DIR, '../..')), cache_key: path.basename(defaultIndexDir())}];
    },

    async run(ctx) {
        const extractor = path.join(V2_DIR, 'index', 'extract.mjs');
        const data = path.join(ctx.dir, 'data');
        const done = ctx.exec(['node', extractor, `--out=${data}`], {quiet: true});
        if (done.status !== 0) {
            throw new Error('extract.mjs failed');
        }
        const {loadIndex} = await import('../../../index/extract.mjs');
        const {tests, meta} = loadIndex(data);
        const sample = {
            schema: 'explorer-coverage-index/v2',
            source_sha: meta.git_sha,
            indexer: 'extract-v1',
            tests: tests.slice(0, SAMPLE),
        };
        const conformance = validate('coverage-index', sample);
        const summary = {
            schema: 'explorer-index-summary/v1',
            source_sha: meta.git_sha,
            cache_key: meta.cache_key,
            tests: meta.counts.tests,
            by_suite: meta.counts.by_suite,
            source_status: meta.counts.source_status,
            files: {tests: '1-index/data/tests.jsonl', meta: '1-index/data/meta.json'},
            coverage_index_schema: {
                checked_records: sample.tests.length,
                conformant: conformance.ok,
                ...(conformance.ok ? {} : {first_errors: conformance.errors.slice(0, 3)}),
            },
        };
        ctx.writeJson('index-summary.json', summary, 'orch#index-summary');
        return {result: 'pass'};
    },
};
