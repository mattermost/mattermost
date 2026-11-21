// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/wrap-regex -- Prettier owns formatting and the repo relaxes these rules for .ts/.js only; awaits in loops run in order by design */

// Canned, schema-valid results for tests. Delegates to the orchestrator's stub agent so there is one set of canned
// answers. Never use it for a live run: it answers nothing about the product.
import path from 'node:path';

import {outDirOf} from './result_check.mjs';

import {stubResult} from '../../orchestrator/lib/stub_agent.mjs';

function featureOf(task) {
    const hit = task.inputs.map((i) => /features\/([A-Za-z0-9._-]+)\.json$/.exec(i.path)).find(Boolean);
    return hit ? hit[1] : 'channels.favorites';
}

export async function buildStubResult(task, taskFile, scenario = 'default') {
    const ctx = {flags: {live: false, feature: featureOf(task)}, out: path.resolve(outDirOf(taskFile))};
    return stubResult(task, ctx, scenario);
}
