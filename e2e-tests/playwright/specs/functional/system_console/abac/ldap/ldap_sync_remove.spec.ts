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
    waitForPolicySyncJob,
    getPolicyIdByName,
} from '../support';

/**
 * MM-T5799a: LDAP sync - User removed after attribute change (startsWith operator, auto-add true)
 *
 * 1. Policy with Department.startsWith("Eng"), auto-add=true
 * 2. User IN channel with qualifying attribute (Engineering)
 * 3. Attribute updated to non-qualifying value (Sales)
 * 4. Next sync removes the user from the channel
 */
test('MM-T5799a LDAP sync - User removed with startsWith operator (auto-add true)', async ({pw}) => {
    test.setTimeout(90000);
    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();
    await ensureUserAttributes(adminClient, ['Department']);

    // User starts WITH qualifying attribute (Department starts with "Eng").
    const user = await createUserWithAttributes(adminClient, {Department: 'Engineering'});
    await adminClient.addToTeam(team.id, user.id);

    const channel = await createPrivateChannelForABAC(adminClient, team.id);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await navigateToABACPage(systemConsolePage.page);
    await enableABAC(systemConsolePage.page);

    const policyName = `LDAP Remove StartsWith ${await pw.random.id()}`;
    await createAdvancedPolicy(systemConsolePage.page, {
        name: policyName,
        celExpression: 'user.attributes.Department.startsWith("Eng")',
        autoSync: true,
        channels: [channel.display_name],
    });

    const policyId = (await getPolicyIdByName(adminClient, policyName))!;
    await activatePolicy(adminClient, policyId);

    // Sync: user has qualifying attribute → gets auto-added.
    await runSyncJob(systemConsolePage.page);
    await waitForPolicySyncJob(adminClient, policyId);

    const initialCheck = await verifyUserInChannel(adminClient, user.id, channel.id);
    expect(initialCheck).toBe(true);

    // Simulate LDAP sync: change Department to non-qualifying value.
    await updateUserAttributes(adminClient, user.id, {Department: 'Sales'});

    // Sync: user no longer qualifies → gets removed.
    await runSyncJob(systemConsolePage.page);
    await waitForPolicySyncJob(adminClient, policyId);

    const afterSync = await verifyUserInChannel(adminClient, user.id, channel.id);
    expect(afterSync).toBe(false);
});

/**
 * MM-T5799b: LDAP sync - User removed after attribute change (== operator, auto-add true)
 *
 * 1. Policy with Department == Engineering, auto-add=true
 * 2. User IN channel with qualifying attribute (Engineering)
 * 3. Attribute updated to non-qualifying value (Sales)
 * 4. Next sync removes the user from the channel
 */
test('MM-T5799b LDAP sync - User removed with == operator (auto-add true)', async ({pw}) => {
    test.setTimeout(90000);
    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();
    await ensureUserAttributes(adminClient, ['Department']);

    // User starts WITH qualifying attribute.
    const user = await createUserWithAttributes(adminClient, {Department: 'Engineering'});
    await adminClient.addToTeam(team.id, user.id);

    const channel = await createPrivateChannelForABAC(adminClient, team.id);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await navigateToABACPage(systemConsolePage.page);
    await enableABAC(systemConsolePage.page);

    const policyName = `LDAP Remove Equals ${await pw.random.id()}`;
    await createBasicPolicy(systemConsolePage.page, {
        name: policyName,
        attribute: 'Department',
        operator: '==',
        value: 'Engineering',
        autoSync: true,
        channels: [channel.display_name],
    });

    const policyId = (await getPolicyIdByName(adminClient, policyName))!;
    await activatePolicy(adminClient, policyId);

    // Sync: user has qualifying attribute → gets auto-added.
    await runSyncJob(systemConsolePage.page);
    await waitForPolicySyncJob(adminClient, policyId);

    const initialCheck = await verifyUserInChannel(adminClient, user.id, channel.id);
    expect(initialCheck).toBe(true);

    // Simulate LDAP sync: change Department to non-qualifying value.
    await updateUserAttributes(adminClient, user.id, {Department: 'Sales'});

    // Sync: user no longer qualifies → gets removed.
    await runSyncJob(systemConsolePage.page);
    await waitForPolicySyncJob(adminClient, policyId);

    const afterSync = await verifyUserInChannel(adminClient, user.id, channel.id);
    expect(afterSync).toBe(false);
});
