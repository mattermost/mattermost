// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    expect,
    test,
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
    getPolicyIdByName,
} from '../support';

/**
 * MM-T5800: Policy enforcement after attribute change (bidirectional)
 */
test('MM-T5800 Policy enforcement after attribute change (bidirectional)', async ({pw}) => {
    test.setTimeout(180000);

    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();

    // Ensure the "Department" custom profile attribute exists before creating users.
    // A concurrent test shard may not yet have run the global setup, or the attribute
    // may have been recreated under a different ID — ensureUserAttributes is idempotent.
    await ensureUserAttributes(adminClient);

    // User starts with non-qualifying attribute.
    const user = await createUserWithAttributes(adminClient, {Department: 'Sales'});
    await adminClient.addToTeam(team.id, user.id);

    const privateChannel = await createPrivateChannelForABAC(adminClient, team.id);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await navigateToABACPage(systemConsolePage.page);

    const policyName = `Dynamic Policy ${await pw.random.id()}`;
    await createBasicPolicy(systemConsolePage.page, {
        name: policyName,
        attribute: 'Department',
        operator: '==',
        value: 'Engineering',
        autoSync: true,
        channels: [privateChannel.display_name],
    });
    const t5800PolicyId = (await getPolicyIdByName(adminClient, policyName))!;

    await activatePolicy(adminClient, t5800PolicyId);

    // PHASE 1: User has non-qualifying attribute — not in channel without a sync.
    const phase1InChannel = await verifyUserInChannel(adminClient, user.id, privateChannel.id);
    expect(phase1InChannel).toBe(false);

    // PHASE 2: Change to qualifying → User auto-added.
    await updateUserAttributes(adminClient, user.id, {Department: 'Engineering'});

    // Capture exact job ID so waitForLatestSyncJob polls the right job, not
    // the most-recent row (which may belong to a concurrent shard's sync job).
    const syncJob2 = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, undefined, syncJob2);

    await expect
        .poll(() => verifyUserInChannel(adminClient, user.id, privateChannel.id), {
            timeout: 15_000,
            intervals: [500, 1000, 2000],
            message: 'User should have been added to channel after qualifying sync',
        })
        .toBe(true);

    // PHASE 3: Change back to non-qualifying → User auto-removed.
    await updateUserAttributes(adminClient, user.id, {Department: 'Marketing'});

    const syncJob3 = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, undefined, syncJob3);

    await expect
        .poll(() => verifyUserInChannel(adminClient, user.id, privateChannel.id), {
            timeout: 15_000,
            intervals: [500, 1000, 2000],
            message: 'User should have been removed from channel after non-qualifying sync',
        })
        .toBe(false);
});
