// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

const PROPERTY_GROUP = 'custom_profile_attributes';
const PROPERTY_OBJECT = 'user';
const TARGET_TYPE = 'system';
const CLASSIFICATION_FIELD_NAME = 'classification';

export const CLASSIFICATION_MARKINGS_ADMIN_PATH = '/admin_console/site_config/classification_markings';

/**
 * Toggle via System Console config API. On servers without SplitKey, feature flags are
 * read-only from config (see server/config/store.go); effective values come from env
 * (e.g. MM_FEATUREFLAGS_CLASSIFICATIONMARKINGS). E2E docker sets that env in server.generate.sh.
 */
export async function setClassificationMarkingsFeatureFlag(adminClient: Client4, enabled: boolean) {
    const config = await adminClient.getConfig();
    // Full config round-trip; FeatureFlags is a wide record on the client type.
    await adminClient.updateConfig({
        ...config,
        FeatureFlags: {
            ...config.FeatureFlags,
            ClassificationMarkings: enabled,
        },
    } as Awaited<ReturnType<Client4['getConfig']>>);
}

/**
 * Removes the system classification property field if present (clean slate for E2E).
 */
export async function deleteClassificationMarkingsFieldIfExists(adminClient: Client4) {
    try {
        const fields = await adminClient.getPropertyFields(PROPERTY_GROUP, PROPERTY_OBJECT, TARGET_TYPE);
        const field = fields.find((f) => f.name === CLASSIFICATION_FIELD_NAME && f.delete_at === 0);
        if (field?.id) {
            await adminClient.deletePropertyField(PROPERTY_GROUP, PROPERTY_OBJECT, field.id);
        }
    } catch {
        // Property routes may be unavailable when the feature flag is off; ignore.
    }
}

export type SetupGlobalBannerOptions = {
    /** Level id to store in ClassificationMarkingsSettings.GlobalBanner.LevelID */
    levelId: string;
    enabled?: boolean;
    placement?: 'top' | 'top_and_bottom';
};

/**
 * Patches the server config so ClassificationMarkingsSettings.GlobalBanner matches the provided
 * values. This replaces the previous PSA-nested `attrs.global_banner` storage approach.
 */
export async function setGlobalBannerConfig(adminClient: Client4, bannerOpts: SetupGlobalBannerOptions) {
    const config = await adminClient.getConfig();
    await adminClient.updateConfig({
        ...config,
        ClassificationMarkingsSettings: {
            ...((config as unknown as {ClassificationMarkingsSettings?: Record<string, unknown>}).ClassificationMarkingsSettings ?? {}),
            GlobalBanner: {
                Enabled: bannerOpts.enabled ?? true,
                Placement: bannerOpts.placement ?? 'top',
                LevelID: bannerOpts.levelId,
            },
        },
    } as Awaited<ReturnType<Client4['getConfig']>>);
}

/**
 * Resets the GlobalBanner section to default (disabled / top / empty level) so subsequent tests
 * start from a clean state.
 */
export async function resetGlobalBannerConfig(adminClient: Client4) {
    await setGlobalBannerConfig(adminClient, {levelId: '', enabled: false, placement: 'top'});
}

/**
 * Creates the classification property field with the provided levels. The global banner
 * configuration now lives in server config, not in the property field's attrs.
 */
export async function setupClassificationField(
    adminClient: Client4,
    levels: Array<{id?: string; name: string; color: string; rank: number}>,
) {
    // Ensure a clean slate first
    await deleteClassificationMarkingsFieldIfExists(adminClient);

    return adminClient.createPropertyField(PROPERTY_GROUP, PROPERTY_OBJECT, {
        name: CLASSIFICATION_FIELD_NAME,
        type: 'select',
        target_type: TARGET_TYPE,
        target_id: '',
        attrs: {
            options: levels.map((l) => ({id: l.id ?? '', name: l.name, color: l.color, rank: l.rank})),
            managed: 'admin',
        },
        permission_field: 'sysadmin',
        permission_values: 'sysadmin',
        permission_options: 'sysadmin',
    } as Parameters<Client4['createPropertyField']>[2]);
}

/**
 * Convenience helper: create the classification field and seed the global banner config
 * so tests start with a fully-configured banner pointing at an existing level.
 */
export async function setupClassificationFieldWithGlobalBanner(
    adminClient: Client4,
    levels: Array<{id?: string; name: string; color: string; rank: number}>,
    bannerOpts: SetupGlobalBannerOptions,
) {
    const created = await setupClassificationField(adminClient, levels);
    await setGlobalBannerConfig(adminClient, bannerOpts);
    return created;
}
