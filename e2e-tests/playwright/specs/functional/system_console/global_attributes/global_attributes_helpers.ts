// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

export const GLOBAL_ATTRIBUTES_ADMIN_PATH = '/admin_console/system_attributes/manage_attributes';

/**
 * Toggle via System Console config API. On servers without SplitKey, feature flags are
 * read-only from config (see server/config/store.go); effective values come from env
 * (e.g. MM_FEATUREFLAGS_GLOBALATTRIBUTES).
 */
export async function setGlobalAttributesFeatureFlag(adminClient: Client4, enabled: boolean) {
    await adminClient.patchConfig({
        FeatureFlags: {
            GlobalAttributes: enabled,
        },
    } as any);
}
