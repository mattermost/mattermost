// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, verifyUserInChannel} from '@mattermost/playwright-lib';

import type {CustomProfileAttribute} from '../../../channels/custom_profile_attributes/helpers';
import {setupCustomProfileAttributeFields} from '../../../channels/custom_profile_attributes/helpers';
import {
    createPrivateChannelForABAC,
    createUserForABAC,
    enableUserManagedAttributes,
    waitForPolicySyncJob,
} from '../support';

import {
    assignChannelsToPolicy,
    createChannelTextField,
    createParentPolicyViaAPI,
    setChannelAttributeValue,
    triggerSyncJob,
} from './helpers';

/**
 * resource.attributes.* membership sync + enforcement (lane agreement).
 *
 * A policy that mixes the requesting user's attribute with the accessed
 * channel's attribute (user.attributes.<a> == resource.attributes.<a>) must:
 *  - remove only the members whose value differs from the channel's (SQL sync lane),
 *  - let an admin add a matching user but block a non-matching one (runtime PDP lane),
 *  - remove everyone when the channel doesn't set the referenced attribute (deny-on-miss).
 *
 * Authoring/sync are driven through the REST API so the tests don't depend on
 * the table-editor's RHS constraints.
 */
test.describe('ABAC resource.attributes - membership sync', {tag: ['@abac', '@abac_resource_attributes']}, () => {
    test('mixed user/resource scalar policy syncs and enforces joins', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminClient, team} = await pw.initSetup();
        await enableUserManagedAttributes(adminClient);
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        } as Parameters<typeof adminClient.patchConfig>[0]);

        // Same field name on both object types → user.attributes.<attr> compared
        // to resource.attributes.<attr>.
        const attr = `region${pw.random.id()}`;
        const userAttribute: CustomProfileAttribute[] = [{name: attr, type: 'text', value: ''}];
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, userAttribute);
        const channelFieldId = await createChannelTextField(adminClient, attr);

        const matchingUserNotInChannel = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: attr, type: 'text', value: 'us'},
        ]);
        const matchingUserInChannel = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: attr, type: 'text', value: 'us'},
        ]);
        const nonMatchingUserInChannel = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: attr, type: 'text', value: 'eu'},
        ]);
        for (const u of [matchingUserNotInChannel, matchingUserInChannel, nonMatchingUserInChannel]) {
            await adminClient.addToTeam(team.id, u.id);
        }

        const channel = await createPrivateChannelForABAC(adminClient, team.id);
        await setChannelAttributeValue(adminClient, channel.id, channelFieldId, 'us');
        await adminClient.addToChannel(matchingUserInChannel.id, channel.id);
        await adminClient.addToChannel(nonMatchingUserInChannel.id, channel.id);

        const policyId = await createParentPolicyViaAPI(adminClient, {
            name: `Resource Region ${pw.random.id()}`,
            expression: `user.attributes.${attr} == resource.attributes.${attr}`,
        });
        await assignChannelsToPolicy(adminClient, policyId, [channel.id]);

        await triggerSyncJob(adminClient, policyId);
        await waitForPolicySyncJob(adminClient, policyId);

        // SQL sync lane on a private channel with an active policy:
        //  - the non-matching (eu) member is removed,
        //  - the matching (us) member stays,
        //  - the matching (us) user who was only in the team is auto-added —
        //    an active private-channel policy pulls in matching team members.
        expect(await verifyUserInChannel(adminClient, matchingUserInChannel.id, channel.id)).toBe(true);
        expect(await verifyUserInChannel(adminClient, nonMatchingUserInChannel.id, channel.id)).toBe(false);
        expect(await verifyUserInChannel(adminClient, matchingUserNotInChannel.id, channel.id)).toBe(true);

        // Runtime lane agrees with the sync result: re-adding the matching user
        // succeeds, while adding the non-matching user is blocked.
        await adminClient.addToChannel(matchingUserNotInChannel.id, channel.id);
        expect(await verifyUserInChannel(adminClient, matchingUserNotInChannel.id, channel.id)).toBe(true);

        try {
            await adminClient.addToChannel(nonMatchingUserInChannel.id, channel.id);
        } catch {
            // expected: the runtime PDP denies the non-matching user
        }
        expect(await verifyUserInChannel(adminClient, nonMatchingUserInChannel.id, channel.id)).toBe(false);
    });

    test('deny-on-miss removes all members when the channel attribute is absent', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminClient, team} = await pw.initSetup();
        await enableUserManagedAttributes(adminClient);
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        } as Parameters<typeof adminClient.patchConfig>[0]);

        const attr = `region${pw.random.id()}`;
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, [
            {name: attr, type: 'text', value: ''},
        ]);

        // Channel field exists so the reference resolves at save time, but the
        // channel below never sets a value → the referenced field is missing for
        // that channel → deny-on-miss.
        await createChannelTextField(adminClient, attr);

        const member = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: attr, type: 'text', value: 'us'},
        ]);
        await adminClient.addToTeam(team.id, member.id);

        const channel = await createPrivateChannelForABAC(adminClient, team.id);
        await adminClient.addToChannel(member.id, channel.id);
        expect(await verifyUserInChannel(adminClient, member.id, channel.id)).toBe(true);

        const policyId = await createParentPolicyViaAPI(adminClient, {
            name: `Resource DenyOnMiss ${pw.random.id()}`,
            expression: `user.attributes.${attr} == resource.attributes.${attr}`,
        });
        await assignChannelsToPolicy(adminClient, policyId, [channel.id]);

        await triggerSyncJob(adminClient, policyId);
        await waitForPolicySyncJob(adminClient, policyId);

        // The channel is missing the referenced attribute, so the whole policy
        // denies and every governed member is removed — fail-secure.
        expect(await verifyUserInChannel(adminClient, member.id, channel.id)).toBe(false);
    });
});
