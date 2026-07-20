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

/**
 * True when the effective GlobalAttributes value can't be trusted as the persisted
 * config value: either an env var (e.g. MM_FEATUREFLAGS_GLOBALATTRIBUTES) overrides it
 * (per getEnvironmentConfig()), or ServiceSettings.SplitKey is configured, meaning flags
 * are synced live from an external service rather than read from local config at all.
 * Callers should skip restoring/mutating the flag when this returns true, since
 * getConfig() would reflect the override, not what is actually persisted underneath it.
 */
export async function isGlobalAttributesFlagOverridden(adminClient: Client4): Promise<boolean> {
    const config = await adminClient.getConfig();
    if (config.ServiceSettings?.SplitKey) {
        return true;
    }
    const environmentConfig = await adminClient.getEnvironmentConfig();
    return Boolean((environmentConfig as any)?.FeatureFlags?.GlobalAttributes);
}
