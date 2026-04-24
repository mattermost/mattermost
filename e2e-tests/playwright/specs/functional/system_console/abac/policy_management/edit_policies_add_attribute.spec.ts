// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC, navigateToABACPage, verifyUserInChannel} from '@mattermost/playwright-lib';

import {
    createUserForABAC,
    testAccessRule,
    createPrivateChannelForABAC,
    createBasicPolicy,
    waitForLatestSyncJob,
} from '../support';

import {openPolicyForEdit, resetAndCreateDepartmentOfficeAttributes} from './support';

/**
 * ABAC Policy Management - Edit Policies
 * Tests for editing existing ABAC policies
 */
test.describe('ABAC Policy Management - Edit Policies', () => {
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

        const attributeFieldsMap = await resetAndCreateDepartmentOfficeAttributes(adminClient);

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
        const policyName = `ABAC-AddAttr-Test-${pw.random.id()}`;

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

        // Navigate back to ABAC list page and open the policy for editing
        await openPolicyForEdit(page, policyName);

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

        // Navigate to ABAC page and wait for auto-triggered sync job
        await navigateToABACPage(page);
        await page.waitForTimeout(2000);

        // Wait for the auto-triggered sync job to complete (policy edit triggers sync automatically)
        await waitForLatestSyncJob(page);

        // Additional wait for membership changes to propagate
        await page.waitForTimeout(5000);

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
});
