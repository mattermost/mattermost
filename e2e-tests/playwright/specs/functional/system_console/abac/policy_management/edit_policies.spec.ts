// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    expect,
    test,
    navigateToABACPage,
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
    createBasicPolicy,
    captureLatestJobId,
    waitForLatestSyncJob,
} from '../support';

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
    const channelName = `abac-edit-test-${await pw.random.id()}`;

    const privateChannel = await adminClient.createChannel({
        team_id: team.id,
        name: channelName.toLowerCase().replace(/[^a-z0-9-]/g, ''),
        display_name: channelName,
        type: 'P',
    });

    await adminClient.addToChannel(engineerUser.id, privateChannel.id);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    const page = systemConsolePage.page;

    await navigateToABACPage(page);

    // Check membership BEFORE policy creation
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
    const policyName = `ABAC-Edit-Test-${await pw.random.id()}`;

    const editTest1PolicyId = await createBasicPolicy(page, {
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
    const beforeEdit1JobId = await captureLatestJobId(page, editTest1PolicyId);
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
        await simpleValueInput.click();
        await simpleValueInput.fill('');
        await simpleValueInput.fill('Sales');
        await page.keyboard.press('Tab');
        await page.waitForTimeout(500);
    } else {
        // Strategy 2: Try value selector menu button
        const valueButton = page.locator('[data-testid="valueSelectorMenuButton"]').first();
        if (await valueButton.isVisible({timeout: 3000})) {
            await valueButton.click();
            await page.waitForTimeout(500);

            const menuInput = page
                .locator('#value-selector-menu input[type="text"], .value-selector-menu input')
                .first();
            if (await menuInput.isVisible({timeout: 2000})) {
                await menuInput.fill('Sales');
                await page.waitForTimeout(500);

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

                const monacoContainer = page.locator('.monaco-editor').first();
                if (await monacoContainer.isVisible({timeout: 3000})) {
                    const editorLines = page.locator('.monaco-editor .view-lines').first();
                    await editorLines.click({force: true});
                    await page.waitForTimeout(300);

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
    await waitForLatestSyncJob(page, 5, beforeEdit1JobId, undefined, editTest1PolicyId);

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
        await adminClient.addToChannel(salesUser.id, privateChannel.id);

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

// MM-T5791 and MM-T5792 moved to edit_policies_rules.spec.ts

/**
 * MM-63848: Renaming a policy to a name that already exists should show an error
 */
test('MM-63848 Should show error when renaming policy to an existing name', async ({pw}) => {
    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();

    const departmentAttribute: CustomProfileAttribute[] = [{name: 'Department', type: 'text', value: ''}];
    await setupCustomProfileAttributeFields(adminClient, departmentAttribute);

    const privateChannel = await createPrivateChannelForABAC(adminClient, team.id);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    const page = systemConsolePage.page;

    await navigateToABACPage(page);

    // Create two policies with different names
    const policyName1 = `Edit Dup Test A ${await pw.random.id()}`;
    await createBasicPolicy(page, {
        name: policyName1,
        attribute: 'Department',
        operator: '==',
        value: 'Engineering',
        autoSync: false,
        channels: [privateChannel.display_name],
    });

    await navigateToABACPage(page);

    const privateChannel2 = await createPrivateChannelForABAC(adminClient, team.id);
    const policyName2 = `Edit Dup Test B ${await pw.random.id()}`;
    await createBasicPolicy(page, {
        name: policyName2,
        attribute: 'Department',
        operator: '==',
        value: 'Sales',
        autoSync: false,
        channels: [privateChannel2.display_name],
    });

    // Navigate back and edit policy2's name to match policy1
    await navigateToABACPage(page);
    await page.waitForTimeout(1000);

    // Search for the second policy
    const policySearchInput = page.locator('input[placeholder*="Search" i]').first();
    if (await policySearchInput.isVisible({timeout: 3000})) {
        await policySearchInput.fill(policyName2);
        await page.waitForTimeout(1000);
    }

    const policyRow = page.locator('tr.clickable, .DataGrid_row').filter({hasText: policyName2}).first();
    await policyRow.waitFor({state: 'visible', timeout: 10000});
    await policyRow.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Change the name to match the first policy
    const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
    await nameInput.waitFor({state: 'visible', timeout: 10000});
    await nameInput.fill('');
    await nameInput.fill(policyName1);

    // Save and expect failure
    const saveButton = page.getByRole('button', {name: 'Save'});
    await saveButton.click();
    await page.waitForTimeout(2000);

    // Handle confirmation modal if it appears
    const applyPolicyButton = page.getByRole('button', {name: /apply policy/i});
    if (await applyPolicyButton.isVisible({timeout: 3000}).catch(() => false)) {
        await applyPolicyButton.click();
        await page.waitForTimeout(2000);
    }

    // Verify error message is shown
    const errorMessage = page.locator('.EditPolicy__error');
    await expect(errorMessage).toBeVisible({timeout: 5000});

    const errorText = await errorMessage.textContent();
    expect(errorText).toContain('A policy with this name already exists');
});
