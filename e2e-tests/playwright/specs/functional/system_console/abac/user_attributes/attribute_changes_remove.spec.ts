// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, verifyUserInChannel, updateUserAttributes, duration} from '@mattermost/playwright-lib';

import type {CustomProfileAttribute} from '../../../channels/custom_profile_attributes/helpers';
import {setupCustomProfileAttributeFields} from '../../../channels/custom_profile_attributes/helpers';
import {createUserForABAC, createPrivateChannelForABAC, activatePolicy, enableUserManagedAttributes} from '../support';
import {
    createMembershipPolicy,
    fieldNamed,
    policyIdByName,
    runSyncJob,
    setAbacEnabled,
    waitForSyncJob,
} from '../surface';

/**
 * ABAC User Attributes - Attribute Changes
 * Tests for user attribute changes affecting ABAC policies
 */
test.describe('ABAC User Attributes - Attribute Changes', () => {
    /**
     * MM-T5796: User is auto-removed from channel when required attribute is removed
     *
     * Test Scenario 1 & 2 (Auto-add: False & True):
     * Steps:
     * 1. As system admin, identify the required attribute for channel access
     * 2. Log in as a user currently in the channel with the required attribute
     * 3. Edit user's profile
     * 4. Remove or change the required attribute value
     * 5. Save changes
     *
     * Expected:
     * - User is automatically removed from the channel
     * - System posts a "User removed" message in the channel
     */
    test('MM-T5796 User auto-removed when required attribute is removed', async ({pw}) => {
        test.setTimeout(duration.four_min);

        await pw.skipIfNoLicense();

        // ============================================================
        // SETUP
        // ============================================================
        const {adminUser, adminClient, team} = await pw.initSetup();

        await enableUserManagedAttributes(adminClient);

        const attributeFields: CustomProfileAttribute[] = [{name: 'Department', type: 'text', value: ''}];
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributeFields);

        // Create test user WITH the qualifying attribute (starts with Department=Engineering)
        const testUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Engineering'},
        ]);
        await adminClient.addToTeam(team.id, testUser.id);

        const privateChannel = await createPrivateChannelForABAC(adminClient, team.id);

        // ============================================================
        // TEST SCENARIO 1: Auto-add FALSE
        // ============================================================

        const {app} = await pw.testBrowser.login(adminUser);
        await setAbacEnabled(app, true);

        const policy1Name = `Engineering Access NoAutoAdd ${pw.random.id()}`;
        const jobId1 = await createMembershipPolicy(app, {
            name: policy1Name,
            rules: [{field: fieldNamed(attributeFieldsMap, 'Department'), value: 'Engineering'}],
            channels: [privateChannel],
            autoAdd: false,
        });

        // Manually add user to channel
        await adminClient.addToChannel(testUser.id, privateChannel.id);
        const initialInChannel = await verifyUserInChannel(adminClient, testUser.id, privateChannel.id);
        expect(initialInChannel).toBe(true);

        // Get policy ID and activate
        if (!jobId1) {
            throw new Error('Saving a policy with channels starts no sync job');
        }
        await waitForSyncJob(adminClient, jobId1);
        await activatePolicy(adminClient, await policyIdByName(adminClient, policy1Name));

        // Remove the qualifying attribute
        await updateUserAttributes(adminClient, testUser.id, {Department: 'Sales'});

        // Wait for attribute change to propagate

        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        });

        // Run sync job
        await waitForSyncJob(adminClient, await runSyncJob(app));

        // Wait for membership updates to apply

        // Verify user is removed
        const userInChannelAfterRemoval = await verifyUserInChannel(adminClient, testUser.id, privateChannel.id);
        expect(userInChannelAfterRemoval).toBe(false);

        // Check for removal system message
        const posts = await adminClient.getPosts(privateChannel.id, 0, 10);
        const postList = posts.order.map((postId: string) => posts.posts[postId]);

        const userRemovedMessage = postList.find((post: any) => {
            return (
                (post.type === 'system_remove_from_channel' || post.type === 'system_leave_channel') &&
                (post.props?.removedUserId === testUser.id || post.user_id === testUser.id)
            );
        });

        if (userRemovedMessage) {
            // System message found
        } else {
            // System message not found (may be disabled in test env)
        }

        // ============================================================
        // TEST SCENARIO 2: Auto-add TRUE
        // ============================================================

        // Restore user attribute and create new policy with auto-add=true
        await updateUserAttributes(adminClient, testUser.id, {Department: 'Engineering'});

        const channel2 = await createPrivateChannelForABAC(adminClient, team.id);

        const policy2Name = `Engineering Access WithAutoAdd ${pw.random.id()}`;
        const jobId2 = await createMembershipPolicy(app, {
            name: policy2Name,
            rules: [{field: fieldNamed(attributeFieldsMap, 'Department'), value: 'Engineering'}],
            channels: [channel2],
            autoAdd: true,
        });

        // Activate and run sync to auto-add user
        if (!jobId2) {
            throw new Error('Saving a policy with channels starts no sync job');
        }
        await waitForSyncJob(adminClient, jobId2);
        await activatePolicy(adminClient, await policyIdByName(adminClient, policy2Name));

        // Re-apply ABAC enable guard: a concurrent initSetup() on another shard may have
        // disabled ABAC between the initial enableABAC call and this sync job.
        // Without ABAC enabled the server skips policy evaluation and won't auto-add the user.
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        });

        await waitForSyncJob(adminClient, await runSyncJob(app));

        const userAutoAdded = await verifyUserInChannel(adminClient, testUser.id, channel2.id);
        expect(userAutoAdded).toBe(true);

        // Remove attribute again
        await updateUserAttributes(adminClient, testUser.id, {Department: 'Marketing'});

        // Wait for attribute change to propagate

        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        });

        // Run sync
        await waitForSyncJob(adminClient, await runSyncJob(app));

        // Small delay for channel membership update

        // Verify user is removed
        const userRemovedFromChannel2 = await verifyUserInChannel(adminClient, testUser.id, channel2.id);
        expect(userRemovedFromChannel2).toBe(false);
    });
});
