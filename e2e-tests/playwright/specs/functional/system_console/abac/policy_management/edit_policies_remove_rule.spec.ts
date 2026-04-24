// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    expect,
    test,
    enableABAC,
    navigateToABACPage,
    verifyUserInChannel,
    verifyUserNotInChannel,
} from '@mattermost/playwright-lib';

import {
    createUserForABAC,
    testAccessRule,
    createPrivateChannelForABAC,
    createAdvancedPolicy,
    waitForLatestSyncJob,
} from '../support';

import {openPolicyForEdit, resetAndCreateDepartmentOfficeAttributes} from './support';

/**
 * ABAC Policy Management - Edit Policies
 * Tests for editing existing ABAC policies
 */
test.describe('ABAC Policy Management - Edit Policies', () => {
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

        const attributeFieldsMap = await resetAndCreateDepartmentOfficeAttributes(adminClient);

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
        const policyName = `ABAC-RemoveRule-${pw.random.id()}`;

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

        // Navigate back to ABAC list page and open the policy for editing
        await openPolicyForEdit(page, policyName);

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
