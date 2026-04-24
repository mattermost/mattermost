// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC, navigateToABACPage, verifyUserInChannel} from '@mattermost/playwright-lib';

import {
    CustomProfileAttribute,
    setupCustomProfileAttributeFields,
} from '../../../channels/custom_profile_attributes/helpers';
import {
    createUserForABAC,
    testAccessRule,
    createBasicPolicy,
    waitForLatestSyncJob,
    enableUserManagedAttributes,
} from '../support';

/**
 * ABAC Policy Management - Edit Policies
 * Tests for editing existing ABAC policies
 */
test.describe('ABAC Policy Management - Edit Policies', () => {
    /**
     * MM-T5790: Editing value of existing attribute-based access policy applies access control as specified (without auto-add)
     *
     * Step 1:
     * 1. Go to ABAC page, click a policy to edit. Ensure Auto-add is False
     * 2. Edit an existing policy rule to a different value (same attribute and operator)
     * 3. Click Test Access Rule, observe users who satisfy the policy
     * 4. Save the changes
     * 5. User who satisfies NEW policy but not in channel → NOT auto-added
     */
    test('MM-T5790 Editing policy value applies access control without auto-add', async ({pw}) => {
        test.setTimeout(180000);

        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();

        // Enable user-managed attributes FIRST (same order as MM-T5783)
        await enableUserManagedAttributes(adminClient);

        // Set up the Department attribute field
        const attributeFields: CustomProfileAttribute[] = [{name: 'Department', type: 'text', value: ''}];
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributeFields);

        // Create users with proper CPA attributes
        // User A: Department=Engineering (will satisfy ORIGINAL policy)
        // User B: Department=Sales (will satisfy EDITED policy)
        const engineerUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', value: 'Engineering', type: 'text'},
        ]);
        const salesUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', value: 'Sales', type: 'text'},
        ]);

        await adminClient.addToTeam(team.id, engineerUser.id);
        await adminClient.addToTeam(team.id, salesUser.id);

        // Create channel - use direct API call for more control
        const channelName = `abac-edit-test-${pw.random.id()}`;

        const privateChannel = await adminClient.createChannel({
            team_id: team.id,
            name: channelName.toLowerCase().replace(/[^a-z0-9-]/g, ''),
            display_name: channelName,
            type: 'P',
        });

        // Admin user is automatically added as channel creator, but let's add the test users
        // Note: addToChannel(userId, channelId) - user first, then channel
        await adminClient.addToChannel(engineerUser.id, privateChannel.id);

        // Verify we can access the channel
        // const channelCheck = await adminClient.getChannel(privateChannel.id);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const page = systemConsolePage.page;

        await navigateToABACPage(page);
        await enableABAC(page);

        // Check membership BEFORE policy creation
        // Using library helper verifyUserInChannel(client, userId, channelId)
        await verifyUserInChannel(adminClient, engineerUser.id, privateChannel.id);

        // Debug: Show user attributes BEFORE policy creation
        try {
            await (adminClient as any).doFetch(
                `${adminClient.getBaseRoute()}/users/${engineerUser.id}/custom_profile_attributes`,
                {method: 'GET'},
            );
        } catch {
            // Ignore errors
        }

        // ===========================================
        // SETUP: Create policy with ORIGINAL value (Engineering), Auto-add OFF
        // ===========================================
        const policyName = `ABAC-Edit-Test-${pw.random.id()}`;

        await createBasicPolicy(page, {
            name: policyName,
            attribute: 'Department',
            operator: '==',
            value: 'Engineering',
            autoSync: false, // Auto-add is OFF
            channels: [privateChannel.display_name],
        });

        // Check membership AFTER policy creation (before explicit sync)
        await verifyUserInChannel(adminClient, engineerUser.id, privateChannel.id);

        // Wait for the automatic sync (triggered by createBasicPolicy's "Apply Policy") to complete
        await page.waitForTimeout(3000); // Give time for sync job to run

        // Check membership AFTER automatic sync
        const engineerAfterSync = await verifyUserInChannel(adminClient, engineerUser.id, privateChannel.id);
        const salesAfterSync = await verifyUserInChannel(adminClient, salesUser.id, privateChannel.id);

        // Debug: Fetch user attributes to verify they're set
        try {
            await (adminClient as any).doFetch(
                `${adminClient.getBaseRoute()}/users/${engineerUser.id}/custom_profile_attributes`,
                {method: 'GET'},
            );
        } catch {
            // Ignore errors
        }

        expect(engineerAfterSync).toBe(true);
        expect(salesAfterSync).toBe(false);

        // ===========================================
        // STEP 1-2: Edit policy to different value (Sales instead of Engineering)
        // ===========================================

        // Navigate to ABAC page and find the policy
        await navigateToABACPage(page);
        await page.waitForTimeout(1000);

        // Search for and click the policy
        const policySearchInput = page.locator('input[placeholder*="Search" i]').first();
        if (await policySearchInput.isVisible({timeout: 3000})) {
            await policySearchInput.fill(policyName);
            await page.waitForTimeout(1000);
        }

        const policyRowLocator = page.locator('tr.clickable, .DataGrid_row').filter({hasText: policyName}).first();
        await policyRowLocator.waitFor({state: 'visible', timeout: 10000});
        await policyRowLocator.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Verify Auto-add is OFF (check the header checkbox)
        const autoAddCheckbox = page.locator('#auto-add-header-checkbox');
        if (await autoAddCheckbox.isVisible({timeout: 3000})) {
            const isChecked = await autoAddCheckbox.isChecked();
            if (isChecked) {
                // Uncheck it
                await autoAddCheckbox.click();
                await page.waitForTimeout(500);
            }
        } else {
            // Checkbox not visible
        }

        // Edit the value: Change from "Engineering" to "Sales"

        // Strategy 1: Try simple input field (for text attributes)
        const simpleValueInput = page.locator('.values-editor__simple-input').first();
        if (await simpleValueInput.isVisible({timeout: 3000})) {
            // Clear and fill the new value
            await simpleValueInput.click();
            await simpleValueInput.fill('');
            await simpleValueInput.fill('Sales');
            // Press Tab or click elsewhere to confirm
            await page.keyboard.press('Tab');
            await page.waitForTimeout(500);
        } else {
            // Strategy 2: Try value selector menu button
            const valueButton = page.locator('[data-testid="valueSelectorMenuButton"]').first();
            if (await valueButton.isVisible({timeout: 3000})) {
                await valueButton.click();
                await page.waitForTimeout(500);

                // Look for input in the dropdown
                const menuInput = page
                    .locator('#value-selector-menu input[type="text"], .value-selector-menu input')
                    .first();
                if (await menuInput.isVisible({timeout: 2000})) {
                    await menuInput.fill('Sales');
                    await page.waitForTimeout(500);

                    // Click on the option or press Enter
                    const salesOption = page.locator('#value-selector-menu').getByText('Sales', {exact: true}).first();
                    if (await salesOption.isVisible({timeout: 2000})) {
                        await salesOption.click();
                    } else {
                        await page.keyboard.press('Enter');
                    }
                    await page.waitForTimeout(500);
                }
            } else {
                // Strategy 3: Use Advanced mode to edit CEL expression directly
                const advancedModeButton = page.getByRole('button', {name: /advanced|switch to advanced/i});
                if (await advancedModeButton.isVisible({timeout: 3000})) {
                    await advancedModeButton.click();
                    await page.waitForTimeout(1000);

                    // Find Monaco editor - use view-lines with force click to bypass overlay
                    const monacoContainer = page.locator('.monaco-editor').first();
                    if (await monacoContainer.isVisible({timeout: 3000})) {
                        const editorLines = page.locator('.monaco-editor .view-lines').first();
                        await editorLines.click({force: true});
                        await page.waitForTimeout(300);

                        // Platform-specific select all
                        const isMac = process.platform === 'darwin';
                        await page.keyboard.press(isMac ? 'Meta+a' : 'Control+a');
                        await page.waitForTimeout(100);

                        await page.keyboard.type('user.attributes.Department == "Sales"', {delay: 10});
                        await page.waitForTimeout(500);
                    }
                }
            }
        }

        // ===========================================
        // STEP 3: Click Test Access Rule
        // ===========================================
        await testAccessRule(page);

        // ===========================================
        // STEP 4: Save the changes
        // ===========================================
        const saveButton = page.getByRole('button', {name: 'Save'});
        await saveButton.waitFor({state: 'visible', timeout: 5000});
        await saveButton.click();
        await page.waitForTimeout(1000);

        // Handle "Apply policy" confirmation if it appears
        const applyPolicyButton = page.getByRole('button', {name: /apply policy/i});
        if (await applyPolicyButton.isVisible({timeout: 3000})) {
            await applyPolicyButton.click();
            await page.waitForTimeout(1000);
        }

        // Wait for sync to complete
        await navigateToABACPage(page);
        await waitForLatestSyncJob(page, 5);

        // ===========================================
        // STEP 5 & 6: Verify channel membership after policy edit
        // ===========================================

        const salesInChannelAfterEdit = await verifyUserInChannel(adminClient, salesUser.id, privateChannel.id);
        const engineerInChannelAfterEdit = await verifyUserInChannel(adminClient, engineerUser.id, privateChannel.id);

        // Step 5: salesUser should NOT be in channel (auto-add is off)
        expect(salesInChannelAfterEdit).toBe(false);

        // Step 6: engineerUser should be REMOVED (no longer satisfies policy)
        expect(engineerInChannelAfterEdit).toBe(false);

        // ===========================================
        // STEP 7: Admin can manually add satisfying user
        // ===========================================
        try {
            // Note: addToChannel(userId, channelId) - user first, then channel
            await adminClient.addToChannel(salesUser.id, privateChannel.id);

            // Verify the user was actually added
            const salesInChannelAfterManualAdd = await verifyUserInChannel(
                adminClient,
                salesUser.id,
                privateChannel.id,
            );
            expect(salesInChannelAfterManualAdd).toBe(true);
        } catch (error) {
            throw new Error(`Step 7 FAILED: Admin should be able to manually add satisfying user. Error: ${error}`);
        }
    });
});
