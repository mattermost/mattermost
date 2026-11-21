// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-process-env -- the infra directory override is a documented test seam */

// Where the infra scripts, the seed manifest and the bookmark helper live. PILOT_INFRA_DIR points the orchestrator at
// a directory laid out like explorer-proto/infra (scripts/{gate,up,down}.sh, scripts/bookmark_ctl.mjs,
// .run/seed-manifest.json). It exists so the selftest can run stage 0 and the control without Docker.
import path from 'node:path';

import {INFRA_DIR, PROTO_DIR} from './common.mjs';

/** Sessions that infra/scripts/up.sh can seed (`up.sh --session=<name>`). */
export const INFRA_SESSIONS = ['bookmarks'];

export function infraPaths() {
    const override = process.env.PILOT_INFRA_DIR;
    const dir = override ? path.resolve(override) : INFRA_DIR;
    const scripts = path.join(dir, 'scripts');
    return {
        overridden: Boolean(override),
        dir,
        scripts,
        gate: path.join(scripts, 'gate.sh'),
        up: path.join(scripts, 'up.sh'),
        down: path.join(scripts, 'down.sh'),
        bookmarkCtl: path.join(scripts, 'bookmark_ctl.mjs'),
        run: path.join(dir, '.run'),
        manifest: path.join(dir, '.run', 'seed-manifest.json'),
        forwarderPid: path.join(dir, '.run', 'forwarder.pid'),
    };
}

export function sessionCharterPath(session) {
    return path.join(PROTO_DIR, 'sessions', session, 'charter.json');
}
