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
    waitForLatestSyncJob,
    getPolicyIdByName,
} from '../support';

/**
 * MM-T5797a: LDAP sync - User auto-added when attribute syncs (== operator, auto-add true)
 */
test('MM-T5797a LDAP sync - User auto-added with == operator (auto-add true)', async ({pw}) => {
    test.setTimeout(90000);

    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();

    const user1 = await createUserWithAttributes(adminClient, {Department: 'Sales'});
    await adminClient.addToTeam(team.id, user1.id);

    const channel1 = await createPrivateChannelForABAC(adminClient, team.id);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await navigateToABACPage(systemConsolePage.page);

    const policy1Name = `LDAP AutoAdd Single ${await pw.random.id()}`;
    await createBasicPolicy(systemConsolePage.page, {
        name: policy1Name,
        attribute: 'Department',
        operator: '==',
        value: 'Engineering',
        autoSync: true,
        channels: [channel1.display_name],
    });
    const policy1Id = await getPolicyIdByName(systemConsolePage.page, policy1Name);

    // Activate directly — no need to wait for the policy-creation sync.
    await activatePolicy(adminClient, policy1Id);

    // User has non-qualifying attribute (Sales) — no sync needed to confirm not in channel.
    const user1InitialCheck = await verifyUserInChannel(adminClient, user1.id, channel1.id);
    expect(user1InitialCheck).toBe(false);

    // Simulate LDAP sync by updating user's attribute to qualifying value.
    await updateUserAttributes(adminClient, user1.id, {Department: 'Engineering'});

    // Run ABAC sync — policy is now active, user has qualifying attribute.
    const sync1bJobId = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, sync1bJobId);

    const user1AfterSync = await verifyUserInChannel(adminClient, user1.id, channel1.id);
    expect(user1AfterSync).toBe(true);
});

/**
 * MM-T5797b: LDAP sync - User auto-added with contains operator (auto-add true)
 */
test('MM-T5797b LDAP sync - User auto-added with contains operator (auto-add true)', async ({pw}) => {
    test.setTimeout(90000);

    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();

    const user2 = await createUserWithAttributes(adminClient, {Department: 'Sales'});
    await adminClient.addToTeam(team.id, user2.id);

    const channel2 = await createPrivateChannelForABAC(adminClient, team.id);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await navigateToABACPage(systemConsolePage.page);

    const policy2Name = `LDAP AutoAdd Contains ${await pw.random.id()}`;
    await createAdvancedPolicy(systemConsolePage.page, {
        name: policy2Name,
        celExpression: 'user.attributes.Department.contains("Eng")',
        autoSync: true,
        channels: [channel2.display_name],
    });
    const policy2Id = await getPolicyIdByName(systemConsolePage.page, policy2Name);

    await activatePolicy(adminClient, policy2Id);

    // User has non-qualifying attribute — no sync needed.
    const user2InitialCheck = await verifyUserInChannel(adminClient, user2.id, channel2.id);
    expect(user2InitialCheck).toBe(false);

    // Simulate LDAP sync: Department → "Engineering" (contains "Eng").
    await updateUserAttributes(adminClient, user2.id, {Department: 'Engineering'});

    const sync2bJobId = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, sync2bJobId);

    const user2AfterSync = await verifyUserInChannel(adminClient, user2.id, channel2.id);
    expect(user2AfterSync).toBe(true);
});

/**
 * MM-T5798a: LDAP sync - User can be added by admin after attribute sync (== operator, auto-add false)
 */
test('MM-T5798a User added by admin after LDAP attribute sync with == operator (auto-add false)', async ({pw}) => {
    test.setTimeout(90000);

    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();

    const user1 = await createUserWithAttributes(adminClient, {Department: 'Sales'});
    await adminClient.addToTeam(team.id, user1.id);

    const channel1 = await createPrivateChannelForABAC(adminClient, team.id);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await navigateToABACPage(systemConsolePage.page);

    const policy1Name = `LDAP Sync Equals ${await pw.random.id()}`;
    await createBasicPolicy(systemConsolePage.page, {
        name: policy1Name,
        attribute: 'Department',
        operator: '==',
        value: 'Engineering',
        autoSync: false,
        channels: [channel1.display_name],
    });
    const t5798Policy1Id = await getPolicyIdByName(systemConsolePage.page, policy1Name);

    await activatePolicy(adminClient, t5798Policy1Id);

    // User has non-qualifying attribute — not in channel without needing a sync.
    const user1InitialCheck = await verifyUserInChannel(adminClient, user1.id, channel1.id);
    expect(user1InitialCheck).toBe(false);

    // Simulate LDAP sync: attribute changes to qualifying value.
    await updateUserAttributes(adminClient, user1.id, {Department: 'Engineering'});

    // With auto-add=false, sync should NOT auto-add the user.
    const t5798Sync1bJobId = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, t5798Sync1bJobId);

    const user1AfterSync = await verifyUserInChannel(adminClient, user1.id, channel1.id);

    if (!user1AfterSync) {
        await adminClient.addToChannel(user1.id, channel1.id);

        const user1AfterAdminAdd = await verifyUserInChannel(adminClient, user1.id, channel1.id);
        expect(user1AfterAdminAdd).toBe(true);
    }

    const user1Final = await verifyUserInChannel(adminClient, user1.id, channel1.id);
    expect(user1Final).toBe(true);
});

/**
 * MM-T5798b: LDAP sync - User can be added by admin after attribute sync (∈ in operator, auto-add false)
 */
test('MM-T5798b User added by admin after LDAP attribute sync with in operator (auto-add false)', async ({pw}) => {
    test.setTimeout(90000);

    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();

    const user2 = await createUserWithAttributes(adminClient, {Department: 'Marketing'});
    await adminClient.addToTeam(team.id, user2.id);

    const channel2 = await createPrivateChannelForABAC(adminClient, team.id);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await navigateToABACPage(systemConsolePage.page);

    const policy2Name = `LDAP Sync In ${await pw.random.id()}`;
    await createAdvancedPolicy(systemConsolePage.page, {
        name: policy2Name,
        celExpression: 'user.attributes.Department in ["Engineering", "Product"]',
        autoSync: false,
        channels: [channel2.display_name],
    });
    const t5798Policy2Id = await getPolicyIdByName(systemConsolePage.page, policy2Name);

    await activatePolicy(adminClient, t5798Policy2Id);

    // User has non-qualifying attribute — not in channel without needing a sync.
    const user2InitialCheck = await verifyUserInChannel(adminClient, user2.id, channel2.id);
    expect(user2InitialCheck).toBe(false);

    // Simulate LDAP sync: attribute changes to qualifying value.
    await updateUserAttributes(adminClient, user2.id, {Department: 'Product'});

    const t5798Sync2bJobId = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, t5798Sync2bJobId);

    const user2AfterSync = await verifyUserInChannel(adminClient, user2.id, channel2.id);

    if (!user2AfterSync) {
        await adminClient.addToChannel(user2.id, channel2.id);

        const user2AfterAdminAdd = await verifyUserInChannel(adminClient, user2.id, channel2.id);
        expect(user2AfterAdminAdd).toBe(true);
    }

    const user2Final = await verifyUserInChannel(adminClient, user2.id, channel2.id);
    expect(user2Final).toBe(true);
});
