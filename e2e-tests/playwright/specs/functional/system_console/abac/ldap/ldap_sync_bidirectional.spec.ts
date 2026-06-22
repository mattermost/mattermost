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
 * ABAC LDAP Integration - Sync
 * Tests for LDAP sync behavior with ABAC policies
 */
test.describe('ABAC LDAP Integration - Sync', () => {
    /**
     * MM-T5800: Policy enforcement after attribute change
     * @objective Verify that policy enforcement updates when user attributes change
     *
     * This test is similar to MM-T5794 but focuses on the bidirectional nature:
     * - User starts with non-qualifying attribute → NOT in channel
     * - Attribute changed to qualifying value → User auto-added
     * - Attribute changed back to non-qualifying → User auto-removed
     */
    test('MM-T5800 Policy enforcement after attribute change (bidirectional)', async ({pw}) => {
        // 4 x waitForLatestSyncJob at up to 180 s each, plus policy creation and browser
        // navigation — CI LDAP sync jobs can take significantly longer than the default 90 s.
        test.setTimeout(300000);

        await pw.skipIfNoLicense();

        // ============================================================
        // SETUP
        // ============================================================
        const {adminUser, adminClient, team} = await pw.initSetup();
        await ensureUserAttributes(adminClient);

        // Create user with Sales department (non-qualifying)
        const user = await createUserWithAttributes(adminClient, {Department: 'Sales'});
        await adminClient.addToTeam(team.id, user.id);

        const privateChannel = await createPrivateChannelForABAC(adminClient, team.id);

        // ============================================================
        // Create policy for Engineering with auto-add
        // ============================================================
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await navigateToABACPage(systemConsolePage.page);
        await enableABAC(systemConsolePage.page);

        const policyName = `Dynamic Policy ${pw.random.id()}`;
        const createJobId = await createBasicPolicy(systemConsolePage.page, {
            name: policyName,
            attribute: 'Department',
            operator: '==',
            value: 'Engineering',
            autoSync: true,
            channels: [privateChannel.display_name],
        });

        // Activate policy
        await waitForLatestSyncJob(systemConsolePage.page, undefined, createJobId, 180_000);
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

        // ============================================================
        // PHASE 1: User should NOT be added (Department=Sales)
        // ============================================================
        const syncJob1 = await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page, undefined, syncJob1, 180_000);

        const phase1InChannel = await verifyUserInChannel(adminClient, user.id, privateChannel.id);
        expect(phase1InChannel).toBe(false);

        // ============================================================
        // PHASE 2: Change attribute to qualifying value → User auto-added
        // ============================================================
        await updateUserAttributes(adminClient, user.id, {Department: 'Engineering'});

        const syncJob2 = await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page, undefined, syncJob2, 180_000);

        const phase2InChannel = await verifyUserInChannel(adminClient, user.id, privateChannel.id);
        expect(phase2InChannel).toBe(true);

        // ============================================================
        // PHASE 3: Change attribute back → User auto-removed
        // ============================================================
        await updateUserAttributes(adminClient, user.id, {Department: 'Marketing'});

        const syncJob3 = await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page, undefined, syncJob3, 180_000);

        const phase3InChannel = await verifyUserInChannel(adminClient, user.id, privateChannel.id);
        expect(phase3InChannel).toBe(false);
    });
});
