// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC} from '@mattermost/playwright-lib';

import {ensureUserAttributes, navigateToPermissionPoliciesPage} from '../support';

/**
 * Permission Policies - System Console (MM-64508)
 *
 * Tests the Permission Policies page under System Attributes > Permission Policies.
 * Requires Enterprise Advanced license and ABAC enabled.
 *
 * Sidebar items (Membership Policies, Permission Policies) are only rendered when
 * ABAC is enabled — all tests call enableABAC() first.
 *
 * UI:
 *   List page  — Name | Role | Permissions columns, "+ Add policy", Search
 *   Detail page — name input, role dropdown (Guest users / Members and system administrators / System administrators), CEL editor,
 *                 permissions menu (Download Files / Upload Files), Save / Cancel
 */

test.describe('Permission Policies - Create Policy', () => {
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
