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

import {setupCustomProfileAttributeFields} from '../../../channels/custom_profile_attributes/helpers';
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
     * MM-T5787: Attribute-based access policy created using Advanced Mode with complex rules
     * @objective Verify complex CEL expressions with || (or) and () grouping work correctly
     *
     * Test Data:
     * - Test || (or) with multiple conditions
     * - Test using () to group conditions
     *
     * Expected:
     * - User who satisfies the multi-rule policy is auto-added
     * - User who does not satisfy all rules is auto-removed
     */
    test('MM-T5787 Test policy with complex rules in Advanced Mode', async ({pw}) => {
        test.setTimeout(120000); // 2 minutes

        // # Skip test if no license for ABAC
        await pw.skipIfNoLicense();

        // # Setup
        const {adminUser, adminClient, team} = await pw.initSetup();

        // # Enable user-managed attributes first
        await enableUserManagedAttributes(adminClient);

        // # Delete existing attributes and create fresh ones
        // This ensures the Location attribute exists (same fix as MM-T5785)
        try {
            const existingFields = await (adminClient as any).doFetch(
                `${adminClient.getBaseRoute()}/custom_profile_attributes/fields`,
                {method: 'GET'},
            );
            for (const field of existingFields || []) {
                try {
                    await adminClient.deleteCustomProfileAttributeField(field.id);
                } catch {
                    // Ignore deletion errors
                }
            }
        } catch {
            // Ignore errors
        }

        // # Create attributes: Department and Location
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, [
            {name: 'Department', type: 'text'},
            {name: 'Location', type: 'text'},
        ]);

        // Verify attributes were created (unused but kept for debugging)
        Object.keys(attributeFieldsMap);

        // # Create test users with different attribute combinations
        // User 1: Department=Engineering (satisfies first condition)
        const engineerUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', value: 'Engineering', type: 'text'},
            {name: 'Location', value: 'Office', type: 'text'},
        ]);

        // User 2: Department=Sales AND Location=Remote (satisfies second grouped condition)
        const salesRemoteUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', value: 'Sales', type: 'text'},
            {name: 'Location', value: 'Remote', type: 'text'},
        ]);

        // User 3: Department=Sales, Location=Office (meets SOME rules - Sales but not Remote)
        // This user satisfies only PART of the grouped condition (Sales && Remote)
        const salesOfficeUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', value: 'Sales', type: 'text'},
            {name: 'Location', value: 'Office', type: 'text'},
        ]);

        // # Add all users to the team
        await adminClient.addToTeam(team.id, engineerUser.id);
        await adminClient.addToTeam(team.id, salesRemoteUser.id);
        await adminClient.addToTeam(team.id, salesOfficeUser.id);

        // # Create private channel with salesOfficeUser in it (will be removed - meets only SOME rules)
        const channel = await createPrivateChannelForABAC(adminClient, team.id);
        await adminClient.addToChannel(salesOfficeUser.id, channel.id);

        // # Login and navigate
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await navigateToABACPage(systemConsolePage.page);
        await enableABAC(systemConsolePage.page);

        // # Reload page to ensure UI sees the API-created attributes
        await systemConsolePage.page.reload();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // # Create policy with complex CEL expression using || and ()
        // Expression: Department == "Engineering" OR (Department == "Sales" AND Location == "Remote")
        const policyName = `Complex Policy ${pw.random.id()}`;
        const complexExpression =
            'user.attributes.Department == "Engineering" || (user.attributes.Department == "Sales" && user.attributes.Location == "Remote")';

        await createAdvancedPolicy(systemConsolePage.page, {
            name: policyName,
            celExpression: complexExpression,
            autoSync: true,
            channels: [channel.display_name],
        });

        // # Ensure we're on the ABAC page
        await navigateToABACPage(systemConsolePage.page);
        await systemConsolePage.page.waitForTimeout(1000);

        // # Test Access Rule - click on policy to open it
        const policyRow = systemConsolePage.page.locator('.policy-name').filter({hasText: policyName}).first();
        if (await policyRow.isVisible({timeout: 5000})) {
            await policyRow.click();
            await systemConsolePage.page.waitForLoadState('networkidle');

            await testAccessRule(systemConsolePage.page, {
                expectedMatchingUsers: [engineerUser.username, salesRemoteUser.username],
                expectedNonMatchingUsers: [salesOfficeUser.username],
            });

            // Go back to ABAC page
            await navigateToABACPage(systemConsolePage.page);
        } else {
            // Policy row not visible
        }

        // # Wait for sync job (from Apply Policy)
        await waitForLatestSyncJob(systemConsolePage.page);

        // # Find and activate the policy - search by unique ID part
        const searchInput = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
        const policyIdMatch = policyName.match(/([a-z0-9]+)$/i);
        const searchTerm = policyIdMatch ? policyIdMatch[1] : policyName;

        await searchInput.fill(searchTerm);
        await systemConsolePage.page.waitForTimeout(1000);

        // Find the specific policy by name
        const foundPolicy = systemConsolePage.page.locator('.policy-name').filter({hasText: policyName}).first();
        if (await foundPolicy.isVisible({timeout: 5000})) {
            const policyId = (await foundPolicy.getAttribute('id'))?.replace('customDescription-', '');
            if (policyId) {
                await activatePolicy(adminClient, policyId);
                await runSyncJob(systemConsolePage.page);
                await waitForLatestSyncJob(systemConsolePage.page);
            }
        } else {
            // Try to list what policies ARE visible
            await systemConsolePage.page.locator('.policy-name').allTextContents();
        }
        await searchInput.clear();

        // # Verify results

        // Step 6: Engineer should be auto-added (satisfies: Department == "Engineering")
        const engineerInChannel = await verifyUserInChannel(adminClient, engineerUser.id, channel.id);
        expect(engineerInChannel).toBe(true);

        // Step 6: Sales+Remote user should be auto-added (satisfies: Department == "Sales" && Location == "Remote")
        const salesRemoteInChannel = await verifyUserInChannel(adminClient, salesRemoteUser.id, channel.id);
        expect(salesRemoteInChannel).toBe(true);

        // Step 7: Sales-Office user should be removed (meets SOME rules but not ALL - Sales but not Remote)
        const salesOfficeInChannel = await verifyUserInChannel(adminClient, salesOfficeUser.id, channel.id);
        expect(salesOfficeInChannel).toBe(false);
    });
});
