// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';

import {PROTO_DIR} from '../../../src/paths.ts';

import {loadAllowlist} from './findings.ts';
import type {Allowlist} from './findings.ts';
import type {CheckSpec} from './oracle-uirest.ts';

export const ORACLES_DIR = path.join(PROTO_DIR, 'v2', 'oracles');

export function loadChecks(dir = path.join(ORACLES_DIR, 'checks')): CheckSpec[] {
    return fs
        .readdirSync(dir)
        .filter((file) => file.endsWith('.check.json'))
        .sort()
        .map((file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')) as CheckSpec);
}

export function loadDefaultAllowlist(): Allowlist {
    return loadAllowlist(path.join(ORACLES_DIR, 'allowlist.json'));
}
