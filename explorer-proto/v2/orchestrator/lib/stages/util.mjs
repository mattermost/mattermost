// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/dot-location -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

import fs from 'node:fs';
import path from 'node:path';

import {hashFiles, listFiles, sha256Json} from '../common.mjs';

const RECORD = 'stage-record.json';

/** Digest of everything a finished stage produced, so a stage's input hash follows its upstream outputs. */
export function dirDigest(ctx, index) {
    const dir = ctx.dirOf(index);
    if (!fs.existsSync(dir)) {
        return null;
    }
    return sha256Json(hashFiles(dir, listFiles(dir, {skip: (rel) => rel === RECORD})));
}

export function readStageRecord(ctx, index) {
    const file = path.join(ctx.dirOf(index), RECORD);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/** Accepted charters recorded by stage 4, as [{id, file, charter}]. */
export function acceptedCharters(ctx) {
    if (!ctx.exists(4, 'selection.json')) {
        return [];
    }
    const selection = ctx.readJson(4, 'selection.json', 'orch#selection');
    return selection.decisions
        .filter((d) => d.decision === 'accepted')
        .map((d) => ({
            id: d.charter_id,
            file: d.charter_file,
            charter: JSON.parse(fs.readFileSync(path.join(ctx.out, d.charter_file), 'utf8')),
        }));
}
