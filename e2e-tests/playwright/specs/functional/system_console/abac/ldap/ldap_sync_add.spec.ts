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
    waitForLatestSyncJob,
    getPolicyIdByName,
} from '../support';

/**
 * MM-T5797a: LDAP sync - User auto-added with `= is` operator (auto-add true)
 *
 * 1. Policy with Department == Engineering, auto-add=true
 * 2. User has non-qualifying attribute (Sales) → not added on first sync
 * 3. Attribute updated to Engineering (simulating LDAP sync)
 * 4. Next sync auto-adds the user
 */
test('MM-T5797a LDAP sync - User auto-added with == operator (auto-add true)', async ({pw}) => {
    test.setTimeout(120000);
    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();
    await ensureUserAttributes(adminClient, ['Department']);

    const user = await createUserWithAttributes(adminClient, {Department: 'Sales'});
    await adminClient.addToTeam(team.id, user.id);

    const channel = await createPrivateChannelForABAC(adminClient, team.id);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await navigateToABACPage(systemConsolePage.page);
    await enableABAC(systemConsolePage.page);

    const policyName = `LDAP AutoAdd Equals ${await pw.random.id()}`;
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

    // Initial sync — user has non-qualifying attribute, should not be added.
    // Capture exact job ID so we poll the right job, not the most-recent row
    // (which may belong to a concurrent shard's sync job under PW_WORKERS >= 2).
    const syncJob5797a1 = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, undefined, syncJob5797a1);

    // Poll: sync job marks itself success before channel_members write is committed.
    await expect
        .poll(() => verifyUserInChannel(adminClient, user.id, channel.id), {
            timeout: 15_000,
            intervals: [500, 1000, 2000],
            message: 'User should NOT be in channel after first sync (Department=Sales)',
        })
        .toBe(false);

    // Simulate LDAP sync: update attribute to qualifying value.
    await updateUserAttributes(adminClient, user.id, {Department: 'Engineering'});

    // Sync again — user now qualifies and should be auto-added.
    const syncJob5797a2 = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, undefined, syncJob5797a2);

    await expect
        .poll(() => verifyUserInChannel(adminClient, user.id, channel.id), {
            timeout: 15_000,
            intervals: [500, 1000, 2000],
            message: 'User should be in channel after second sync (Department=Engineering)',
        })
        .toBe(true);
});

/**
 * MM-T5797b: LDAP sync - User auto-added with `contains` operator (auto-add true)
 *
 * 1. Policy with Department.contains("Eng"), auto-add=true
 * 2. User has non-qualifying attribute (Sales) → not added on first sync
 * 3. Attribute updated to Engineering (simulating LDAP sync)
 * 4. Next sync auto-adds the user
 */
test('MM-T5797b LDAP sync - User auto-added with contains operator (auto-add true)', async ({pw}) => {
    test.setTimeout(120000);
    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();
    await ensureUserAttributes(adminClient, ['Department']);

    const user = await createUserWithAttributes(adminClient, {Department: 'Sales'});
    await adminClient.addToTeam(team.id, user.id);

    const channel = await createPrivateChannelForABAC(adminClient, team.id);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await navigateToABACPage(systemConsolePage.page);
    await enableABAC(systemConsolePage.page);

    const policyName = `LDAP AutoAdd Contains ${await pw.random.id()}`;
    await createAdvancedPolicy(systemConsolePage.page, {
        name: policyName,
        celExpression: 'user.attributes.Department.contains("Eng")',
        autoSync: true,
        channels: [channel.display_name],
    });

    const policyId = (await getPolicyIdByName(adminClient, policyName))!;
    await activatePolicy(adminClient, policyId);

    // Initial sync — user has non-qualifying attribute, should not be added.
    const syncJob5797b1 = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, undefined, syncJob5797b1);

    await expect
        .poll(() => verifyUserInChannel(adminClient, user.id, channel.id), {
            timeout: 15_000,
            intervals: [500, 1000, 2000],
            message: 'User should NOT be in channel after first sync (Department=Sales)',
        })
        .toBe(false);

    // Simulate LDAP sync: update Department to value containing "Eng".
    await updateUserAttributes(adminClient, user.id, {Department: 'Engineering'});

    // Sync again — user now qualifies and should be auto-added.
    const syncJob5797b2 = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, undefined, syncJob5797b2);

    await expect
        .poll(() => verifyUserInChannel(adminClient, user.id, channel.id), {
            timeout: 15_000,
            intervals: [500, 1000, 2000],
            message: 'User should be in channel after second sync (Department=Engineering)',
        })
        .toBe(true);
});
