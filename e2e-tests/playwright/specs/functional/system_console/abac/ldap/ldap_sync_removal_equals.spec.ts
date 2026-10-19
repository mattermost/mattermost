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
    getPolicyIdByName,
} from '../support';

/**
 * MM-T5799b: LDAP sync - User removed after attribute removed (== operator, auto-add true)
 */
test('MM-T5799b LDAP sync - User removed with == operator (auto-add true)', async ({pw}) => {
    test.setTimeout(120000);

    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();
    await ensureUserAttributes(adminClient, ['Department']);

    // User starts WITH qualifying attribute.
    const user2 = await createUserWithAttributes(adminClient, {Department: 'Engineering'});
    await adminClient.addToTeam(team.id, user2.id);

    const channel2 = await createPrivateChannelForABAC(adminClient, team.id);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await navigateToABACPage(systemConsolePage.page);
    await enableABAC(systemConsolePage.page);

    const policy2Name = `LDAP Remove TwoAttr ${await pw.random.id()}`;
    await createBasicPolicy(systemConsolePage.page, {
        name: policy2Name,
        attribute: 'Department',
        operator: '==',
        value: 'Engineering',
        autoSync: true,
        channels: [channel2.display_name],
    });
    const t5799Policy2Id = (await getPolicyIdByName(adminClient, policy2Name))!;

    await activatePolicy(adminClient, t5799Policy2Id);

    // Sync: user has qualifying attribute → gets auto-added.
    // Capture exact job ID so we poll the right job, not the most-recent row
    // (which may belong to a concurrent shard's sync job under PW_WORKERS >= 2).
    const syncJob5799b1 = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, undefined, syncJob5799b1);

    await expect
        .poll(() => verifyUserInChannel(adminClient, user2.id, channel2.id), {
            timeout: 15_000,
            intervals: [500, 1000, 2000],
            message: 'User should have been added to channel after first sync',
        })
        .toBe(true);

    // Change Department to non-qualifying value.
    await updateUserAttributes(adminClient, user2.id, {Department: 'Sales'});

    // Sync: user no longer qualifies → gets removed.
    const syncJob5799b2 = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, undefined, syncJob5799b2);

    await expect
        .poll(() => verifyUserInChannel(adminClient, user2.id, channel2.id), {
            timeout: 15_000,
            intervals: [500, 1000, 2000],
            message: 'User should have been removed from channel after second sync',
        })
        .toBe(false);
});
