// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    expect,
    test,
    enableABAC,
    navigateToABACPage,
    runSyncJob,
    verifyUserInChannel,
} from '@mattermost/playwright-lib';

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
    enableUserManagedAttributes,
} from '../support';

/**
 * ABAC Policies - Advanced Policies
 * Tests for advanced policy configurations including multiple attributes, operators, and complex rules
 */
test.describe('ABAC Policies - Advanced Policies', () => {
    /**
     * MM-T5786: Attribute-based access policy using operator variations in Simple mode
     * controls access as specified (one attribute, various operators, with auto-add)
     *
     * @reference https://github.com/mattermost/mattermost-test-management/blob/main/data/test-cases/channels/abac-attribute-based-access/abac-system-admin/MM-T5786.md
     *
     * Tests operators: is not (!=), in, starts with, ends with, contains
     */
    test('MM-T5786 Test policy with various operators in Simple mode', async ({pw}) => {
        // Increase timeout for this test since it tests multiple operators
        test.setTimeout(300000); // 5 minutes for 5 operator steps
        // # Skip test if no license for ABAC
        await pw.skipIfNoLicense();

        // # Setup
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableUserManagedAttributes(adminClient);

        // Delete existing attributes and create fresh
        try {
            const existingFields = await adminClient.getCustomProfileAttributeFields();
            for (const field of existingFields || []) {
                await adminClient.deleteCustomProfileAttributeField(field.id).catch(() => {
                    // Ignore deletion errors
                });
            }
        } catch {
            // Ignore errors
        }

        const attributeFields: CustomProfileAttribute[] = [{name: 'Department', type: 'text', value: ''}];
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributeFields);

        // Create users with different Department values for testing various operators
        // Engineering - for testing matches
        // Sales - for testing non-matches
        const engineerUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Engineering'},
        ]);
        const salesUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Sales'},
        ]);

        await adminClient.addToTeam(team.id, engineerUser.id);
        await adminClient.addToTeam(team.id, salesUser.id);

        // Login as admin
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await navigateToABACPage(systemConsolePage.page);
        await enableABAC(systemConsolePage.page);

        // ============================================================
        // STEP 1: Test "is not" (!=) operator
        // Policy: Department != "Sales" → Engineering matches, Sales doesn't
        // ============================================================

        const channel1 = await createPrivateChannelForABAC(adminClient, team.id);
        await adminClient.addToChannel(salesUser.id, channel1.id); // Sales user in channel initially

        const policy1Name = `IsNot Policy ${pw.random.id()}`;
        await createAdvancedPolicy(systemConsolePage.page, {
            name: policy1Name,
            celExpression: 'user.attributes.Department != "Sales"',
            autoSync: true,
            channels: [channel1.display_name],
        });

        // Test Access Rule - navigate back to policy and verify
        await systemConsolePage.page.waitForTimeout(1000);
        const policyRowForTest1 = systemConsolePage.page.locator('.policy-name').filter({hasText: policy1Name}).first();
        if (await policyRowForTest1.isVisible({timeout: 3000})) {
            await policyRowForTest1.click();
            await systemConsolePage.page.waitForLoadState('networkidle');

            await testAccessRule(systemConsolePage.page, {
                expectedMatchingUsers: [engineerUser.username],
                expectedNonMatchingUsers: [salesUser.username],
            });

            await navigateToABACPage(systemConsolePage.page);
        }

        await waitForLatestSyncJob(systemConsolePage.page);

        // Get policy ID and activate
        const searchInput1 = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
        await searchInput1.fill('IsNot');
        await systemConsolePage.page.waitForTimeout(1000);
        const policyRow1 = systemConsolePage.page.locator('.policy-name').first();
        const policyId1 = (await policyRow1.getAttribute('id'))?.replace('customDescription-', '');
        if (policyId1) {
            await activatePolicy(adminClient, policyId1);
            await runSyncJob(systemConsolePage.page);
            await waitForLatestSyncJob(systemConsolePage.page);
        }
        await searchInput1.clear();

        // Verify: Engineer should be added (satisfies != Sales), Sales should be removed
        const eng1InChannel = await verifyUserInChannel(adminClient, engineerUser.id, channel1.id);
        const sales1InChannel = await verifyUserInChannel(adminClient, salesUser.id, channel1.id);
        expect(eng1InChannel).toBe(true);
        expect(sales1InChannel).toBe(false);

        // ============================================================
        // STEP 2: Test "in" operator
        // Policy: Department in ["Engineering", "DevOps"] → Engineering matches
        // ============================================================

        await navigateToABACPage(systemConsolePage.page);
        const channel2 = await createPrivateChannelForABAC(adminClient, team.id);
        await adminClient.addToChannel(salesUser.id, channel2.id); // Sales user in channel initially

        const policy2Name = `In Policy ${pw.random.id()}`;
        await createAdvancedPolicy(systemConsolePage.page, {
            name: policy2Name,
            celExpression: 'user.attributes.Department in ["Engineering", "DevOps"]',
            autoSync: true,
            channels: [channel2.display_name],
        });

        // Test Access Rule - navigate back to policy and verify
        await systemConsolePage.page.waitForTimeout(1000);
        const policyRowForTest2 = systemConsolePage.page.locator('.policy-name').filter({hasText: policy2Name}).first();
        if (await policyRowForTest2.isVisible({timeout: 3000})) {
            await policyRowForTest2.click();
            await systemConsolePage.page.waitForLoadState('networkidle');

            await testAccessRule(systemConsolePage.page, {
                expectedMatchingUsers: [engineerUser.username],
                expectedNonMatchingUsers: [salesUser.username],
            });

            await navigateToABACPage(systemConsolePage.page);
        }

        await waitForLatestSyncJob(systemConsolePage.page);

        const searchInput2 = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
        await searchInput2.fill('In Policy');
        await systemConsolePage.page.waitForTimeout(1000);
        const policyRow2 = systemConsolePage.page.locator('.policy-name').first();
        const policyId2 = (await policyRow2.getAttribute('id'))?.replace('customDescription-', '');
        if (policyId2) {
            await activatePolicy(adminClient, policyId2);
            await runSyncJob(systemConsolePage.page);
            await waitForLatestSyncJob(systemConsolePage.page);
        }
        await searchInput2.clear();

        const eng2InChannel = await verifyUserInChannel(adminClient, engineerUser.id, channel2.id);
        const sales2InChannel = await verifyUserInChannel(adminClient, salesUser.id, channel2.id);
        expect(eng2InChannel).toBe(true);
        expect(sales2InChannel).toBe(false);

        // ============================================================
        // STEP 3: Test "starts with" operator
        // Policy: Department.startsWith("Eng") → Engineering matches
        // ============================================================

        await navigateToABACPage(systemConsolePage.page);
        const channel3 = await createPrivateChannelForABAC(adminClient, team.id);
        await adminClient.addToChannel(salesUser.id, channel3.id);

        const policy3Name = `StartsWith Policy ${pw.random.id()}`;
        await createAdvancedPolicy(systemConsolePage.page, {
            name: policy3Name,
            celExpression: 'user.attributes.Department.startsWith("Eng")',
            autoSync: true,
            channels: [channel3.display_name],
        });

        // Test Access Rule - navigate back to policy and verify
        await systemConsolePage.page.waitForTimeout(1000);
        const policyRowForTest3 = systemConsolePage.page.locator('.policy-name').filter({hasText: policy3Name}).first();
        if (await policyRowForTest3.isVisible({timeout: 3000})) {
            await policyRowForTest3.click();
            await systemConsolePage.page.waitForLoadState('networkidle');

            await testAccessRule(systemConsolePage.page, {
                expectedMatchingUsers: [engineerUser.username],
                expectedNonMatchingUsers: [salesUser.username],
            });

            await navigateToABACPage(systemConsolePage.page);
        }

        await waitForLatestSyncJob(systemConsolePage.page);

        const searchInput3 = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
        await searchInput3.fill('StartsWith');
        await systemConsolePage.page.waitForTimeout(1000);
        const policyRow3 = systemConsolePage.page.locator('.policy-name').first();
        const policyId3 = (await policyRow3.getAttribute('id'))?.replace('customDescription-', '');
        if (policyId3) {
            await activatePolicy(adminClient, policyId3);
            await runSyncJob(systemConsolePage.page);
            await waitForLatestSyncJob(systemConsolePage.page);
        }
        await searchInput3.clear();

        const eng3InChannel = await verifyUserInChannel(adminClient, engineerUser.id, channel3.id);
        const sales3InChannel = await verifyUserInChannel(adminClient, salesUser.id, channel3.id);
        expect(eng3InChannel).toBe(true);
        expect(sales3InChannel).toBe(false);

        // ============================================================
        // STEP 4: Test "ends with" operator
        // Policy: Department.endsWith("ing") → Engineering matches
        // ============================================================

        await navigateToABACPage(systemConsolePage.page);
        const channel4 = await createPrivateChannelForABAC(adminClient, team.id);
        await adminClient.addToChannel(salesUser.id, channel4.id);

        const policy4Name = `EndsWith Policy ${pw.random.id()}`;
        await createAdvancedPolicy(systemConsolePage.page, {
            name: policy4Name,
            celExpression: 'user.attributes.Department.endsWith("ing")',
            autoSync: true,
            channels: [channel4.display_name],
        });

        // Test Access Rule - navigate back to policy and verify
        await systemConsolePage.page.waitForTimeout(1000);
        const policyRowForTest4 = systemConsolePage.page.locator('.policy-name').filter({hasText: policy4Name}).first();
        if (await policyRowForTest4.isVisible({timeout: 3000})) {
            await policyRowForTest4.click();
            await systemConsolePage.page.waitForLoadState('networkidle');

            await testAccessRule(systemConsolePage.page, {
                expectedMatchingUsers: [engineerUser.username],
                expectedNonMatchingUsers: [salesUser.username],
            });

            await navigateToABACPage(systemConsolePage.page);
        }

        await waitForLatestSyncJob(systemConsolePage.page);

        const searchInput4 = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
        await searchInput4.fill('EndsWith');
        await systemConsolePage.page.waitForTimeout(1000);
        const policyRow4 = systemConsolePage.page.locator('.policy-name').first();
        const policyId4 = (await policyRow4.getAttribute('id'))?.replace('customDescription-', '');
        if (policyId4) {
            await activatePolicy(adminClient, policyId4);
            await runSyncJob(systemConsolePage.page);
            await waitForLatestSyncJob(systemConsolePage.page);
        }
        await searchInput4.clear();

        const eng4InChannel = await verifyUserInChannel(adminClient, engineerUser.id, channel4.id);
        const sales4InChannel = await verifyUserInChannel(adminClient, salesUser.id, channel4.id);
        expect(eng4InChannel).toBe(true);
        expect(sales4InChannel).toBe(false);

        // ============================================================
        // STEP 5: Test "contains" operator
        // Policy: Department.contains("gineer") → Engineering matches
        // ============================================================

        await navigateToABACPage(systemConsolePage.page);
        const channel5 = await createPrivateChannelForABAC(adminClient, team.id);
        await adminClient.addToChannel(salesUser.id, channel5.id);

        const policy5Name = `Contains Policy ${pw.random.id()}`;
        await createAdvancedPolicy(systemConsolePage.page, {
            name: policy5Name,
            celExpression: 'user.attributes.Department.contains("gineer")',
            autoSync: true,
            channels: [channel5.display_name],
        });

        // Test Access Rule - navigate back to policy and verify
        await systemConsolePage.page.waitForTimeout(1000);
        const policyRowForTest5 = systemConsolePage.page.locator('.policy-name').filter({hasText: policy5Name}).first();
        if (await policyRowForTest5.isVisible({timeout: 3000})) {
            await policyRowForTest5.click();
            await systemConsolePage.page.waitForLoadState('networkidle');

            await testAccessRule(systemConsolePage.page, {
                expectedMatchingUsers: [engineerUser.username],
                expectedNonMatchingUsers: [salesUser.username],
            });

            await navigateToABACPage(systemConsolePage.page);
        }

        await waitForLatestSyncJob(systemConsolePage.page);

        const searchInput5 = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
        await searchInput5.fill('Contains');
        await systemConsolePage.page.waitForTimeout(1000);
        const policyRow5 = systemConsolePage.page.locator('.policy-name').first();
        const policyId5 = (await policyRow5.getAttribute('id'))?.replace('customDescription-', '');
        if (policyId5) {
            await activatePolicy(adminClient, policyId5);
            await runSyncJob(systemConsolePage.page);
            await waitForLatestSyncJob(systemConsolePage.page);
        }
        await searchInput5.clear();

        const eng5InChannel = await verifyUserInChannel(adminClient, engineerUser.id, channel5.id);
        const sales5InChannel = await verifyUserInChannel(adminClient, salesUser.id, channel5.id);
        expect(eng5InChannel).toBe(true);
        expect(sales5InChannel).toBe(false);
    });
});
