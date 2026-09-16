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
    createLinkedGraphHierarchy,
    createParentPolicyViaAPI,
    deleteLinkedFieldTrio,
    deleteParentPolicy,
    // A graph value is the same wire shape as a multiselect one — a list of the
    // option ids the object holds — so the multiselect setters serve both, and the
    // aliases keep the call sites honest about which type is under test.
    setChannelMultiselectValue as setChannelOptionValue,
    setUserMultiselectValue as setUserOptionValue,
    skipIfNoGraphFields,
    triggerSyncJob,
    type GraphHierarchy,
} from './helpers';

/**
 * The driving use case for graph property fields, end to end: a hierarchy of
 * programs, users tagged with the programs they hold, a channel tagged with the
 * program it discusses, and the rule "a user may access this channel only if, for
 * every program on the channel, the user holds that program or an ancestor of it"
 * — which is coversAll.
 *
 * The hierarchy both tests build:
 *
 *     Air Program
 *       └── Fighter Jet Program
 *             ├── F-18 Program
 *             └── F-35 Program
 *
 * Against a channel holding {F-18 Program}, a user covers it by holding F-18
 * itself or anything above it, and fails by holding only F-35 — a sibling, which
 * is neither at nor above F-18. That sibling is the whole point of the fixture: an
 * uncovered user who nonetheless holds an option from the same hierarchy is what
 * separates a working coversAll from a plain set intersection.
 *
 * Both lanes are asserted, because agreeing is the feature's central invariant:
 *  - SQL sync lane: an uncovered member is removed, a covering member stays, and a
 *    covering team-only user is auto-added to the assigned private channel.
 *  - Runtime PDP lane: adding a covering user succeeds; adding an uncovered one is
 *    blocked.
 *
 * Authoring and sync run over the REST API, following membership_sync.spec.ts:
 * what is under test here is the two evaluation lanes, not the policy editor.
 * The editor half of the same feature is graph_operators.spec.ts.
 */
test.describe('ABAC resource.attributes - graph hierarchy sync', {tag: ['@abac', '@abac_resource_attributes']}, () => {
    const airProgram = 'Air Program';
    const fighterJetProgram = 'Fighter Jet Program';
    const f18Program = 'F-18 Program';
    const f35Program = 'F-35 Program';

    const programsHierarchy = [
        {name: airProgram},
        {name: fighterJetProgram, parents: [airProgram]},
        {name: f18Program, parents: [fighterJetProgram]},
        {name: f35Program, parents: [fighterJetProgram]},
    ];

    test('coversAll syncs and enforces hierarchy coverage', async ({pw}) => {
        test.setTimeout(180000);
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ResourceAttributesInPolicies', true);

        const {adminClient, team} = await pw.initSetup();
        await skipIfNoGraphFields(adminClient);
        await enableUserManagedAttributes(adminClient);
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        } as Parameters<typeof adminClient.patchConfig>[0]);

        let hierarchy: GraphHierarchy | undefined;
        let createdPolicyId: string | undefined;
        let governedChannelId: string | undefined;
        try {
            hierarchy = await createLinkedGraphHierarchy(adminClient, `programs${pw.random.id()}`, programsHierarchy);
            const optionIds = hierarchy.optionIds;

            // The channel discusses F-18. Each user below holds one program, or
            // none, and coverage follows only from where that program sits.
            const ancestorInChannel = await createUserForABAC(adminClient, {}, []); // {Air} — two levels above
            const exactTeamOnly = await createUserForABAC(adminClient, {}, []); // {F-18} — the option itself
            const siblingInChannel = await createUserForABAC(adminClient, {}, []); // {F-35} — same parent, no coverage
            const untaggedInChannel = await createUserForABAC(adminClient, {}, []); // no value at all
            await setUserOptionValue(adminClient, ancestorInChannel.id, hierarchy.userFieldId, [optionIds[airProgram]]);
            await setUserOptionValue(adminClient, exactTeamOnly.id, hierarchy.userFieldId, [optionIds[f18Program]]);
            await setUserOptionValue(adminClient, siblingInChannel.id, hierarchy.userFieldId, [optionIds[f35Program]]);
            for (const u of [ancestorInChannel, exactTeamOnly, siblingInChannel, untaggedInChannel]) {
                await adminClient.addToTeam(team.id, u.id);
            }

            const channel = await createPrivateChannelForABAC(adminClient, team.id);
            await setChannelOptionValue(adminClient, channel.id, hierarchy.channelFieldId, [optionIds[f18Program]]);
            await adminClient.addToChannel(ancestorInChannel.id, channel.id);
            await adminClient.addToChannel(siblingInChannel.id, channel.id);
            await adminClient.addToChannel(untaggedInChannel.id, channel.id);

            const policyId = await createParentPolicyViaAPI(adminClient, {
                name: `CoversAll ${pw.random.id()}`,
                expression: `user.attributes.${hierarchy.userFieldName}.coversAll(resource.attributes.${hierarchy.channelFieldName})`,
            });
            createdPolicyId = policyId;
            governedChannelId = channel.id;
            await assignChannelsToPolicy(adminClient, policyId, [channel.id]);

            // Both lanes read attribute values from materialized views, and the
            // sync job refreshes them itself before it reads anything, so a value
            // written moments ago needs no settling time here.
            await triggerSyncJob(adminClient, policyId);
            await waitForPolicySyncJob(adminClient, policyId);

            // SQL sync lane. The ancestor holder covers F-18 and stays; the
            // sibling holder does not and is removed; the covering team-only user
            // is auto-added, since an active private-channel policy pulls in
            // matching team members.
            expect(await verifyUserInChannel(adminClient, ancestorInChannel.id, channel.id)).toBe(true);
            expect(await verifyUserInChannel(adminClient, siblingInChannel.id, channel.id)).toBe(false);
            expect(await verifyUserInChannel(adminClient, exactTeamOnly.id, channel.id)).toBe(true);

            // Holding nothing covers nothing. Removed either way — whether the
            // engine reads it as an empty set of held options or as the referenced
            // attribute being missing for that user, both fail closed.
            expect(await verifyUserInChannel(adminClient, untaggedInChannel.id, channel.id)).toBe(false);

            // Runtime PDP lane agrees with the sync verdict on the same fixtures. Remove
            // the covering user first: adding someone who is already a member returns the
            // existing membership without consulting the policy, so the add has to be a
            // real join for the grant to be under test at all.
            await adminClient.removeFromChannel(exactTeamOnly.id, channel.id);
            await adminClient.addToChannel(exactTeamOnly.id, channel.id);
            expect(await verifyUserInChannel(adminClient, exactTeamOnly.id, channel.id)).toBe(true);

            try {
                await adminClient.addToChannel(siblingInChannel.id, channel.id);
            } catch {
                // expected: the runtime PDP denies the user holding only a sibling
            }
            expect(await verifyUserInChannel(adminClient, siblingInChannel.id, channel.id)).toBe(false);
        } finally {
            if (createdPolicyId) {
                await deleteParentPolicy(adminClient, createdPolicyId, governedChannelId ? [governedChannelId] : []);
            }
            if (hierarchy) {
                await deleteLinkedFieldTrio(adminClient, hierarchy);
            }
        }
    });

    test('a member is removed once their value stops covering the channel', async ({pw}) => {
        test.setTimeout(180000);
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ResourceAttributesInPolicies', true);

        const {adminClient, team} = await pw.initSetup();
        await skipIfNoGraphFields(adminClient);
        await enableUserManagedAttributes(adminClient);
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        } as Parameters<typeof adminClient.patchConfig>[0]);

        let hierarchy: GraphHierarchy | undefined;
        let createdPolicyId: string | undefined;
        let governedChannelId: string | undefined;
        try {
            hierarchy = await createLinkedGraphHierarchy(adminClient, `programs${pw.random.id()}`, programsHierarchy);
            const optionIds = hierarchy.optionIds;

            // Starts one level above the channel's program, so the member covers it.
            const member = await createUserForABAC(adminClient, {}, []);
            await setUserOptionValue(adminClient, member.id, hierarchy.userFieldId, [optionIds[fighterJetProgram]]);
            await adminClient.addToTeam(team.id, member.id);

            const channel = await createPrivateChannelForABAC(adminClient, team.id);
            await setChannelOptionValue(adminClient, channel.id, hierarchy.channelFieldId, [optionIds[f18Program]]);
            await adminClient.addToChannel(member.id, channel.id);

            const policyId = await createParentPolicyViaAPI(adminClient, {
                name: `CoversAll Regression ${pw.random.id()}`,
                expression: `user.attributes.${hierarchy.userFieldName}.coversAll(resource.attributes.${hierarchy.channelFieldName})`,
            });
            createdPolicyId = policyId;
            governedChannelId = channel.id;
            await assignChannelsToPolicy(adminClient, policyId, [channel.id]);

            // A sync while the member still covers keeps them: the removal below
            // then has to be the value change, not the policy merely existing.
            await triggerSyncJob(adminClient, policyId);
            await waitForPolicySyncJob(adminClient, policyId);
            expect(await verifyUserInChannel(adminClient, member.id, channel.id)).toBe(true);

            // Move them sideways in the hierarchy — still tagged, still in the same
            // hierarchy, no longer at or above what the channel holds.
            await setUserOptionValue(adminClient, member.id, hierarchy.userFieldId, [optionIds[f35Program]]);

            await triggerSyncJob(adminClient, policyId);
            await waitForPolicySyncJob(adminClient, policyId);
            expect(await verifyUserInChannel(adminClient, member.id, channel.id)).toBe(false);
        } finally {
            if (createdPolicyId) {
                await deleteParentPolicy(adminClient, createdPolicyId, governedChannelId ? [governedChannelId] : []);
            }
            if (hierarchy) {
                await deleteLinkedFieldTrio(adminClient, hierarchy);
            }
        }
    });
});
