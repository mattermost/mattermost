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
    createBasicPolicy,
    activatePolicy,
    waitForPolicySyncJob,
    getPolicyIdByName,
} from '../support';

/**
 * MM-T5799b: LDAP sync - User removed after attribute removed (== operator, auto-add true)
 */
test('MM-T5799b LDAP sync - User removed with == operator (auto-add true)', async ({pw}) => {
    test.setTimeout(120000);

    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();

    // User starts WITH qualifying attribute.
    const user2 = await createUserWithAttributes(adminClient, {Department: 'Engineering'});
    await adminClient.addToTeam(team.id, user2.id);

    const channel2 = await createPrivateChannelForABAC(adminClient, team.id);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await navigateToABACPage(systemConsolePage.page);

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
    await runSyncJob(systemConsolePage.page);
    await waitForPolicySyncJob(adminClient, t5799Policy2Id);

    const user2InitialCheck = await verifyUserInChannel(adminClient, user2.id, channel2.id);
    expect(user2InitialCheck).toBe(true);

    // Change Department to non-qualifying value.
    await updateUserAttributes(adminClient, user2.id, {Department: 'Sales'});

    // Sync: user no longer qualifies → gets removed.
    await runSyncJob(systemConsolePage.page);
    await waitForPolicySyncJob(adminClient, t5799Policy2Id);

    const user2AfterSync = await verifyUserInChannel(adminClient, user2.id, channel2.id);
    expect(user2AfterSync).toBe(false);
});
