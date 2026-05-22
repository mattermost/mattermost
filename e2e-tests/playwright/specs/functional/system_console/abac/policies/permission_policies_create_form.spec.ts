// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC} from '@mattermost/playwright-lib';

import {ensureUserAttributes, navigateToPermissionPoliciesPage} from '../support';

/**
 * Permission Policies - Create Policy form UI and validation (MM-64508)
 *
 * Covers the create-form UI elements (name input, role dropdown, CEL editor mode
 * toggle, info banner) and inline validation (empty name / expression / permissions).
 * See permission_policies_create_save.spec.ts for the save/cancel flows that
 * actually persist policies.
 */

test.describe('Permission Policies - Create Policy', () => {
    test('MM-T5804 admin can open the create permission policy form', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);

        await systemConsolePage.page.getByRole('button', {name: 'Add policy'}).click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Detail page heading and name input visible
        await expect(
            systemConsolePage.page.getByText('Attribute Based Permission Policy', {exact: true}),
        ).toBeVisible();
        await expect(systemConsolePage.page.getByPlaceholder('Add a unique policy name')).toBeVisible();
    });

    test('MM-T5805 create policy form shows evaluation order info banner', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);
        await systemConsolePage.page.getByRole('button', {name: 'Add policy'}).click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Banner explains that permission policies override system permission schemes
        await expect(
            systemConsolePage.page.getByText('The permissions defined in this policy override the', {exact: false}),
        ).toBeVisible();
        await expect(systemConsolePage.page.getByText('system permission schemes', {exact: false})).toBeVisible();
        await expect(systemConsolePage.page.getByText('Permissions evaluation order', {exact: false})).toBeVisible();
    });

    test('MM-T5806 create policy form shows role dropdown defaulting to Members', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);
        await systemConsolePage.page.getByRole('button', {name: 'Add policy'}).click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        await expect(systemConsolePage.page.getByText('Who this policy applies to')).toBeVisible();
        await expect(
            systemConsolePage.page.getByText('Select a role from the predefined list of system roles'),
        ).toBeVisible();

        // * The dropdown button is visible and shows the default role
        //   (system_user). The label was shortened from "Members and
        //   system administrators" to just "Members" in the UX pass;
        //   the "system admins fall back when no admin-specific rule
        //   exists" semantics moved into the role's description copy.
        //   Use an exact-text matcher so a regression to the longer
        //   "Members and system administrators" label fails the test
        //   instead of silently passing the substring check.
        const roleButton = systemConsolePage.page.locator('#pp-role-selector-btn');
        await expect(roleButton).toBeVisible();
        await expect(roleButton).toHaveText('Members');
    });

    test('MM-T5807 admin can change role selection to System administrators via dropdown', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);
        await systemConsolePage.page.getByRole('button', {name: 'Add policy'}).click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // # Open the role dropdown and select System administrators
        await systemConsolePage.page.locator('#pp-role-selector-btn').click();
        await systemConsolePage.page.locator('#pp-role-option-system_admin').click();

        // * Dropdown button now shows the selected role
        await expect(systemConsolePage.page.locator('#pp-role-selector-btn')).toContainText('System administrators');
    });

    test('MM-T5808 admin can toggle between Simple and Advanced CEL editor modes', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);
        await systemConsolePage.page.getByRole('button', {name: 'Add policy'}).click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        const switchToAdvanced = systemConsolePage.page.getByRole('button', {name: 'Switch to Advanced Mode'});
        await expect(switchToAdvanced).toBeVisible();
        await switchToAdvanced.click();

        // * Button label flips to Simple Mode
        const switchToSimple = systemConsolePage.page.getByRole('button', {name: 'Switch to Simple Mode'});
        await expect(switchToSimple).toBeVisible();

        await switchToSimple.click();
        await expect(switchToAdvanced).toBeVisible();
    });

    test('MM-T5809 Save is blocked when policy name is empty', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);
        await systemConsolePage.page.getByRole('button', {name: 'Add policy'}).click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // # Type then clear the name to mark the form dirty, enabling the Save button
        const nameInput = systemConsolePage.page.getByPlaceholder('Add a unique policy name');
        await nameInput.fill('x');
        await nameInput.clear();

        await systemConsolePage.page.getByRole('button', {name: 'Save'}).last().click();

        await expect(systemConsolePage.page.getByText('Please add a name to the policy')).toBeVisible();
    });

    test('MM-T5810 Save is blocked when CEL expression is empty', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);
        await systemConsolePage.page.getByRole('button', {name: 'Add policy'}).click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        await systemConsolePage.page
            .getByPlaceholder('Add a unique policy name')
            .fill(`PP Expr Validate ${pw.random.id()}`);
        await systemConsolePage.page.getByRole('button', {name: 'Save'}).last().click();

        await expect(systemConsolePage.page.getByText('Please add an expression to the policy')).toBeVisible();
    });

    test('MM-T5811 Save is blocked when no permission is selected', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);
        await systemConsolePage.page.getByRole('button', {name: 'Add policy'}).click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        await systemConsolePage.page
            .getByPlaceholder('Add a unique policy name')
            .fill(`PP Perm Validate ${pw.random.id()}`);

        // # Enter a valid CEL expression but add no permissions
        await systemConsolePage.page.getByRole('button', {name: 'Switch to Advanced Mode'}).click();
        const monacoContainer = systemConsolePage.page.locator('.monaco-editor').first();
        await monacoContainer.waitFor({state: 'visible', timeout: 5000});
        const editorLines = systemConsolePage.page.locator('.monaco-editor .view-lines').first();
        await editorLines.click({force: true});
        await systemConsolePage.page.waitForTimeout(300);
        const isMac = process.platform === 'darwin';
        await systemConsolePage.page.keyboard.press(isMac ? 'Meta+a' : 'Control+a');
        await systemConsolePage.page.waitForTimeout(100);
        await systemConsolePage.page.keyboard.type('user.attributes.Department == "Engineering"', {delay: 10});

        await systemConsolePage.page.getByRole('button', {name: 'Save'}).last().click();

        await expect(systemConsolePage.page.getByText('Please select at least one permission')).toBeVisible();
    });
});
