// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/dot-location, @stylistic/wrap-regex -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// Feature definitions (features/<id>.json): schema-checked, then leakage-checked before any stage runs.
import fs from 'node:fs';
import path from 'node:path';

import {EXIT, ORCH_DIR, ORCH_REPO_PATH, readJson, sha256File} from './common.mjs';
import {checkFeatureLeakage} from './leakage.mjs';
import {validate} from './schemas.mjs';

export function featureFile(id) {
    return path.join(ORCH_DIR, 'features', `${id}.json`);
}

export function featureRepoPath(id) {
    return `${ORCH_REPO_PATH}/features/${id}.json`;
}

export function listFeatures() {
    return fs
        .readdirSync(path.join(ORCH_DIR, 'features'))
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace(/\.json$/, ''))
        .sort();
}

export function loadFeature(id) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(id) || !fs.existsSync(featureFile(id))) {
        return {ok: false, exitCode: EXIT.USAGE, errors: [`unknown feature; available: ${listFeatures().join(', ')}`]};
    }
    const feature = readJson(featureFile(id));
    const shape = validate('feature', feature);
    if (!shape.ok || feature.id !== id) {
        return {ok: false, exitCode: EXIT.USAGE, errors: shape.ok ? ['id does not match the file name'] : shape.errors};
    }
    const leakage = checkFeatureLeakage(feature);
    if (!leakage.pass) {
        return {
            ok: false,
            exitCode: EXIT.FAIL,
            errors: leakage.violations.map((v) => `leakage ${v.rule} ${v.path}: ${v.detail}`),
        };
    }
    return {ok: true, feature, leakage, sha256: sha256File(featureFile(id)), repoPath: featureRepoPath(id)};
}
