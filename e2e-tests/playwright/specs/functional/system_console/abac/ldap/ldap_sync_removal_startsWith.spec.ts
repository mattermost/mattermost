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
    createPrivateChannelForABAC,
    createAdvancedPolicy,
    activatePolicy,
    waitForPolicySyncJob,
    getPolicyIdByName,
} from '../support';

/**
 * MM-T5799a: LDAP sync - User removed after attribute removed (startsWith operator, auto-add true)
 */
test('MM-T5799a LDAP sync - User removed with startsWith operator (auto-add true)', async ({pw}) => {
    test.setTimeout(120000);

    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();

    // User starts WITH qualifying attribute (Department starts with "Eng").
    const user1 = await createUserWithAttributes(adminClient, {Department: 'Engineering'});
    await adminClient.addToTeam(team.id, user1.id);

    const channel1 = await createPrivateChannelForABAC(adminClient, team.id);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await navigateToABACPage(systemConsolePage.page);

    const policy1Name = `LDAP Remove StartsWith ${await pw.random.id()}`;
    await createAdvancedPolicy(systemConsolePage.page, {
        name: policy1Name,
        celExpression: 'user.attributes.Department.startsWith("Eng")',
        autoSync: true,
        channels: [channel1.display_name],
    });
    const t5799Policy1Id = (await getPolicyIdByName(adminClient, policy1Name))!;

    // Activate immediately using the UUID — no creation-sync wait needed.
    await activatePolicy(adminClient, t5799Policy1Id);

    // Sync: user has qualifying attribute → gets auto-added.
    // Use policy-scoped API polling to avoid cross-shard job contamination.
    await runSyncJob(systemConsolePage.page);
    await waitForPolicySyncJob(adminClient, t5799Policy1Id);

    // Poll: the sync job marks itself success before the channel_members write
    // is fully committed.  Give the server up to 15 s to catch up.
    await expect
        .poll(() => verifyUserInChannel(adminClient, user1.id, channel1.id), {
            timeout: 15_000,
            intervals: [500, 1000, 2000],
            message: 'User should have been added to channel after first sync',
        })
        .toBe(true);

    // Simulate LDAP sync: change Department to non-qualifying value.
    await updateUserAttributes(adminClient, user1.id, {Department: 'Sales'});

    // Sync: user no longer qualifies → gets removed.
    await runSyncJob(systemConsolePage.page);
    await waitForPolicySyncJob(adminClient, t5799Policy1Id);

    await expect
        .poll(() => verifyUserInChannel(adminClient, user1.id, channel1.id), {
            timeout: 15_000,
            intervals: [500, 1000, 2000],
            message: 'User should have been removed from channel after second sync',
        })
        .toBe(false);
});
