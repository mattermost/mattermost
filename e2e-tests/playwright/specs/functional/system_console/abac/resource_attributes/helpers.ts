// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import type {Client4} from '@mattermost/client';

/**
 * Helpers for exercising resource.attributes.* (channel custom profile
 * attributes) end to end. The subject of a policy stays the user; these helpers
 * provision the *resource* side — channel-object-type CPA fields in the
 * access_control group and per-channel values — plus API-driven policy authoring
 * so the tests never depend on the (deferred) all-channels editor UI.
 */

const PROPERTY_GROUP = 'access_control';
const CHANNEL_OBJECT_TYPE = 'channel';
const USER_OBJECT_TYPE = 'user';
const TEMPLATE_OBJECT_TYPE = 'template';

/**
 * Create a channel-object-type text CPA field in the access_control group. The
 * ABAC materialized view surfaces it as resource.attributes.<name>. Marked
 * admin-managed so SavePolicy's name normalization accepts a reference to it
 * (channel fields have no user-managed-attributes toggle). Returns the field id.
 */
export async function createChannelTextField(adminClient: Client4, name: string): Promise<string> {
    const field = await adminClient.createPropertyField(PROPERTY_GROUP, CHANNEL_OBJECT_TYPE, {
        name,
        type: 'text',
        target_type: 'system',
        target_id: '',
        attrs: {managed: 'admin'},
    } as Parameters<Client4['createPropertyField']>[2]);
    return field.id;
}

/**
 * Set a single channel's value for a channel CPA field. Call
 * refresh-before-read is not needed for the sync lane (the sync job reads a
 * freshly refreshed matview), but note the matview is refreshed on a timer, so
 * set values before triggering the sync job.
 */
export async function setChannelAttributeValue(
    adminClient: Client4,
    channelId: string,
    fieldId: string,
    value: string,
): Promise<void> {
    await adminClient.patchPropertyValues(PROPERTY_GROUP, CHANNEL_OBJECT_TYPE, channelId, [{field_id: fieldId, value}]);
}

type ParentPolicyOptions = {
    name: string;
    expression: string;
    appliesToAllChannels?: boolean;
    version?: string;
};

/**
 * Create a parent membership policy via the REST API. A parent is the reusable
 * rule-carrier: assign channels to it (assignChannelsToPolicy) or mark it
 * applies_to_all_channels. `applies_to_all_channels` is sent raw because the
 * webapp policy type does not yet carry it (the editor toggle is deferred).
 * Returns the created policy id.
 */
export async function createParentPolicyViaAPI(adminClient: Client4, opts: ParentPolicyOptions): Promise<string> {
    const body: Record<string, unknown> = {
        id: '',
        name: opts.name,
        type: 'parent',
        version: opts.version ?? 'v0.3',
        revision: 0,
        active: true,
        rules: [{expression: opts.expression, actions: ['membership']}],
    };
    if (opts.appliesToAllChannels) {
        body.applies_to_all_channels = true;
    }
    const policy = await (adminClient as any).doFetch(`${adminClient.getBaseRoute()}/access_control_policies`, {
        method: 'put',
        body: JSON.stringify(body),
    });
    return policy.id as string;
}

/**
 * Assign channels to a parent policy (creates the per-channel child policy that
 * imports the parent and flips enforcement on). Mirrors the System Console
 * "Add channels" flow.
 */
export async function assignChannelsToPolicy(
    adminClient: Client4,
    policyId: string,
    channelIds: string[],
): Promise<void> {
    // The /assign endpoint returns 200 with an empty body but a JSON content
    // type, which Client4.doFetch chokes on ("Unexpected end of JSON input").
    // Use a raw request and check status, matching the pattern the rest of the
    // ABAC e2e helpers use for these no-body endpoints.
    const res = await fetch(`${adminClient.getBaseRoute()}/access_control_policies/${policyId}/assign`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${adminClient.getToken()}`},
        body: JSON.stringify({channel_ids: channelIds}),
    });
    if (!res.ok) {
        throw new Error(`assign channels failed: ${res.status} ${await res.text()}`);
    }
}

/**
 * Trigger an access_control_sync job. Pass a policyId to target the channels
 * governed by that policy (for an all-channels parent this backfills and syncs
 * its materialized children); omit it for a global sweep. Returns the job id.
 */
export async function triggerSyncJob(adminClient: Client4, policyId?: string): Promise<string> {
    const job = await adminClient.createAccessControlSyncJob(policyId ? {policy_id: policyId} : {});
    return job.id;
}

export type MultiselectScale = {
    templateId: string;
    userFieldId: string;
    userFieldName: string;
    channelFieldId: string;
    channelFieldName: string;
    // Server-assigned option ids keyed by option name. Both the user and channel
    // fields inherit these exact ids from the template (that's what "shared option
    // scale" means), so hasAnyOf/hasAllOf compares the same id space on both sides.
    optionIds: Record<string, string>;
};

/**
 * Provision a shared-scale multiselect setup for a list-vs-list (hasAnyOf /
 * hasAllOf) rule: a template multiselect field plus a user field and a channel
 * field that both link to it via linked_field_id. All three live in the
 * access_control group — a user CPA field in the custom_profile_attributes group
 * cannot carry a linked_field_id (the server rejects it), and the scale-match
 * validation requires the receiver (user) and argument (channel) fields to share
 * a non-nil, equal linked_field_id. The linked user field still surfaces as
 * user.attributes.<name> to the engine. Returns the field ids/names and the
 * option ids (identical across all three fields).
 */
export async function createLinkedMultiselectScale(
    adminClient: Client4,
    baseName: string,
    optionNames: string[],
): Promise<MultiselectScale> {
    const template = await adminClient.createPropertyField(PROPERTY_GROUP, TEMPLATE_OBJECT_TYPE, {
        name: `${baseName}_tmpl`,
        type: 'multiselect',
        target_type: 'system',
        target_id: '',
        attrs: {options: optionNames.map((name) => ({id: '', name, color: '#0000ff'}))},
    } as Parameters<Client4['createPropertyField']>[2]);

    const userFieldName = `${baseName}_user`;
    const userField = await adminClient.createPropertyField(PROPERTY_GROUP, USER_OBJECT_TYPE, {
        name: userFieldName,
        type: 'multiselect',
        target_type: 'system',
        target_id: '',
        linked_field_id: template.id,
    } as Parameters<Client4['createPropertyField']>[2]);

    const channelFieldName = `${baseName}_chan`;
    const channelField = await adminClient.createPropertyField(PROPERTY_GROUP, CHANNEL_OBJECT_TYPE, {
        name: channelFieldName,
        type: 'multiselect',
        target_type: 'system',
        target_id: '',
        linked_field_id: template.id,
    } as Parameters<Client4['createPropertyField']>[2]);

    const optionIds: Record<string, string> = {};
    for (const opt of (template.attrs?.options ?? []) as Array<{id: string; name: string}>) {
        optionIds[opt.name] = opt.id;
    }

    return {
        templateId: template.id,
        userFieldId: userField.id,
        userFieldName,
        channelFieldId: channelField.id,
        channelFieldName,
        optionIds,
    };
}

/**
 * Set a user's multiselect value (list of option ids) for an access_control-group
 * user field. Multiselect values are stored as option ids, not names.
 */
export async function setUserMultiselectValue(
    adminClient: Client4,
    userId: string,
    fieldId: string,
    optionIds: string[],
): Promise<void> {
    await adminClient.patchPropertyValues(PROPERTY_GROUP, USER_OBJECT_TYPE, userId, [
        {field_id: fieldId, value: optionIds},
    ]);
}

/**
 * Set a channel's multiselect value (list of option ids) for a channel field.
 */
export async function setChannelMultiselectValue(
    adminClient: Client4,
    channelId: string,
    fieldId: string,
    optionIds: string[],
): Promise<void> {
    await adminClient.patchPropertyValues(PROPERTY_GROUP, CHANNEL_OBJECT_TYPE, channelId, [
        {field_id: fieldId, value: optionIds},
    ]);
}

/**
 * Open an existing membership policy in the System Console editor by id. The
 * parent-policy editor page carries the all-channels toggle and the Test-access-rule
 * button, so UI specs provision the policy over the API and drive only the
 * feature under test here.
 */
export async function openPolicyEditor(page: Page, policyId: string): Promise<void> {
    await page.goto(`/admin_console/system_attributes/membership_policies/edit_policy/${policyId}`);
    await page.waitForLoadState('networkidle');
}
