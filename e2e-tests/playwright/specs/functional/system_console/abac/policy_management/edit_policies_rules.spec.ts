// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    expect,
    getAdminClient,
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
    waitForLatestSyncJob,
    getPolicyIdByName,
    enableUserManagedAttributes,
} from '../support';
import {deleteFieldFromDB} from '../masking/masking_db_setup';

// Restore AccessControlSettings to the shared baseline expected by
// `specs/test_setup.ts` (ABAC enabled) after this file's tests complete, so
// later files on the same worker see the expected setup-state.
test.afterAll(async () => {
    try {
        const {adminClient} = await getAdminClient({skipLog: true});
        await adminClient.patchConfig({
            AccessControlSettings: {
                EnableAttributeBasedAccessControl: true,
                EnableUserManagedAttributes: true,
            },
        } as any);
    } catch {
        // Best-effort cleanup.
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

    // Ensure Office field exists with correct managed:admin permissions.
    // Fields created by older server versions may lack permission_values, causing 403
    // when setting attribute values — delete and recreate if permission_values is missing.
    // Legacy fields with permission_field=null reject API deletion (403), so fall back to DB.
    const existingFields = await adminClient.getCustomProfileAttributeFields();
    const attributeFieldsMap: Record<string, any> = {};
    for (const field of existingFields) {
        attributeFieldsMap[field.id] = field;
    }
    const existingOffice = existingFields.find((f: any) => f.name === 'Office') as any;
    if (!existingOffice || !(existingOffice as any).permission_values) {
        if (existingOffice) {
            try {
                await adminClient.deleteCustomProfileAttributeField(existingOffice.id);
            } catch {
                await deleteFieldFromDB(existingOffice.id);
            }
            delete attributeFieldsMap[existingOffice.id];
        }
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

    await createBasicPolicy(page, {
        name: policyName,
        attribute: 'Department',
        operator: '==',
        value: 'Engineering',
        autoSync: true, // Auto-add is ON
        channels: [privateChannel.display_name],
    });
    (await getPolicyIdByName(adminClient, policyName))!;

    // Wait for automatic sync to complete
    await page.waitForTimeout(500);

    // Verify initial state after original policy sync
    await verifyUserInChannel(adminClient, engineerRemoteUser.id, privateChannel.id);
    await verifyUserInChannel(adminClient, engineerOfficeUser.id, privateChannel.id);

    // ===========================================
    // STEP 1-2: Edit policy to ADD another attribute (Office=Remote)
    // New expression: Department=Engineering AND Office=Remote
    // ===========================================

    // Navigate back to ABAC list page
    await page.goto('/admin_console/system_attributes/membership_policies', {waitUntil: 'networkidle'});
    await page.waitForTimeout(2000);

    // Verify we're on the list page by checking for "Add policy" button
    const addPolicyButton = page.getByRole('button', {name: 'Add policy'});
    await addPolicyButton.waitFor({state: 'visible', timeout: 10000});

    // Try to find the policy row first without search
    const policyRowLocator = page.locator('tr.clickable, .DataGrid_row').filter({hasText: policyName}).first();
    let isPolicyVisible = await policyRowLocator.isVisible({timeout: 3000}).catch(() => false);

    // If not visible, use search
    if (!isPolicyVisible) {
        const policySearchInput = page
            .locator('.DataGrid input[type="text"], input[placeholder*="Search policies" i]')
            .first();
        if (await policySearchInput.isVisible({timeout: 3000})) {
            await policySearchInput.fill(policyName);
        }
        // Re-bind and poll — grid refresh under parallel load may be delayed.
        await expect
            .poll(() => policyRowLocator.isVisible(), {
                timeout: 20_000,
                message: `policy "${policyName}" should appear in grid after search`,
            })
            .toBe(true);
        isPolicyVisible = true;
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
    await expect
        .poll(() => attributeMenu.isVisible(), {
            timeout: 15_000,
            message: 'attribute dropdown should appear',
        })
        .toBe(true);

    const officeOption = attributeMenu.locator('li:has-text("Office")').first();
    await expect
        .poll(() => officeOption.isVisible(), {
            timeout: 15_000,
            message: 'Office option should be visible in attribute dropdown',
        })
        .toBe(true);
    await officeOption.click({force: true});
    await page.waitForTimeout(500);

    // Select operator "==" (is)
    const operatorButton = page.locator('[data-testid="operatorSelectorMenuButton"]').last();
    await operatorButton.waitFor({state: 'visible', timeout: 10_000});
    await operatorButton.click({force: true});
    await page.waitForTimeout(500);

    const operatorOption = page.locator('[id^="operator-selector-menu"] li:has-text("is")').first();
    await operatorOption.click({force: true});
    await page.waitForTimeout(500);

    // Fill value "Remote"
    const valueInput = page.locator('.values-editor__simple-input').last();
    await valueInput.waitFor({state: 'visible', timeout: 10_000});
    await valueInput.fill('Remote');
    await page.waitForTimeout(500);

    // ===========================================
    // STEP 3: Test Access Rule
    // ===========================================
    await testAccessRule(page);

    // ===========================================
    // STEP 4: Save the changes
    // ===========================================

    // Intercept the sync-job POST triggered by "Apply policy" so we can poll the
    // exact job ID instead of using the racy UI-table path.
    const editSyncJobIdPromise = page
        .waitForResponse((r) => r.url().includes('/api/v4/jobs') && r.request().method() === 'POST', {timeout: 15_000})
        .then(async (r) => (r.ok() ? (((await r.json()) as {id?: string}).id ?? null) : null))
        .catch(() => null);

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
    await page.waitForTimeout(500);

    // Wait for the auto-triggered sync job to complete (policy edit triggers sync automatically)
    const editSyncJobId = await editSyncJobIdPromise;
    await waitForLatestSyncJob(page, 10, editSyncJobId);

    // ===========================================
    // STEP 5 & 6: Verify channel membership after edit
    // ===========================================

    // Poll under PW_WORKERS>=2: another shard's sync job may briefly change
    // membership after we read it, so we retry until stable.
    await expect
        .poll(async () => verifyUserInChannel(adminClient, engineerRemoteUser.id, privateChannel.id), {
            timeout: 30_000,
            intervals: [500, 1000, 2000],
            message: 'engineerRemoteUser should be in channel (satisfies BOTH attributes)',
        })
        .toBe(true);
    await expect
        .poll(async () => verifyUserInChannel(adminClient, engineerOfficeUser.id, privateChannel.id), {
            timeout: 30_000,
            intervals: [500, 1000, 2000],
            message: 'engineerOfficeUser should be REMOVED (does not satisfy new policy)',
        })
        .toBe(false);
    await expect
        .poll(async () => verifyUserInChannel(adminClient, salesUser.id, privateChannel.id), {
            timeout: 30_000,
            intervals: [500, 1000, 2000],
            message: 'salesUser should not be in channel',
        })
        .toBe(false);
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

    // Ensure Office field exists with correct managed:admin permissions.
    // Fields created by older server versions may lack permission_values, causing 403
    // when setting attribute values — delete and recreate if permission_values is missing.
    // Legacy fields with permission_field=null reject API deletion (403), so fall back to DB.
    const existingFields = await adminClient.getCustomProfileAttributeFields();
    const attributeFieldsMap: Record<string, any> = {};
    for (const field of existingFields) {
        attributeFieldsMap[field.id] = field;
    }
    const existingOffice = existingFields.find((f: any) => f.name === 'Office') as any;
    if (!existingOffice || !(existingOffice as any).permission_values) {
        if (existingOffice) {
            try {
                await adminClient.deleteCustomProfileAttributeField(existingOffice.id);
            } catch {
                await deleteFieldFromDB(existingOffice.id);
            }
            delete attributeFieldsMap[existingOffice.id];
        }
        const officeField = await adminClient.createCustomProfileAttributeField({
            name: 'Office',
            type: 'text',
            attrs: {managed: 'admin', visibility: 'when_set', sort_order: 1},
        } as any);
        attributeFieldsMap[officeField.id] = officeField;
    }

    // Wait for attributes to be indexed
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await enableUserManagedAttributes(adminClient);

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

    await createAdvancedPolicy(page, {
        name: policyName,
        celExpression: 'user.attributes.Department == "Engineering" && user.attributes.Office == "Remote"',
        autoSync: true, // Auto-add is ON
        channels: [privateChannel.display_name],
    });
    (await getPolicyIdByName(adminClient, policyName))!;

    // Wait for automatic sync to complete
    await page.waitForTimeout(500);

    // Verify initial state after original policy sync
    await verifyUserInChannel(adminClient, engineerRemoteUser.id, privateChannel.id);
    await verifyUserNotInChannel(adminClient, engineerOfficeUser.id, privateChannel.id);
    await verifyUserNotInChannel(adminClient, salesRemoteUser.id, privateChannel.id);

    // ===========================================
    // STEP 1-2: Edit policy to REMOVE Location rule
    // New expression: Department=Engineering (only)
    // ===========================================
    await page.goto('/admin_console/system_attributes/membership_policies', {waitUntil: 'networkidle'});
    await page.waitForTimeout(500);

    const addPolicyButton = page.getByRole('button', {name: 'Add policy'});
    await addPolicyButton.waitFor({state: 'visible', timeout: 10000});

    // Wait for the exact policy row to appear with retry — under parallel load the
    // grid update from the server may lag behind the page load.
    const policyRowLocator = page.locator('tr.clickable, .DataGrid_row').filter({hasText: policyName}).first();
    const found = await policyRowLocator.isVisible({timeout: 3000}).catch(() => false);

    if (!found) {
        const policySearchInput = page
            .locator('.DataGrid input[type="text"], input[placeholder*="Search policies" i]')
            .first();
        if (await policySearchInput.isVisible({timeout: 3000})) {
            await policySearchInput.fill(policyName);
        }
        const policyRow = () => page.locator('tr.clickable, .DataGrid_row').filter({hasText: policyName}).first();
        await expect
            .poll(() => policyRow().isVisible(), {
                timeout: 45_000,
                intervals: [500, 1000, 2000, 3000],
                message: `policy "${policyName}" should appear in grid after search`,
            })
            .toBe(true);
    }
    await page.locator('tr.clickable, .DataGrid_row').filter({hasText: policyName}).first().click();
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

    // Remove the Office rule in Simple mode (table editor). Opening an Advanced-created policy
    // can leave the UI in CEL mode; "Switch to Advanced Mode" stays disabled while attributes load.
    const switchToSimpleButton = page.getByRole('button', {name: /switch to simple mode/i});
    if (await switchToSimpleButton.isVisible({timeout: 5000}).catch(() => false)) {
        await expect(switchToSimpleButton).toBeEnabled({timeout: 60_000});
        await switchToSimpleButton.click();
        await page.waitForTimeout(500);
    }

    const officeRowRemove = page
        .locator('.table-editor__row')
        .filter({hasText: 'Office'})
        .getByRole('button', {name: 'Remove row'});
    await expect(officeRowRemove).toBeVisible({timeout: 15_000});
    await officeRowRemove.click();
    await page.waitForTimeout(500);

    // ===========================================
    // STEP 3: Test Access Rule
    // ===========================================
    await testAccessRule(page);

    // ===========================================
    // STEP 4: Save the changes
    // ===========================================

    // Intercept the sync-job POST triggered by "Apply policy" so we can poll the
    // exact job ID instead of using the racy UI-table path.
    const editSyncJobIdPromiseT5792 = page
        .waitForResponse((r) => r.url().includes('/api/v4/jobs') && r.request().method() === 'POST', {timeout: 15_000})
        .then(async (r) => (r.ok() ? (((await r.json()) as {id?: string}).id ?? null) : null))
        .catch(() => null);

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
    const editSyncJobIdT5792 = await editSyncJobIdPromiseT5792;
    await waitForLatestSyncJob(page, 10, editSyncJobIdT5792);

    // ===========================================
    // STEP 5 & 6: Verify channel membership after edit
    // ===========================================

    // Re-apply guard: a concurrent initSetup() may have reset ABAC between the policy save
    // and the sync job completing. Without ABAC enabled the sync job is a no-op.
    await adminClient.patchConfig({
        AccessControlSettings: {
            EnableAttributeBasedAccessControl: true,
            EnableUserManagedAttributes: true,
        },
    } as any);

    // Poll under PW_WORKERS>=2: other shards' sync jobs may briefly change membership.
    await expect
        .poll(async () => verifyUserInChannel(adminClient, engineerOfficeUser.id, privateChannel.id), {
            timeout: 30_000,
            intervals: [500, 1000, 2000],
            message: 'engineerOfficeUser should be AUTO-ADDED (satisfies simpler Dept-only policy)',
        })
        .toBe(true);
    await expect
        .poll(async () => verifyUserInChannel(adminClient, engineerRemoteUser.id, privateChannel.id), {
            timeout: 30_000,
            intervals: [500, 1000, 2000],
            message: 'engineerRemoteUser should still be in channel',
        })
        .toBe(true);
    await expect
        .poll(async () => verifyUserInChannel(adminClient, salesRemoteUser.id, privateChannel.id), {
            timeout: 30_000,
            intervals: [500, 1000, 2000],
            message: 'salesRemoteUser should NOT be in channel',
        })
        .toBe(false);
});
