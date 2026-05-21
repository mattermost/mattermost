// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC, navigateToABACPage} from '@mattermost/playwright-lib';

import {createBasicPolicy, getPolicyIdByName} from '../support';

/**
 * @objective E2E coverage for membership policy edit action navigation:
 *   - Clicking Edit in the policy row action menu navigates to the membership policy editor
 *
 * @reference MM-68958: Fix membership policy edit action navigation
 */
test.describe('ABAC Policy Management - Edit Action Navigation', () => {
    /**
     * MM-68958: Edit action in policy row menu navigates to membership policy editor
     *
     * Steps:
     * 1. Enable ABAC and create a membership policy
     * 2. Navigate to System Console > Membership Policies
     * 3. Open a policy row's three-dot action menu
     * 4. Click Edit
     * 5. Verify the URL is /admin_console/system_attributes/membership_policies/edit_policy/<policy_id>
     */
    test('MM-68958 Edit action navigates to membership policy editor', async ({pw}) => {
        test.setTimeout(120000);

        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();

        // Create a test channel for the policy
        const channelName = `abac-edit-nav-test-${pw.random.id()}`;
        const privateChannel = await adminClient.createChannel({
            team_id: team.id,
            name: channelName.toLowerCase().replace(/[^a-z0-9-]/g, ''),
            display_name: channelName,
            type: 'P',
        });

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const page = systemConsolePage.page;

        await navigateToABACPage(page);
        await enableABAC(page);

        // Create a basic membership policy
        const policyName = `Edit-Nav-Test-${pw.random.id()}`;

        await createBasicPolicy(page, {
            name: policyName,
            attribute: 'Department',
            operator: '==',
            value: 'Engineering',
            autoSync: false,
            channels: [privateChannel.display_name],
        });

        // Get the policy ID from the backend
        const policyId = await getPolicyIdByName(adminClient, policyName);
        expect(policyId, 'Policy should be created and have an ID').toBeTruthy();

        // Navigate to Membership Policies list page
        await page.goto('/admin_console/system_attributes/membership_policies', {waitUntil: 'networkidle'});
        await page.waitForTimeout(1000);

        // Search for the policy to ensure it's visible
        const policySearchInput = page.locator('input[placeholder*="Search" i]').first();
        if (await policySearchInput.isVisible({timeout: 3000})) {
            await policySearchInput.fill(policyName);
            await page.waitForTimeout(1000);
        }

        // Find the policy row
        const policyRowLocator = page.locator('tr.clickable, .DataGrid_row').filter({hasText: policyName}).first();
        await policyRowLocator.waitFor({state: 'visible', timeout: 10000});

        // Open the three-dot action menu for the policy
        const actionMenuButton = policyRowLocator
            .locator('button[aria-label*="Actions" i], button:has(i.icon-dots-vertical)')
            .first();
        await actionMenuButton.waitFor({state: 'visible', timeout: 5000});
        await actionMenuButton.click();
        await page.waitForTimeout(500);

        // Click the Edit menu item
        const editMenuItem = page.locator(`[id*="policy-menu-edit-${policyId}"]`).first();
        await editMenuItem.waitFor({state: 'visible', timeout: 5000});

        // Click Edit and wait for navigation
        await editMenuItem.click();

        // Wait for the URL to change to the edit policy page
        await page.waitForURL(`**/admin_console/system_attributes/membership_policies/edit_policy/${policyId}`, {
            timeout: 10000,
        });

        // Verify we're on the edit policy page by checking the URL
        const currentURL = page.url();
        expect(currentURL).toContain(`/admin_console/system_attributes/membership_policies/edit_policy/${policyId}`);

        // Additional verification: Check that the policy editor is loaded
        // The policy editor should have the policy name visible
        const policyNameInput = page.locator('input[placeholder*="name" i], input[value*="Edit-Nav-Test"]').first();
        await expect(policyNameInput).toBeVisible({timeout: 10000});
    });

    /**
     * MM-68958: Row click also navigates to membership policy editor
     *
     * This test verifies that clicking the row (not just the Edit action) also navigates correctly.
     * This behavior should have been working before, but we verify it still works after the fix.
     */
    test('Row click navigates to membership policy editor', async ({pw}) => {
        test.setTimeout(120000);

        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();

        // Create a test channel for the policy
        const channelName = `abac-row-click-test-${pw.random.id()}`;
        const privateChannel = await adminClient.createChannel({
            team_id: team.id,
            name: channelName.toLowerCase().replace(/[^a-z0-9-]/g, ''),
            display_name: channelName,
            type: 'P',
        });

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const page = systemConsolePage.page;

        await navigateToABACPage(page);
        await enableABAC(page);

        // Create a basic membership policy
        const policyName = `Row-Click-Test-${pw.random.id()}`;

        await createBasicPolicy(page, {
            name: policyName,
            attribute: 'Department',
            operator: '==',
            value: 'Sales',
            autoSync: false,
            channels: [privateChannel.display_name],
        });

        // Get the policy ID from the backend
        const policyId = await getPolicyIdByName(adminClient, policyName);
        expect(policyId, 'Policy should be created and have an ID').toBeTruthy();

        // Navigate to Membership Policies list page
        await page.goto('/admin_console/system_attributes/membership_policies', {waitUntil: 'networkidle'});
        await page.waitForTimeout(1000);

        // Search for the policy to ensure it's visible
        const policySearchInput = page.locator('input[placeholder*="Search" i]').first();
        if (await policySearchInput.isVisible({timeout: 3000})) {
            await policySearchInput.fill(policyName);
            await page.waitForTimeout(1000);
        }

        // Find the policy row
        const policyRowLocator = page.locator('tr.clickable, .DataGrid_row').filter({hasText: policyName}).first();
        await policyRowLocator.waitFor({state: 'visible', timeout: 10000});

        // Click the row (not the action menu)
        await policyRowLocator.click();

        // Wait for the URL to change to the edit policy page
        await page.waitForURL(`**/admin_console/system_attributes/membership_policies/edit_policy/${policyId}`, {
            timeout: 10000,
        });

        // Verify we're on the edit policy page
        const currentURL = page.url();
        expect(currentURL).toContain(`/admin_console/system_attributes/membership_policies/edit_policy/${policyId}`);
    });
});
