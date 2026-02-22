// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    expect,
    test,
    enableABAC,
    navigateToABACPage,
    verifyUserInChannel,
    verifyUserNotInChannel,
    runSyncJob,
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
    createAdvancedPolicy,
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
        const channelName = `abac-edit-test-${await pw.random.id()}`;

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
        const policyName = `ABAC-Edit-Test-${await pw.random.id()}`;

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

    /**
     * MM-T5791: Editing existing access policy to add another attribute applies access control as specified (with auto-add)
     *
     * Precondition: At least one policy in existence
     *
     * Step 1:
     * 1. Go to ABAC page, click a policy to edit. Ensure Auto-add is TRUE
     * 2. Edit an existing policy rule to add another attribute/value
     * 3. Click Test Access Rule, observe users who satisfy the policy
     * 4. Save the changes
     * 5. User who satisfies NEWLY EDITED policy but not in channel → auto-ADDED
     * 6. User who doesn't satisfy NEWLY EDITED policy and is in channel → auto-REMOVED
     *
     * Expected:
     * - User satisfying new multi-attribute policy IS auto-added
     * - User not satisfying new policy IS auto-removed
     */
    test('MM-T5791 Editing policy to add attribute with auto-add enabled', async ({pw}) => {
        test.setTimeout(180000);

        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();

        // Delete ALL existing custom attributes to start fresh
        try {
            const existingFields = await adminClient.getCustomProfileAttributeFields();
            for (const field of existingFields) {
                try {
                    await adminClient.deleteCustomProfileAttributeField(field.id);
                } catch {
                    // Ignore deletion errors
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch {
            // Ignore if no fields exist
        }

        // Enable user-managed attributes FIRST (same pattern as MM-T5783)
        await enableUserManagedAttributes(adminClient);

        // Set up TWO attribute fields: Department AND Office with admin-managed attrs
        const attributeFields: CustomProfileAttribute[] = [
            {name: 'Department', type: 'text', value: '', attrs: {managed: 'admin', visibility: 'when_set'} as any},
            {name: 'Office', type: 'text', value: '', attrs: {managed: 'admin', visibility: 'when_set'} as any},
        ];
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributeFields);

        // Create users:
        // 1. engineerRemoteUser: Dept=Engineering, Office=Remote → satisfies BOTH (after edit)
        // 2. engineerOfficeUser: Dept=Engineering, Office=HQ → satisfies ORIGINAL only, NOT the edited policy
        // 3. salesUser: Dept=Sales → doesn't satisfy any policy

        const engineerRemoteUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Engineering'},
            {name: 'Office', type: 'text', value: 'Remote'},
        ]);

        const engineerOfficeUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Engineering'},
            {name: 'Office', type: 'text', value: 'HQ'},
        ]);

        const salesUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Sales'},
        ]);

        // Add users to team
        await adminClient.addToTeam(team.id, engineerRemoteUser.id);
        await adminClient.addToTeam(team.id, engineerOfficeUser.id);
        await adminClient.addToTeam(team.id, salesUser.id);

        // Create channel and add engineerOfficeUser (satisfies original policy)
        const privateChannel = await createPrivateChannelForABAC(adminClient, team.id);
        await adminClient.addToChannel(engineerOfficeUser.id, privateChannel.id);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const page = systemConsolePage.page;

        await navigateToABACPage(page);
        await enableABAC(page);

        // ===========================================
        // PRECONDITION: Create ORIGINAL policy with ONE attribute (Department=Engineering)
        // Auto-add ON so users are auto-added
        // ===========================================
        const policyName = `ABAC-AddAttr-Test-${await pw.random.id()}`;

        await createBasicPolicy(page, {
            name: policyName,
            attribute: 'Department',
            operator: '==',
            value: 'Engineering',
            autoSync: true, // Auto-add is ON
            channels: [privateChannel.display_name],
        });

        // Wait for automatic sync to complete
        await page.waitForTimeout(3000);

        // Verify initial state after original policy sync
        await verifyUserInChannel(adminClient, engineerRemoteUser.id, privateChannel.id);
        await verifyUserInChannel(adminClient, engineerOfficeUser.id, privateChannel.id);

        // ===========================================
        // STEP 1-2: Edit policy to ADD another attribute (Office=Remote)
        // New expression: Department=Engineering AND Office=Remote
        // ===========================================

        // Navigate back to ABAC list page
        await page.goto('/admin_console/system_attributes/attribute_based_access_control', {waitUntil: 'networkidle'});
        await page.waitForTimeout(2000);

        // Verify we're on the list page by checking for "Add policy" button
        const addPolicyButton = page.getByRole('button', {name: 'Add policy'});
        await addPolicyButton.waitFor({state: 'visible', timeout: 10000});

        // Try to find the policy row first without search
        const policyRowLocator = page.locator('tr.clickable, .DataGrid_row').filter({hasText: policyName}).first();
        const isPolicyVisible = await policyRowLocator.isVisible({timeout: 3000}).catch(() => false);

        // If not visible, use search
        if (!isPolicyVisible) {
            const policySearchInput = page
                .locator('.DataGrid input[type="text"], input[placeholder*="Search policies" i]')
                .first();
            if (await policySearchInput.isVisible({timeout: 3000})) {
                await policySearchInput.click();
                await policySearchInput.fill(policyName);
                await page.waitForTimeout(1500);
            }
        }

        // Click policy to edit
        await policyRowLocator.waitFor({state: 'visible', timeout: 15000});
        await policyRowLocator.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Check if "Add attribute" button is disabled (means attributes not loaded)
        // If so, reload to fetch the Office attribute
        const addAttributeButtonCheck = page.getByRole('button', {name: /add attribute/i});
        if (await addAttributeButtonCheck.isVisible({timeout: 2000})) {
            const isDisabled = await addAttributeButtonCheck.isDisabled();
            if (isDisabled) {
                await page.reload();
                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(1000);
            }
        }

        // Stay in Simple Mode and add a second attribute row
        const addAttributeButton = page.getByRole('button', {name: /add attribute/i});
        await addAttributeButton.waitFor({state: 'visible', timeout: 5000});
        await addAttributeButton.click();
        await page.waitForTimeout(1000);

        // The attribute dropdown opens automatically after clicking "Add attribute"
        // Wait for the menu to be visible and select "Office"
        const attributeMenu = page.locator('[id^="attribute-selector-menu"]');
        await attributeMenu.waitFor({state: 'visible', timeout: 5000});

        const officeOption = attributeMenu.locator('li:has-text("Office")').first();
        await officeOption.waitFor({state: 'visible', timeout: 5000});
        await officeOption.click({force: true});
        await page.waitForTimeout(500);

        // Select operator "==" (is)
        const operatorButton = page.locator('[data-testid="operatorSelectorMenuButton"]').last();
        await operatorButton.waitFor({state: 'visible', timeout: 5000});
        await operatorButton.click({force: true});
        await page.waitForTimeout(500);

        const operatorOption = page.locator('[id^="operator-selector-menu"] li:has-text("is")').first();
        await operatorOption.click({force: true});
        await page.waitForTimeout(500);

        // Fill value "Remote"
        const valueInput = page.locator('.values-editor__simple-input').last();
        await valueInput.waitFor({state: 'visible', timeout: 5000});
        await valueInput.fill('Remote');
        await page.waitForTimeout(500);

        // ===========================================
        // STEP 3: Test Access Rule
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

        // Navigate to ABAC page
        await navigateToABACPage(page);
        await page.waitForTimeout(1000);

        // Manually trigger a sync job to apply the policy changes
        await runSyncJob(page, false);
        await waitForLatestSyncJob(page);

        // Trigger a SECOND sync job - sometimes the first sync only processes additions
        await runSyncJob(page, false);
        await waitForLatestSyncJob(page);

        // Additional wait for membership changes to propagate
        await page.waitForTimeout(3000);

        // ===========================================
        // STEP 5 & 6: Verify channel membership after edit
        // ===========================================

        const engineerRemoteAfterEdit = await verifyUserInChannel(
            adminClient,
            engineerRemoteUser.id,
            privateChannel.id,
        );
        const engineerOfficeAfterEdit = await verifyUserInChannel(
            adminClient,
            engineerOfficeUser.id,
            privateChannel.id,
        );
        const salesAfterEdit = await verifyUserInChannel(adminClient, salesUser.id, privateChannel.id);

        // Step 5: engineerRemoteUser should be in channel (satisfies BOTH attributes)
        expect(engineerRemoteAfterEdit).toBe(true);

        // Step 6: engineerOfficeUser should be REMOVED (only satisfies original, not new policy)
        expect(engineerOfficeAfterEdit).toBe(false);

        // salesUser should not be in channel (never satisfied any policy)
        expect(salesAfterEdit).toBe(false);
    });

    /**
     * MM-T5792: Editing existing access policy to remove one of the rules applies access control as specified (with auto-add)
     *
     * Precondition: At least one policy with MULTIPLE rules in existence
     *
     * Step 1:
     * 1. Go to ABAC page, click a policy to edit. Ensure Auto-add is TRUE
     * 2. Edit policy to REMOVE one of the rules (attribute/value)
     * 3. Click Test Access Rule, observe users who satisfy the policy
     * 4. Save the changes
     * 5. User who satisfies newly edited (simpler) policy but not in channel → auto-ADDED
     * 6. User who no longer satisfies newly edited policy and is in channel → auto-REMOVED
     *
     * Expected:
     * - User satisfying new simpler policy IS auto-added
     * - User not satisfying new policy IS auto-removed
     *
     * This is the OPPOSITE of MM-T5791:
     * - MM-T5791: ADD rule → policy MORE restrictive
     * - MM-T5792: REMOVE rule → policy LESS restrictive
     */
    test('MM-T5792 Editing policy to remove attribute rule with auto-add enabled', async ({pw}) => {
        test.setTimeout(180000);

        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();

        // Delete ALL existing custom attributes to start fresh
        try {
            const existingFields = await adminClient.getCustomProfileAttributeFields();
            for (const field of existingFields) {
                try {
                    await adminClient.deleteCustomProfileAttributeField(field.id);
                } catch {
                    // Ignore deletion errors
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch {
            // Ignore if no fields exist
        }

        // Enable user-managed attributes FIRST (same pattern as MM-T5783)
        await enableUserManagedAttributes(adminClient);

        // Set up TWO attribute fields: Department AND Office with admin-managed attrs
        const attributeFields: CustomProfileAttribute[] = [
            {name: 'Department', type: 'text', value: '', attrs: {managed: 'admin', visibility: 'when_set'} as any},
            {name: 'Office', type: 'text', value: '', attrs: {managed: 'admin', visibility: 'when_set'} as any},
        ];
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributeFields);

        // Create users:
        // 1. engineerRemoteUser: Dept=Engineering, Office=Remote → satisfies ORIGINAL (both rules)
        // 2. engineerOfficeUser: Dept=Engineering, Office=HQ → satisfies EDITED policy (Dept only)
        // 3. salesRemoteUser: Dept=Sales, Office=Remote → doesn't satisfy (wrong Dept)

        const engineerRemoteUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Engineering'},
            {name: 'Office', type: 'text', value: 'Remote'},
        ]);

        const engineerOfficeUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Engineering'},
            {name: 'Office', type: 'text', value: 'HQ'},
        ]);

        const salesRemoteUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Sales'},
            {name: 'Office', type: 'text', value: 'Remote'},
        ]);

        // Add users to team
        await adminClient.addToTeam(team.id, engineerRemoteUser.id);
        await adminClient.addToTeam(team.id, engineerOfficeUser.id);
        await adminClient.addToTeam(team.id, salesRemoteUser.id);

        // Create channel and add salesRemoteUser (does NOT satisfy any policy)
        // This user will be REMOVED after we edit policy (to verify removal behavior)
        const privateChannel = await createPrivateChannelForABAC(adminClient, team.id);
        await adminClient.addToChannel(salesRemoteUser.id, privateChannel.id);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const page = systemConsolePage.page;

        await navigateToABACPage(page);
        await enableABAC(page);

        // ===========================================
        // PRECONDITION: Create ORIGINAL policy with TWO attributes
        // Department=Engineering AND Office=Remote
        // Auto-add ON
        // ===========================================
        const policyName = `ABAC-RemoveRule-${await pw.random.id()}`;

        // Use advanced mode for multi-attribute policy
        await createAdvancedPolicy(page, {
            name: policyName,
            celExpression: 'user.attributes.Department == "Engineering" && user.attributes.Office == "Remote"',
            autoSync: true, // Auto-add is ON
            channels: [privateChannel.display_name],
        });

        // Wait for automatic sync to complete
        await page.waitForTimeout(3000);

        // Verify initial state after original policy sync
        // Original policy: Department=Engineering AND Office=Remote
        // - engineerRemoteUser: satisfies → should be auto-added
        // - engineerOfficeUser: does NOT satisfy (HQ != Remote) → should NOT be in channel
        // - salesRemoteUser: does NOT satisfy (Sales != Engineering) → should be auto-removed
        await verifyUserInChannel(adminClient, engineerRemoteUser.id, privateChannel.id);
        await verifyUserNotInChannel(adminClient, engineerOfficeUser.id, privateChannel.id);
        await verifyUserNotInChannel(adminClient, salesRemoteUser.id, privateChannel.id);

        // ===========================================
        // STEP 1-2: Edit policy to REMOVE Location rule
        // New expression: Department=Engineering (only)
        // This makes policy LESS restrictive
        // ===========================================

        // Navigate back to ABAC list page
        await page.goto('/admin_console/system_attributes/attribute_based_access_control', {waitUntil: 'networkidle'});
        await page.waitForTimeout(2000);

        // Verify we're on the list page by checking for "Add policy" button
        const addPolicyButton = page.getByRole('button', {name: 'Add policy'});
        await addPolicyButton.waitFor({state: 'visible', timeout: 10000});

        // Try to find the policy row first without search
        const policyRowLocator = page.locator('tr.clickable, .DataGrid_row').filter({hasText: policyName}).first();
        const isPolicyVisible = await policyRowLocator.isVisible({timeout: 3000}).catch(() => false);

        // If not visible, try with search
        if (!isPolicyVisible) {
            // Use a more specific selector for the search input in the policies table
            const policySearchInput = page
                .locator('.DataGrid input[type="text"], input[placeholder*="Search policies" i]')
                .first();
            if (await policySearchInput.isVisible({timeout: 3000})) {
                await policySearchInput.click();
                await policySearchInput.fill(policyName);
                // DON'T press Enter - just wait for the search to filter
                await page.waitForTimeout(1500);
            }
        }

        // Wait for policy row to be visible
        await policyRowLocator.waitFor({state: 'visible', timeout: 15000});
        await policyRowLocator.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Verify Auto-add is ON
        const autoAddCheckbox = page.locator('#auto-add-header-checkbox');
        if (await autoAddCheckbox.isVisible({timeout: 3000})) {
            const isChecked = await autoAddCheckbox.isChecked();
            if (!isChecked) {
                await autoAddCheckbox.click();
                await page.waitForTimeout(500);
            }
        }

        // Check if Monaco editor is visible - if not, switch to Advanced mode
        // Policy may open in Simple mode even if created in Advanced mode
        let monacoContainer = page.locator('.monaco-editor').first();
        const isMonacoVisible = await monacoContainer.isVisible({timeout: 2000}).catch(() => false);

        if (!isMonacoVisible) {
            const advancedModeButton = page.getByRole('button', {name: /advanced|switch to advanced/i});
            if (await advancedModeButton.isVisible({timeout: 5000})) {
                await advancedModeButton.click();
                await page.waitForTimeout(2000); // Wait for Monaco to fully initialize
            }
        }

        // Find Monaco editor and update expression to REMOVE Office rule
        monacoContainer = page.locator('.monaco-editor').first();
        await monacoContainer.waitFor({state: 'visible', timeout: 10000});

        const editorLines = page.locator('.monaco-editor .view-lines').first();
        await editorLines.waitFor({state: 'visible', timeout: 5000});
        await page.waitForTimeout(500);

        // Click to focus the editor
        await editorLines.click({force: true});
        await page.waitForTimeout(300);

        // Use platform-specific select all (Meta+a on Mac, Control+a on others)
        const isMac = process.platform === 'darwin';
        await page.keyboard.press(isMac ? 'Meta+a' : 'Control+a');
        await page.waitForTimeout(200);

        // Type the new CEL expression (REMOVING Office rule)
        const newExpression = 'user.attributes.Department == "Engineering"';
        await page.keyboard.type(newExpression, {delay: 10});
        await page.waitForTimeout(1000);

        // Wait for the "Valid" indicator to confirm the expression is valid
        const validIndicator = page.locator('text=Valid').first();
        try {
            await validIndicator.waitFor({state: 'visible', timeout: 10000});
        } catch {
            // Ignore if Valid indicator doesn't appear
        }

        // ===========================================
        // STEP 3: Test Access Rule
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

        // Navigate to ABAC page and wait for sync job to complete
        await navigateToABACPage(page);
        await waitForLatestSyncJob(page);

        // ===========================================
        // STEP 5 & 6: Verify channel membership after edit
        // ===========================================

        const engineerRemoteAfterEdit = await verifyUserInChannel(
            adminClient,
            engineerRemoteUser.id,
            privateChannel.id,
        );
        const engineerOfficeAfterEdit = await verifyUserInChannel(
            adminClient,
            engineerOfficeUser.id,
            privateChannel.id,
        );
        const salesRemoteAfterEdit = await verifyUserInChannel(adminClient, salesRemoteUser.id, privateChannel.id);

        // Step 5: engineerOfficeUser should be AUTO-ADDED (now satisfies simpler Dept-only policy)
        expect(engineerOfficeAfterEdit).toBe(true);

        // engineerRemoteUser should still be in channel (continues to satisfy policy)
        expect(engineerRemoteAfterEdit).toBe(true);

        // Step 6: salesRemoteUser should NOT be in channel (never satisfied Dept requirement)
        expect(salesRemoteAfterEdit).toBe(false);
    });
});
