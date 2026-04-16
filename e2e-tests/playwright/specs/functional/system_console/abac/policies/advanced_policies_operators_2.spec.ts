// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, navigateToABACPage, runSyncJob, verifyUserInChannel} from '@mattermost/playwright-lib';

import {
    CustomProfileAttribute,
    setupCustomProfileAttributeFields,
} from '../../../channels/custom_profile_attributes/helpers';
import {
    createUserForABAC,
    testAccessRule,
    createPrivateChannelForABAC,
    createAdvancedPolicy,
    activatePolicy,
    waitForLatestSyncJob,
    getPolicyIdByName,
} from '../support';

/**
 * MM-T5786 (4/5): "ends with" operator — Department.endsWith("ing") with auto-add
 *
 * @reference https://github.com/mattermost/mattermost-test-management/blob/main/data/test-cases/channels/abac-attribute-based-access/abac-system-admin/MM-T5786.md
 */
test('MM-T5786 Test "ends with" operator in Simple mode', async ({pw}) => {
    test.setTimeout(120000);
    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();

    const attributeFields: CustomProfileAttribute[] = [{name: 'Department', type: 'text', value: ''}];
    const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributeFields);

    const engineerUser = await createUserForABAC(adminClient, attributeFieldsMap, [
        {name: 'Department', type: 'text', value: 'Engineering'},
    ]);
    const salesUser = await createUserForABAC(adminClient, attributeFieldsMap, [
        {name: 'Department', type: 'text', value: 'Sales'},
    ]);
    await adminClient.addToTeam(team.id, engineerUser.id);
    await adminClient.addToTeam(team.id, salesUser.id);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await navigateToABACPage(systemConsolePage.page);

    const channel = await createPrivateChannelForABAC(adminClient, team.id);
    await adminClient.addToChannel(salesUser.id, channel.id);

    const policyName = `EndsWith Policy ${await pw.random.id()}`;
    await createAdvancedPolicy(systemConsolePage.page, {
        name: policyName,
        celExpression: 'user.attributes.Department.endsWith("ing")',
        autoSync: true,
        channels: [channel.display_name],
    });
    const policyId = await getPolicyIdByName(systemConsolePage.page, policyName);

    await systemConsolePage.page.waitForTimeout(1000);
    const policyRowForTest = systemConsolePage.page.locator('.policy-name').filter({hasText: policyName}).first();
    if (await policyRowForTest.isVisible({timeout: 3000})) {
        await policyRowForTest.click();
        await systemConsolePage.page.waitForLoadState('networkidle');
        await testAccessRule(systemConsolePage.page, {
            expectedMatchingUsers: [engineerUser.username],
            expectedNonMatchingUsers: [salesUser.username],
        });
        await navigateToABACPage(systemConsolePage.page);
    }

    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, undefined, policyId);

    await activatePolicy(adminClient, policyId);
    const syncJobId = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, syncJobId);

    const engInChannel = await verifyUserInChannel(adminClient, engineerUser.id, channel.id);
    const salesInChannel = await verifyUserInChannel(adminClient, salesUser.id, channel.id);
    expect(engInChannel).toBe(true);
    expect(salesInChannel).toBe(false);
});

/**
 * MM-T5786 (5/5): "contains" operator — Department.contains("gineer") with auto-add
 *
 * @reference https://github.com/mattermost/mattermost-test-management/blob/main/data/test-cases/channels/abac-attribute-based-access/abac-system-admin/MM-T5786.md
 */
test('MM-T5786 Test "contains" operator in Simple mode', async ({pw}) => {
    test.setTimeout(120000);
    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();

    const attributeFields: CustomProfileAttribute[] = [{name: 'Department', type: 'text', value: ''}];
    const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributeFields);

    const engineerUser = await createUserForABAC(adminClient, attributeFieldsMap, [
        {name: 'Department', type: 'text', value: 'Engineering'},
    ]);
    const salesUser = await createUserForABAC(adminClient, attributeFieldsMap, [
        {name: 'Department', type: 'text', value: 'Sales'},
    ]);
    await adminClient.addToTeam(team.id, engineerUser.id);
    await adminClient.addToTeam(team.id, salesUser.id);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await navigateToABACPage(systemConsolePage.page);

    const channel = await createPrivateChannelForABAC(adminClient, team.id);
    await adminClient.addToChannel(salesUser.id, channel.id);

    const policyName = `Contains Policy ${await pw.random.id()}`;
    await createAdvancedPolicy(systemConsolePage.page, {
        name: policyName,
        celExpression: 'user.attributes.Department.contains("gineer")',
        autoSync: true,
        channels: [channel.display_name],
    });
    const policyId = await getPolicyIdByName(systemConsolePage.page, policyName);

    await systemConsolePage.page.waitForTimeout(1000);
    const policyRowForTest = systemConsolePage.page.locator('.policy-name').filter({hasText: policyName}).first();
    if (await policyRowForTest.isVisible({timeout: 3000})) {
        await policyRowForTest.click();
        await systemConsolePage.page.waitForLoadState('networkidle');
        await testAccessRule(systemConsolePage.page, {
            expectedMatchingUsers: [engineerUser.username],
            expectedNonMatchingUsers: [salesUser.username],
        });
        await navigateToABACPage(systemConsolePage.page);
    }

    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, undefined, policyId);

    await activatePolicy(adminClient, policyId);
    const syncJobId = await runSyncJob(systemConsolePage.page);
    await waitForLatestSyncJob(systemConsolePage.page, 5, undefined, syncJobId);

    const engInChannel = await verifyUserInChannel(adminClient, engineerUser.id, channel.id);
    const salesInChannel = await verifyUserInChannel(adminClient, salesUser.id, channel.id);
    expect(engInChannel).toBe(true);
    expect(salesInChannel).toBe(false);
});
