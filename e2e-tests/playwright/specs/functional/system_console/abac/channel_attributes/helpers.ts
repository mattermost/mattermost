// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {Client4} from '@mattermost/client';
import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

/**
 * Channel attributes are channel-object, system-target property fields in the
 * PSAv2 `access_control` group — the same group Classification Markings uses.
 * The server registers that group unconditionally at start-up, so these helpers
 * work on any server where the Properties API routes are registered.
 */
export const CHANNEL_ATTRIBUTES_GROUP = 'access_control';
export const CHANNEL_OBJECT_TYPE = 'channel';
export const SYSTEM_TARGET_TYPE = 'system';

/** Every field created by these specs carries this prefix so cleanup stays scoped. */
export const FIELD_PREFIX = 'mm61172ca';

export type PropertyPermissionLevel = 'none' | 'member' | 'admin' | 'sysadmin';

type CreateFieldOptions = {
    permission?: PropertyPermissionLevel;
    actions?: string[];
};

export function channelAttributeFieldName(suffix: string, uniqueId: string): string {
    return `${FIELD_PREFIX}_${suffix}_${uniqueId}`;
}

/**
 * Create a channel attribute definition. Permission tiers are set explicitly on
 * all three axes; only a system admin may pass them, non-admin callers get the
 * server default pinned instead.
 */
export async function createChannelAttributeField(
    adminClient: Client4,
    name: string,
    {permission = 'admin', actions}: CreateFieldOptions = {},
): Promise<PropertyField> {
    const field: Record<string, unknown> = {
        name,
        type: 'text',
        target_type: SYSTEM_TARGET_TYPE,
        target_id: '',
        permission_field: permission,
        permission_values: permission,
        permission_options: permission,
    };

    if (actions) {
        field.attrs = {actions};
    }

    return adminClient.createPropertyField(
        CHANNEL_ATTRIBUTES_GROUP,
        CHANNEL_OBJECT_TYPE,
        field as Parameters<Client4['createPropertyField']>[2],
    );
}

export async function deleteChannelAttributeFields(adminClient: Client4, fieldIds: string[]): Promise<void> {
    for (const fieldId of fieldIds) {
        try {
            await adminClient.deletePropertyField(CHANNEL_ATTRIBUTES_GROUP, CHANNEL_OBJECT_TYPE, fieldId);
        } catch {} // eslint-disable-line no-empty
    }
}

/**
 * Best-effort removal of fields left behind by an interrupted run. Scoped to
 * FIELD_PREFIX so it never touches Classification or other real attributes
 * living in the same shared group.
 */
export async function purgeChannelAttributeFields(adminClient: Client4): Promise<void> {
    try {
        const fields = await adminClient.getPropertyFields(
            CHANNEL_ATTRIBUTES_GROUP,
            CHANNEL_OBJECT_TYPE,
            SYSTEM_TARGET_TYPE,
        );
        const stale = (fields ?? []).filter((field) => field.name.startsWith(FIELD_PREFIX) && field.delete_at === 0);
        await deleteChannelAttributeFields(
            adminClient,
            stale.map((field) => field.id),
        );
    } catch {} // eslint-disable-line no-empty
}

export function writeChannelValue(
    client: Client4,
    channelId: string,
    fieldId: string,
    value: string,
): Promise<Array<PropertyValue<string>>> {
    return client.patchPropertyValues<string>(CHANNEL_ATTRIBUTES_GROUP, CHANNEL_OBJECT_TYPE, channelId, [
        {field_id: fieldId, value},
    ]);
}

export function readChannelValues(client: Client4, channelId: string): Promise<Array<PropertyValue<string>>> {
    return client.getPropertyValues<string>(CHANNEL_ATTRIBUTES_GROUP, CHANNEL_OBJECT_TYPE, channelId);
}

export function findValue(values: Array<PropertyValue<string>>, fieldId: string): PropertyValue<string> | undefined {
    return values.find((value) => value.field_id === fieldId);
}

/**
 * Assert that an API call is rejected with a specific HTTP status. Client4
 * rejects with a ClientError carrying `status_code`, so a resolved promise or a
 * different status both fail the assertion.
 */
export async function expectApiStatus(
    action: () => Promise<unknown>,
    expectedStatus: number,
    label: string,
): Promise<void> {
    let status: number | 'resolved' | undefined;
    try {
        await action();
        status = 'resolved';
    } catch (error: unknown) {
        status =
            typeof error === 'object' && error !== null && 'status_code' in error
                ? (error as {status_code?: number}).status_code
                : undefined;
    }
    expect(status, `${label} should have been rejected with HTTP ${expectedStatus}`).toBe(expectedStatus);
}
