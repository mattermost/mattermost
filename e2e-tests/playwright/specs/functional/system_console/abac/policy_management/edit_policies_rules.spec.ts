// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    expect,
    test,
    navigateToABACPage,
    verifyUserInChannel,
    verifyUserNotInChannel,
} from '@mattermost/playwright-lib';

import {
    createUserForABAC,
    testAccessRule,
    createPrivateChannelForABAC,
    createBasicPolicy,
    createAdvancedPolicy,
    captureLatestJobId,
    waitForLatestSyncJob,
} from '../support';

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

    // Use ensure-exists pattern - non-destructive, safe for parallel test runs
    const existingFields = await adminClient.getCustomProfileAttributeFields();
    const attributeFieldsMap: Record<string, any> = {};
    for (const field of existingFields) {
        attributeFieldsMap[field.id] = field;
    }
    if (!existingFields.some((f: any) => f.name === 'Office')) {
        const officeField = await adminClient.createCustomProfileAttributeField({
            name: 'Office',
            type: 'text',
            attrs: {managed: 'admin', visibility: 'when_set', sort_order: 1},
        } as any);
        attributeFieldsMap[officeField.id] = officeField;
    }

    // Wait for attributes to be indexed
    await new Promise((resolve) => setTimeout(resolve, 2000));

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

    // ===========================================
    // PRECONDITION: Create ORIGINAL policy with ONE attribute (Department=Engineering)
    // Auto-add ON so users are auto-added
    // ===========================================
    const policyName = `ABAC-AddAttr-Test-${await pw.random.id()}`;

    const editTest2PolicyId = await createBasicPolicy(page, {
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
    const beforeEdit2JobId = await captureLatestJobId(page, editTest2PolicyId);
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
    await waitForLatestSyncJob(page, 5, beforeEdit2JobId, undefined, editTest2PolicyId);

    // Additional wait for membership changes to propagate
    await page.waitForTimeout(5000);

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
 * This is the OPPOSITE of MM-T5791:
 * - MM-T5791: ADD rule → policy MORE restrictive
 * - MM-T5792: REMOVE rule → policy LESS restrictive
 */
test('MM-T5792 Editing policy to remove attribute rule with auto-add enabled', async ({pw}) => {
    test.setTimeout(180000);

    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();

    // Use ensure-exists pattern - non-destructive, safe for parallel test runs
    const existingFields = await adminClient.getCustomProfileAttributeFields();
    const attributeFieldsMap: Record<string, any> = {};
    for (const field of existingFields) {
        attributeFieldsMap[field.id] = field;
    }
    if (!existingFields.some((f: any) => f.name === 'Office')) {
        const officeField = await adminClient.createCustomProfileAttributeField({
            name: 'Office',
            type: 'text',
            attrs: {managed: 'admin', visibility: 'when_set', sort_order: 1},
        } as any);
        attributeFieldsMap[officeField.id] = officeField;
    }

    // Wait for attributes to be indexed
    await new Promise((resolve) => setTimeout(resolve, 2000));

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
    const privateChannel = await createPrivateChannelForABAC(adminClient, team.id);
    await adminClient.addToChannel(salesRemoteUser.id, privateChannel.id);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    const page = systemConsolePage.page;

    await navigateToABACPage(page);

    // ===========================================
    // PRECONDITION: Create ORIGINAL policy with TWO attributes
    // Department=Engineering AND Office=Remote, Auto-add ON
    // ===========================================
    const policyName = `ABAC-RemoveRule-${await pw.random.id()}`;

    const editTest3PolicyId = await createAdvancedPolicy(page, {
        name: policyName,
        celExpression: 'user.attributes.Department == "Engineering" && user.attributes.Office == "Remote"',
        autoSync: true, // Auto-add is ON
        channels: [privateChannel.display_name],
    });

    // Wait for automatic sync to complete
    await page.waitForTimeout(3000);

    // Verify initial state after original policy sync
    await verifyUserInChannel(adminClient, engineerRemoteUser.id, privateChannel.id);
    await verifyUserNotInChannel(adminClient, engineerOfficeUser.id, privateChannel.id);
    await verifyUserNotInChannel(adminClient, salesRemoteUser.id, privateChannel.id);

    // ===========================================
    // STEP 1-2: Edit policy to REMOVE Location rule
    // New expression: Department=Engineering (only)
    // ===========================================

    const beforeEdit3JobId = await captureLatestJobId(page, editTest3PolicyId);
    await page.goto('/admin_console/system_attributes/attribute_based_access_control', {waitUntil: 'networkidle'});
    await page.waitForTimeout(2000);

    const addPolicyButton = page.getByRole('button', {name: 'Add policy'});
    await addPolicyButton.waitFor({state: 'visible', timeout: 10000});

    const policyRowLocator = page.locator('tr.clickable, .DataGrid_row').filter({hasText: policyName}).first();
    const isPolicyVisible = await policyRowLocator.isVisible({timeout: 3000}).catch(() => false);

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
    let monacoContainer = page.locator('.monaco-editor').first();
    const isMonacoVisible = await monacoContainer.isVisible({timeout: 2000}).catch(() => false);

    if (!isMonacoVisible) {
        const advancedModeButton = page.getByRole('button', {name: /advanced|switch to advanced/i});
        if (await advancedModeButton.isVisible({timeout: 5000})) {
            await advancedModeButton.click();
            await page.waitForTimeout(2000);
        }
    }

    monacoContainer = page.locator('.monaco-editor').first();
    await monacoContainer.waitFor({state: 'visible', timeout: 10000});

    const editorLines = page.locator('.monaco-editor .view-lines').first();
    await editorLines.waitFor({state: 'visible', timeout: 5000});
    await page.waitForTimeout(500);

    await editorLines.click({force: true});
    await page.waitForTimeout(300);

    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+a' : 'Control+a');
    await page.waitForTimeout(200);

    const newExpression = 'user.attributes.Department == "Engineering"';
    await page.keyboard.type(newExpression, {delay: 10});
    await page.waitForTimeout(1000);

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

    const applyPolicyButton = page.getByRole('button', {name: /apply policy/i});
    if (await applyPolicyButton.isVisible({timeout: 3000})) {
        await applyPolicyButton.click();
        await page.waitForTimeout(1000);
    }

    await navigateToABACPage(page);
    await waitForLatestSyncJob(page, 5, beforeEdit3JobId, undefined, editTest3PolicyId);

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
