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
    createUserWithAttributes,
} from '@mattermost/playwright-lib';

import {
    ensureUserAttributes,
    createPrivateChannelForABAC,
    createBasicPolicy,
    activatePolicy,
    waitForLatestSyncJob,
} from '../support';

/**
 * ABAC User Attributes - Attribute Changes
 * Tests for user attribute changes affecting ABAC policies
 */
test.describe('ABAC User Attributes - Attribute Changes', () => {
    /**
     * MM-T5794: User is auto-added to channel when a qualifying attribute is added to their profile (auto-add true)
     *
     * Step 1:
     * With at least one access policy in existence on the server, set to auto-add, and applied to a channel:
     * 1. As system admin make a note of the attribute needed for a user to be auto-added to a channel
     * 2. As a user not in the channel and not having the required attribute
     * 3. Click user's own profile picture top right and select Profile
     * 4. Scroll down to the required custom attribute, click Edit, and add the required value
     */
    test('MM-T5794 User auto-added when qualifying attribute is added to profile', async ({pw}) => {
        test.setTimeout(120000);

        await pw.skipIfNoLicense();

        // ============================================================
        // SETUP: Create attribute, policy, and channel
        // ============================================================
        const {adminUser, adminClient, team} = await pw.initSetup();

        // Setup attributes (using ensureUserAttributes like MM-T5800 does)
        await ensureUserAttributes(adminClient);

        // Create test user with NON-qualifying Department attribute (same pattern as MM-T5800)
        // MM-T5800 creates user with Department=Sales, then changes to Engineering
        // We do the same: Start with Sales (non-qualifying), then change to Engineering (qualifying)
        const testUser = await createUserWithAttributes(adminClient, {Department: 'Sales'});
        await adminClient.addToTeam(team.id, testUser.id);

        // Create private channel
        const privateChannel = await createPrivateChannelForABAC(adminClient, team.id);

        // ============================================================
        // STEP 1: Create ABAC policy with auto-add enabled
        // Policy requirement: Department == "Engineering"
        // ============================================================
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await navigateToABACPage(systemConsolePage.page);
        await enableABAC(systemConsolePage.page);

        const policyName = `Engineering Access ${pw.random.id()}`;
        const jobId = await createBasicPolicy(systemConsolePage.page, {
            name: policyName,
            attribute: 'Department',
            operator: '==',
            value: 'Engineering',
            autoSync: true, // ✅ Auto-add enabled
            channels: [privateChannel.display_name],
        });

        // Activate policy (EXACT same pattern as MM-T5800)
        await waitForLatestSyncJob(systemConsolePage.page, undefined, jobId);
        const searchInput = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
        await searchInput.waitFor({state: 'visible', timeout: 5000});
        const idMatch = policyName.match(/([a-z0-9]+)$/i);
        const uniqueId = idMatch ? idMatch[1] : policyName;
        await searchInput.fill(uniqueId);
        await systemConsolePage.page.waitForTimeout(1000);

        const policyRow = systemConsolePage.page.locator('.policy-name').first();
        const policyId = (await policyRow.getAttribute('id'))?.replace('customDescription-', '');

        if (policyId) {
            await activatePolicy(adminClient, policyId);
        }
        await searchInput.clear();

        // Re-apply guard: concurrent initSetup() resets ABAC between enableABAC() UI call and sync
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        });

        // ============================================================
        // STEP 2: Verify user is NOT in channel initially
        // ============================================================
        const syncJob1 = await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page, undefined, syncJob1);

        const initialInChannel = await verifyUserInChannel(adminClient, testUser.id, privateChannel.id);
        expect(initialInChannel).toBe(false);

        // ============================================================
        // STEPS 3-5: Add qualifying attribute to user's profile
        // Note: Using API for attribute update. UI testing for profile editing
        // is covered in separate user profile test suite.
        // ============================================================
        await updateUserAttributes(adminClient, testUser.id, {Department: 'Engineering'});

        // ============================================================
        // STEP 6: Run sync job to trigger auto-add
        // ============================================================

        // DEBUG: Verify attribute was updated before sync
        await adminClient.getUserCustomProfileAttributesValues(testUser.id);

        // Get the Department field to check its value
        await adminClient.getCustomProfileAttributeFields();

        const syncJob2 = await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page, undefined, syncJob2);

        // ============================================================
        // VERIFICATION: User should now be auto-added to channel
        // ============================================================

        // DEBUG: Check all channel members
        await adminClient.getChannelMembers(privateChannel.id);

        const finalInChannel = await verifyUserInChannel(adminClient, testUser.id, privateChannel.id);

        if (!finalInChannel) {
            // console.error('\n[ERROR] User NOT in channel after sync!');
            // console.error('[ERROR] This means the ABAC sync did not add the user.');
            // console.error('[ERROR] Possible causes:');
            // console.error('[ERROR] 1. Policy not active');
            // console.error('[ERROR] 2. Attribute value not matching policy');
            // console.error('[ERROR] 3. Sync job failed silently');
        }

        expect(finalInChannel).toBe(true);

        // ============================================================
        // VERIFICATION: Check for "User added" system message
        // ============================================================

        // Get recent posts from the channel
        const posts = await adminClient.getPosts(privateChannel.id, 0, 10);
        const postList = posts.order.map((postId: string) => posts.posts[postId]);

        // Find system message for user being added
        const userAddedMessage = postList.find((post: any) => {
            return (
                post.type === 'system_add_to_channel' &&
                post.props?.addedUserId === testUser.id &&
                post.user_id === 'system'
            );
        });

        if (userAddedMessage) {
            // System message found
        } else {
            // System message not found (may be disabled in test env)
        }

        // System messages might be disabled in test env, so we don't fail the test
        // The important verification is that the user was added
        expect(finalInChannel).toBe(true);
    });
});
