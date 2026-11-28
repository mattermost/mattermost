// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    expect,
    test,
    verifyUserInChannel,
    updateUserAttributes,
    createUserWithAttributes,
    duration,
} from '@mattermost/playwright-lib';

import {
    ensureUserAttributes,
    createPrivateChannelForABAC,
    activatePolicy,
    getUserAttributeFieldByName,
} from '../support';
import {
    createMembershipPolicy,
    policyIdByName,
    runSyncJob,
    setAbacEnabled,
    syncJobId,
    waitForSyncJob,
} from '../surface';

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
        test.setTimeout(duration.ten_min);

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
        const {app} = await pw.testBrowser.login(adminUser);
        await setAbacEnabled(app, true);

        const policyName = `Dynamic Policy ${pw.random.id()}`;
        const createJobId = await createMembershipPolicy(app, {
            name: policyName,
            rules: [{field: await getUserAttributeFieldByName(adminClient, 'Department'), value: 'Engineering'}],
            channels: [privateChannel],
            autoAdd: true,
        });

        // # Wait for the sync the save started, then activate the policy
        await waitForSyncJob(adminClient, syncJobId(createJobId), 180_000);
        await activatePolicy(adminClient, await policyIdByName(adminClient, policyName));

        // ============================================================
        // PHASE 1: User should NOT be added (Department=Sales)
        // ============================================================
        await waitForSyncJob(adminClient, await runSyncJob(app), 180_000);

        const phase1InChannel = await verifyUserInChannel(adminClient, user.id, privateChannel.id);
        expect(phase1InChannel).toBe(false);

        // ============================================================
        // PHASE 2: Change attribute to qualifying value → User auto-added
        // ============================================================
        await updateUserAttributes(adminClient, user.id, {Department: 'Engineering'});

        await waitForSyncJob(adminClient, await runSyncJob(app), 180_000);

        const phase2InChannel = await verifyUserInChannel(adminClient, user.id, privateChannel.id);
        expect(phase2InChannel).toBe(true);

        // ============================================================
        // PHASE 3: Change attribute back → User auto-removed
        // ============================================================
        await updateUserAttributes(adminClient, user.id, {Department: 'Marketing'});

        await waitForSyncJob(adminClient, await runSyncJob(app), 180_000);

        const phase3InChannel = await verifyUserInChannel(adminClient, user.id, privateChannel.id);
        expect(phase3InChannel).toBe(false);
    });
});
