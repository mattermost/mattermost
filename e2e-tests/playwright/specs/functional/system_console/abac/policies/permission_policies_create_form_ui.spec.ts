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

    test('MM-T5806 create policy form shows role dropdown defaulting to Members and system administrators', async ({
        pw,
    }) => {
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

        // * The dropdown button is visible and shows the default role (system_user = "Members and system administrators")
        const roleButton = systemConsolePage.page.locator('#pp-role-selector-btn');
        await expect(roleButton).toBeVisible();
        await expect(roleButton).toContainText('Members and system administrators');
    });
});
