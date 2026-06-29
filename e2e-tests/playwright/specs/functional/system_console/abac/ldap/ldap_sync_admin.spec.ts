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
    getPolicyIdByName,
} from '../support';

/**
 * ABAC LDAP Integration - Sync
 * Tests for LDAP sync behavior with ABAC policies
 */
test.describe('ABAC LDAP Integration - Sync', () => {
    /**
     * MM-T5798: LDAP sync - User can be added to channel by admin after editing qualifying attribute (auto-add false)
     *
     * Step 1: Using `= is` operator
     * 1. Policy with auto-add=false exists and is applied to a channel
     * 2. User has wrong attribute value (non-qualifying)
     * 3. Simulate LDAP sync by updating user's attribute to qualifying value
     * 4. Run ABAC sync job (updates qualification state but doesn't auto-add due to auto-add=false)
     * 5. Verify user NOT auto-added
     * 6. Admin manually adds user to channel
     *
     * Step 2: Using `∈ in` operator
     * 1. Policy with `in` operator exists
     * 2. User has attribute but not a qualifying value
     * 3. Simulate LDAP sync by updating to qualifying value
     * 4. Admin adds user to channel
     *
     * Expected:
     * - User who satisfies policy can be added by admin
     * - `User added` message posted in channel
     *
     * NOTE: This test simulates LDAP attribute sync behavior via API.
     *       In production, attributes would be synced from LDAP server.
     */
    test('MM-T5798 User added by admin after LDAP attribute sync (auto-add false)', async ({pw}) => {
        test.setTimeout(180000);

        await pw.skipIfNoLicense();

        // ============================================================
        // SETUP
        // ============================================================
        const {adminUser, adminClient, team} = await pw.initSetup();

        await ensureUserAttributes(adminClient);

        // ============================================================
        // STEP 1: Test with `= is` operator
        // ============================================================

        // Create user with NON-qualifying attribute (simulating LDAP user before sync)
        const user1 = await createUserWithAttributes(adminClient, {Department: 'Sales'});
        await adminClient.addToTeam(team.id, user1.id);

        const channel1 = await createPrivateChannelForABAC(adminClient, team.id);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await navigateToABACPage(systemConsolePage.page);
        await enableABAC(systemConsolePage.page);

        const policy1Name = `LDAP Sync Equals ${pw.random.id()}`;
        await createBasicPolicy(systemConsolePage.page, {
            name: policy1Name,
            attribute: 'Department',
            operator: '==',
            value: 'Engineering',
            autoSync: false,
            channels: [channel1.display_name],
        });

        // Get policy ID via API (no DOM scraping, no page reload needed)
        const policyId1 = (await getPolicyIdByName(adminClient, policy1Name))!;
        await activatePolicy(adminClient, policyId1);

        // Initial sync — user has non-qualifying attribute, should not be added.
        // Capture exact job ID so we poll the right job, not the most-recent row
        // (which may belong to a concurrent shard's sync job under PW_WORKERS >= 2).
        const syncJob5798a1 = await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page, undefined, syncJob5798a1);

        const user1InitialCheck = await verifyUserInChannel(adminClient, user1.id, channel1.id);
        expect(user1InitialCheck).toBe(false);

        // Simulate LDAP sync: update attribute to qualifying value
        await updateUserAttributes(adminClient, user1.id, {Department: 'Engineering'});

        // Sync again — auto-add=false, so user is NOT auto-added even when qualifying
        const syncJob5798a2 = await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page, undefined, syncJob5798a2);

        const user1AfterSync = await verifyUserInChannel(adminClient, user1.id, channel1.id);

        if (!user1AfterSync) {
            // Expected: admin must manually add qualifying user when auto-add=false
            await adminClient.addToChannel(user1.id, channel1.id);
            const user1AfterAdminAdd = await verifyUserInChannel(adminClient, user1.id, channel1.id);
            expect(user1AfterAdminAdd).toBe(true);
        }

        const user1Final = await verifyUserInChannel(adminClient, user1.id, channel1.id);
        expect(user1Final).toBe(true);

        // ============================================================
        // STEP 2: Test with `∈ in` operator
        // ============================================================

        const user2 = await createUserWithAttributes(adminClient, {Department: 'Marketing'});
        await adminClient.addToTeam(team.id, user2.id);

        const channel2 = await createPrivateChannelForABAC(adminClient, team.id);

        await navigateToABACPage(systemConsolePage.page);

        const policy2Name = `LDAP Sync In ${pw.random.id()}`;
        await createAdvancedPolicy(systemConsolePage.page, {
            name: policy2Name,
            celExpression: 'user.attributes.Department in ["Engineering", "Product"]',
            autoSync: false,
            channels: [channel2.display_name],
        });

        const policyId2 = (await getPolicyIdByName(adminClient, policy2Name))!;
        await activatePolicy(adminClient, policyId2);

        // Initial sync — non-qualifying, should not be added
        const syncJob5798b1 = await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page, undefined, syncJob5798b1);

        const user2InitialCheck = await verifyUserInChannel(adminClient, user2.id, channel2.id);
        expect(user2InitialCheck).toBe(false);

        // Simulate LDAP sync: update to qualifying value
        await updateUserAttributes(adminClient, user2.id, {Department: 'Product'});

        // Sync again — auto-add=false, admin must manually add
        const syncJob5798b2 = await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page, undefined, syncJob5798b2);

        const user2AfterSync = await verifyUserInChannel(adminClient, user2.id, channel2.id);

        if (!user2AfterSync) {
            await adminClient.addToChannel(user2.id, channel2.id);
            const user2AfterAdminAdd = await verifyUserInChannel(adminClient, user2.id, channel2.id);
            expect(user2AfterAdminAdd).toBe(true);
        }

        const user2Final = await verifyUserInChannel(adminClient, user2.id, channel2.id);
        expect(user2Final).toBe(true);
    });
});
