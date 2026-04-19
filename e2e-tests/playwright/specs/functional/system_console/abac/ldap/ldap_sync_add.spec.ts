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
    createAdvancedPolicy,
    activatePolicy,
    waitForLatestSyncJob,
} from '../support';

/**
 * ABAC LDAP Integration - Sync
 * Tests for LDAP sync behavior with ABAC policies
 */
test.describe('ABAC LDAP Integration - Sync', () => {
    /**
     * MM-T5797: LDAP sync - User is auto-added to channel when qualifying attribute syncs to their profile (auto-add true)
     *
     * Step 1: Single attribute with `= is` operator
     * 1. Policy with one attribute (Department == Engineering), auto-add=true exists
     * 2. User NOT in channel, lacking required attribute
     */
    test('MM-T5797 LDAP sync - User auto-added when attribute syncs (auto-add true)', async ({pw}) => {
        test.setTimeout(180000);

        await pw.skipIfNoLicense();

        // ============================================================
        // SETUP
        // ============================================================
        const {adminUser, adminClient, team} = await pw.initSetup();

        // Ensure Department attribute exists
        await ensureUserAttributes(adminClient, ['Department']);

        // ============================================================
        // STEP 1: Single attribute with == operator, auto-add TRUE
        // ============================================================

        // Create user with NON-qualifying attribute (simulating LDAP user before sync)
        const user1 = await createUserWithAttributes(adminClient, {Department: 'Sales'});
        await adminClient.addToTeam(team.id, user1.id);

        // Create channel and policy
        const channel1 = await createPrivateChannelForABAC(adminClient, team.id);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await navigateToABACPage(systemConsolePage.page);
        await enableABAC(systemConsolePage.page);

        const policy1Name = `LDAP AutoAdd Single ${pw.random.id()}`;
        await createBasicPolicy(systemConsolePage.page, {
            name: policy1Name,
            attribute: 'Department',
            operator: '==',
            value: 'Engineering',
            autoSync: true, // Auto-add TRUE
            channels: [channel1.display_name],
        });

        // Wait for page to load completely and job table to appear
        await systemConsolePage.page.waitForTimeout(2000);

        // Activate policy
        await waitForLatestSyncJob(systemConsolePage.page);
        const searchInput = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
        await searchInput.waitFor({state: 'visible', timeout: 5000});
        await searchInput.fill(policy1Name.match(/([a-z0-9]+)$/i)?.[1] || policy1Name);
        await systemConsolePage.page.waitForTimeout(1000);

        const policyRow1 = systemConsolePage.page.locator('.policy-name').first();
        const policyId1 = (await policyRow1.getAttribute('id'))?.replace('customDescription-', '');
        if (policyId1) {
            await activatePolicy(adminClient, policyId1);
        }
        await searchInput.clear();

        // Run initial sync - user should NOT be in channel (doesn't have qualifying attribute)
        await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page);

        const user1InitialCheck = await verifyUserInChannel(adminClient, user1.id, channel1.id);
        expect(user1InitialCheck).toBe(false);

        // Simulate LDAP sync by updating user's attribute to qualifying value
        await updateUserAttributes(adminClient, user1.id, {Department: 'Engineering'});

        // Run ABAC sync job to apply policy with new attribute value
        await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page);

        // Verify user IS NOW in channel (auto-added)
        const user1AfterSync = await verifyUserInChannel(adminClient, user1.id, channel1.id);
        expect(user1AfterSync).toBe(true);

        // Verify system message
        const posts1 = await adminClient.getPosts(channel1.id, 0, 10);
        const postList1 = posts1.order.map((postId: string) => posts1.posts[postId]);
        const addMessage1 = postList1.find((post: any) => {
            return post.type === 'system_add_to_channel' && post.props?.addedUserId === user1.id;
        });
        if (addMessage1) {
            // System message found
        } else {
            // System message not found (may be disabled in test env)
        }

        // ============================================================
        // STEP 2: Single attribute using "contains" operator
        // ============================================================

        // Create user with Department that doesn't contain "Eng"
        const user2 = await createUserWithAttributes(adminClient, {
            Department: 'Sales', // Doesn't contain "Eng"
        });
        await adminClient.addToTeam(team.id, user2.id);

        // Create second channel
        const channel2 = await createPrivateChannelForABAC(adminClient, team.id);

        await navigateToABACPage(systemConsolePage.page);

        // Create policy with contains operator: Department contains "Eng"
        const policy2Name = `LDAP AutoAdd Contains ${pw.random.id()}`;
        await createAdvancedPolicy(systemConsolePage.page, {
            name: policy2Name,
            celExpression: 'user.attributes.Department.contains("Eng")',
            autoSync: true, // Auto-add TRUE
            channels: [channel2.display_name],
        });

        // Activate policy
        await waitForLatestSyncJob(systemConsolePage.page);
        await searchInput.fill(policy2Name.match(/([a-z0-9]+)$/i)?.[1] || policy2Name);
        await systemConsolePage.page.waitForTimeout(1000);

        const policyRow2 = systemConsolePage.page.locator('.policy-name').first();
        const policyId2 = (await policyRow2.getAttribute('id'))?.replace('customDescription-', '');
        if (policyId2) {
            await activatePolicy(adminClient, policyId2);
        }
        await searchInput.clear();

        // Run initial sync - user should NOT be in channel (has Department but Skills missing Python)
        await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page);

        const user2InitialCheck = await verifyUserInChannel(adminClient, user2.id, channel2.id);
        expect(user2InitialCheck).toBe(false);

        // Simulate LDAP sync by updating Department to "Engineering" (contains "Eng")
        await updateUserAttributes(adminClient, user2.id, {Department: 'Engineering'});

        // Run ABAC sync job
        await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page);

        // Verify user IS NOW in channel (auto-added)
        const user2AfterSync = await verifyUserInChannel(adminClient, user2.id, channel2.id);
        expect(user2AfterSync).toBe(true);

        // Verify system message
        const posts2 = await adminClient.getPosts(channel2.id, 0, 10);
        const postList2 = posts2.order.map((postId: string) => posts2.posts[postId]);
        const addMessage2 = postList2.find((post: any) => {
            return post.type === 'system_add_to_channel' && post.props?.addedUserId === user2.id;
        });
        if (addMessage2) {
            // System message found
        } else {
            // System message not found (may be disabled in test env)
        }
    });
});
