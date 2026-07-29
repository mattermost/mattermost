// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

const PROPERTY_GROUP = 'access_control';
const TEMPLATE_OBJECT_TYPE = 'template';
const CHANNEL_OBJECT_TYPE = 'channel';
const TARGET_TYPE = 'system';
const CLASSIFICATION_FIELD_NAME = 'classification';
const CHANNEL_LINKED_FIELD_NAME = 'classification';

export const TEST_LEVELS = [
    {name: 'UNCLASSIFIED', color: '#007A33', rank: 1},
    {name: 'CONFIDENTIAL', color: '#0033A0', rank: 2},
    {name: 'SECRET', color: '#C8102E', rank: 3},
    {name: 'TOP SECRET', color: '#FF8C00', rank: 4},
];

/**
 * Sets the ClassificationMarkings feature flag via server config.
 */
export async function setClassificationMarkingsFeatureFlag(adminClient: Client4, enabled: boolean) {
    const config = await adminClient.getConfig();
    await adminClient.updateConfig({
        ...config,
        FeatureFlags: {
            ...config.FeatureFlags,
            ClassificationMarkings: enabled,
        },
    } as Awaited<ReturnType<Client4['getConfig']>>);
}

/**
 * Deletes existing classification fields (channel linked, system linked, and template)
 * to provide a clean slate.
 */
export async function deleteClassificationFieldsIfExist(adminClient: Client4) {
    // Delete channel linked fields first
    try {
        const channelFields = await adminClient.getPropertyFields(PROPERTY_GROUP, CHANNEL_OBJECT_TYPE, TARGET_TYPE, '');
        for (const f of channelFields.filter((f) => f.name === CHANNEL_LINKED_FIELD_NAME && f.delete_at === 0)) {
            await adminClient.deletePropertyField(PROPERTY_GROUP, CHANNEL_OBJECT_TYPE, f.id);
        }
    } catch {
        // May not exist
    }

    // Delete system linked fields
    for (const objectType of ['system', 'user'] as const) {
        try {
            const linkedFields = await adminClient.getPropertyFields(PROPERTY_GROUP, objectType, TARGET_TYPE, '');
            for (const f of linkedFields.filter(
                (f) => f.name === 'classification' && f.delete_at === 0 && f.linked_field_id,
            )) {
                await adminClient.deletePropertyField(PROPERTY_GROUP, objectType, f.id);
            }
        } catch {
            // May not exist
        }
    }

    // Delete template fields
    try {
        const fields = await adminClient.getPropertyFields(PROPERTY_GROUP, TEMPLATE_OBJECT_TYPE, TARGET_TYPE);
        for (const f of fields.filter((f) => f.name === CLASSIFICATION_FIELD_NAME && f.delete_at === 0)) {
            await adminClient.deletePropertyField(PROPERTY_GROUP, TEMPLATE_OBJECT_TYPE, f.id);
        }
    } catch {
        // May not exist
    }
}

export type ClassificationLevel = {
    id: string;
    name: string;
    color: string;
    rank: number;
};

export type SetupResult = {
    templateFieldId: string;
    channelFieldId: string;
    levels: ClassificationLevel[];
};

/**
 * Creates the full classification setup: template field + channel linked field.
 * Returns the created fields and the resolved levels (with server-assigned IDs).
 */
export async function setupClassificationWithChannelField(
    adminClient: Client4,
    levels: Array<{name: string; color: string; rank: number}> = TEST_LEVELS,
): Promise<SetupResult> {
    await deleteClassificationFieldsIfExist(adminClient);

    // Create template field
    const templateField = await adminClient.createPropertyField(PROPERTY_GROUP, TEMPLATE_OBJECT_TYPE, {
        name: CLASSIFICATION_FIELD_NAME,
        type: 'select',
        target_type: TARGET_TYPE,
        target_id: '',
        attrs: {
            options: levels.map((l) => ({id: '', name: l.name, color: l.color, rank: l.rank})),
        },
        permission_field: 'admin',
        permission_values: 'admin',
        permission_options: 'admin',
    } as Parameters<Client4['createPropertyField']>[2]);

    // Create channel linked field
    const channelField = await adminClient.createPropertyField(PROPERTY_GROUP, CHANNEL_OBJECT_TYPE, {
        name: CHANNEL_LINKED_FIELD_NAME,
        type: 'select',
        target_type: TARGET_TYPE,
        target_id: '',
        linked_field_id: templateField.id,
    } as Parameters<Client4['createPropertyField']>[2]);

    // Resolve levels with server-assigned IDs
    const options = (templateField.attrs?.options ?? []) as ClassificationLevel[];
    const resolvedLevels = options.sort((a, b) => a.rank - b.rank);

    return {templateFieldId: templateField.id, channelFieldId: channelField.id, levels: resolvedLevels};
}
