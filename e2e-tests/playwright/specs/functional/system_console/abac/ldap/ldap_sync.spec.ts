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
    const policy1Id = await createBasicPolicy(systemConsolePage.page, {
        name: policy1Name,
        attribute: 'Department',
        operator: '==',
        value: 'Engineering',
        autoSync: true,
        channels: [channel1.display_name],
    });

    // Activate policy
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, undefined, policy1Id);
    const searchInput = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
    await searchInput.waitFor({state: 'visible', timeout: 5000});
    await searchInput.fill(policy1Name.match(/([a-z0-9]+)$/i)?.[1] || policy1Name);
    await systemConsolePage.page.waitForTimeout(300);

    const policyRow1 = systemConsolePage.page.locator('.policy-name').first();
    const policyId1 = (await policyRow1.getAttribute('id'))?.replace('customDescription-', '');
    if (policyId1) {
        await activatePolicy(adminClient, policyId1);
    }
    await searchInput.clear();

    // Run initial sync - user should NOT be in channel (doesn't have qualifying attribute)
    const sync1aJobId = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, sync1aJobId);

    const user1InitialCheck = await verifyUserInChannel(adminClient, user1.id, channel1.id);
    expect(user1InitialCheck).toBe(false);

    // Simulate LDAP sync by updating user's attribute to qualifying value
    await updateUserAttributes(adminClient, user1.id, {Department: 'Engineering'});

    // Run ABAC sync job to apply policy with new attribute value
    const sync1bJobId = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, sync1bJobId);

    // Verify user IS NOW in channel (auto-added)
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
    const policy2Id = await createAdvancedPolicy(systemConsolePage.page, {
        name: policy2Name,
        celExpression: 'user.attributes.Department.contains("Eng")',
        autoSync: true,
        channels: [channel2.display_name],
    });

    // Activate policy
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, undefined, policy2Id);
    const searchInput = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
    await searchInput.waitFor({state: 'visible', timeout: 5000});
    await searchInput.fill(policy2Name.match(/([a-z0-9]+)$/i)?.[1] || policy2Name);
    await systemConsolePage.page.waitForTimeout(300);

    const policyRow2 = systemConsolePage.page.locator('.policy-name').first();
    const policyId2 = (await policyRow2.getAttribute('id'))?.replace('customDescription-', '');
    if (policyId2) {
        await activatePolicy(adminClient, policyId2);
    }
    await searchInput.clear();

    // Run initial sync - user should NOT be in channel
    const sync2aJobId = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, sync2aJobId);

    const user2InitialCheck = await verifyUserInChannel(adminClient, user2.id, channel2.id);
    expect(user2InitialCheck).toBe(false);

    // Simulate LDAP sync by updating Department to "Engineering" (contains "Eng")
    await updateUserAttributes(adminClient, user2.id, {Department: 'Engineering'});

    // Run ABAC sync job
    const sync2bJobId = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, sync2bJobId);

    // Verify user IS NOW in channel (auto-added)
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
    const t5798Policy1Id = await createBasicPolicy(systemConsolePage.page, {
        name: policy1Name,
        attribute: 'Department',
        operator: '==',
        value: 'Engineering',
        autoSync: false,
        channels: [channel1.display_name],
    });

    // Activate policy
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, undefined, t5798Policy1Id);
    const searchInput = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
    await searchInput.waitFor({state: 'visible', timeout: 5000});
    await searchInput.fill(policy1Name.match(/([a-z0-9]+)$/i)?.[1] || policy1Name);
    await systemConsolePage.page.waitForTimeout(300);

    const policyRow1 = systemConsolePage.page.locator('.policy-name').first();
    const policyId1 = (await policyRow1.getAttribute('id'))?.replace('customDescription-', '');
    if (policyId1) {
        await activatePolicy(adminClient, policyId1);
    }
    await searchInput.clear();

    // Run initial sync - user should NOT be in channel
    const t5798Sync1aJobId = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, t5798Sync1aJobId);

    const user1InitialCheck = await verifyUserInChannel(adminClient, user1.id, channel1.id);
    expect(user1InitialCheck).toBe(false);

    // Simulate LDAP sync by updating user's attribute to qualifying value
    await updateUserAttributes(adminClient, user1.id, {Department: 'Engineering'});

    // Run sync job - with auto-add=false, users should NOT be auto-added
    const t5798Sync1bJobId = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, t5798Sync1bJobId);

    // Verify user behavior after sync
    const user1AfterSync = await verifyUserInChannel(adminClient, user1.id, channel1.id);

    if (!user1AfterSync) {
        await adminClient.addToChannel(user1.id, channel1.id);

        const user1AfterAdminAdd = await verifyUserInChannel(adminClient, user1.id, channel1.id);
        expect(user1AfterAdminAdd).toBe(true);
    }

    // Final verification
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
    const t5798Policy2Id = await createAdvancedPolicy(systemConsolePage.page, {
        name: policy2Name,
        celExpression: 'user.attributes.Department in ["Engineering", "Product"]',
        autoSync: false,
        channels: [channel2.display_name],
    });

    // Activate policy
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, undefined, t5798Policy2Id);
    const searchInput = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
    await searchInput.waitFor({state: 'visible', timeout: 5000});
    await searchInput.fill(policy2Name.match(/([a-z0-9]+)$/i)?.[1] || policy2Name);
    await systemConsolePage.page.waitForTimeout(300);

    const policyRow2 = systemConsolePage.page.locator('.policy-name').first();
    const policyId2 = (await policyRow2.getAttribute('id'))?.replace('customDescription-', '');
    if (policyId2) {
        await activatePolicy(adminClient, policyId2);
    }
    await searchInput.clear();

    // Run initial sync - user should NOT be in channel
    const t5798Sync2aJobId = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, t5798Sync2aJobId);

    const user2InitialCheck = await verifyUserInChannel(adminClient, user2.id, channel2.id);
    expect(user2InitialCheck).toBe(false);

    // Simulate LDAP sync by updating to qualifying value
    await updateUserAttributes(adminClient, user2.id, {Department: 'Product'});

    // Run sync job
    const t5798Sync2bJobId = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, t5798Sync2bJobId);

    // Verify user behavior after sync
    const user2AfterSync = await verifyUserInChannel(adminClient, user2.id, channel2.id);

    if (!user2AfterSync) {
        await adminClient.addToChannel(user2.id, channel2.id);

        const user2AfterAdminAdd = await verifyUserInChannel(adminClient, user2.id, channel2.id);
        expect(user2AfterAdminAdd).toBe(true);
    }

    // Final verification
    const user2Final = await verifyUserInChannel(adminClient, user2.id, channel2.id);
    expect(user2Final).toBe(true);
});
