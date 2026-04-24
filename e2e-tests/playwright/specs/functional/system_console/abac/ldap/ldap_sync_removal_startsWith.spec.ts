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

    const user1InitialCheck = await verifyUserInChannel(adminClient, user1.id, channel1.id);
    expect(user1InitialCheck).toBe(true);

    // Simulate LDAP sync: change Department to non-qualifying value.
    await updateUserAttributes(adminClient, user1.id, {Department: 'Sales'});

    // Sync: user no longer qualifies → gets removed.
    await runSyncJob(systemConsolePage.page);
    await waitForPolicySyncJob(adminClient, t5799Policy1Id);

    const user1AfterSync = await verifyUserInChannel(adminClient, user1.id, channel1.id);
    expect(user1AfterSync).toBe(false);
});
