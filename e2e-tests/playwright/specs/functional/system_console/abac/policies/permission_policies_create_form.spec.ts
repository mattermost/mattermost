// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, formatMessage, test, type App, duration, Msg} from '@mattermost/playwright-lib';

import {ensureUserAttributes} from '../support';
import {openPermissionPolicies, setAbacEnabled, setCelExpression} from '../surface';

/**
 * Permission Policies - Create Policy form UI and validation (MM-64508)
 *
 * Covers the create-form UI elements (name input, role dropdown, CEL editor mode
 * toggle, info banner) and inline validation (empty name / expression / permissions).
 * See permission_policies_create_save.spec.ts for the save/cancel flows that
 * actually persist policies.
 */

/** Turns attribute-based access on and opens a new permission policy. */
async function openNewPermissionPolicy(app: App) {
    await setAbacEnabled(app, true);
    const list = await openPermissionPolicies(app);
    await list.addButton.click();
    await expect(list.edit.name.valueTextbox).toBeVisible();
    return {name: list.edit.name, policy: app.admin.permissionPolicy};
}

test.describe('Permission Policies - Create Policy', () => {
    test('MM-T5804 admin can open the create permission policy form', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {app} = await pw.testBrowser.login(adminUser);

        const {name} = await openNewPermissionPolicy(app);

        // * Detail page heading and name input visible
        await expect(app.admin.header).toContainMessage(Msg.admin.permission_policies.edit.title);
        await expect(name.valueTextbox).toHaveAttribute('placeholder', 'Add a unique policy name');
    });

    test('MM-T5805 create policy form shows evaluation order info banner', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {app} = await pw.testBrowser.login(adminUser);

        const {policy} = await openNewPermissionPolicy(app);

        // * Banner explains that permission policies override system permission schemes
        const banner = policy.evaluationInfo.locator;
        await expect(banner).toContainText('The permissions defined in this policy override the');
        await expect(banner).toContainMessage(Msg.admin.permission_policies.edit.info_banner.link);
        await expect(banner).toContainText('Permissions evaluation order');
    });

    test('MM-T5806 create policy form shows role dropdown defaulting to Members', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {app} = await pw.testBrowser.login(adminUser);

        const {policy} = await openNewPermissionPolicy(app);

        // The policy scope has no container of its own, so the panel title is read from the page.
        await expect(app.page.locator('body')).toContainMessage(Msg.admin.permission_policies.edit.who.title);
        await expect(policy.roleLabelText).toBeVisible();
        await expect(policy.roleLabelText).toHaveMessage(Msg.admin.permission_policies.edit.who.role_label);

        // * The dropdown button is visible and shows the default role
        //   (system_user). The label was shortened from "Members and
        //   system administrators" to just "Members" in the UX pass;
        //   the "system admins fall back when no admin-specific rule
        //   exists" semantics moved into the role's description copy.
        //   Use an exact-text matcher so a regression to the longer
        //   "Members and system administrators" label fails the test
        //   instead of silently passing the substring check.
        await expect(policy.roleButton).toBeVisible();
        await expect(policy.roleButton).toHaveText('Members');
    });

    test('MM-T5807 admin can change role selection to System administrators via dropdown', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {app} = await pw.testBrowser.login(adminUser);

        const {policy} = await openNewPermissionPolicy(app);

        // # Open the role dropdown and select System administrators
        await policy.roleButton.click();
        await expect(policy.roleMenu.role('system_admin')).toBeVisible();
        await policy.roleMenu.role('system_admin').click();

        // * Dropdown button now shows the selected role
        await expect(policy.roleButton).toContainMessage(Msg.admin.permission_policies.role.system_admin.label);
    });

    test('MM-T5808 admin can toggle between Simple and Advanced CEL editor modes', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {app} = await pw.testBrowser.login(adminUser);

        const {policy} = await openNewPermissionPolicy(app);
        const toggle = policy.switchModeButton.locator;
        await expect(toggle).toHaveText('Switch to Advanced Mode');
        await expect(policy.rules.addButton).toBeVisible();
        await policy.switchModeButton.click();

        // * Button label flips to Simple Mode, with the CEL editor showing
        await expect(toggle).toHaveText('Switch to Simple Mode');
        await expect(policy.cel.input).toBeVisible();
        await policy.switchModeButton.click();
        await expect(toggle).toHaveText('Switch to Advanced Mode');
        await expect(policy.rules.addButton).toBeVisible();
    });

    test('MM-T5809 Save is blocked when policy name is empty', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {app} = await pw.testBrowser.login(adminUser);

        const {name, policy} = await openNewPermissionPolicy(app);

        // # Type then clear the name to mark the form dirty, enabling the Save button
        await name.valueTextbox.fill('x');
        await name.valueTextbox.fill('');
        await app.admin.saveButton.click();

        await expect(policy.errorText).toContainMessage(Msg.admin.permission_policies.edit.error.name_required);
    });

    test('MM-T5810 Save is blocked when CEL expression is empty', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {app} = await pw.testBrowser.login(adminUser);

        const {name, policy} = await openNewPermissionPolicy(app);
        await name.valueTextbox.fill(`PP Expr Validate ${pw.random.id()}`);
        await app.admin.saveButton.click();

        await expect(policy.errorText).toContainMessage(Msg.admin.permission_policies.edit.error.expression_required);
    });

    test('MM-T5811 Save is blocked when no permission is selected', async ({pw}) => {
        test.setTimeout(duration.two_min);

        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {app} = await pw.testBrowser.login(adminUser);

        const {name, policy} = await openNewPermissionPolicy(app);
        const policyName = `PP Perm Validate ${pw.random.id()}`;
        await name.valueTextbox.fill(policyName);
        await expect(name.valueTextbox).toHaveValue(policyName);

        // # Enter a valid CEL expression but add no permissions
        await setCelExpression(app, policy, 'user.attributes.Department == "Engineering"');
        await app.admin.saveButton.click();

        await expect(policy.errorText).toContainMessage(Msg.admin.permission_policies.edit.error.permissions_required);
    });

    /**
     * @objective Verify a Members permission policy only offers Simulate rules, disabled until a permission is added, and never the role-blind Test access rule (MM-71299)
     */
    test(
        'keeps Simulate rules disabled until a permission is added without falling back to Test access rule',
        {tag: '@abac'},
        async ({pw}) => {
            test.setTimeout(duration.two_min);
            await pw.skipIfNoLicense();
            const {adminUser, adminClient} = await pw.initSetup();
            await ensureUserAttributes(adminClient);
            const {app} = await pw.testBrowser.login(adminUser);

            // # Open the create form, keeping the default Members role, and enter a valid rule without adding a permission
            const {policy} = await openNewPermissionPolicy(app);
            await setCelExpression(app, policy, 'user.attributes.Department == "Engineering"');

            // * Simulate rules is shown disabled, and the expression-only Test access rule is not offered
            const simulateButton = policy.cel.testButton.locator;
            await expect(simulateButton).toBeVisible();
            await expect(simulateButton).toBeDisabled();
            await expect(simulateButton).toHaveText('Simulate rules');
            // Neither editor mode has a generated container enclosing its buttons; reject the membership-only label
            // across the form, including an extra button outside the generated Simulate rules part.
            await expect(
                app.page.getByRole('button', {
                    name: formatMessage(Msg.admin.access_control.table_editor.test_access_rule),
                }),
            ).toHaveCount(0);

            // # Add a permission
            await policy.addPermissionButton.click();
            await expect(policy.permissionMenu.permission('download_file_attachment')).toBeVisible();
            await policy.permissionMenu.permission('download_file_attachment').click();

            // * Simulate rules becomes available and opens the simulator, not the membership test results
            await expect(simulateButton).toBeEnabled({timeout: duration.ten_sec});
            await policy.cel.testButton.click();
            await expect(app.admin.simulateAccess).toBeVisible();
            // The membership results title has no generated part and its portalled modal must be absent;
            // search the document so a stray title outside that absent container also fails this check.
            await expect(app.page.getByText(formatMessage(Msg.admin.access_control.testResults))).toHaveCount(0);
        },
    );
});
