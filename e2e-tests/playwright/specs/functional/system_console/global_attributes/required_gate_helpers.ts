// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ClientError, type Client4} from '@mattermost/client';
import type {Channel} from '@mattermost/types/channels';
import type {PropertyField} from '@mattermost/types/properties';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {expect, ignoreMissing, type App} from '@mattermost/playwright-lib';

import {backfillAndRequireChannelAttribute} from '../../channels/channel_attributes/helpers';

import {attributeDetailsPath} from './global_attributes_helpers';

const SYSTEM_BOT_USERNAME = 'system-bot';

const PROPERTY_GROUP = 'access_control';
const TARGET_TYPE = 'system';

/**
 * Fetches a single channel-object property field by ID. The TS Client4 has
 * no singular getPropertyField, only the paginated list.
 */
export async function getChannelPropertyField(adminClient: Client4, fieldId: string): Promise<PropertyField> {
    const fields = await adminClient.getPropertyFields(PROPERTY_GROUP, 'channel', {
        targetType: TARGET_TYPE,
        perPage: 200,
    });
    const field = fields.find((f) => f.id === fieldId);
    if (!field) {
        throw new Error(`channel property field ${fieldId} not found`);
    }
    return field;
}

// Prefix on every field/channel these specs create, so cleanup never touches
// anything real. Mirrors channels/channel_attributes/helpers.ts's FIELD_PREFIX
// convention, kept separate because this directory's fields are always
// template+linked pairs, not standalone channel fields.
export const FIELD_PREFIX = 'req_gate_e2e';

export function fieldName(suffix: string, uniqueId: string): string {
    return `${FIELD_PREFIX}_${suffix}_${uniqueId}`.replace(/[^A-Za-z0-9_]/g, '_');
}

export type ChannelAttributeFieldPair = {
    templateField: PropertyField;
    channelField: PropertyField;
};

/**
 * Creates a template field plus its Channels-linked field directly via the
 * API -- the same two-field shape the System Console's "New attribute" page
 * builds through the UI (see attribute_details.tsx), but without driving
 * every keystroke, so a test can seed a starting state and then navigate
 * straight to the edit page to exercise the Required toggle from there.
 *
 * When `required` is requested, the helper follows the production rollout:
 * create optional, backfill every active local channel, then PATCH Required.
 * A caller that needs a noncompliant channel must keep that channel archived
 * during this helper and restore it afterward.
 *
 * `displayName` is set on the template only, as an API or plugin caller may
 * leave it: the linked channel field carries none of its own.
 */
export async function createChannelAttributeField(
    adminClient: Client4,
    name: string,
    opts: {options?: string[]; required?: boolean; displayName?: string} = {},
): Promise<ChannelAttributeFieldPair> {
    const templateAttrs: Record<string, unknown> = {};
    if (opts.options?.length) {
        templateAttrs.options = opts.options.map((o) => ({id: '', name: o}));
    }
    if (opts.displayName) {
        templateAttrs.display_name = opts.displayName;
    }
    const templateField = await adminClient.createPropertyField(PROPERTY_GROUP, 'template', {
        name,
        type: opts.options?.length ? 'select' : 'text',
        target_type: TARGET_TYPE,
        target_id: '',
        attrs: Object.keys(templateAttrs).length ? templateAttrs : undefined,
        permission_field: 'admin',
        permission_values: 'admin',
        permission_options: 'admin',
    } as Parameters<Client4['createPropertyField']>[2]);

    const channelField = await adminClient.createPropertyField(PROPERTY_GROUP, 'channel', {
        name,
        type: templateField.type,
        target_type: TARGET_TYPE,
        target_id: '',
        linked_field_id: templateField.id,
        permission_field: 'admin',
        permission_values: 'admin',
    } as Parameters<Client4['createPropertyField']>[2]);

    if (!opts.required) {
        return {templateField, channelField};
    }

    const requiredChannelField = await backfillAndRequireChannelAttribute(
        adminClient,
        channelField,
        opts.options?.length ? optionId(templateField, opts.options[0]) : 'e2e backfill',
    );
    return {templateField, channelField: requiredChannelField};
}

/**
 * Deletes the channel-linked field first (the server refuses to delete a
 * template with live linked dependents), then the template. A field that is
 * already gone is fine; any other failure surfaces.
 */
export async function deleteChannelAttributeField(
    adminClient: Client4,
    pair: ChannelAttributeFieldPair,
): Promise<void> {
    await ignoreMissing(() => adminClient.deletePropertyField(PROPERTY_GROUP, 'channel', pair.channelField.id));
    await ignoreMissing(() => adminClient.deletePropertyField(PROPERTY_GROUP, 'template', pair.templateField.id));
}

/**
 * Cleanup for a run interrupted before its own teardown ran: deletes any
 * template/channel field pair whose name starts with FIELD_PREFIX. Channel
 * fields are deleted first for the same reason as deleteChannelAttributeField.
 */
export async function purgeRequiredGateFields(adminClient: Client4): Promise<void> {
    const channelFields = await adminClient.getPropertyFields(PROPERTY_GROUP, 'channel', {
        targetType: TARGET_TYPE,
        perPage: 200,
    });
    for (const field of channelFields.filter((f) => f.name.startsWith(FIELD_PREFIX) && f.delete_at === 0)) {
        await ignoreMissing(() => adminClient.deletePropertyField(PROPERTY_GROUP, 'channel', field.id));
    }

    const templateFields = await adminClient.getPropertyFields(PROPERTY_GROUP, 'template', {
        targetType: TARGET_TYPE,
        perPage: 200,
    });
    for (const field of templateFields.filter((f) => f.name.startsWith(FIELD_PREFIX) && f.delete_at === 0)) {
        await ignoreMissing(() => adminClient.deletePropertyField(PROPERTY_GROUP, 'template', field.id));
    }
}

/**
 * Archives channels the test made. Archived channels are not counted by the gate, so this keeps the server-wide
 * missing-values count from leaking into later tests and specs. A channel that is already gone is fine.
 */
export async function archiveChannels(adminClient: Client4, channels: Channel[]): Promise<void> {
    for (const channel of channels) {
        await ignoreMissing(() => adminClient.deleteChannel(channel.id));
    }
}

export async function createComplianceChannel(
    adminClient: Client4,
    team: Team,
    suffix: string,
    displayName = `Req Gate Channel ${suffix}`,
): Promise<Channel> {
    return adminClient.createChannel({
        team_id: team.id,
        name: `req-gate-${suffix}`.toLowerCase(),
        display_name: displayName,
        type: 'O',
    } as Channel);
}

export function optionId(field: PropertyField, name: string): string {
    const options = (field.attrs?.options ?? []) as Array<{id: string; name: string}>;
    const match = options.find((option) => option.name === name);
    if (!match) {
        throw new Error(`option ${name} not found on ${field.name}`);
    }
    return match.id;
}

/**
 * Opens an existing attribute's page and its Channels settings, which start collapsed. `fieldId` is the template's id,
 * or the channel field's own id for an attribute created on channels directly.
 */
export async function openAttributeChannelSettings(
    app: App,
    fieldId: string,
): Promise<App['admin']['attribute']['appliesTo']['channel']['settings']> {
    await app.page.goto(attributeDetailsPath(app, fieldId));
    await expect(app.admin.attribute.displayName.container).toBeVisible();
    const {channel} = app.admin.attribute.appliesTo;
    await channel.toggleButton.clickTo(channel.settings);
    return channel.settings;
}

/**
 * The text of the System Bot's DMs to `user` that mention `text`: none while the bot does not exist yet (the server
 * creates it lazily on first use, so nothing can have been sent by it).
 */
export async function systemBotMessagesAbout(adminClient: Client4, user: UserProfile, text: string): Promise<string[]> {
    let systemBot: UserProfile;
    try {
        systemBot = await adminClient.getUserByUsername(SYSTEM_BOT_USERNAME);
    } catch (error) {
        if (error instanceof ClientError && error.status_code === 404) {
            return [];
        }
        throw error;
    }
    const dm = await adminClient.createDirectChannel([user.id, systemBot.id]);
    const {posts} = await adminClient.getPosts(dm.id);
    return Object.values(posts)
        .map((post) => post.message)
        .filter((message) => message.includes(text));
}
