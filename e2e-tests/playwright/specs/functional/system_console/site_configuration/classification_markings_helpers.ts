// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

// Canonical values: webapp/channels/src/components/admin_console/classification_markings/utils/index.ts
// (cross-package import not feasible between e2e-tests and webapp)
const PROPERTY_GROUP = 'access_control';
const OBJECT_TYPE = 'template';
const LINKED_OBJECT_TYPE = 'system';
const TARGET_TYPE = 'system';
const SYSTEM_FIELD_TARGET_ID = ''; // target_type 'system' requires empty target_id on the field
const CLASSIFICATION_FIELD_NAME = 'classification';
const LINKED_CLASSIFICATION_FIELD_NAME = 'classification';
const DISPLAY_BANNER_TOP = 'display_banner_top';
const DISPLAY_BANNER_BOTTOM = 'display_banner_bottom';

export const CLASSIFICATION_MARKINGS_ADMIN_PATH = '/admin_console/site_config/classification_markings';

/**
 * Toggle via System Console config API. On servers without SplitKey, feature flags are
 * read-only from config (see server/config/store.go); effective values come from env
 * (e.g. MM_FEATUREFLAGS_CLASSIFICATIONMARKINGS). E2E docker sets that env in server.generate.sh.
 */
export async function setClassificationMarkingsFeatureFlag(adminClient: Client4, enabled: boolean) {
    await adminClient.patchConfig({
        FeatureFlags: {
            ClassificationMarkings: enabled,
        },
    } as any);
}

/**
 * Removes the classification property field and its linked system field if present
 * (clean slate for E2E). Linked field is deleted first to avoid deletion-protection errors.
 */
export async function deleteClassificationMarkingsFieldIfExists(adminClient: Client4) {
    // Delete channel linked fields first (created by channel classification tests).
    try {
        const channelFields = await adminClient.getPropertyFields(PROPERTY_GROUP, 'channel', TARGET_TYPE, '');
        for (const f of channelFields.filter((f) => f.name === 'classification' && f.delete_at === 0)) {
            await adminClient.deletePropertyField(PROPERTY_GROUP, 'channel', f.id);
        }
    } catch {
        // May not exist; ignore.
    }

    // Clean up both the current 'system' object type and the legacy 'user' object type
    // to handle stale data from earlier versions of the feature.
    for (const objectType of [LINKED_OBJECT_TYPE, 'user'] as const) {
        try {
            const linkedFields = await adminClient.getPropertyFields(
                PROPERTY_GROUP,
                objectType,
                TARGET_TYPE,
                SYSTEM_FIELD_TARGET_ID,
            );
            const matchingLinkedFields = linkedFields.filter(
                (f) => f.name === LINKED_CLASSIFICATION_FIELD_NAME && f.delete_at === 0 && f.linked_field_id,
            );
            for (const f of matchingLinkedFields) {
                await adminClient.deletePropertyField(PROPERTY_GROUP, objectType, f.id);
            }
        } catch {
            // Linked field may not exist; ignore.
        }
    }
    try {
        const fields = await adminClient.getPropertyFields(PROPERTY_GROUP, OBJECT_TYPE, TARGET_TYPE);
        const matchingFields = fields.filter((f) => f.name === CLASSIFICATION_FIELD_NAME && f.delete_at === 0);
        for (const f of matchingFields) {
            await adminClient.deletePropertyField(PROPERTY_GROUP, OBJECT_TYPE, f.id);
        }
    } catch {
        // Property routes may be unavailable when the feature flag is off; ignore.
    }
}

export type SetupGlobalBannerOptions = {
    /** Level ID that the global banner should display */
    levelId: string;
    enabled?: boolean;
    placement?: 'top' | 'top_and_bottom';
};

/**
 * Creates (or recreates) the classification property field with the provided levels.
 * The template field stores classification levels (attrs.options) only.
 */
export async function setupClassificationField(
    adminClient: Client4,
    levels: Array<{id?: string; name: string; color: string; rank: number}>,
) {
    // Ensure a clean slate first.
    await deleteClassificationMarkingsFieldIfExists(adminClient);

    return adminClient.createPropertyField(PROPERTY_GROUP, OBJECT_TYPE, {
        name: CLASSIFICATION_FIELD_NAME,
        type: 'select',
        target_type: TARGET_TYPE,
        target_id: '',
        attrs: {
            options: levels.map((l) => ({id: l.id ?? '', name: l.name, color: l.color, rank: l.rank})),
        },
        permission_field: 'admin',
        permission_values: 'admin',
        permission_options: 'admin',
    } as Parameters<Client4['createPropertyField']>[2]);
}

/**
 * Creates the classification template field, the linked system classification field
 * (with attrs.actions encoding banner placement), and upserts the system property value
 * (the option ID of the selected classification level) — the full three-layer setup.
 *
 * Data model:
 *   Template field  → attrs.options (levels)
 *   Linked field    → attrs.actions (display_banner_top / display_banner_bottom)
 *   Property value  → value = option_id (UUID from template attrs.options)
 */
export async function setupClassificationFieldWithGlobalBanner(
    adminClient: Client4,
    levels: Array<{id?: string; name: string; color: string; rank: number}>,
    bannerOpts: SetupGlobalBannerOptions,
) {
    // 1. Create the template field (levels only).
    const templateField = await setupClassificationField(adminClient, levels);

    const enabled = bannerOpts.enabled ?? true;

    // Resolve the option ID for the requested level (only needed when enabled).
    let optionId = '';
    if (enabled && bannerOpts.levelId) {
        const options = (templateField.attrs?.options ?? []) as Array<{id: string; name: string}>;
        const matchedOption = options.find((o) => o.id === bannerOpts.levelId);
        if (!matchedOption) {
            const available = options.map((o) => `${o.name} (${o.id})`).join(', ');
            throw new Error(
                `setupClassificationFieldWithGlobalBanner: unknown level ID "${bannerOpts.levelId}". ` +
                    `Available options on template field ${templateField.id}: [${available}]`,
            );
        }
        optionId = matchedOption.id;
    }
    const actions: string[] = [];
    if (enabled) {
        actions.push(DISPLAY_BANNER_TOP);
        if (bannerOpts.placement === 'top_and_bottom') {
            actions.push(DISPLAY_BANNER_BOTTOM);
        }
    }

    // 2. Create the linked system classification field.
    // type, options, and permissions are inherited from the source template by the server.
    const linkedField = await adminClient.createPropertyField(PROPERTY_GROUP, LINKED_OBJECT_TYPE, {
        name: LINKED_CLASSIFICATION_FIELD_NAME,
        type: 'select',
        target_type: TARGET_TYPE,
        target_id: SYSTEM_FIELD_TARGET_ID,
        linked_field_id: templateField.id,
        attrs: {actions},
    } as Parameters<Client4['createPropertyField']>[2]);

    // 3. Upsert the system property value via the dedicated system endpoint.
    if (enabled) {
        if (!optionId) {
            throw new Error(
                `setupClassificationFieldWithGlobalBanner: resolved optionId is empty for level "${bannerOpts.levelId}". ` +
                    'The server may not have assigned an ID to the option.',
            );
        }
        if (typeof (adminClient as any).patchSystemPropertyValues !== 'function') {
            throw new Error('adminClient.patchSystemPropertyValues is not available — rebuild @mattermost/client');
        }
        await (adminClient as any).patchSystemPropertyValues(PROPERTY_GROUP, [
            {field_id: linkedField.id, value: optionId},
        ]);
    }

    return {templateField, linkedField};
}
