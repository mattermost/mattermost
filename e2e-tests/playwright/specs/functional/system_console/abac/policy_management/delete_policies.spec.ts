// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC, navigateToABACPage} from '@mattermost/playwright-lib';

import {
    CustomProfileAttribute,
    setupCustomProfileAttributeFields,
} from '../../../channels/custom_profile_attributes/helpers';
import {createPrivateChannelForABAC, createBasicPolicy, enableUserManagedAttributes} from '../support';

/**
 * ABAC Policy Management - Delete Policies
 * Tests for deleting ABAC policies
 */
test.describe('ABAC Policy Management - Delete Policies', () => {
    /**
     * MM-T5793: Attribute-based access policy cannot be deleted if it is applied to any channels
     *
     * Step 1:
     * 1. As system admin, go to ABAC page and click three-dot menu on a policy APPLIED to a channel
     * 2. Observe Delete is DISABLED
     * 3. Click three-dot menu on a policy NOT applied to any channels
     * 4. Click Delete
     *
     * Expected:
     * - Policy applied to a channel CANNOT be deleted (Delete is disabled)
     * - Policy NOT applied to any channels CAN be deleted
     */
    test('MM-T5793 Policy with channels cannot be deleted, policy without channels can be deleted', async ({pw}) => {
        test.setTimeout(120000);

        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();

        // Enable user-managed attributes
        await enableUserManagedAttributes(adminClient);

        // Set up a basic attribute field
        const attributeFields: CustomProfileAttribute[] = [{name: 'Department', type: 'text', value: ''}];
        await setupCustomProfileAttributeFields(adminClient, attributeFields);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const page = systemConsolePage.page;

        await navigateToABACPage(page);
        await enableABAC(page);

        // ===========================================
        // Create two policies:
        // 1. policyWithChannel - has a channel assigned
        // 2. policyWithoutChannel - has NO channels assigned
        // ===========================================
        const uniqueId = await pw.random.id();
        const policyWithChannelName = `ABAC-WithChannel-${uniqueId}`;
        const policyWithoutChannelName = `ABAC-NoChannel-${uniqueId}`;

        // Create a channel for the first policy
        const team = (await adminClient.getMyTeams())[0];
        const privateChannel = await createPrivateChannelForABAC(adminClient, team.id);

        // Create policy WITH channel
        await createBasicPolicy(page, {
            name: policyWithChannelName,
            attribute: 'Department',
            operator: '==',
            value: 'Engineering',
            autoSync: false,
            channels: [privateChannel.display_name],
        });

        // Navigate back to ABAC page
        await navigateToABACPage(page);
        await page.waitForTimeout(1000);

        // Create policy WITHOUT channel using UI (Advanced mode)
        // We'll create the policy, save it without channels, then remove channels via UI

        // Click Add policy
        const addPolicyButton = page.getByRole('button', {name: 'Add policy'});
        await addPolicyButton.click();
        await page.waitForLoadState('networkidle');

        // Fill policy name
        const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
        await nameInput.waitFor({state: 'visible', timeout: 10000});
        await nameInput.fill(policyWithoutChannelName);

        // Switch to Advanced mode to create minimal policy
        const advancedModeButton = page.getByRole('button', {name: /advanced/i});
        if (await advancedModeButton.isVisible({timeout: 2000})) {
            await advancedModeButton.click();
            await page.waitForTimeout(1000);
        }

        // Fill CEL expression in Monaco editor
        const monacoContainer = page.locator('.monaco-editor').first();
        await monacoContainer.waitFor({state: 'visible', timeout: 5000});

        const editorLines = page.locator('.monaco-editor .view-lines').first();
        await editorLines.click({force: true});
        await page.waitForTimeout(300);

        // Type a simple expression
        const isMac = process.platform === 'darwin';
        await page.keyboard.press(isMac ? 'Meta+a' : 'Control+a');
        await page.waitForTimeout(100);
        await page.keyboard.type('user.attributes.Department == "Sales"', {delay: 10});
        await page.waitForTimeout(1000);

        // Save policy WITHOUT assigning any channels
        const saveButton = page.getByRole('button', {name: 'Save'});
        await saveButton.click();

        // The "Apply policy" modal should NOT appear since there are no channels
        // The webapp will call handleSubmit() directly and navigate back automatically
        // Wait for navigation to complete
        await page.waitForURL('**/attribute_based_access_control', {timeout: 10000});
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);

        // ===========================================
        // STEP 1-2: Verify Delete is DISABLED for policy WITH channel
        // ===========================================

        // Clear any existing search and verify both policies exist
        const searchInput = page.locator('input[placeholder*="Search" i]').first();
        await searchInput.waitFor({state: 'visible', timeout: 5000});
        await searchInput.clear();
        await page.waitForTimeout(500);

        // Verify both policies are visible
        await page.locator('.policy-name, tr.clickable').count();

        // Now search for the policy with channel
        await searchInput.fill(policyWithChannelName);
        await page.waitForTimeout(1000);

        // Find and click the three-dot menu for the policy with channel
        const policyWithChannelRow = page
            .locator('tr.clickable, .DataGrid_row')
            .filter({hasText: policyWithChannelName})
            .first();
        await policyWithChannelRow.waitFor({state: 'visible', timeout: 10000});

        const menuButtonWithChannel = policyWithChannelRow
            .locator('button[id*="policy-menu"], button[aria-label*="menu" i], .menu-button, button:has(svg)')
            .first();
        await menuButtonWithChannel.click();
        await page.waitForTimeout(500);

        // Check if Delete is disabled
        const deleteMenuItemWithChannel = page.getByRole('menuitem', {name: /delete/i});
        const isDeleteDisabled = await deleteMenuItemWithChannel.isDisabled();

        // Close the menu
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        expect(isDeleteDisabled).toBe(true);

        // ===========================================
        // STEP 3-4: Verify Delete is ENABLED for policy WITHOUT channel and delete it
        // ===========================================

        // Clear search first to ensure we're seeing all policies
        await searchInput.clear();
        await page.waitForTimeout(500);

        // Verify policy without channel exists in the list
        const policyWithoutChannelExists = await page.locator('text=' + policyWithoutChannelName).count();

        if (policyWithoutChannelExists === 0) {
            // Try reloading if policy not visible
            await page.reload();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1000);
        }

        // Now search for the policy without channel
        await searchInput.fill(policyWithoutChannelName);
        await page.waitForTimeout(1000);

        // Find and click the three-dot menu for the policy without channel
        const policyWithoutChannelRow = page
            .locator('tr.clickable, .DataGrid_row')
            .filter({hasText: policyWithoutChannelName})
            .first();
        await policyWithoutChannelRow.waitFor({state: 'visible', timeout: 10000});

        const menuButtonWithoutChannel = policyWithoutChannelRow
            .locator('button[id*="policy-menu"], button[aria-label*="menu" i], .menu-button, button:has(svg)')
            .first();
        await menuButtonWithoutChannel.click();
        await page.waitForTimeout(500);

        // Check if Delete is enabled
        const deleteMenuItemWithoutChannel = page.getByRole('menuitem', {name: /delete/i});
        const isDeleteEnabled = !(await deleteMenuItemWithoutChannel.isDisabled());

        expect(isDeleteEnabled).toBe(true);

        // Click Delete
        await deleteMenuItemWithoutChannel.click();
        await page.waitForTimeout(500);

        // Handle confirmation modal if it appears
        const confirmDeleteButton = page.getByRole('button', {name: /delete|confirm/i});
        if (await confirmDeleteButton.isVisible({timeout: 2000})) {
            await confirmDeleteButton.click();
            await page.waitForTimeout(1000);
        }

        await page.waitForLoadState('networkidle');

        // Verify the policy was deleted
        await searchInput.clear();
        await searchInput.fill(policyWithoutChannelName);
        await page.waitForTimeout(1000);

        const policyStillExists = await page
            .locator('tr.clickable, .DataGrid_row')
            .filter({hasText: policyWithoutChannelName})
            .isVisible({timeout: 3000});
        expect(policyStillExists).toBe(false);
    });
});
