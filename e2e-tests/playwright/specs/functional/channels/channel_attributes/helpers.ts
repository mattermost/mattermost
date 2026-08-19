// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Channel} from '@mattermost/types/channels';
import type {PropertyField, PropertyValue} from '@mattermost/types/properties';
import type {Team} from '@mattermost/types/teams';

// Channel attributes share the access_control group with Classification Markings.
export const GROUP = 'access_control';
export const TARGET_TYPE = 'system';

// Prefix on every field these specs create, so cleanup never touches real ones.
export const FIELD_PREFIX = 'chanattr_e2e';

// Mirrors the allow-list in model/property_field_attrs_validation.go.
export const DISPLAY_LABEL_HEADER = 'display_label_header';
export const DISPLAY_LABEL_INFO = 'display_label_info';
export const DISPLAY_BANNER_TOP = 'display_banner_top';

type CreateOptions = {
    objectType?: 'channel' | 'user';
    type?: 'select' | 'multiselect' | 'text';
    options?: string[];

    required?: boolean;

    // Omit to leave unset, which reads as editable. Pass false to lock.
    editable?: boolean;

    // Undesignated attributes are stored but never shown.
    actions?: string[];

    // Defaults to member, so an ordinary channel member can set a value.
    permissionValues?: 'none' | 'sysadmin' | 'admin' | 'member';

    sortOrder?: number;
    optionColors?: Record<string, string>;
};

export function attributeName(suffix: string, uniqueId: string): string {
    return `${FIELD_PREFIX}_${suffix}_${uniqueId}`;
}

export async function createAttribute(
    adminClient: Client4,
    name: string,
    {
        objectType = 'channel',
        type,
        options = [],
        required,
        editable,
        actions,
        permissionValues = 'member',
        sortOrder,
        optionColors,
    }: CreateOptions = {},
): Promise<PropertyField> {
    const field: Record<string, unknown> = {
        name,
        type: type ?? (options.length ? 'select' : 'text'),
        target_type: TARGET_TYPE,
        target_id: '',
        permission_field: 'admin',
        permission_values: permissionValues,
        permission_options: 'admin',
    };

    const attrs: Record<string, unknown> = {};

    if (options.length) {
        attrs.options = options.map((optionName) => ({
            id: '',
            name: optionName,
            ...(optionColors?.[optionName] ? {color: optionColors[optionName]} : {}),
        }));
    }
    if (required !== undefined) {
        attrs.required = required;
    }
    if (editable !== undefined) {
        attrs.editable = editable;
    }
    if (actions) {
        attrs.actions = actions;
    }
    if (sortOrder !== undefined) {
        attrs.sort_order = sortOrder;
    }

    if (Object.keys(attrs).length) {
        field.attrs = attrs;
    }

    return adminClient.createPropertyField(GROUP, objectType, field as Parameters<Client4['createPropertyField']>[2]);
}

// Sets up channel state without driving the UI.
export async function setChannelValue(
    client: Client4,
    channelId: string,
    field: PropertyField,
    value: unknown,
): Promise<void> {
    await client.patchPropertyValues(GROUP, 'channel', channelId, [
        {field_id: field.id, value} as Parameters<Client4['patchPropertyValues']>[3][number],
    ]);
}

export async function createChannelForAttributes(
    adminClient: Client4,
    team: Team,
    suffix: string,
    displayName = `Attr ${suffix}`,
    propertyValues?: Array<{field_id: string; value: unknown}>,
): Promise<Channel> {
    return adminClient.createChannel({
        team_id: team.id,
        name: `attr-${suffix}`.toLowerCase(),
        display_name: displayName,
        type: 'O',

        // Required attributes are refused server-side, so a channel seeded for a
        // spec has to carry them in the create call.
        ...(propertyValues?.length ? {property_values: propertyValues} : {}),
    } as Channel);
}

export async function setBannerTemplate(
    client: Client4,
    channelId: string,
    text: string,
    backgroundColor = '#1E325C',
): Promise<void> {
    await client.patchChannel(channelId, {
        banner_info: {enabled: true, text, background_color: backgroundColor},
    } as Partial<Channel>);
}

// Mirrors attributeToken() in components/channel_attributes/banner_template.ts.
export function attributeToken(name: string): string {
    return `{{${name}}}`;
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
            const stale = (fields ?? []).filter(
                (field) => field.name.startsWith(FIELD_PREFIX) && field.delete_at === 0,
            );
            await deleteAttributes(adminClient, stale);
        } catch {} // eslint-disable-line no-empty
    }
}

/**
 * Throws when the server carries a required channel attribute these specs did not
 * create.
 *
 * A stray one breaks every fixture that creates a channel — as a 400 from the API,
 * as a 30s timeout on a disabled Create button here — and neither failure names the
 * cause. purgeAttributes cannot clear them: it is scoped to FIELD_PREFIX so it never
 * deletes a field someone meant to keep.
 */
export async function assertNoForeignRequiredAttributes(adminClient: Client4): Promise<void> {
    const fields = await adminClient.getPropertyFields(GROUP, 'channel', TARGET_TYPE, undefined, {perPage: 200});
    const foreign = (fields ?? []).filter(
        (field) => field.delete_at === 0 && field.attrs?.required === true && !field.name.startsWith(FIELD_PREFIX),
    );

    if (foreign.length) {
        const names = foreign.map((field) => field.name).join(', ');
        throw new Error(
            `Required channel attributes not owned by these specs are present: ${names}. ` +
            'Channel creation cannot complete until each has a value. Delete them, or turn off Required, and re-run.',
        );
    }
}
