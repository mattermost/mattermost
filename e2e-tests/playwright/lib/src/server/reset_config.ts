// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {getAdminClientHealing} from './admin_lockout';
import {resetConfigWith} from './reset_config_with';

/** Re-applies the on-prem config overrides. Pass a logged-in admin client when a lockout may be active. */
export async function resetConfig(adminClient?: Client4) {
    return resetConfigWith(adminClient ?? (await getAdminClientHealing()).adminClient);
}
