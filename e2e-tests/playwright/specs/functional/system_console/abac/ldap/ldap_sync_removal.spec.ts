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
    await waitForPolicySyncJob(adminClient, t5799Policy1Id, 10);

    const user1InitialCheck = await verifyUserInChannel(adminClient, user1.id, channel1.id);
    expect(user1InitialCheck).toBe(true);

    // Simulate LDAP sync: change Department to non-qualifying value.
    await updateUserAttributes(adminClient, user1.id, {Department: 'Sales'});

    // Sync: user no longer qualifies → gets removed.
    await runSyncJob(systemConsolePage.page);
    await waitForPolicySyncJob(adminClient, t5799Policy1Id, 10);

    const user1AfterSync = await verifyUserInChannel(adminClient, user1.id, channel1.id);
    expect(user1AfterSync).toBe(false);
});

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
    await waitForPolicySyncJob(adminClient, t5799Policy2Id, 10);

    const user2InitialCheck = await verifyUserInChannel(adminClient, user2.id, channel2.id);
    expect(user2InitialCheck).toBe(true);

    // Change Department to non-qualifying value.
    await updateUserAttributes(adminClient, user2.id, {Department: 'Sales'});

    // Sync: user no longer qualifies → gets removed.
    await runSyncJob(systemConsolePage.page);
    await waitForPolicySyncJob(adminClient, t5799Policy2Id, 10);

    const user2AfterSync = await verifyUserInChannel(adminClient, user2.id, channel2.id);
    expect(user2AfterSync).toBe(false);
});

/**
 * MM-T5800: Policy enforcement after attribute change (bidirectional)
 */
test('MM-T5800 Policy enforcement after attribute change (bidirectional)', async ({pw}) => {
    test.setTimeout(120000);

    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();

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

    await runSyncJob(systemConsolePage.page);
    await waitForPolicySyncJob(adminClient, t5800PolicyId, 10);

    const phase2InChannel = await verifyUserInChannel(adminClient, user.id, privateChannel.id);
    expect(phase2InChannel).toBe(true);

    // PHASE 3: Change back to non-qualifying → User auto-removed.
    await updateUserAttributes(adminClient, user.id, {Department: 'Marketing'});

    await runSyncJob(systemConsolePage.page);
    await waitForPolicySyncJob(adminClient, t5800PolicyId, 10);

    const phase3InChannel = await verifyUserInChannel(adminClient, user.id, privateChannel.id);
    expect(phase3InChannel).toBe(false);
});
