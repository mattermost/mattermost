// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@playwright/test';
import type {Page} from '@playwright/test';
import type {Client4} from '@mattermost/client';

/**
 * Helpers for exercising resource.attributes.* (channel custom profile
 * attributes) end to end. The subject of a policy stays the user; these helpers
 * provision the *resource* side — channel-object-type CPA fields in the
 * access_control group and per-channel values — plus API-driven policy authoring
 * so a spec can exercise the resource side without also driving the policy
 * editor UI.
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
 * Set a single channel's value for a channel CPA field. A refresh-before-read
 * is not needed for the sync lane (the sync job reads a freshly refreshed
 * matview), but note the matview is refreshed on a timer, so set values before
 * triggering the sync job.
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
    version?: string;
};

/**
 * Create a parent membership policy via the REST API. A parent is the reusable
 * rule-carrier: assign channels to it (assignChannelsToPolicy) to put those
 * channels under its rules. Returns the created policy id.
 */
export async function createParentPolicyViaAPI(adminClient: Client4, opts: ParentPolicyOptions): Promise<string> {
    const body = {
        id: '',
        name: opts.name,
        type: 'parent',
        version: opts.version ?? 'v0.3',
        revision: 0,
        active: true,
        rules: [{expression: opts.expression, actions: ['membership']}],
    };
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
 * governed by that policy; omit it for a global sweep. Returns the job id.
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
 * Skip when the server does not have the graph property field type enabled.
 *
 * The type is gated on a feature flag that is off by default, and a feature flag
 * cannot be set through the config API — it is read-only there — so a spec cannot
 * turn it on for itself the way it can with a config setting. Without it the first
 * field POST below is refused, so the alternative to skipping is a suite that goes
 * red on every server that has not opted in. Set MM_FEATUREFLAGS_PROPERTYFIELDGRAPH
 * on the server to run these.
 */
export async function skipIfNoGraphFields(adminClient: Client4): Promise<void> {
    const config: any = await adminClient.getConfig();
    const enabled = config?.FeatureFlags?.PropertyFieldGraph;
    test.skip(
        enabled !== true && enabled !== 'true',
        'Skipping test - PropertyFieldGraph feature flag is not enabled on the server',
    );
}

export type GraphOptionSpec = {
    name: string;
    // Parents are named, not identified: the hierarchy is authored in the same
    // request that creates the options, so a parent may appear later in the list
    // than the option naming it.
    parents?: string[];
};

export type GraphHierarchy = {
    templateId: string;
    userFieldId: string;
    userFieldName: string;
    channelFieldId: string;
    channelFieldName: string;
    // Server-assigned option ids keyed by option name. The linked fields serve
    // the template's options under the template's identifiers — a linked graph
    // field owns no options of its own — so one id space covers both sides of a
    // hierarchy predicate, and a value written for either side names ids from
    // this map.
    optionIds: Record<string, string>;
};

/**
 * Provision a graph hierarchy for a hierarchy-predicate rule: a template graph field
 * owning the whole option hierarchy, plus a user field and a channel field that
 * link to it. Same three-field shape as createLinkedMultiselectScale and for the
 * same reason — all three in the access_control group, the user field surfacing as
 * user.attributes.<name> — with one difference that matters when reading the
 * fixture: neither linked field states a type. A field created with a
 * linked_field_id takes its type from its source, so the graph type arrives by
 * copy, which is also the only way the two ends are guaranteed to agree.
 *
 * Both fields linking to one template is sufficient but not required for a
 * predicate to compare them: what the server asks of a graph pair is that they
 * resolve to the same option owner, which a channel field linked straight to the
 * user field also satisfies. This shape is the one the driving use case has.
 *
 * Returns the field ids/names and every option's server-assigned id.
 */
export async function createLinkedGraphHierarchy(
    adminClient: Client4,
    baseName: string,
    options: GraphOptionSpec[],
): Promise<GraphHierarchy> {
    const template = await adminClient.createPropertyField(PROPERTY_GROUP, TEMPLATE_OBJECT_TYPE, {
        name: `${baseName}_tmpl`,
        type: 'graph',
        target_type: 'system',
        target_id: '',
        attrs: {options},
    } as Parameters<Client4['createPropertyField']>[2]);

    // Both linked fields are admin-managed. An attribute is usable in a policy —
    // and offered rather than greyed out in the editor's attribute picker — when it
    // is admin-managed, or when the EnableUserManagedAttributes config setting is
    // on; marking the fields keeps the fixture working whichever way that setting
    // has been left, since it is global and other specs flip it.
    const userFieldName = `${baseName}_user`;
    const userField = await adminClient.createPropertyField(PROPERTY_GROUP, USER_OBJECT_TYPE, {
        name: userFieldName,
        target_type: 'system',
        target_id: '',
        linked_field_id: template.id,
        attrs: {managed: 'admin'},
    } as Parameters<Client4['createPropertyField']>[2]);

    const channelFieldName = `${baseName}_chan`;
    const channelField = await adminClient.createPropertyField(PROPERTY_GROUP, CHANNEL_OBJECT_TYPE, {
        name: channelFieldName,
        target_type: 'system',
        target_id: '',
        linked_field_id: template.id,
        attrs: {managed: 'admin'},
    } as Parameters<Client4['createPropertyField']>[2]);

    const optionIds: Record<string, string> = {};
    for (const opt of (template.attrs?.options ?? []) as Array<{id: string; name: string}>) {
        optionIds[opt.name] = opt.id;
    }
    for (const spec of options) {
        if (!optionIds[spec.name]) {
            throw new Error(`graph template ${template.id} did not return an id for option "${spec.name}"`);
        }
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
 * Unassign a parent policy's channels and delete it.
 *
 * Worth doing rather than leaving behind: the policy list the System Console
 * shows is paginated, so policies accumulated on a shared server push newer ones
 * off the first page, and a spec that finds its policy by scanning that list then
 * fails in a way that reads as a failed save. Unassigning first so the per-channel
 * child policy goes too — a parent that still has children is refused, and a
 * channel left importing a deleted parent enforces a rule nobody can read.
 *
 * Delete a policy BEFORE the fields its rules reference, not after. While
 * attribute-value masking is on, deleting a policy first asks which of its values
 * the caller may see, and that check fails outright when a referenced field is
 * gone — leaving a policy that cannot be deleted through the API at all.
 *
 * Best-effort — a failure here should not mask the assertion that already ran.
 */
export async function deleteParentPolicy(
    adminClient: Client4,
    policyId: string,
    channelIds: string[] = [],
): Promise<void> {
    if (channelIds.length > 0) {
        await adminClient.unassignChannelsFromAccessControlPolicy(policyId, channelIds).catch(() => {});
    }
    await adminClient.deleteAccessControlPolicy(policyId).catch(() => {});
}

/**
 * Delete one field of the access_control group by object type.
 *
 * Best-effort — a failure here should not mask the assertion that already ran.
 */
export async function deletePropertyFieldQuietly(
    adminClient: Client4,
    objectType: string,
    fieldId: string,
): Promise<void> {
    await adminClient.deletePropertyField(PROPERTY_GROUP, objectType, fieldId).catch(() => {});
}

/**
 * Delete the three fields of a linked template/user/channel fixture, whether it
 * came from createLinkedGraphHierarchy or createLinkedMultiselectScale.
 *
 * Fixtures are worth deleting rather than leaving behind: the access_control group
 * allows at most 20 user-object fields, and once that is reached every later spec
 * that creates a user attribute fails in its setup. The policy editor also reads
 * only the first page of fields, so leaked fields can hide a real one from the
 * attribute picker well before the cap.
 *
 * Dependents first as a precaution, since deleting the owning template cascades to
 * the options and edges the linked fields were serving.
 *
 * Best-effort — a failure here should not mask the assertion that already ran.
 */
export async function deleteLinkedFieldTrio(
    adminClient: Client4,
    fixture: {templateId: string; userFieldId: string; channelFieldId: string},
): Promise<void> {
    for (const [objectType, fieldId] of [
        [USER_OBJECT_TYPE, fixture.userFieldId],
        [CHANNEL_OBJECT_TYPE, fixture.channelFieldId],
        [TEMPLATE_OBJECT_TYPE, fixture.templateId],
    ] as const) {
        await deletePropertyFieldQuietly(adminClient, objectType, fieldId);
    }
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
 * parent-policy editor page carries the rule table and the Test-access-rule
 * button, so UI specs provision the policy over the API and drive only the
 * feature under test here.
 */
export async function openPolicyEditor(page: Page, policyId: string): Promise<void> {
    await page.goto(`/admin_console/system_attributes/membership_policies/edit_policy/${policyId}`);
    await page.waitForLoadState('networkidle');
}
