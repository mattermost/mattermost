// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {getOnPremServerConfigPatch} from './default_config';
import {clearAdminLockout} from './lockout';

/** Re-applies the on-prem config overrides through `client`; clears a known lockout and retries once. */
export async function resetConfigWith(client: Client4) {
    const patch = getOnPremServerConfigPatch() as any;

    try {
        return await client.patchConfig(patch);
    } catch (error) {
        if (!(await clearAdminLockout(error))) {
            throw error;
        }
        return client.patchConfig(patch);
    }
}
