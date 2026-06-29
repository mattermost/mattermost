// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, navigateToABACPage, runSyncJob, verifyUserInChannel} from '@mattermost/playwright-lib';

import type {CustomProfileAttribute} from '../../../channels/custom_profile_attributes/helpers';
import {setupCustomProfileAttributeFields} from '../../../channels/custom_profile_attributes/helpers';
import {
    ensureUserAttributes,
    createUserForABAC,
    testAccessRule,
    createPrivateChannelForABAC,
    createAdvancedPolicy,
    activatePolicy,
    waitForPolicySyncJob,
    getPolicyIdByName,
} from '../support';

/**
 * MM-T5786 (1/5): "is not" (!=) operator — Department != "Sales" with auto-add
 *
 * @reference https://github.com/mattermost/mattermost-test-management/blob/main/data/test-cases/channels/abac-attribute-based-access/abac-system-admin/MM-T5786.md
 */
test('MM-T5786 Test "is not" (!=) operator in Simple mode', async ({pw}) => {
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
    const {page} = systemConsolePage;
    await navigateToABACPage(page);

    const channel = await createPrivateChannelForABAC(adminClient, team.id);
    await adminClient.addToChannel(salesUser.id, channel.id);

    await ensureUserAttributes(adminClient);
    const policyName = `IsNot Policy ${await pw.random.id()}`;
    await createAdvancedPolicy(page, {
        name: policyName,
        celExpression: 'user.attributes.Department != "Sales"',
        autoSync: true,
        channels: [channel.display_name],
    });
    const policyId = (await getPolicyIdByName(adminClient, policyName))!;

    await page.waitForTimeout(1000);
    await systemConsolePage.policyList.searchInput.waitFor({state: 'visible', timeout: 5000});
    await systemConsolePage.policyList.searchPolicy(policyName);
    await page.waitForTimeout(500);
    const policyRowForTest = systemConsolePage.policyList.getPolicyRowByName(policyName);
    if (await policyRowForTest.isVisible({timeout: 3000})) {
        await policyRowForTest.click();
        await page.waitForLoadState('networkidle');
        await testAccessRule(page, {
            expectedMatchingUsers: [engineerUser.username],
            expectedNonMatchingUsers: [salesUser.username],
        });
        await navigateToABACPage(page);
    }

    await activatePolicy(adminClient, policyId);
    await runSyncJob(page);
    await waitForPolicySyncJob(adminClient, policyId);

    const engInChannel = await verifyUserInChannel(adminClient, engineerUser.id, channel.id);
    const salesInChannel = await verifyUserInChannel(adminClient, salesUser.id, channel.id);
    expect(engInChannel).toBe(true);
    expect(salesInChannel).toBe(false);
});

/**
 * MM-T5786 (2/5): "in" operator — Department in ["Engineering", "DevOps"] with auto-add
 *
 * @reference https://github.com/mattermost/mattermost-test-management/blob/main/data/test-cases/channels/abac-attribute-based-access/abac-system-admin/MM-T5786.md
 */
test('MM-T5786 Test "in" operator in Simple mode', async ({pw}) => {
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
    const {page} = systemConsolePage;
    await navigateToABACPage(page);

    const channel = await createPrivateChannelForABAC(adminClient, team.id);
    await adminClient.addToChannel(salesUser.id, channel.id);

    await ensureUserAttributes(adminClient);
    const policyName = `In Policy ${await pw.random.id()}`;
    await createAdvancedPolicy(page, {
        name: policyName,
        celExpression: 'user.attributes.Department in ["Engineering", "DevOps"]',
        autoSync: true,
        channels: [channel.display_name],
    });
    const policyId = (await getPolicyIdByName(adminClient, policyName))!;

    await page.waitForTimeout(1000);
    await systemConsolePage.policyList.searchInput.waitFor({state: 'visible', timeout: 5000});
    await systemConsolePage.policyList.searchPolicy(policyName);
    await page.waitForTimeout(500);
    const policyRowForTest = systemConsolePage.policyList.getPolicyRowByName(policyName);
    if (await policyRowForTest.isVisible({timeout: 3000})) {
        await policyRowForTest.click();
        await page.waitForLoadState('networkidle');
        await testAccessRule(page, {
            expectedMatchingUsers: [engineerUser.username],
            expectedNonMatchingUsers: [salesUser.username],
        });
        await navigateToABACPage(page);
    }

    await activatePolicy(adminClient, policyId);
    await runSyncJob(page);
    await waitForPolicySyncJob(adminClient, policyId);

    const engInChannel = await verifyUserInChannel(adminClient, engineerUser.id, channel.id);
    const salesInChannel = await verifyUserInChannel(adminClient, salesUser.id, channel.id);
    expect(engInChannel).toBe(true);
    expect(salesInChannel).toBe(false);
});

/**
 * MM-T5786 (3/5): "starts with" operator — Department.startsWith("Eng") with auto-add
 *
 * @reference https://github.com/mattermost/mattermost-test-management/blob/main/data/test-cases/channels/abac-attribute-based-access/abac-system-admin/MM-T5786.md
 */
test('MM-T5786 Test "starts with" operator in Simple mode', async ({pw}) => {
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
    const {page} = systemConsolePage;
    await navigateToABACPage(page);

    const channel = await createPrivateChannelForABAC(adminClient, team.id);
    await adminClient.addToChannel(salesUser.id, channel.id);

    await ensureUserAttributes(adminClient);
    const policyName = `StartsWith Policy ${await pw.random.id()}`;
    await createAdvancedPolicy(page, {
        name: policyName,
        celExpression: 'user.attributes.Department.startsWith("Eng")',
        autoSync: true,
        channels: [channel.display_name],
    });
    const policyId = (await getPolicyIdByName(adminClient, policyName))!;

    await page.waitForTimeout(1000);
    await systemConsolePage.policyList.searchInput.waitFor({state: 'visible', timeout: 5000});
    await systemConsolePage.policyList.searchPolicy(policyName);
    await page.waitForTimeout(500);
    const policyRowForTest = systemConsolePage.policyList.getPolicyRowByName(policyName);
    if (await policyRowForTest.isVisible({timeout: 3000})) {
        await policyRowForTest.click();
        await page.waitForLoadState('networkidle');
        await testAccessRule(page, {
            expectedMatchingUsers: [engineerUser.username],
            expectedNonMatchingUsers: [salesUser.username],
        });
        await navigateToABACPage(page);
    }

    await activatePolicy(adminClient, policyId);
    await runSyncJob(page);
    await waitForPolicySyncJob(adminClient, policyId);

    const engInChannel = await verifyUserInChannel(adminClient, engineerUser.id, channel.id);
    const salesInChannel = await verifyUserInChannel(adminClient, salesUser.id, channel.id);
    expect(engInChannel).toBe(true);
    expect(salesInChannel).toBe(false);
});
