// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

export const GLOBAL_ATTRIBUTES_ADMIN_PATH = '/admin_console/system_attributes/manage_attributes';

// Canonical values: webapp/channels/src/components/admin_console/global_attributes/global_attributes_table.tsx
// (cross-package import not feasible between e2e-tests and webapp)
const PROPERTY_GROUP = 'access_control';
const OBJECT_TYPE = 'template';
const TARGET_TYPE = 'system';

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
 * Removes any access_control/template field with the given name (clean slate for E2E),
 * ignoring failures — the property routes may be unavailable when the feature flag is off,
 * or the field may simply not exist yet.
 */
export async function deleteGlobalAttributeFieldIfExists(adminClient: Client4, name: string) {
    try {
        const fields = await adminClient.getPropertyFields(PROPERTY_GROUP, OBJECT_TYPE, TARGET_TYPE);
        for (const field of fields.filter((f) => f.name === name && f.delete_at === 0)) {
            await adminClient.deletePropertyField(PROPERTY_GROUP, OBJECT_TYPE, field.id);
        }
    } catch {
        // May not exist, or routes unavailable; ignore.
    }
}

/**
 * Creates an access_control/template property field (the same group/object type/target
 * this ticket's table lists) for E2E seeding. Ensures a clean slate first so reruns don't
 * collide with a field left over from a prior failed run.
 */
export async function createGlobalAttributeField(
    adminClient: Client4,
    name: string,
    field: Partial<Parameters<Client4['createPropertyField']>[2]>,
) {
    await deleteGlobalAttributeFieldIfExists(adminClient, name);

    return adminClient.createPropertyField(PROPERTY_GROUP, OBJECT_TYPE, {
        name,
        target_type: TARGET_TYPE,
        target_id: '',
        ...field,
    } as Parameters<Client4['createPropertyField']>[2]);
}
