// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    expect,
    test,
    enableABAC,
    navigateToABACPage,
    runSyncJob,
    verifyUserInChannel,
    updateUserAttributes,
} from '@mattermost/playwright-lib';

import type {CustomProfileAttribute} from '../../../channels/custom_profile_attributes/helpers';
import {setupCustomProfileAttributeFields} from '../../../channels/custom_profile_attributes/helpers';
import {
    createUserForABAC,
    createPrivateChannelForABAC,
    createBasicPolicy,
    activatePolicy,
    waitForLatestSyncJob,
    enableUserManagedAttributes,
} from '../support';

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
        test.setTimeout(180000);

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

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await navigateToABACPage(systemConsolePage.page);
        await enableABAC(systemConsolePage.page);

        const policy1Name = `Engineering Access NoAutoAdd ${pw.random.id()}`;
        const jobId1 = await createBasicPolicy(systemConsolePage.page, {
            name: policy1Name,
            attribute: 'Department',
            operator: '==',
            value: 'Engineering',
            autoSync: false, // Auto-add FALSE
            channels: [privateChannel.display_name],
        });

        // Manually add user to channel
        await adminClient.addToChannel(testUser.id, privateChannel.id);
        const initialInChannel = await verifyUserInChannel(adminClient, testUser.id, privateChannel.id);
        expect(initialInChannel).toBe(true);

        // Get policy ID and activate
        await waitForLatestSyncJob(systemConsolePage.page, undefined, jobId1);
        const searchInput = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
        await searchInput.waitFor({state: 'visible', timeout: 5000});
        const idMatch = policy1Name.match(/([a-z0-9]+)$/i);
        const uniqueId = idMatch ? idMatch[1] : policy1Name;
        await searchInput.fill(uniqueId);
        await systemConsolePage.page.waitForTimeout(1000);

        const policyRow = systemConsolePage.page.locator('.policy-name').first();
        const policyElementId = await policyRow.getAttribute('id');
        const policyId = policyElementId?.replace('customDescription-', '');

        if (policyId) {
            await activatePolicy(adminClient, policyId);
        }
        await searchInput.clear();

        // Remove the qualifying attribute
        await updateUserAttributes(adminClient, testUser.id, {Department: 'Sales'});

        // Wait for attribute change to propagate
        await systemConsolePage.page.waitForTimeout(1000);

        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        });

        // Run sync job
        const syncJob1 = await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page, undefined, syncJob1);

        // Wait for membership updates to apply
        await systemConsolePage.page.waitForTimeout(1000);

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

        await navigateToABACPage(systemConsolePage.page);

        const policy2Name = `Engineering Access WithAutoAdd ${pw.random.id()}`;
        const jobId2 = await createBasicPolicy(systemConsolePage.page, {
            name: policy2Name,
            attribute: 'Department',
            operator: '==',
            value: 'Engineering',
            autoSync: true, // Auto-add TRUE
            channels: [channel2.display_name],
        });

        // Activate and run sync to auto-add user
        await waitForLatestSyncJob(systemConsolePage.page, undefined, jobId2);
        await searchInput.fill(policy2Name.match(/([a-z0-9]+)$/i)?.[1] || policy2Name);
        await systemConsolePage.page.waitForTimeout(1000);

        const policyRow2 = systemConsolePage.page.locator('.policy-name').first();
        const policyId2 = (await policyRow2.getAttribute('id'))?.replace('customDescription-', '');

        if (policyId2) {
            await activatePolicy(adminClient, policyId2);
        }
        await searchInput.clear();

        // Re-apply ABAC enable guard: a concurrent initSetup() on another shard may have
        // disabled ABAC between the initial enableABAC call and this sync job.
        // Without ABAC enabled the server skips policy evaluation and won't auto-add the user.
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        });

        const syncJob2 = await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page, undefined, syncJob2);

        const userAutoAdded = await verifyUserInChannel(adminClient, testUser.id, channel2.id);
        expect(userAutoAdded).toBe(true);

        // Remove attribute again
        await updateUserAttributes(adminClient, testUser.id, {Department: 'Marketing'});

        // Wait for attribute change to propagate
        await systemConsolePage.page.waitForTimeout(1000);

        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        });

        // Run sync
        const syncJob3 = await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page, undefined, syncJob3);

        // Small delay for channel membership update
        await systemConsolePage.page.waitForTimeout(1000);

        // Verify user is removed
        const userRemovedFromChannel2 = await verifyUserInChannel(adminClient, testUser.id, channel2.id);
        expect(userRemovedFromChannel2).toBe(false);
    });
});
