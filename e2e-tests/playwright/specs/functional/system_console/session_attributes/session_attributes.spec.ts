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

import {expect, test, type App, duration, Msg} from '@mattermost/playwright-lib';

import {ensureUserAttributes, getUserAttributeFieldByName} from '../abac/support';
import {openMembershipPolicies, openPermissionPolicies, setAbacEnabled} from '../abac/surface';

import {
    choosePreset,
    findFieldByName,
    openActions,
    openSessionAttributes,
    patchSessionAttribute,
    readSessionAttribute,
    restoreSessionAttributesToBaseline,
    saveAndSettle,
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
            const {app, fields} = await setupSessionAttributesTest(pw);
            const sa = app.admin.sessionAttributes;

            // # Navigate to Session Attributes via the sidebar
            await app.admin.sidebar.category('system_attributes').section('session_attributes').titleLink.click();
            await expect(sa.container).toBeVisible();

            // * Verify the page loaded
            await expect(sa.rowList).not.toHaveKeyCount(0);

            const ipAddress = findFieldByName(fields, 'ip_address');
            const clientIpAddress = findFieldByName(fields, 'client_ip_address');
            const vpnActive = findFieldByName(fields, 'vpn_active');
            const networkInterfaceType = findFieldByName(fields, 'network_interface_type');
            const osVersion = findFieldByName(fields, 'os_version');

            // * Verify a representative row is rendered with its platform icons
            await expect(sa.row(ipAddress.id)).toBeVisible();
            await expect(sa.row(ipAddress.id).platforms).toBeVisible();

            // * Verify request-derived fields carry the "Server" label
            await expect(sa.row(ipAddress.id).serverLabelText).toBeVisible();

            // * Verify a seeded-but-client-native field does NOT carry the Server label
            await expect(sa.row(clientIpAddress.id).serverLabelText).toHaveCount(0);

            // * Verify the derived Type column maps text/select fields correctly. getDisplayType()
            // (session_attributes/utils.ts) only distinguishes Boolean/Enum via select options;
            // every other field type, including ip_address and os_version, renders as String.
            await expect(sa.row(ipAddress.id).typeText).toContainMessage(Msg.admin.session_attributes.type.string);
            await expect(sa.row(vpnActive.id).typeText).toContainMessage(Msg.admin.session_attributes.type.boolean);
            await expect(sa.row(networkInterfaceType.id).typeText).toContainMessage(
                Msg.admin.session_attributes.type.enum,
            );
            await expect(sa.row(osVersion.id).typeText).toContainMessage(Msg.admin.session_attributes.type.string);

            // * Verify seeded fields render as Disabled by default
            await expect(sa.row(ipAddress.id).statusText).toContainMessage(
                Msg.admin.session_attributes.status.disabled,
            );
            await expect(sa.row(ipAddress.id).statusText).toHaveAttribute('data-enabled', 'false');
        },
    );

    /**
     * @objective Verify staging a TTL preset, a Grace preset, and a one-click
     * Enable, then Saving, persists the changes after a full page reload.
     */
    test('persists TTL, grace, and enable edits after save and reload', {tag: '@session_attributes'}, async ({pw}) => {
        const {adminClient, app, fields} = await setupSessionAttributesTest(pw);
        const field = findFieldByName(fields, 'os_version');

        // # Open Session Attributes, then stage a new TTL (1h), a new Grace period (5m), and enable the field
        let sa = await openSessionAttributes(app);
        await choosePreset(app, field, 'ttl', 3600);
        await choosePreset(app, field, 'grace', 300);
        await (await openActions(app, field)).enableMenuItem.click();

        // * Verify the staged values are reflected before saving
        await expect(sa.row(field.id).ttlText).toHaveText('1h');
        await expect(sa.row(field.id).graceText).toHaveText('5m');
        await expect(sa.row(field.id).statusText).toContainMessage(Msg.admin.session_attributes.status.enabled);

        // # Save the staged edits (one PATCH per changed field), and reload
        await saveAndSettle(app);
        sa = await openSessionAttributes(app);

        // * Verify the edits persisted in the UI after reload
        await expect(sa.row(field.id).ttlText).toHaveText('1h');
        await expect(sa.row(field.id).graceText).toHaveText('5m');
        await expect(sa.row(field.id).statusText).toContainMessage(Msg.admin.session_attributes.status.enabled);

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
        const {adminClient, app, fields} = await setupSessionAttributesTest(pw);
        const field = findFieldByName(fields, 'client_version');

        // # Enable the field via API so the actions menu offers Disable
        await patchSessionAttribute(adminClient, field.id, {enabled: true});

        // # Open Session Attributes
        let sa = await openSessionAttributes(app);

        // * Verify it shows as Enabled
        await expect(sa.row(field.id).statusText).toContainMessage(Msg.admin.session_attributes.status.enabled);

        // # Choose Disable from the actions menu, which asks for confirmation
        await (await openActions(app, field)).disableMenuItem.click();
        const {disableModal} = sa;
        await expect(disableModal).toContainMessage(Msg.admin.session_attributes.disable.title);

        // # Confirm the disable
        await disableModal.confirmButton.click();

        // * Verify the staged status flips to Disabled before saving
        await expect(sa.row(field.id).statusText).toContainMessage(Msg.admin.session_attributes.status.disabled);

        // # Save the staged change, and reload
        await saveAndSettle(app);
        sa = await openSessionAttributes(app);

        // * Verify the disabled state persisted in the UI and server-side
        await expect(sa.row(field.id).statusText).toContainMessage(Msg.admin.session_attributes.status.disabled);
        const persisted = await readSessionAttribute(adminClient, field.id);
        expect(persisted.enabled).toBe(false);
    });

    /**
     * @objective Verify a staged edit blocks sidebar navigation with a discard
     * prompt, and that Cancel reverts the staged change.
     *
     * Stages via one-click Enable rather than a TTL preset. The duration
     * submenu is covered by the persist test and is too racy here: the nav
     * guard only needs any unsaved edit.
     */
    test('blocks navigation while dirty and reverts on cancel', {tag: '@session_attributes'}, async ({pw}) => {
        const {app, fields} = await setupSessionAttributesTest(pw);
        const field = findFieldByName(fields, 'ssid');

        // # Open Session Attributes
        const sa = await openSessionAttributes(app);

        // # Stage a one-click Enable (dot menu, no duration submenu)
        await expect(sa.row(field.id).statusText).toContainMessage(Msg.admin.session_attributes.status.disabled);
        await (await openActions(app, field)).enableMenuItem.click();

        // * Verify the edit is staged and Save is enabled
        const {saveButton, cancelButton} = sa.savePanel;
        await expect(sa.row(field.id).statusText).toContainMessage(Msg.admin.session_attributes.status.enabled);
        await expect(saveButton).toBeEnabled();

        // # Attempt to navigate away via the sidebar while dirty
        await app.admin.sidebar.category('system_attributes').section('global_attributes').titleLink.click();

        // * Verify the unsaved-changes navigation guard appears
        const discard = app.discardChangesModal;
        await expect(discard).toContainText('Discard Changes?');
        await expect(discard).toContainMessage(Msg.saveChangesPanel.message);

        // # Decline the discard prompt to stay on the page
        await discard.cancelButton.click();
        await expect(discard.cancelButton).toBeHidden();

        // # Cancel the staged edit via the save panel
        await cancelButton.click();

        // * Verify the status reverted and Save returned to disabled
        await expect(sa.row(field.id).statusText).toContainMessage(Msg.admin.session_attributes.status.disabled);
        await expect(saveButton).toBeDisabled();
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
            test.setTimeout(duration.two_min);
            const {adminClient, app, fields} = await setupSessionAttributesTest(pw);

            const sessionField = findFieldByName(fields, 'ip_address');

            // A second session attribute kept DISABLED: the merge lists enabled
            // attributes only, so this one must never reach the picker.
            const disabledSessionField = findFieldByName(fields, 'vpn_active');

            // # Ensure prerequisites: a user attribute, ABAC on, one session
            //   attribute enabled and a second one explicitly disabled.
            await ensureUserAttributes(adminClient, ['Department']);
            await patchSessionAttribute(adminClient, sessionField.id, {enabled: true});
            await patchSessionAttribute(adminClient, disabledSessionField.id, {enabled: false});
            await setAbacEnabled(app, true);
            const userField = await getUserAttributeFieldByName(adminClient, 'Department');

            // ── Permission policy editor: session attribute IS available ──

            // # Open a new permission policy and add an attribute row
            const permissionPolicy = await newPermissionPolicy(app, `PP Session ${pw.random.id()}`);
            const permissionMenu = await addAttributeRow(permissionPolicy.rules);
            await expect(permissionMenu).toBeVisible();

            // * Verify the Session attributes section and the enabled session attribute are present
            await expect(permissionMenu).toContainText('Session attributes');
            await expect(permissionMenu.attribute(sessionField)).toBeVisible();

            // * Verify the DISABLED session attribute is absent (enabled-only filter)
            await expect(permissionMenu.attribute(disabledSessionField)).toHaveCount(0);

            // ── Membership policy editor: session attribute is NOT available ──
            //
            // Done before building a permission expression so this navigation
            // isn't blocked by the unsaved-changes guard.

            // # Open a new membership policy and add an attribute row
            const policies = await openMembershipPolicies(app);
            await policies.addButton.click();
            const membershipPolicy = app.admin.accessControl.policy;
            await expect(membershipPolicy.editPolicy.name.valueTextbox).toBeVisible();
            const membershipName = `MP Session ${pw.random.id()}`;
            await membershipPolicy.editPolicy.name.valueTextbox.fill(membershipName);
            await expect(membershipPolicy.editPolicy.name.valueTextbox).toHaveValue(membershipName);
            const membershipMenu = await addAttributeRow(membershipPolicy.rules);
            await expect(membershipMenu).toBeVisible();

            // * Verify the picker loaded user attributes (proves the menu is populated)
            await expect(membershipMenu.attribute(userField)).toBeVisible();

            // * Verify session attributes are absent from the membership picker
            await expect(membershipMenu).not.toContainText('Session attributes');
            await expect(membershipMenu.attribute(sessionField)).toHaveCount(0);

            // ── CEL path: a picked session attribute generates user.session.<name> ──
            //
            // Last step: building an expression dirties the form, so any
            // navigation must already be complete.

            // # Open a fresh permission policy, pick the session attribute, set a value
            const celPolicy = await newPermissionPolicy(app, `PP CEL ${pw.random.id()}`);
            const celMenu = await addAttributeRow(celPolicy.rules);
            await expect(celMenu).toBeVisible();
            await celMenu.attribute(sessionField).click();
            const row = celPolicy.rules.row(0);
            await expect(row.valueInputTextbox).toBeVisible();
            await row.valueInputTextbox.fill('10.0.0.1');
            await row.valueInputTextbox.press('Enter');
            await expect(row.valueInputTextbox).toHaveValue('10.0.0.1');

            // # Switch to Advanced (CEL) mode
            await celPolicy.switchModeButton.click();

            // * Verify the generated CEL uses the session namespace, not user.attributes
            await expect(celPolicy.cel.input).toContainText('user.session.ip_address');
            await expect(celPolicy.cel.input).not.toContainText('user.attributes.ip_address');
        },
    );
});

/** Opens a new permission policy and names it. */
async function newPermissionPolicy(app: App, name: string) {
    const list = await openPermissionPolicies(app);
    await list.addButton.click();
    await expect(list.edit.name.valueTextbox).toBeVisible();
    await list.edit.name.valueTextbox.fill(name);
    await expect(list.edit.name.valueTextbox).toHaveValue(name);
    return app.admin.permissionPolicy;
}

/**
 * Adds an attribute row in a policy's rule table; the new row's attribute picker opens by itself. Shared by the
 * permission and membership editor checks, since both reuse the same table editor.
 */
async function addAttributeRow(
    rules: App['admin']['permissionPolicy']['rules'] | App['admin']['accessControl']['policy']['rules'],
) {
    const row = rules.row((await rules.rowList.keys()).length);
    await expect(rules.addButton).toBeEnabled({timeout: duration.half_min});
    await rules.addButton.click();
    await expect(row.attributeMenu).toBeVisible();
    return row.attributeMenu;
}
