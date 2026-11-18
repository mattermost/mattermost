// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

import {scanProject} from '../src/cli.ts';
import {loadConfig, resolveConfig} from '../src/config.ts';
import {goldenCeilings} from '../src/report.ts';
import {staleReferences} from '../src/stale_refs.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const goldenFile = path.join(here, '..', 'golden.json');

// eslint-disable-next-line no-process-env
const enabled = Boolean(process.env.TEST_SURFACE_GOLDEN);

type Golden = {ceilings: Record<string, number>; errors: Record<string, number>};

// Error counts and exception budgets may decrease without changing a baseline.
test('golden numbers on the webapp', {skip: !enabled && 'set TEST_SURFACE_GOLDEN=1 (scans the whole webapp)'}, () => {
    const hostConfig = path.join(here, '..', '..', 'lib', 'surface', 'config.json');
    const webapp = path.resolve(here, '../../../../webapp');
    const config = fs.existsSync(hostConfig) ? loadConfig(hostConfig) : resolveConfig({
        root: webapp,
        tsconfig: path.join(webapp, 'channels/tsconfig.json'),
        include: [path.join(webapp, 'channels/src'), path.join(webapp, 'platform')],
        entityTypeDirs: [path.join(webapp, 'platform/types/src')],
        client: {file: path.join(webapp, 'platform/client/src/client4.ts'), className: 'Client4', urlVersion: '/api/v4'},
        openapiDir: path.join(webapp, '../api/v4/source'),
        pathOverrides: {
            '@mattermost/types/*': ['../platform/types/src/*'],
            '@mattermost/client': ['../platform/client/src/index.ts'],
            '@mattermost/client/*': ['../platform/client/src/*'],
            '@mattermost/components': ['../platform/components/src/index.tsx'],
            '@mattermost/shared/*': ['../platform/shared/src/*'],
        },
        output: {report: 'webapp.surface.json'},
    }, here);
    const {result, manifest, diagnostics} = scanProject(config);
    const {ceilings, errors} = JSON.parse(fs.readFileSync(goldenFile, 'utf8')) as Golden;
    const above = goldenCeilings(result.stats, [...diagnostics, ...staleReferences(manifest, config)], config.checks);
    const rises = Object.entries(ceilings).filter(([k, v]) => (above.ceilings[k] ?? 0) > v).map(([k, v]) => `${k}: ${above.ceilings[k]} > ${v}`);
    const more = Object.entries(above.errors).filter(([rule, count]) => count > (errors[rule] ?? 0)).map(([rule, count]) => `${rule} errors: ${count} > ${errors[rule] ?? 0}`);
    const failures = [...rises, ...more];
    assert.deepEqual(failures, [], `error count or exception budget increased:\n  ${failures.join('\n  ')}\nIf this is intended, update golden.json (\`test-surface report\` writes the current numbers to reports/golden.json).`);
});
