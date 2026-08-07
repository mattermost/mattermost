// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

// Channel attributes share the access_control group with Classification Markings.
export const GROUP = 'access_control';
export const TARGET_TYPE = 'system';

// Prefix on every field these specs create, so cleanup never touches real ones.
export const FIELD_PREFIX = 'chanattr_e2e';

type CreateOptions = {
    objectType?: 'channel' | 'user';
    type?: 'select' | 'multiselect' | 'text';
    options?: string[];
};

export function attributeName(suffix: string, uniqueId: string): string {
    return `${FIELD_PREFIX}_${suffix}_${uniqueId}`;
}

export async function createAttribute(
    adminClient: Client4,
    name: string,
    {objectType = 'channel', type, options = []}: CreateOptions = {},
): Promise<PropertyField> {
    const field: Record<string, unknown> = {
        name,
        type: type ?? (options.length ? 'select' : 'text'),
        target_type: TARGET_TYPE,
        target_id: '',
        permission_field: 'admin',
        permission_values: 'member',
        permission_options: 'admin',
    };

    if (options.length) {
        field.attrs = {options: options.map((optionName) => ({id: '', name: optionName}))};
    }

    return adminClient.createPropertyField(GROUP, objectType, field as Parameters<Client4['createPropertyField']>[2]);
}

export function optionId(field: PropertyField, name: string): string {
    const options = (field.attrs?.options ?? []) as Array<{id: string; name: string}>;
    const match = options.find((option) => option.name === name);
    if (!match) {
        throw new Error(`option ${name} not found on ${field.name}`);
    }
    return match.id;
}

// Values are typed loosely because a multiselect stores an array where a select
// stores a single option id. The endpoint answers a bare null, not an empty
// array, when a channel has no values at all.
export async function readChannelValues(client: Client4, channelId: string): Promise<Array<PropertyValue<unknown>>> {
    const values = await client.getPropertyValues<unknown>(GROUP, 'channel', channelId);
    return values ?? [];
}

export function valueFor(values: Array<PropertyValue<unknown>>, field: PropertyField): unknown {
    return values.find((value) => value.field_id === field.id)?.value;
}

export async function deleteAttributes(adminClient: Client4, fields: PropertyField[]): Promise<void> {
    for (const field of fields) {
        try {
            await adminClient.deletePropertyField(GROUP, field.object_type, field.id);
        } catch {} // eslint-disable-line no-empty
    }
}

// Best-effort cleanup of fields left behind by an interrupted run.
export async function purgeAttributes(adminClient: Client4): Promise<void> {
    for (const objectType of ['channel', 'user'] as const) {
        try {
            const fields = await adminClient.getPropertyFields(GROUP, objectType, TARGET_TYPE);
            const stale = (fields ?? []).filter((field) => field.name.startsWith(FIELD_PREFIX) && field.delete_at === 0);
            await deleteAttributes(adminClient, stale);
        } catch {} // eslint-disable-line no-empty
    }
}
