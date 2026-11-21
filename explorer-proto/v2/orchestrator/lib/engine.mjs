// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/dot-location -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// How a charter maps onto the existing engine CLI (explorer-proto/src/cli.ts). The engine reads
// explorer-proto/sessions/<name>/charter.json: session mode for explorer-session-charter/v1, journey mode for
// explorer-journey-charter/v1. It has no reader for explorer-charter/v2 yet, so those are reported unsupported.
import fs from 'node:fs';
import path from 'node:path';

import {PROTO_DIR} from './common.mjs';

export const ENGINE_CLI = 'explorer-proto/src/cli.ts';

const KIND_BY_SCHEMA = {
    'explorer-session-charter/v1': 'session',
    'explorer-journey-charter/v1': 'journey',
};

function nameOf(charter) {
    return String(charter.dedupe?.key ?? charter.journey_id ?? charter.charter_id)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** {kind, name, supported, reason?} for a charter, or for --engine-charter <session|journey>:<name>. */
export function engineFor(flags, charter) {
    let kind;
    let name;
    if (flags.engineCharter) {
        [kind, name] = flags.engineCharter.split(':');
    } else {
        kind = KIND_BY_SCHEMA[charter.schema];
        name = nameOf(charter);
    }
    if (!kind) {
        return {kind: null, name, supported: false, reason: `the engine has no reader for ${charter.schema}`};
    }
    if (!fs.existsSync(path.join(PROTO_DIR, 'sessions', name, 'charter.json'))) {
        return {kind, name, supported: false, reason: `explorer-proto/sessions/${name}/charter.json does not exist`};
    }
    return {kind, name, supported: true};
}

export function engineArgv(mode, engine, out) {
    const flag = engine.kind === 'journey' ? `--journey=${engine.name}` : `--session=${engine.name}`;
    return ['node', ENGINE_CLI, mode, flag, ...(out ? [`--out=${out}`] : [])];
}

/** Planned argv (same shape in dry mode, where support is not required). */
export function plannedArgv(mode, flags, charter, out) {
    const kind = flags.engineCharter?.split(':')[0] ?? KIND_BY_SCHEMA[charter.schema] ?? 'session';
    const name = flags.engineCharter?.split(':')[1] ?? nameOf(charter);
    return engineArgv(mode, {kind, name}, out);
}
