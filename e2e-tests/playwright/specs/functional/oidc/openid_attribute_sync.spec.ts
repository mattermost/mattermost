// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {expect, test, type PlaywrightExtended} from '@mattermost/playwright-lib';

// Claims the realm's mattermost-openid client releases from user attributes (see the protocol
// mappers in keycloak-realm-export.json): a nested claim, an array claim, and a claim that only the
// ID token carries.
const DEPARTMENT_CLAIM = 'org.department';
const CLEARANCES_CLAIM = 'clearances';
const EMPLOYEE_ID_CLAIM = 'employee_id';

async function signInWithOpenId(pw: PlaywrightExtended, username: string, password: string) {
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.openIdLoginButton.click();
    await pw.keycloakLoginPage.loginIfFormShown(username, password);
    await pw.loginPage.expectNotOnLoginPage();
}

/** The user's synced values keyed by field name, with multiselect option IDs resolved to names. */
async function attributeValues(adminClient: Client4, userId: string, fields: UserPropertyField[]) {
    const values = await adminClient.getUserCustomProfileAttributesValues(userId);
    const fresh = await adminClient.getCustomProfileAttributeFields();
    const named: Record<string, unknown> = {};
    for (const field of fields) {
        const value = values[field.id];
        const options = fresh.find((f) => f.id === field.id)?.attrs.options ?? [];
        named[field.name] = Array.isArray(value)
            ? value.map((id) => options.find((option) => option.id === id)?.name ?? id)
            : value;
    }
    return named;
}

async function runMembershipSync(adminClient: Client4, policyId: string) {
    const job = await adminClient.createAccessControlSyncJob({policy_id: policyId});
    await expect.poll(async () => (await adminClient.getJob(job.id)).status, {timeout: 60_000}).toBe('success');
}

async function assignChannelsToPolicy(adminClient: Client4, policyId: string, channelIds: string[]) {
    // The endpoint answers 200 with an empty body but a JSON content type, which Client4 fails to parse.
    const response = await fetch(`${adminClient.getBaseRoute()}/access_control_policies/${policyId}/assign`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${adminClient.getToken()}`},
        body: JSON.stringify({channel_ids: channelIds}),
    });
    expect(response.ok, `assign channels: ${response.status}`).toBe(true);
}

async function isChannelMember(adminClient: Client4, channelId: string, userId: string) {
    const members = await adminClient.getChannelMembers(channelId);
    return members.some((member) => member.user_id === userId);
}

/**
 * @objective Verify user attributes linked to OpenID Connect claims sync at every sign-in: a nested
 * claim, an array claim and a claim only the verified ID token carries fill their attributes, a
 * membership policy on a synced attribute admits the user, and a claim the provider stops sending
 * clears the attribute and, through the policy, the membership at the next sign-in.
 *
 * @precondition
 * A Keycloak realm whose mattermost-openid client maps the department, clearances and employeeId user
 * attributes to the org.department, clearances and (ID token only) employee_id claims, and the
 * server configured from Keycloak's discovery document so it can verify ID tokens.
 */
test('syncs user attributes from OpenID Connect claims at every sign-in', {tag: '@openid'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureKeycloakOpenId({discovery: true});
    await pw.ensureSiteUrl();

    const {adminClient} = await pw.getAdminClient();
    await adminClient.patchConfig({AccessControlSettings: {EnableAttributeBasedAccessControl: true}});

    const id = pw.random.id();
    const fields: UserPropertyField[] = [];
    let policyId = '';
    let channelId = '';
    let keycloakUserId = '';

    try {
        // # Link three user attributes to OpenID Connect claims
        for (const [name, type, claim] of [
            [`department_${id}`, 'text', DEPARTMENT_CLAIM],
            [`clearances_${id}`, 'multiselect', CLEARANCES_CLAIM],
            [`employee_id_${id}`, 'text', EMPLOYEE_ID_CLAIM],
        ] as const) {
            fields.push(
                await adminClient.createCustomProfileAttributeField({
                    name,
                    type,
                    attrs: {sort_order: 0, visibility: 'always', value_type: '', openid: claim},
                }),
            );
        }
        const [department, clearances, employeeId] = fields;

        const keycloakUser = {
            ...pw.generateKeycloakUser('oidcattrs'),
            attributes: {department: ['Engineering'], clearances: ['secret', 'topsecret'], employeeId: ['E-1001']},
        };
        keycloakUserId = await pw.createKeycloakUser(keycloakUser);

        // # Sign in for the first time, which creates the account
        await signInWithOpenId(pw, keycloakUser.username, keycloakUser.password);
        const user = await adminClient.getUserByUsername(keycloakUser.username);
        expect(user.auth_service).toBe('openid');

        // * Verify every linked claim was synced, including the ID-token-only one
        expect(await attributeValues(adminClient, user.id, fields)).toEqual({
            [department.name]: 'Engineering',
            [clearances.name]: ['secret', 'topsecret'],
            [employeeId.name]: 'E-1001',
        });

        // # Put a private channel under a membership policy on the synced department
        const team = await pw.createNewTeam(adminClient);
        await adminClient.addToTeam(team.id, user.id);
        const channel = await adminClient.createChannel(
            pw.random.channel({
                teamId: team.id,
                name: `engineering-${id}`,
                displayName: `Engineering ${id}`,
                type: 'P',
            }),
        );
        channelId = channel.id;
        const policy = await adminClient.updateOrCreateAccessControlPolicy({
            id: '',
            name: `Engineering from OpenID Connect ${id}`,
            type: 'parent',
            version: 'v0.3',
            revision: 0,
            rules: [
                {
                    actions: ['membership'],
                    expression: `user.attributes.${department.name} == "Engineering"`,
                    metadata: {auto_add: 'always'},
                },
            ],
        });
        policyId = policy.id;
        await assignChannelsToPolicy(adminClient, policyId, [channelId]);
        await runMembershipSync(adminClient, policyId);

        // * Verify the policy admitted the user through the synced attribute
        expect(await isChannelMember(adminClient, channelId, user.id)).toBe(true);

        // # Remove the department and a clearance at the provider, then sign in again
        await pw.setKeycloakUserAttributes(keycloakUserId, {clearances: ['secret'], employeeId: ['E-1001']});
        await pw.keycloakLoginPage.logout();
        await signInWithOpenId(pw, keycloakUser.username, keycloakUser.password);

        // * Verify the claims the provider stopped sending are gone from Mattermost
        expect(await attributeValues(adminClient, user.id, fields)).toEqual({
            [department.name]: '',
            [clearances.name]: ['secret'],
            [employeeId.name]: 'E-1001',
        });

        // * Verify the policy no longer admits the user
        await runMembershipSync(adminClient, policyId);
        expect(await isChannelMember(adminClient, channelId, user.id)).toBe(false);
    } finally {
        if (policyId) {
            await adminClient.unassignChannelsFromAccessControlPolicy(policyId, [channelId]).catch(() => {});
            await adminClient.deleteAccessControlPolicy(policyId).catch(() => {});
        }
        for (const field of fields) {
            await adminClient.deleteCustomProfileAttributeField(field.id).catch(() => {});
        }
        if (keycloakUserId) {
            await pw.deleteKeycloakUser(keycloakUserId).catch(() => {});
        }
    }
});
