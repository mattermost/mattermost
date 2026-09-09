// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, verifyUserInChannel} from '@mattermost/playwright-lib';

import {
    createPrivateChannelForABAC,
    createUserForABAC,
    enableUserManagedAttributes,
    waitForPolicySyncJob,
} from '../support';

import {
    assignChannelsToPolicy,
    createLinkedMultiselectScale,
    createParentPolicyViaAPI,
    expectAddToChannelDenied,
    setChannelMultiselectValue,
    setUserMultiselectValue,
    triggerSyncJob,
} from './helpers';

/**
 * List-vs-list (multiselect) resource targets end to end: a rule comparing a
 * multiselect user attribute against a multiselect channel attribute with
 * hasAnyOf / hasAllOf, authored here over the real HTTP boundary. Both fields
 * link to a shared template (equal linked_field_id) so they share one option-id
 * scale — the only shape the save-time validation accepts.
 *
 * Each test asserts the two evaluation lanes agree on the same fixtures:
 *  - SQL sync lane: a non-matching member is removed, a matching member stays,
 *    and a matching team-only user is auto-added to the assigned private channel.
 *  - Runtime PDP lane: re-adding a matching user succeeds; adding a non-matching
 *    user is blocked.
 *
 * hasAnyOf = the lists intersect. hasAllOf = the channel's list is a subset of
 * the user's (the user holds every value the channel requires).
 */
test.describe('ABAC resource.attributes - multiselect targets', {tag: ['@abac', '@abac_resource_attributes']}, () => {
    test('has any of syncs and enforces on list intersection', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ResourceAttributesInPolicies', true);

        const {adminClient, team} = await pw.initSetup();
        await enableUserManagedAttributes(adminClient);
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        } as Parameters<typeof adminClient.patchConfig>[0]);

        const scale = await createLinkedMultiselectScale(adminClient, `region${pw.random.id()}`, [
            'alpha',
            'beta',
            'gamma',
        ]);
        const {alpha, beta, gamma} = scale.optionIds;

        // Channel requires [alpha, beta]. has-any-of matches a user sharing >=1.
        const matchInChannel = await createUserForABAC(adminClient, {}, []); // [beta] -> shares beta
        const matchTeamOnly = await createUserForABAC(adminClient, {}, []); // [alpha] -> shares alpha
        const nonMatch = await createUserForABAC(adminClient, {}, []); // [gamma] -> disjoint
        await setUserMultiselectValue(adminClient, matchInChannel.id, scale.userFieldId, [beta]);
        await setUserMultiselectValue(adminClient, matchTeamOnly.id, scale.userFieldId, [alpha]);
        await setUserMultiselectValue(adminClient, nonMatch.id, scale.userFieldId, [gamma]);
        for (const u of [matchInChannel, matchTeamOnly, nonMatch]) {
            await adminClient.addToTeam(team.id, u.id);
        }

        const channel = await createPrivateChannelForABAC(adminClient, team.id);
        await setChannelMultiselectValue(adminClient, channel.id, scale.channelFieldId, [alpha, beta]);
        await adminClient.addToChannel(matchInChannel.id, channel.id);
        await adminClient.addToChannel(nonMatch.id, channel.id);

        const policyId = await createParentPolicyViaAPI(adminClient, {
            name: `HasAnyOf ${pw.random.id()}`,
            expression: `user.attributes.${scale.userFieldName}.hasAnyOf(resource.attributes.${scale.channelFieldName})`,
        });
        await assignChannelsToPolicy(adminClient, policyId, [channel.id]);

        await triggerSyncJob(adminClient, policyId);
        await waitForPolicySyncJob(adminClient, policyId);

        // SQL sync lane: the disjoint member is removed, the intersecting member
        // stays, and the intersecting team-only user is auto-added — an active
        // private-channel policy pulls in matching team members.
        expect(await verifyUserInChannel(adminClient, matchInChannel.id, channel.id)).toBe(true);
        expect(await verifyUserInChannel(adminClient, nonMatch.id, channel.id)).toBe(false);
        expect(await verifyUserInChannel(adminClient, matchTeamOnly.id, channel.id)).toBe(true);

        // Runtime PDP lane agrees with the sync verdict: re-adding the
        // intersecting user succeeds, while the disjoint one is blocked.
        await adminClient.addToChannel(matchTeamOnly.id, channel.id);
        expect(await verifyUserInChannel(adminClient, matchTeamOnly.id, channel.id)).toBe(true);
        await expectAddToChannelDenied(adminClient, nonMatch.id, channel.id);
        expect(await verifyUserInChannel(adminClient, nonMatch.id, channel.id)).toBe(false);
    });

    test('has all of syncs and enforces on channel-list subset', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ResourceAttributesInPolicies', true);

        const {adminClient, team} = await pw.initSetup();
        await enableUserManagedAttributes(adminClient);
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        } as Parameters<typeof adminClient.patchConfig>[0]);

        const scale = await createLinkedMultiselectScale(adminClient, `clr${pw.random.id()}`, [
            'alpha',
            'beta',
            'gamma',
        ]);
        const {alpha, beta, gamma} = scale.optionIds;

        // Channel requires [alpha, beta]. has-all-of matches only a user holding
        // BOTH — a user with just alpha does not (missing beta).
        const matchInChannel = await createUserForABAC(adminClient, {}, []); // [alpha, beta, gamma] superset
        const matchTeamOnly = await createUserForABAC(adminClient, {}, []); // [alpha, beta] exact
        const nonMatch = await createUserForABAC(adminClient, {}, []); // [alpha] missing beta
        await setUserMultiselectValue(adminClient, matchInChannel.id, scale.userFieldId, [alpha, beta, gamma]);
        await setUserMultiselectValue(adminClient, matchTeamOnly.id, scale.userFieldId, [alpha, beta]);
        await setUserMultiselectValue(adminClient, nonMatch.id, scale.userFieldId, [alpha]);
        for (const u of [matchInChannel, matchTeamOnly, nonMatch]) {
            await adminClient.addToTeam(team.id, u.id);
        }

        const channel = await createPrivateChannelForABAC(adminClient, team.id);
        await setChannelMultiselectValue(adminClient, channel.id, scale.channelFieldId, [alpha, beta]);
        await adminClient.addToChannel(matchInChannel.id, channel.id);
        await adminClient.addToChannel(nonMatch.id, channel.id);

        const policyId = await createParentPolicyViaAPI(adminClient, {
            name: `HasAllOf ${pw.random.id()}`,
            expression: `user.attributes.${scale.userFieldName}.hasAllOf(resource.attributes.${scale.channelFieldName})`,
        });
        await assignChannelsToPolicy(adminClient, policyId, [channel.id]);

        await triggerSyncJob(adminClient, policyId);
        await waitForPolicySyncJob(adminClient, policyId);

        // SQL sync lane: the superset member stays, the member missing a required
        // value is removed, and the exact-match team-only user is auto-added — an
        // active private-channel policy pulls in matching team members.
        expect(await verifyUserInChannel(adminClient, matchInChannel.id, channel.id)).toBe(true);
        expect(await verifyUserInChannel(adminClient, nonMatch.id, channel.id)).toBe(false);
        expect(await verifyUserInChannel(adminClient, matchTeamOnly.id, channel.id)).toBe(true);

        // Runtime PDP lane agrees: re-adding the exact-match user succeeds, the
        // subset-missing user is blocked.
        await adminClient.addToChannel(matchTeamOnly.id, channel.id);
        expect(await verifyUserInChannel(adminClient, matchTeamOnly.id, channel.id)).toBe(true);
        await expectAddToChannelDenied(adminClient, nonMatch.id, channel.id);
        expect(await verifyUserInChannel(adminClient, nonMatch.id, channel.id)).toBe(false);
    });
});
