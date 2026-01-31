// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {
    enableABAC,
    disableABAC,
    navigateToABACPage,
    editPolicy,
    deletePolicy,
    runSyncJob,
    verifyUserInChannel,
    verifyUserNotInChannel,
    updateUserAttributes,
    createUserWithAttributes,
} from '../../../../../lib/src/server/abac_helpers';

import {
    CustomProfileAttribute,
    setupCustomProfileAttributeFields,
    setupCustomProfileAttributeValuesForUser,
    deleteCustomProfileAttributes,
} from '../../../channels/custom_profile_attributes/helpers';

import {
    verifyPolicyExists,
    verifyPolicyNotExists,
    createUserAttributeField,
    ensureUserAttributes,
    createUserForABAC,
    testAccessRule,
    createPrivateChannelForABAC,
    createBasicPolicy,
    createMultiAttributePolicy,
    createAdvancedPolicy,
    activatePolicy,
    waitForLatestSyncJob,
    getJobDetailsForChannel,
    getJobDetailsFromRecentJobs,
    getPolicyIdByName,
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
        const attributeFields: CustomProfileAttribute[] = [
            {name: 'Department', type: 'text', value: ''},
        ];
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
        try {
            await adminClient.addToChannel(engineerUser.id, privateChannel.id);
        } catch (error) {
            throw error;
        }

        // Verify we can access the channel
        try {
            const channelCheck = await adminClient.getChannel(privateChannel.id);
        } catch (error) {
            throw new Error(`Channel ${privateChannel.id} not accessible after creation: ${error}`);
        }

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const page = systemConsolePage.page;

        await navigateToABACPage(page);
        await enableABAC(page);

        // Check membership BEFORE policy creation
        // Using library helper verifyUserInChannel(client, userId, channelId)
        const engineerBeforePolicy = await verifyUserInChannel(adminClient, engineerUser.id, privateChannel.id);

        // Debug: Show user attributes BEFORE policy creation
        try {
            const engAttrs = await (adminClient as any).doFetch(
                `${adminClient.getBaseRoute()}/users/${engineerUser.id}/custom_profile_attributes`,
                {method: 'GET'},
            );
        } catch (e) {
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
        const engineerAfterPolicy = await verifyUserInChannel(adminClient, engineerUser.id, privateChannel.id);

        if (!engineerAfterPolicy) {
        }

        // Wait for the automatic sync (triggered by createBasicPolicy's "Apply Policy") to complete
        await page.waitForTimeout(3000); // Give time for sync job to run

        // Check membership AFTER automatic sync
        const engineerAfterSync = await verifyUserInChannel(adminClient, engineerUser.id, privateChannel.id);
        const salesAfterSync = await verifyUserInChannel(adminClient, salesUser.id, privateChannel.id);


        // Debug: Fetch user attributes to verify they're set
        try {
            const engAttrs = await (adminClient as any).doFetch(
                `${adminClient.getBaseRoute()}/users/${engineerUser.id}/custom_profile_attributes`,
                {method: 'GET'},
            );
        } catch (e) {
        }

        // If engineerUser was removed, show debug info
        if (!engineerAfterSync && engineerAfterPolicy) {
        } else if (!engineerAfterSync && !engineerAfterPolicy) {
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
                const menuInput = page.locator('#value-selector-menu input[type="text"], .value-selector-menu input').first();
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
        const testResult = await testAccessRule(page);

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
            const salesInChannelAfterManualAdd = await verifyUserInChannel(adminClient, salesUser.id, privateChannel.id);
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

        // Enable user-managed attributes FIRST (same pattern as MM-T5783)
        await enableUserManagedAttributes(adminClient);

        // Set up TWO attribute fields: Department AND Location
        const attributeFields: CustomProfileAttribute[] = [
            {name: 'Department', type: 'text', value: ''},
            {name: 'Location', type: 'text', value: ''},
        ];
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributeFields);

        // Create users:
        // 1. engineerRemoteUser: Dept=Engineering, Location=Remote → satisfies BOTH (after edit)
        // 2. engineerOfficeUser: Dept=Engineering, Location=Office → satisfies ORIGINAL only, NOT the edited policy
        // 3. salesUser: Dept=Sales → doesn't satisfy any policy

        const engineerRemoteUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Engineering'},
            {name: 'Location', type: 'text', value: 'Remote'},
        ]);

        const engineerOfficeUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Engineering'},
            {name: 'Location', type: 'text', value: 'Office'},
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
        // Using library helper verifyUserInChannel(client, userId, channelId)
        const engineerRemoteInitial = await verifyUserInChannel(adminClient, engineerRemoteUser.id, privateChannel.id);
        const engineerOfficeInitial = await verifyUserInChannel(adminClient, engineerOfficeUser.id, privateChannel.id);

        // Both Engineering users should be in channel now (auto-add is ON)
        // Note: If this fails, the original policy isn't working
        if (!engineerRemoteInitial || !engineerOfficeInitial) {
        }

        // ===========================================
        // STEP 1-2: Edit policy to ADD another attribute (Location=Remote)
        // New expression: Department=Engineering AND Location=Remote
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

        // Verify Auto-add is ON
        const autoAddCheckbox = page.locator('#auto-add-header-checkbox');
        if (await autoAddCheckbox.isVisible({timeout: 3000})) {
            const isChecked = await autoAddCheckbox.isChecked();
            if (!isChecked) {
                await autoAddCheckbox.click();
                await page.waitForTimeout(500);
            }
        }

        // Switch to Advanced mode to add AND condition
        const advancedModeButton = page.getByRole('button', {name: /advanced|switch to advanced/i});
        if (await advancedModeButton.isVisible({timeout: 5000})) {
            await advancedModeButton.click();
            // Wait longer for Monaco editor to fully initialize after mode switch
            await page.waitForTimeout(2000);
        }

        // Find Monaco editor and update expression to include Location
        // Monaco editor has a visual layer that intercepts clicks, so we need to:
        // 1. Wait for editor to be fully loaded with content
        // 2. Click on the .view-lines area with {force: true} to focus
        // 3. Use keyboard to select all and type the new expression
        const monacoContainer = page.locator('.monaco-editor').first();
        await monacoContainer.waitFor({state: 'visible', timeout: 10000});

        // Wait for the view-lines to have content (editor is loaded)
        const editorLines = page.locator('.monaco-editor .view-lines').first();
        await editorLines.waitFor({state: 'visible', timeout: 5000});

        // Wait for editor content to be populated (should have some text from original policy)
        await page.waitForTimeout(500);

        // Click to focus the editor
        await editorLines.click({force: true});
        await page.waitForTimeout(300);

        // Use platform-specific select all (Meta+a on Mac, Control+a on others)
        const isMac = process.platform === 'darwin';
        await page.keyboard.press(isMac ? 'Meta+a' : 'Control+a');
        await page.waitForTimeout(200);

        // Type the new CEL expression with delay for stability
        const newExpression = 'user.attributes.Department == "Engineering" && user.attributes.Location == "Remote"';
        await page.keyboard.type(newExpression, {delay: 10});
        await page.waitForTimeout(1000);

        // Wait for the "Valid" indicator to confirm the expression is valid
        const validIndicator = page.locator('text=Valid').first();
        try {
            await validIndicator.waitFor({state: 'visible', timeout: 10000});
        } catch {
        }

        // ===========================================
        // STEP 3: Test Access Rule
        // ===========================================
        const testResult = await testAccessRule(page);

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

        const engineerRemoteAfterEdit = await verifyUserInChannel(adminClient, engineerRemoteUser.id, privateChannel.id);
        const engineerOfficeAfterEdit = await verifyUserInChannel(adminClient, engineerOfficeUser.id, privateChannel.id);
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

        // Enable user-managed attributes FIRST (same pattern as MM-T5783)
        await enableUserManagedAttributes(adminClient);

        // Set up TWO attribute fields: Department AND Location
        const attributeFields: CustomProfileAttribute[] = [
            {name: 'Department', type: 'text', value: ''},
            {name: 'Location', type: 'text', value: ''},
        ];
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributeFields);

        // Create users:
        // 1. engineerRemoteUser: Dept=Engineering, Location=Remote → satisfies ORIGINAL (both rules)
        // 2. engineerOfficeUser: Dept=Engineering, Location=Office → satisfies EDITED policy (Dept only)
        // 3. salesRemoteUser: Dept=Sales, Location=Remote → doesn't satisfy (wrong Dept)

        const engineerRemoteUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Engineering'},
            {name: 'Location', type: 'text', value: 'Remote'},
        ]);

        const engineerOfficeUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Engineering'},
            {name: 'Location', type: 'text', value: 'Office'},
        ]);

        const salesRemoteUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Sales'},
            {name: 'Location', type: 'text', value: 'Remote'},
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
        // Department=Engineering AND Location=Remote
        // Auto-add ON
        // ===========================================
        const policyName = `ABAC-RemoveRule-${await pw.random.id()}`;

        // Use advanced mode for multi-attribute policy
        await createAdvancedPolicy(page, {
            name: policyName,
            celExpression: 'user.attributes.Department == "Engineering" && user.attributes.Location == "Remote"',
            autoSync: true, // Auto-add is ON
            channels: [privateChannel.display_name],
        });

        // Wait for automatic sync to complete
        await page.waitForTimeout(3000);

        // Verify initial state after original policy sync
        // Using library helper verifyUserInChannel(client, userId, channelId)
        const engineerRemoteInitial = await verifyUserInChannel(adminClient, engineerRemoteUser.id, privateChannel.id);
        const engineerOfficeInitial = await verifyUserInChannel(adminClient, engineerOfficeUser.id, privateChannel.id);
        const salesRemoteInitial = await verifyUserInChannel(adminClient, salesRemoteUser.id, privateChannel.id);


        // ===========================================
        // STEP 1-2: Edit policy to REMOVE Location rule
        // New expression: Department=Engineering (only)
        // This makes policy LESS restrictive
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

        // Find Monaco editor and update expression to REMOVE Location rule
        // Monaco editor has a visual layer that intercepts clicks, so we need to:
        // 1. Wait for editor to be fully loaded with content
        // 2. Click on the .view-lines area with {force: true} to focus
        // 3. Use keyboard to select all and type the new expression
        monacoContainer = page.locator('.monaco-editor').first();
        await monacoContainer.waitFor({state: 'visible', timeout: 10000});

        // Wait for the view-lines to have content (editor is loaded)
        const editorLines = page.locator('.monaco-editor .view-lines').first();
        await editorLines.waitFor({state: 'visible', timeout: 5000});

        // Wait for editor content to be populated
        await page.waitForTimeout(500);

        // Click to focus the editor
        await editorLines.click({force: true});
        await page.waitForTimeout(300);

        // Use platform-specific select all (Meta+a on Mac, Control+a on others)
        const isMac = process.platform === 'darwin';
        await page.keyboard.press(isMac ? 'Meta+a' : 'Control+a');
        await page.waitForTimeout(200);

        // Type the new CEL expression (REMOVING Location rule) with delay for stability
        const newExpression = 'user.attributes.Department == "Engineering"';
        await page.keyboard.type(newExpression, {delay: 10});
        await page.waitForTimeout(1000);

        // Wait for the "Valid" indicator to confirm the expression is valid
        const validIndicator = page.locator('text=Valid').first();
        try {
            await validIndicator.waitFor({state: 'visible', timeout: 10000});
        } catch {
        }

        // ===========================================
        // STEP 3: Test Access Rule
        // ===========================================
        const testResult = await testAccessRule(page);

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

        const engineerRemoteAfterEdit = await verifyUserInChannel(adminClient, engineerRemoteUser.id, privateChannel.id);
        const engineerOfficeAfterEdit = await verifyUserInChannel(adminClient, engineerOfficeUser.id, privateChannel.id);
        const salesRemoteAfterEdit = await verifyUserInChannel(adminClient, salesRemoteUser.id, privateChannel.id);


        // Step 5: engineerOfficeUser should be AUTO-ADDED (now satisfies simpler Dept-only policy)
        expect(engineerOfficeAfterEdit).toBe(true);

        // engineerRemoteUser should still be in channel (continues to satisfy policy)
        expect(engineerRemoteAfterEdit).toBe(true);

        // Step 6: salesRemoteUser should NOT be in channel (never satisfied Dept requirement)
        expect(salesRemoteAfterEdit).toBe(false);

    });
});
