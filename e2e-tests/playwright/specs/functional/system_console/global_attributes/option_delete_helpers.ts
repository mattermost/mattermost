// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Channel} from '@mattermost/types/channels';
import type {PropertyField} from '@mattermost/types/properties';
import type {Team} from '@mattermost/types/teams';

import {GROUP, createChannelForAttributes, setChannelValue} from '../../channels/channel_attributes/helpers';

import {getChannelPropertyField} from './required_gate_helpers';

export const OPTION_IN_USE_ERROR_ID = 'api.property_field.options.delete.in_use.app_error';
export const OPTION_IN_USE_MESSAGE = "This option is applied to channels and can't be deleted.";

// The TS Client4 has no wrapper for the options DELETE route, so it is called directly.
export async function deleteFieldOptions(adminClient: Client4, field: PropertyField, optionIds: string[]) {
    return (adminClient as any).doFetch(adminClient.getPropertyFieldOptionsRoute(GROUP, field.object_type, field.id), {
        method: 'delete',
        body: JSON.stringify(optionIds),
    });
}

// Reads a standalone channel field's options, or with objectType 'template' the
// options a System Console attribute keeps on its template.
export async function optionNames(
    adminClient: Client4,
    fieldId: string,
    objectType: 'channel' | 'template' = 'channel',
): Promise<string[]> {
    const field =
        objectType === 'channel'
            ? await getChannelPropertyField(adminClient, fieldId)
            : (await adminClient.getPropertyFields(GROUP, objectType, {targetType: 'system', perPage: 200})).find(
                  (f) => f.id === fieldId,
              );
    if (!field) {
        throw new Error(`${objectType} property field ${fieldId} not found`);
    }
    return ((field.attrs?.options ?? []) as Array<{name: string}>).map((option) => option.name);
}

export async function createValuedChannel(
    adminClient: Client4,
    team: Team,
    suffix: string,
    field: PropertyField,
    value: unknown,
): Promise<Channel> {
    const channel = await createChannelForAttributes(adminClient, team, suffix);
    await setChannelValue(adminClient, channel.id, field, value);
    return channel;
}

export async function archiveChannels(adminClient: Client4, channels: Channel[]) {
    for (const channel of channels) {
        await adminClient.deleteChannel(channel.id).catch(() => undefined);
    }
}
