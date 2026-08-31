// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * E2E tests for System Console > System Attributes > Session Attributes.
 *
 * Covers the seeded session-attribute listing table, per-row TTL/Grace/Enable/
 * Disable tuning with staged Save, the unsaved-changes navigation guard, and the
 * ABAC picker polarity (enabled session attributes appear in permission-policy
 * editors and are absent from membership-policy editors).
 *
 * The CEL autocomplete endpoint returns access control group attributes and
 * does not return session attributes; the webapp fetches the enabled ones separately
 * and merges them into the permission-policy pickers client-side,
 * where they generate `user.session.<name>` references.
 *
 * The session_attributes Property group is gated server-side: it requires an
 * Enterprise Advanced license (returns HTTP 501 otherwise) and the
 * FeatureFlags.SessionAttributes flag. Tests skip cleanly when those are not met.
 */

import type {Page} from '@playwright/test';

import {enableABAC, expect, test} from '@mattermost/playwright-lib';

import {ensureUserAttributes, getUserAttributeFieldByName} from '../abac/support';

import {
    findFieldByName,
    patchSessionAttribute,
    readSessionAttribute,
    restoreSessionAttributesToBaseline,
    setupSessionAttributesTest,
} from './support';

test.describe('System Console - Session Attributes', () => {
    // Return every seeded session attribute to its captured baseline after each
    // test. Tests toggle enabled/ttl/grace on various fields, so without this
    // the listing test's "Disabled by default" assertions would depend on no
    // other test having enabled a field first. Runs even when a test throws.
    test.afterEach(async () => {
        await restoreSessionAttributesToBaseline();
    });

    /**
     * @objective Verify the gated listing page renders the seeded session
     * attributes with correct Type, Platform, Status, and Server-source labeling.
     */
    test(
        'renders the listing table with correct type, status, and server labels',
        {tag: '@session_attributes'},
        async ({pw}) => {
            const {systemConsolePage, fields} = await setupSessionAttributesTest(pw);
            const sa = systemConsolePage.sessionAttributes;

            // # Navigate to Session Attributes via the sidebar
            await systemConsolePage.sidebar.systemAttributes.sessionAttributes.click();

            // * Verify the page loaded
            await sa.toBeVisible();

            const ipAddress = findFieldByName(fields, 'ip_address');
            const clientIpAddress = findFieldByName(fields, 'client_ip_address');
            const vpnActive = findFieldByName(fields, 'vpn_active');
            const networkInterfaceType = findFieldByName(fields, 'network_interface_type');
            const osVersion = findFieldByName(fields, 'os_version');

            // * Verify a representative row is rendered with its platform icons
            await expect(sa.row(ipAddress.id)).toBeVisible();
            await expect(sa.platforms(ipAddress.id)).toBeVisible();

            // * Verify request-derived fields carry the "Server" label
            await expect(sa.serverLabel(ipAddress.id)).toBeVisible();

            // * Verify a seeded-but-client-native field does NOT carry the Server label
            await expect(sa.serverLabel(clientIpAddress.id)).toHaveCount(0);

            // * Verify the derived Type column maps text/select fields correctly
            await expect(sa.type(ipAddress.id)).toContainText('IP');
            await expect(sa.type(vpnActive.id)).toContainText('Boolean');
            await expect(sa.type(networkInterfaceType.id)).toContainText('Enum');
            await expect(sa.type(osVersion.id)).toContainText('Version');

            // * Verify seeded fields render as Disabled by default
            await expect(sa.status(ipAddress.id)).toContainText('Disabled');
            await expect(sa.status(ipAddress.id)).toHaveAttribute('data-enabled', 'false');
        },
    );

    /**
     * @objective Verify staging a TTL preset, a Grace preset, and a one-click
     * Enable, then Saving, persists the changes after a full page reload.
     */
    test('persists TTL, grace, and enable edits after save and reload', {tag: '@session_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage, fields} = await setupSessionAttributesTest(pw);
        const sa = systemConsolePage.sessionAttributes;

        const field = findFieldByName(fields, 'os_version');

        // # Navigate to Session Attributes page
        await sa.goto();

        // # Stage a new TTL (1h), a new Grace period (5m), and enable the field
        await sa.setTtlPreset(field.id, 3600);
        await sa.setGracePreset(field.id, 300);
        await sa.enable(field.id);

        // * Verify the staged values are reflected before saving
        await expect(sa.ttl(field.id)).toHaveText('1h');
        await expect(sa.grace(field.id)).toHaveText('5m');
        await expect(sa.status(field.id)).toContainText('Enabled');

        // # Save the staged edits (one PATCH per changed field)
        await sa.saveAndWaitForSettled();

        // # Reload the page
        await sa.goto();

        // * Verify the edits persisted in the UI after reload
        await expect(sa.ttl(field.id)).toHaveText('1h');
        await expect(sa.grace(field.id)).toHaveText('5m');
        await expect(sa.status(field.id)).toContainText('Enabled');

        // * Verify the edits persisted server-side via the property API
        const persisted = await readSessionAttribute(adminClient, field.id);
        expect(persisted.ttl_seconds).toBe(3600);
        expect(persisted.grace_period_seconds).toBe(300);
        expect(persisted.enabled).toBe(true);
    });

    /**
     * @objective Verify disabling an enabled attribute requires confirming the
     * modal, and that the disabled state persists after save and reload.
     *
     * @precondition
     * The target session attribute is enabled via API before the test.
     */
    test('disables an enabled attribute via confirmation modal', {tag: '@session_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage, fields} = await setupSessionAttributesTest(pw);
        const sa = systemConsolePage.sessionAttributes;

        const field = findFieldByName(fields, 'client_version');

        // # Enable the field via API so the dot menu offers Disable
        await patchSessionAttribute(adminClient, field.id, {enabled: true});

        // # Navigate to Session Attributes page
        await sa.goto();

        // * Verify it shows as Enabled
        await expect(sa.status(field.id)).toContainText('Enabled');

        // # Open the dot menu and trigger Disable (opens the confirmation modal)
        await sa.openDisableModal(field.id);

        // * Verify the confirmation modal is shown
        await expect(sa.disableModal()).toBeVisible();

        // # Confirm the disable
        await sa.confirmDisable();

        // * Verify the staged status flips to Disabled before saving
        await expect(sa.status(field.id)).toContainText('Disabled');

        // # Save the staged change
        await sa.saveAndWaitForSettled();

        // # Reload the page
        await sa.goto();

        // * Verify the disabled state persisted in the UI and server-side
        await expect(sa.status(field.id)).toContainText('Disabled');
        const persisted = await readSessionAttribute(adminClient, field.id);
        expect(persisted.enabled).toBe(false);
    });

    /**
     * @objective Verify a staged edit blocks sidebar navigation with a discard
     * prompt, and that Cancel reverts the staged change.
     */
    test('blocks navigation while dirty and reverts on cancel', {tag: '@session_attributes'}, async ({pw}) => {
        const {systemConsolePage, fields} = await setupSessionAttributesTest(pw);
        const sa = systemConsolePage.sessionAttributes;
        const page = systemConsolePage.page;

        const field = findFieldByName(fields, 'ssid');

        // # Navigate to Session Attributes page
        await sa.goto();

        // # Capture the rendered TTL, then stage a different TTL (24h)
        const beforeTtl = (await sa.ttl(field.id).textContent())?.trim() ?? '';
        await sa.setTtlPreset(field.id, 86400);

        // * Verify the edit is staged and Save is enabled
        await expect(sa.ttl(field.id)).toHaveText('24h');
        await expect(sa.saveButton).toBeEnabled();

        // # Attempt to navigate away via the sidebar while dirty
        await systemConsolePage.sidebar.systemAttributes.userAttributes.click();

        // * Verify the unsaved-changes navigation guard appears
        const discardModal = page.getByRole('dialog').filter({hasText: 'Discard Changes?'});
        await expect(discardModal).toBeVisible();
        await expect(discardModal.getByText('You have unsaved changes', {exact: false})).toBeVisible();

        // # Decline the discard prompt to stay on the page
        await discardModal.getByRole('button', {name: 'Cancel'}).click();
        await expect(discardModal).toBeHidden();

        // # Cancel the staged edit via the Save Changes panel
        await sa.cancel();

        // * Verify the TTL reverted and Save returned to disabled
        await expect(sa.ttl(field.id)).toHaveText(beforeTtl);
        await expect(sa.saveButton).toBeDisabled();
    });

    /**
     * @objective Verify session attributes are selectable in a permission-policy
     * editor's attribute picker but absent from a membership-policy editor's picker.
     *
     * @precondition
     * ABAC is enabled, at least one user attribute exists, and a session
     * attribute is enabled via API.
     */
    test(
        'appears in permission-policy picker and is absent from membership-policy picker',
        {tag: '@session_attributes'},
        async ({pw}) => {
            test.setTimeout(120000);
            const {adminClient, systemConsolePage, fields} = await setupSessionAttributesTest(pw);
            const page = systemConsolePage.page;

            const sessionField = findFieldByName(fields, 'ip_address');

            // A second session attribute kept DISABLED: the merge lists enabled
            // attributes only, so this one must never reach the picker.
            const disabledSessionField = findFieldByName(fields, 'vpn_active');

            // # Ensure prerequisites: a user attribute, ABAC on, one session
            //   attribute enabled and a second one explicitly disabled.
            await ensureUserAttributes(adminClient, ['Department']);
            await patchSessionAttribute(adminClient, sessionField.id, {enabled: true});
            await patchSessionAttribute(adminClient, disabledSessionField.id, {enabled: false});
            await enableABAC(page);

            // Picker menu items are keyed by field id (`#attribute-<id>`), not by
            // name, so resolve the user attribute's id the same way the session
            // attribute ids come from the property-fields API.
            const userField = await getUserAttributeFieldByName(adminClient, 'Department');

            // ── Permission policy editor: session attribute IS available ──

            // # Open a new permission policy and add an attribute row
            await page.goto('/admin_console/system_attributes/permission_policies');
            await page.waitForLoadState('networkidle');
            await page.getByRole('button', {name: 'Add policy'}).click();
            await page.waitForLoadState('networkidle');
            await page.getByPlaceholder('Add a unique policy name').fill(`PP Session ${pw.random.id()}`);

            await openAttributePicker(page);

            const permissionMenu = page.getByRole('menu', {name: 'Select attribute'});
            await expect(permissionMenu).toBeVisible();

            // * Verify the SESSION ATTRIBUTES section and the enabled session attribute are present
            await expect(permissionMenu.getByText('Session attributes', {exact: true})).toBeVisible();
            await expect(permissionMenu.locator(`#attribute-${sessionField.id}`)).toBeVisible();

            // * Verify the DISABLED session attribute is absent (enabled-only filter)
            await expect(permissionMenu.locator(`#attribute-${disabledSessionField.id}`)).toHaveCount(0);

            // ── Membership policy editor: session attribute is NOT available ──
            //
            // Done before building a permission expression so this navigation
            // isn't blocked by the unsaved-changes guard.

            // # Open a new membership policy and add an attribute row
            await page.goto('/admin_console/system_attributes/membership_policies');
            await page.waitForLoadState('networkidle');
            await page.getByRole('button', {name: 'Add policy'}).click();
            await page.waitForLoadState('networkidle');
            await page
                .locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName')
                .fill(`MP Session ${pw.random.id()}`);

            await openAttributePicker(page);

            const membershipMenu = page.getByRole('menu', {name: 'Select attribute'});
            await expect(membershipMenu).toBeVisible();

            // * Verify the picker loaded user attributes (proves the menu is populated)
            await expect(membershipMenu.locator(`#attribute-${userField.id}`)).toBeVisible();

            // * Verify session attributes are absent from the membership picker
            await expect(membershipMenu.getByText('Session attributes', {exact: true})).toHaveCount(0);
            await expect(membershipMenu.locator(`#attribute-${sessionField.id}`)).toHaveCount(0);

            // ── CEL path: a picked session attribute generates user.session.<name> ──
            //
            // Last step: building an expression dirties the form, so any
            // navigation must already be complete.

            // # Open a fresh permission policy, pick the session attribute, set a value
            await page.goto('/admin_console/system_attributes/permission_policies');
            await page.waitForLoadState('networkidle');
            await page.getByRole('button', {name: 'Add policy'}).click();
            await page.waitForLoadState('networkidle');
            await page.getByPlaceholder('Add a unique policy name').fill(`PP CEL ${pw.random.id()}`);

            await openAttributePicker(page);

            const celMenu = page.getByRole('menu', {name: 'Select attribute'});
            await expect(celMenu).toBeVisible();
            await celMenu.locator(`#attribute-${sessionField.id}`).click();

            const valueInput = page.locator('.values-editor__simple-input').first();
            await valueInput.click();
            await valueInput.fill('10.0.0.1');
            await valueInput.press('Enter');

            // # Switch to Advanced (CEL) mode
            await page.getByRole('button', {name: 'Switch to Advanced Mode'}).click();

            // * Verify the generated CEL uses the session namespace, not user.attributes
            await expect(page.locator('.cel-editor')).toContainText('user.session.ip_address');
            await expect(page.locator('.cel-editor')).not.toContainText('user.attributes.ip_address');
        },
    );
});

/**
 * Add an attribute row in the policy table editor and open its attribute picker.
 * Shared by the permission and membership editor checks since both reuse the
 * same table-editor attribute selector.
 */
async function openAttributePicker(page: Page): Promise<void> {
    const addAttributeButton = page.getByRole('button', {name: /add attribute/i});
    await expect(addAttributeButton).toBeEnabled({timeout: 15000});
    await addAttributeButton.click();

    // Adding a row auto-opens the attribute menu. Only click the selector
    // button to open it when the auto-open didn't fire — clicking while the
    // menu is already open would land on its backdrop and be intercepted.
    const menu = page.getByRole('menu', {name: 'Select attribute'});
    try {
        await expect(menu).toBeVisible({timeout: 3000});
    } catch {
        await page.getByTestId('attributeSelectorMenuButton').first().click();
        await expect(menu).toBeVisible();
    }
}
