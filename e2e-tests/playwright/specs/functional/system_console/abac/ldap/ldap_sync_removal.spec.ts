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
 * MM-T5799a: LDAP sync - User removed after attribute removed (startsWith operator, auto-add true)
 */
test('MM-T5799a LDAP sync - User removed with startsWith operator (auto-add true)', async ({pw}) => {
    test.setTimeout(90000);

    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();

    // Create user with qualifying attribute (Department starts with "Eng")
    const user1 = await createUserWithAttributes(adminClient, {Department: 'Engineering'});
    await adminClient.addToTeam(team.id, user1.id);

    const channel1 = await createPrivateChannelForABAC(adminClient, team.id);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await navigateToABACPage(systemConsolePage.page);

    const policy1Name = `LDAP Remove StartsWith ${await pw.random.id()}`;
    const t5799Policy1Id = await createAdvancedPolicy(systemConsolePage.page, {
        name: policy1Name,
        celExpression: 'user.attributes.Department.startsWith("Eng")',
        autoSync: true,
        channels: [channel1.display_name],
    });

    // Activate policy
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, undefined, t5799Policy1Id);
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

    // Run sync - user should be AUTO-ADDED (has Department=Engineering which starts with "Eng")
    const t5799Sync1aJobId = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, t5799Sync1aJobId);

    const user1InitialCheck = await verifyUserInChannel(adminClient, user1.id, channel1.id);
    expect(user1InitialCheck).toBe(true);

    // Simulate LDAP sync by changing Department to value that doesn't start with "Eng"
    await updateUserAttributes(adminClient, user1.id, {Department: 'Sales'});

    // Run ABAC sync job to remove user
    const t5799Sync1bJobId = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, t5799Sync1bJobId);

    // Verify user IS REMOVED from channel
    const user1AfterSync = await verifyUserInChannel(adminClient, user1.id, channel1.id);
    expect(user1AfterSync).toBe(false);
});

/**
 * MM-T5799b: LDAP sync - User removed after attribute removed (== operator two attributes, auto-add true)
 */
test('MM-T5799b LDAP sync - User removed with == operator (auto-add true)', async ({pw}) => {
    test.setTimeout(90000);

    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();

    // Create user with qualifying attribute
    const user2 = await createUserWithAttributes(adminClient, {Department: 'Engineering'});
    await adminClient.addToTeam(team.id, user2.id);

    const channel2 = await createPrivateChannelForABAC(adminClient, team.id);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await navigateToABACPage(systemConsolePage.page);

    const policy2Name = `LDAP Remove TwoAttr ${await pw.random.id()}`;
    const t5799Policy2Id = await createBasicPolicy(systemConsolePage.page, {
        name: policy2Name,
        attribute: 'Department',
        operator: '==',
        value: 'Engineering',
        autoSync: true,
        channels: [channel2.display_name],
    });

    // Activate policy
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, undefined, t5799Policy2Id);
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

    // Run initial sync - user should be AUTO-ADDED
    const t5799Sync2aJobId = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, t5799Sync2aJobId);

    const user2InitialCheck = await verifyUserInChannel(adminClient, user2.id, channel2.id);
    expect(user2InitialCheck).toBe(true);

    // Simulate LDAP sync by removing the Department attribute (changing to non-qualifying value)
    await updateUserAttributes(adminClient, user2.id, {Department: 'Sales'});

    // Run ABAC sync job
    const t5799Sync2bJobId = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, t5799Sync2bJobId);

    // Verify user IS REMOVED from channel
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
    // Create user with Sales department (non-qualifying)
    const user = await createUserWithAttributes(adminClient, {Department: 'Sales'});
    await adminClient.addToTeam(team.id, user.id);

    const privateChannel = await createPrivateChannelForABAC(adminClient, team.id);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await navigateToABACPage(systemConsolePage.page);

    const policyName = `Dynamic Policy ${await pw.random.id()}`;
    const t5800PolicyId = await createBasicPolicy(systemConsolePage.page, {
        name: policyName,
        attribute: 'Department',
        operator: '==',
        value: 'Engineering',
        autoSync: true,
        channels: [privateChannel.display_name],
    });

    // Activate policy
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, undefined, t5800PolicyId);
    const searchInput = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
    await searchInput.waitFor({state: 'visible', timeout: 5000});
    const idMatch = policyName.match(/([a-z0-9]+)$/i);
    const uniqueId = idMatch ? idMatch[1] : policyName;
    await searchInput.fill(uniqueId);
    await systemConsolePage.page.waitForTimeout(300);

    const policyRow = systemConsolePage.page.locator('.policy-name').first();
    const policyId = (await policyRow.getAttribute('id'))?.replace('customDescription-', '');

    if (policyId) {
        await activatePolicy(adminClient, policyId);
    }
    await searchInput.clear();

    // PHASE 1: User should NOT be added (Department=Sales)
    const phase1JobId = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, phase1JobId);

    const phase1InChannel = await verifyUserInChannel(adminClient, user.id, privateChannel.id);
    expect(phase1InChannel).toBe(false);

    // PHASE 2: Change attribute to qualifying value → User auto-added
    await updateUserAttributes(adminClient, user.id, {Department: 'Engineering'});

    const phase2JobId = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, phase2JobId);

    const phase2InChannel = await verifyUserInChannel(adminClient, user.id, privateChannel.id);
    expect(phase2InChannel).toBe(true);

    // PHASE 3: Change attribute back → User auto-removed
    await updateUserAttributes(adminClient, user.id, {Department: 'Marketing'});

    const phase3JobId = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, phase3JobId);

    const phase3InChannel = await verifyUserInChannel(adminClient, user.id, privateChannel.id);
    expect(phase3InChannel).toBe(false);
});
