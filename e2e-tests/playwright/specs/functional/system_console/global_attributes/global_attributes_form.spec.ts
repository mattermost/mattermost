// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console — Global Attributes create/edit form (Definition, options, external
 * source, Applies-to). Assumes the GlobalAttributes flag is already on — flag-off
 * coverage lives in global_attributes_listing.spec.ts so this file never turns it off.
 *
 * Local runs: upload or use a license with SkuShortName `enterprise`, `entry`, or `advanced`.
 */

import {expect, test, getAdminClient} from '@mattermost/playwright-lib';

import {
    GLOBAL_ATTRIBUTES_ADMIN_PATH,
    createGlobalAttributeField,
    createLinkedDependentField,
    deleteAppliesToAttributeAndLinkedFieldsIfExists,
    deleteGlobalAttributeFieldIfExists,
    fetchLinkedFieldsForTemplate,
    requireGlobalAttributesEnabled,
    setGlobalAttributesFeatureFlag,
} from './global_attributes_helpers';

test.describe('System Console - Global Attributes form', {tag: '@system_console'}, () => {
    // Serial so create/edit/applies-to tests on the shared server do not overlap mid-save.
    test.describe.configure({mode: 'serial'});

    let originalFlagValue: boolean | undefined;

    test.beforeAll(async () => {
        const {adminClient} = await getAdminClient();
        const {FeatureFlags} = await adminClient.getConfig();
        originalFlagValue = FeatureFlags.GlobalAttributes === true;
    });

    test.afterAll(async () => {
        const {adminClient} = await getAdminClient();
        if (adminClient && originalFlagValue !== undefined) {
            await setGlobalAttributesFeatureFlag(adminClient, originalFlagValue);
        }
    });

    test.describe('create attribute', () => {
        /**
         * @objective Ensure the full create flow works end-to-end: the "New attribute" button
         * navigates to the create page, the Unique name live-updates from Display name, the
         * Edit/Done toggle round-trips correctly, and Save creates a real bare Text template
         * that shows up back in the Manage Attributes list.
         */
        test('creates a bare Text attribute via the New attribute page and shows it in the list', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            // Avoids an "E2E" prefix: slugifyForCEL's camelCase/digit-boundary regex
            // (webapp/channels/src/utils/properties.ts) inserts an underscore between
            // any lowercase-or-digit character immediately followed by an uppercase
            // one, so "E2E ..." would actually slugify to "e2_e_..." (verified against
            // slugifyForCEL directly), not the naively-expected "e2e_...". "Playwright"
            // has no internal case/digit boundary, so its derived slug is unambiguous.
            // The prefix is kept short on purpose: the Unique name input is capped at
            // Constants.MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH (40), and a 13-digit Date.now()
            // leaves only 27 characters for everything before it. A longer prefix derives
            // a silently truncated slug that no longer matches the expectation below.
            const timestamp = Date.now();
            const displayName = `Playwright Attr ${timestamp}`;
            const expectedName = `playwright_attr_${timestamp}`;

            try {
                // # Log in and open the Manage Attributes page
                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                // # Click "New attribute" to open the create page
                await systemConsolePage.page.getByTestId('newAttributeButton').click();
                await expect(systemConsolePage.page).toHaveURL(/attribute_details/);

                // # Fill in the Display name; the Unique name caption auto-derives live
                await systemConsolePage.page.getByTestId('attributeDisplayNameInput').fill(displayName);
                await expect(systemConsolePage.page.getByTestId('attributeUniqueNameValue')).toHaveText(expectedName);

                // # Exercise the Edit/Done round-trip once, confirming the input is focused
                // and seeded, then revert back to static display without changing the value
                await systemConsolePage.page.getByTestId('attributeNameEditLink').click();
                const nameInput = systemConsolePage.page.getByTestId('attributeNameInput');
                await expect(nameInput).toBeFocused();
                await expect(nameInput).toHaveValue(expectedName);
                await systemConsolePage.page.getByTestId('attributeNameEditLink').click();
                await expect(systemConsolePage.page.getByTestId('attributeUniqueNameValue')).toHaveText(expectedName);

                // # Save
                await systemConsolePage.page.getByTestId('saveSetting').click();

                // * Redirected back to the Manage Attributes list
                await expect(systemConsolePage.page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));

                // * The new attribute renders with the expected Display name, Type, and Source
                const row = systemConsolePage.page.locator('tr', {
                    has: systemConsolePage.page.getByTestId('global-attribute-name').filter({hasText: displayName}),
                });
                await expect(row.getByTestId('global-attribute-name')).toHaveText(displayName);
                await expect(row.getByTestId('global-attribute-type')).toContainText('Text');
                await expect(row.getByTestId('global-attribute-source')).toContainText('Managed here');
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, expectedName);
            }
        });

        /**
         * @objective Ensure a Display name that auto-slugs straight to a reserved CEL word shows
         * a specific inline error, disables Save, and does not navigate away — without the admin
         * ever clicking "Edit" to reach the manual Name input.
         */
        test('shows an inline error and does not navigate away when the auto-derived Name is a reserved word', async ({
            pw,
        }) => {
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            // # Log in and open the Manage Attributes page
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

            // # Open the create page
            await systemConsolePage.page.getByTestId('newAttributeButton').click();
            await expect(systemConsolePage.page).toHaveURL(/attribute_details/);

            // # Type a Display name that auto-slugs straight to a reserved CEL keyword
            await systemConsolePage.page.getByTestId('attributeDisplayNameInput').fill('For');

            // * Inline validation error is shown without ever clicking "Edit"
            await expect(systemConsolePage.page.getByTestId('attributeUniqueNameError')).toContainText('reserved word');
            // * Save is disabled
            await expect(systemConsolePage.page.getByTestId('saveSetting')).toBeDisabled();

            // * No navigation occurred
            await expect(systemConsolePage.page).toHaveURL(/attribute_details/);
        });

        /**
         * @objective Ensure "Done", Enter, and blur all refuse to commit an invalid manual Unique
         * name, so a reserved word can never be left sitting in the field, and that correcting the
         * value unblocks the commit and lets the attribute save for real.
         */
        test('blocks Done, Enter, and blur while the manual Unique name is a reserved word, then commits once corrected', async ({
            pw,
        }) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            // The prefix is kept short deliberately: the Unique name input is capped at
            // Constants.MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH (40), and a 13-digit Date.now() leaves
            // only 27 characters ahead of it. A longer prefix derives a silently truncated slug
            // that no longer matches the expectations below.
            const displayName = `Playwright Resv ${timestamp}`;
            const autoDerivedName = `playwright_resv_${timestamp}`;
            // The corrected value -- typed by appending to the rejected "for", which is how an
            // admin would actually fix it. Still starts with a letter, so it stays a valid
            // CEL identifier, and the timestamp keeps it unique across runs.
            const correctedName = `for_${timestamp}`;

            try {
                // # Log in and open the create page
                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
                await systemConsolePage.page.getByTestId('newAttributeButton').click();
                await expect(systemConsolePage.page).toHaveURL(/attribute_details/);

                await systemConsolePage.page.getByTestId('attributeDisplayNameInput').fill(displayName);
                await expect(systemConsolePage.page.getByTestId('attributeUniqueNameValue')).toHaveText(
                    autoDerivedName,
                );

                // # Open the manual Name editor and replace the auto-derived slug with a reserved word
                await systemConsolePage.page.getByTestId('attributeNameEditLink').click();
                const nameInput = systemConsolePage.page.getByTestId('attributeNameInput');
                await nameInput.fill('for');

                // * The inline error appears and Done reports itself as unavailable, while staying
                // focusable (aria-disabled, not the disabled attribute) and pointing at the reason
                const doneLink = systemConsolePage.page.getByTestId('attributeNameEditLink');
                await expect(systemConsolePage.page.getByTestId('attributeUniqueNameError')).toContainText(
                    'reserved word',
                );
                await expect(doneLink).toHaveAttribute('aria-disabled', 'true');
                await expect(doneLink).toHaveAttribute('aria-describedby', 'attribute-unique-name-error');

                // * Still reachable by keyboard -- this is the whole reason the block is expressed
                // as aria-disabled rather than the disabled attribute, which would drop Done out
                // of the tab order and leave a keyboard user with no way to discover why
                await nameInput.press('Tab');
                await expect(doneLink).toBeFocused();

                // # Click Done anyway. `force` skips Playwright's own actionability checks, which
                // treat aria-disabled as disabled and would otherwise refuse to dispatch the click
                // -- the point of this step is that the click really does reach the handler and is
                // rejected there, not that Playwright declined to send it.
                await doneLink.click({force: true});

                // * Rejected -- the editor is still open with the reserved word still in it,
                // rather than the value being committed into the field behind a lingering error
                await expect(nameInput).toBeVisible();
                await expect(nameInput).toHaveValue('for');
                await expect(doneLink).toHaveText('Done');

                // # Press Enter, which routes through the same commit path
                await nameInput.press('Enter');

                // * Also rejected
                await expect(nameInput).toBeVisible();
                await expect(nameInput).toHaveValue('for');
                await expect(systemConsolePage.page.getByTestId('attributeUniqueNameError')).toContainText(
                    'reserved word',
                );

                // # Click away onto the Display name field (blur), same commit path as Done/Enter
                await systemConsolePage.page.getByTestId('attributeDisplayNameInput').click();

                // * Also rejected -- the editor stays open rather than committing on click-away
                await expect(nameInput).toBeVisible();
                await expect(nameInput).toHaveValue('for');
                await expect(doneLink).toHaveText('Done');

                // # Correct the value by typing the rest of the identifier
                await nameInput.click();
                await nameInput.press('End');
                await nameInput.pressSequentially(`_${timestamp}`);

                // * The error clears and Done is live again
                await expect(systemConsolePage.page.getByTestId('attributeUniqueNameError')).toHaveCount(0);
                await expect(doneLink).not.toHaveAttribute('aria-disabled', 'true');

                // # Commit with Enter this time
                await nameInput.press('Enter');

                // * Committed -- the editor closed and the corrected Name is shown
                await expect(systemConsolePage.page.getByTestId('attributeNameInput')).toHaveCount(0);
                await expect(systemConsolePage.page.getByTestId('attributeUniqueNameValue')).toHaveText(correctedName);

                // # Save
                await systemConsolePage.page.getByTestId('saveSetting').click();

                // * The attribute was created with the corrected Name
                await expect(systemConsolePage.page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));
                const row = systemConsolePage.page.locator('tr', {
                    has: systemConsolePage.page.getByTestId('global-attribute-name').filter({hasText: displayName}),
                });
                await expect(row.getByTestId('global-attribute-name')).toHaveText(displayName);
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, correctedName);
            }
        });

        /**
         * @objective Ensure the blocked Done is not a dead end: an admin who has typed an invalid
         * Unique name can still get out by clearing the field (which reverts) or by pressing
         * Escape (which discards), without ever having to fix the value first.
         */
        test('leaves both escape hatches open when the manual Unique name is invalid', async ({pw}) => {
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            // Short prefix: see the 40-char Unique name cap noted in the reserved-word test above
            const displayName = `Playwright Esc ${timestamp}`;
            const autoDerivedName = `playwright_esc_${timestamp}`;

            // # Log in and open the create page
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
            await systemConsolePage.page.getByTestId('newAttributeButton').click();
            await expect(systemConsolePage.page).toHaveURL(/attribute_details/);

            await systemConsolePage.page.getByTestId('attributeDisplayNameInput').fill(displayName);

            // # Escape hatch 1: clear the field. An empty Name has no validation error, so Done
            // goes live again and applies its usual revert.
            await systemConsolePage.page.getByTestId('attributeNameEditLink').click();
            const nameInput = systemConsolePage.page.getByTestId('attributeNameInput');
            await nameInput.fill('for');

            const doneLink = systemConsolePage.page.getByTestId('attributeNameEditLink');
            await expect(doneLink).toHaveAttribute('aria-disabled', 'true');

            await nameInput.fill('');
            await expect(doneLink).not.toHaveAttribute('aria-disabled', 'true');
            await doneLink.click();

            // * Exited edit mode, reverted to the auto-derived slug, no error left behind
            await expect(systemConsolePage.page.getByTestId('attributeNameInput')).toHaveCount(0);
            await expect(systemConsolePage.page.getByTestId('attributeUniqueNameValue')).toHaveText(autoDerivedName);
            await expect(systemConsolePage.page.getByTestId('attributeUniqueNameError')).toHaveCount(0);

            // # Escape hatch 2: press Escape while the field is invalid, discarding the edit
            await systemConsolePage.page.getByTestId('attributeNameEditLink').click();
            await systemConsolePage.page.getByTestId('attributeNameInput').fill('for');
            await expect(systemConsolePage.page.getByTestId('attributeNameEditLink')).toHaveAttribute(
                'aria-disabled',
                'true',
            );
            await systemConsolePage.page.getByTestId('attributeNameInput').press('Escape');

            // * Exited edit mode with the reserved word discarded
            await expect(systemConsolePage.page.getByTestId('attributeNameInput')).toHaveCount(0);
            await expect(systemConsolePage.page.getByTestId('attributeUniqueNameValue')).toHaveText(autoDerivedName);
            await expect(systemConsolePage.page.getByTestId('attributeUniqueNameError')).toHaveCount(0);

            // * Save is available again, since the Name is back to a valid auto-derived slug
            await expect(systemConsolePage.page.getByTestId('saveSetting')).toBeEnabled();
        });

        /**
         * @objective Ensure clicking away from the Unique name input is the same as Done: an
         * unchanged seed keeps auto-derivation live, and an actual edit pins the Name so further
         * Display name changes no longer rewrite it. Mirrors the channel URL field in create/settings.
         */
        test('treats clicking away from Unique name as Done: no-op keeps derivation, an edit pins', async ({pw}) => {
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            // Short prefix: see the 40-char Unique name cap noted in the reserved-word test above
            const displayName = `Playwright Blur ${timestamp}`;
            const autoDerivedName = `playwright_blur_${timestamp}`;
            const extendedDisplayName = `${displayName} Two`;
            const extendedAutoDerivedName = `${autoDerivedName}_two`;
            const pinnedName = `custom_blur_${timestamp}`;

            // # Log in and open the create page
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
            await systemConsolePage.page.getByTestId('newAttributeButton').click();
            await expect(systemConsolePage.page).toHaveURL(/attribute_details/);

            const displayNameInput = systemConsolePage.page.getByTestId('attributeDisplayNameInput');
            await displayNameInput.fill(displayName);
            await expect(systemConsolePage.page.getByTestId('attributeUniqueNameValue')).toHaveText(autoDerivedName);

            // # Open the editor and click away without changing the seeded value
            await systemConsolePage.page.getByTestId('attributeNameEditLink').click();
            await expect(systemConsolePage.page.getByTestId('attributeNameInput')).toBeFocused();
            await displayNameInput.click();

            // * Exited edit mode, still showing the auto-derived slug
            await expect(systemConsolePage.page.getByTestId('attributeNameInput')).toHaveCount(0);
            await expect(systemConsolePage.page.getByTestId('attributeNameEditLink')).toHaveText('Edit');
            await expect(systemConsolePage.page.getByTestId('attributeUniqueNameValue')).toHaveText(autoDerivedName);

            // * Auto-derivation is still live
            await displayNameInput.fill(extendedDisplayName);
            await expect(systemConsolePage.page.getByTestId('attributeUniqueNameValue')).toHaveText(
                extendedAutoDerivedName,
            );

            // # Open the editor, type a different Name, and click away
            await systemConsolePage.page.getByTestId('attributeNameEditLink').click();
            await systemConsolePage.page.getByTestId('attributeNameInput').fill(pinnedName);
            await displayNameInput.click();

            // * Committed -- the editor closed and the typed Name is shown
            await expect(systemConsolePage.page.getByTestId('attributeNameInput')).toHaveCount(0);
            await expect(systemConsolePage.page.getByTestId('attributeUniqueNameValue')).toHaveText(pinnedName);

            // * Manual override stays in effect -- further Display name edits do not overwrite it
            await displayNameInput.fill(`${extendedDisplayName} Three`);
            await expect(systemConsolePage.page.getByTestId('attributeUniqueNameValue')).toHaveText(pinnedName);
        });

        /**
         * @objective Ensure a Select attribute can be created end-to-end with a real options
         * editor: type switch, add two options via Enter, Save is blocked until an option exists,
         * and the saved attribute shows the correct type/option count back in the list.
         */
        test('creates a Select attribute with two options via the options editor', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            // Short prefix: see the 40-char Unique name cap noted in the bare-Text test above
            const displayName = `Playwright Select ${timestamp}`;
            const expectedName = `playwright_select_${timestamp}`;

            try {
                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await systemConsolePage.page.getByTestId('newAttributeButton').click();
                await expect(systemConsolePage.page).toHaveURL(/attribute_details/);

                await systemConsolePage.page.getByTestId('attributeDisplayNameInput').fill(displayName);
                await expect(systemConsolePage.page.getByTestId('attributeUniqueNameValue')).toHaveText(expectedName);

                // # Switch type to Select
                await systemConsolePage.page.getByTestId('attributeTypeMenuButton').click();
                await systemConsolePage.page.getByRole('menuitemradio', {name: 'Select', exact: true}).click();

                // * Save is disabled with zero options, with an inline reason shown
                await expect(systemConsolePage.page.getByTestId('attributeOptionsRequiredError')).toContainText(
                    'At least one option is required',
                );
                await expect(systemConsolePage.page.getByTestId('saveSetting')).toBeDisabled();

                // # Add two options via Enter
                const optionsInput = systemConsolePage.page.getByTestId('attributeOptionsValues__addInput');
                await optionsInput.fill('Engineering');
                await optionsInput.press('Enter');
                await optionsInput.fill('Sales');
                await optionsInput.press('Enter');

                // * Save is now enabled
                await expect(systemConsolePage.page.getByTestId('saveSetting')).toBeEnabled();
                await systemConsolePage.page.getByTestId('saveSetting').click();

                // * Redirected back to the list, showing the correct type and option count
                await expect(systemConsolePage.page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));
                const row = systemConsolePage.page.locator('tr', {
                    has: systemConsolePage.page.getByTestId('global-attribute-name').filter({hasText: displayName}),
                });
                await expect(row.getByTestId('global-attribute-type')).toContainText('Select');
                await expect(row.getByTestId('global-attribute-options')).toContainText('2 options');
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, expectedName);
            }
        });

        /**
         * @objective Ensure a Rank attribute can be created end-to-end, including reordering an
         * option via the keyboard-accessible "Rank" popover before Save, and that the saved
         * attribute shows the correct type/option count in the list.
         */
        test('creates a Rank attribute, reorders an option via the Rank popover, and saves', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            // Short prefix: see the 40-char Unique name cap noted in the bare-Text test above
            const displayName = `Playwright Ranked ${timestamp}`;
            const expectedName = `playwright_ranked_${timestamp}`;

            try {
                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await systemConsolePage.page.getByTestId('newAttributeButton').click();
                await systemConsolePage.page.getByTestId('attributeDisplayNameInput').fill(displayName);
                await expect(systemConsolePage.page.getByTestId('attributeUniqueNameValue')).toHaveText(expectedName);

                await systemConsolePage.page.getByTestId('attributeTypeMenuButton').click();
                await systemConsolePage.page.getByRole('menuitemradio', {name: /Ranked/}).click();

                const optionsInput = systemConsolePage.page.getByTestId('attributeOptionsRankValues__addInput');
                await optionsInput.fill('Low');
                await optionsInput.press('Enter');
                await optionsInput.fill('High');
                await optionsInput.press('Enter');

                // * Chips render in ascending rank order
                const chipLabels = systemConsolePage.page.getByTestId('attributeOptionsRankValues__chipLabel');
                await expect(chipLabels).toHaveText(['Low', 'High']);

                // # Reorder "High" to position 1 via its popover's Rank submenu
                await chipLabels.filter({hasText: 'High'}).click();
                await systemConsolePage.page.getByText('Rank', {exact: true}).click();
                await systemConsolePage.page.getByRole('menuitemradio', {name: '1'}).click();

                // * Reordered — "High" now renders first
                await expect(chipLabels).toHaveText(['High', 'Low']);

                await systemConsolePage.page.getByTestId('saveSetting').click();

                await expect(systemConsolePage.page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));
                const row = systemConsolePage.page.locator('tr', {
                    has: systemConsolePage.page.getByTestId('global-attribute-name').filter({hasText: displayName}),
                });
                await expect(row.getByTestId('global-attribute-type')).toContainText('Ranked');
                await expect(row.getByTestId('global-attribute-options')).toContainText('2 options');
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, expectedName);
            }
        });

        /**
         * @objective Ensure switching type mid-form preserves already-entered options rather than
         * discarding them, per the ticket's "freely switch types" requirement.
         */
        test('preserves already-entered options when switching type away and back', async ({pw}) => {
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

            await systemConsolePage.page.getByTestId('newAttributeButton').click();

            await systemConsolePage.page.getByTestId('attributeTypeMenuButton').click();
            await systemConsolePage.page.getByRole('menuitemradio', {name: 'Select', exact: true}).click();
            const optionsInput = systemConsolePage.page.getByTestId('attributeOptionsValues__addInput');
            await optionsInput.fill('Engineering');
            await optionsInput.press('Enter');

            // # Switch to Text (options editor unmounts) and back to Select
            await systemConsolePage.page.getByTestId('attributeTypeMenuButton').click();
            await systemConsolePage.page.getByRole('menuitemradio', {name: 'Text'}).click();
            await expect(systemConsolePage.page.getByTestId('attributeOptionsValues')).toHaveCount(0);

            await systemConsolePage.page.getByTestId('attributeTypeMenuButton').click();
            await systemConsolePage.page.getByRole('menuitemradio', {name: 'Select', exact: true}).click();

            // * The previously-entered option is still there, not discarded
            await expect(systemConsolePage.page.getByTestId('attributeOptionsValues__chipLabel')).toHaveText(
                'Engineering',
            );
        });

        /**
         * @objective Ensure a Text attribute can be linked to AD/LDAP via the external source
         * picker end-to-end, and that the Manage Attributes list picks up the new attrs.ldap
         * value with no further changes needed on that page.
         */
        test('creates a Text attribute linked to AD/LDAP via the external source picker', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            // Short prefix: see the 40-char Unique name cap noted in the bare-Text test above.
            // This one only uses expectedName for cleanup, so an over-long prefix leaked the
            // created field onto the shared server instead of failing loudly.
            const displayName = `Playwright Ldap ${timestamp}`;
            const expectedName = `playwright_ldap_${timestamp}`;

            try {
                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await systemConsolePage.page.getByTestId('newAttributeButton').click();
                await systemConsolePage.page.getByTestId('attributeDisplayNameInput').fill(displayName);

                // # Open the external source picker and link AD/LDAP
                await systemConsolePage.page.getByTestId('attributeExternalSourceTrigger').click();
                await systemConsolePage.page.getByRole('menuitem', {name: /AD\/LDAP/}).click();
                await systemConsolePage.page.getByRole('textbox').fill('employeeID');
                await systemConsolePage.page.getByRole('button', {name: 'Save'}).click();

                // * A chip for AD/LDAP now appears on the Options line, prefixed by Synced with, and Type shows Text
                await expect(systemConsolePage.page.getByTestId('attributeExternalSourceChip-ldap')).toBeVisible();
                await expect(systemConsolePage.page.getByTestId('attributeTypeMenuButton')).toContainText('Text');
                await expect(systemConsolePage.page.getByTestId('attributeExternalSourceSynced')).toContainText(
                    'Synced with',
                );

                await systemConsolePage.page.getByTestId('saveSetting').click();

                // * The new attribute shows "AD/LDAP" in the Source column
                await expect(systemConsolePage.page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));
                const row = systemConsolePage.page.locator('tr', {
                    has: systemConsolePage.page.getByTestId('global-attribute-name').filter({hasText: displayName}),
                });
                await expect(row.getByTestId('global-attribute-source')).toContainText('AD/LDAP');
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, expectedName);
            }
        });

        /**
         * @objective Ensure both AD/LDAP and SAML can be linked on the same attribute, that an
         * already-linked source is excluded from the "add" menu (and the trigger disappears
         * once both are linked), and that each chip shows the actual linked value, not just the
         * source name.
         */
        test('links both AD/LDAP and SAML, excludes an already-linked source from the menu, and shows the linked value in each chip', async ({
            pw,
        }) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            // Short prefix: see the 40-char Unique name cap noted in the bare-Text test above
            const displayName = `Playwright Dual ${timestamp}`;
            const expectedName = `playwright_dual_${timestamp}`;

            try {
                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await systemConsolePage.page.getByTestId('newAttributeButton').click();
                await systemConsolePage.page.getByTestId('attributeDisplayNameInput').fill(displayName);

                // # Before anything is linked, the menu offers both sources
                await systemConsolePage.page.getByTestId('attributeExternalSourceTrigger').click();
                await expect(systemConsolePage.page.getByRole('menuitem', {name: /AD\/LDAP/})).toBeVisible();
                await expect(systemConsolePage.page.getByRole('menuitem', {name: /^SAML/})).toBeVisible();

                // # Link AD/LDAP
                await systemConsolePage.page.getByRole('menuitem', {name: /AD\/LDAP/}).click();
                await systemConsolePage.page.getByPlaceholder('department').fill('employeeID');
                await systemConsolePage.page.getByRole('button', {name: 'Save'}).click();

                // * The chip shows the source and the value that was actually typed
                await expect(systemConsolePage.page.getByTestId('attributeExternalSourceChip-ldap')).toHaveText(
                    'AD/LDAP: employeeID',
                );

                // # Reopen the trigger -- AD/LDAP is no longer offered, only SAML
                await systemConsolePage.page.getByTestId('attributeExternalSourceTrigger').click();
                await expect(systemConsolePage.page.getByRole('menuitem', {name: /^SAML/})).toBeVisible();
                await expect(systemConsolePage.page.getByRole('menuitem', {name: /AD\/LDAP/})).not.toBeVisible();

                // # Link SAML too
                await systemConsolePage.page.getByRole('menuitem', {name: /^SAML/}).click();
                await systemConsolePage.page.getByPlaceholder('department').fill('position');
                await systemConsolePage.page.getByRole('button', {name: 'Save'}).click();

                // * Both chips are shown with their own values, and the trigger disappears
                // entirely -- there is nothing left to add
                await expect(systemConsolePage.page.getByTestId('attributeExternalSourceChip-ldap')).toHaveText(
                    'AD/LDAP: employeeID',
                );
                await expect(systemConsolePage.page.getByTestId('attributeExternalSourceChip-saml')).toHaveText(
                    'SAML: position',
                );
                await expect(systemConsolePage.page.getByTestId('attributeExternalSourceTrigger')).not.toBeVisible();

                await systemConsolePage.page.getByTestId('saveSetting').click();

                // * With both linked, the list's Source column shows both sources together
                await expect(systemConsolePage.page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));
                const row = systemConsolePage.page.locator('tr', {
                    has: systemConsolePage.page.getByTestId('global-attribute-name').filter({hasText: displayName}),
                });
                await expect(row.getByTestId('global-attribute-source')).toContainText('AD/LDAP, SAML');
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, expectedName);
            }
        });

        /**
         * @objective Ensure a linked chip's edit action reopens the modal pre-filled and commits
         * a changed value, and that its remove action clears the link immediately with no modal.
         */
        test("edits a linked chip's value via its edit action, and removes a link via its remove action with no modal", async ({
            pw,
        }) => {
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

            await systemConsolePage.page.getByTestId('newAttributeButton').click();

            // # Link AD/LDAP
            await systemConsolePage.page.getByTestId('attributeExternalSourceTrigger').click();
            await systemConsolePage.page.getByRole('menuitem', {name: /AD\/LDAP/}).click();
            await systemConsolePage.page.getByPlaceholder('department').fill('employeeID');
            await systemConsolePage.page.getByRole('button', {name: 'Save'}).click();
            await expect(systemConsolePage.page.getByTestId('attributeExternalSourceChip-ldap')).toHaveText(
                'AD/LDAP: employeeID',
            );

            // # Click the chip's edit action -- the modal reopens pre-filled with the current value
            await systemConsolePage.page.getByTestId('attributeExternalSourceChip-ldap-edit').click();
            await expect(systemConsolePage.page.getByPlaceholder('department')).toHaveValue('employeeID');

            // # Change the value and save
            await systemConsolePage.page.getByPlaceholder('department').fill('newEmployeeID');
            await systemConsolePage.page.getByRole('button', {name: 'Save'}).click();
            await expect(systemConsolePage.page.getByTestId('attributeExternalSourceChip-ldap')).toHaveText(
                'AD/LDAP: newEmployeeID',
            );

            // # Click the chip's remove action -- the link clears immediately, no modal opens
            await systemConsolePage.page.getByTestId('attributeExternalSourceChip-ldap-remove').click();
            await expect(systemConsolePage.page.getByTestId('attributeExternalSourceChip-ldap')).not.toBeVisible();
            await expect(systemConsolePage.page.getByPlaceholder('department')).not.toBeVisible();

            // * The trigger is back, offering AD/LDAP again since nothing is linked anymore
            await expect(systemConsolePage.page.getByTestId('attributeExternalSourceTrigger')).toBeVisible();
        });

        /**
         * @objective Ensure the picker warns before converting a non-Text field to Text, and that
         * once a source is linked the Type control is locked to Text until the last chip is removed.
         */
        test('warns before converting a non-Text field, and locks Type to Text while a source is linked', async ({
            pw,
        }) => {
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

            await systemConsolePage.page.getByTestId('newAttributeButton').click();

            // # Switch to Select, then try linking AD/LDAP
            await systemConsolePage.page.getByTestId('attributeTypeMenuButton').click();
            await systemConsolePage.page.getByRole('menuitemradio', {name: 'Select', exact: true}).click();
            await systemConsolePage.page.getByTestId('attributeExternalSourceTrigger').click();
            await systemConsolePage.page.getByRole('menuitem', {name: /AD\/LDAP/}).click();

            // * The modal warns the field will convert to Text
            await expect(systemConsolePage.page.getByText(/converted to a TEXT attribute/i)).toBeVisible();

            // # Save the link anyway
            await systemConsolePage.page.getByPlaceholder('department').fill('employeeID');
            await systemConsolePage.page.getByRole('button', {name: 'Save'}).click();

            // * Type switched to Text, a chip appeared, and Type is locked
            const typeButton = systemConsolePage.page.getByTestId('attributeTypeMenuButton');
            await expect(typeButton).toContainText('Text');
            await expect(systemConsolePage.page.getByTestId('attributeExternalSourceChip-ldap')).toBeVisible();
            await expect(typeButton).toBeDisabled();

            // # Remove the chip
            await systemConsolePage.page.getByTestId('attributeExternalSourceChip-ldap-remove').click();

            // * Type is editable again
            await expect(typeButton).toBeEnabled();
            await typeButton.click();
            await systemConsolePage.page.getByRole('menuitemradio', {name: 'Select', exact: true}).click();
            await expect(typeButton).toContainText('Select');
        });
    });

    test.describe('applies to', () => {
        /**
         * @objective Ensure a brand-new attribute's Applies-to card renders its empty state
         * correctly, with no resources and both "Add resource" triggers available.
         */
        test('shows the empty state with both Add-resource triggers, and no rows', async ({pw}) => {
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
            await systemConsolePage.page.getByTestId('newAttributeButton').click();

            // * Empty state renders with its heading/helper text
            await expect(systemConsolePage.page.getByTestId('attributeAppliesToEmptyState')).toBeVisible();

            // * No resource rows exist yet
            for (const type of ['user', 'channel', 'post']) {
                await expect(systemConsolePage.page.getByTestId(`attributeAppliesToRow-${type}`)).not.toBeVisible();
            }

            // * Both triggers are available
            await expect(systemConsolePage.page.getByTestId('attributeAppliesToAddResourceButtonHeader')).toBeVisible();
            await expect(systemConsolePage.page.getByTestId('attributeAppliesToAddResourceButtonInline')).toBeVisible();
        });

        /**
         * @objective Ensure the picker offers exactly the not-yet-selected types, adding one
         * removes it from the picker and renders its row, and once all three are added both
         * triggers disappear entirely.
         */
        test('offers only unselected types, renders a row per addition, and hides both triggers once all three are added', async ({
            pw,
        }) => {
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
            await systemConsolePage.page.getByTestId('newAttributeButton').click();

            // # Open the picker; all three types are offered, in order
            await systemConsolePage.page.getByTestId('attributeAppliesToAddResourceButtonHeader').click();
            const menuItems = systemConsolePage.page.getByRole('menuitem');
            await expect(menuItems).toHaveText(['Users', 'Channels', 'Posts']);

            // # Pick Users
            await systemConsolePage.page.getByRole('menuitem', {name: 'Users'}).click();

            // * Users row renders, empty state is gone
            await expect(systemConsolePage.page.getByTestId('attributeAppliesToRow-user')).toBeVisible();
            await expect(systemConsolePage.page.getByTestId('attributeAppliesToEmptyState')).not.toBeVisible();

            // # Reopen the picker -- only Channels and Posts remain
            await systemConsolePage.page.getByTestId('attributeAppliesToAddResourceButtonHeader').click();
            await expect(systemConsolePage.page.getByRole('menuitem')).toHaveText(['Channels', 'Posts']);

            // # Add Channels, then Posts
            await systemConsolePage.page.getByRole('menuitem', {name: 'Channels'}).click();
            await systemConsolePage.page.getByTestId('attributeAppliesToAddResourceButtonHeader').click();
            await systemConsolePage.page.getByRole('menuitem', {name: 'Posts'}).click();

            // * All three rows render, in insertion order
            await expect(systemConsolePage.page.getByTestId('attributeAppliesToRow-user')).toBeVisible();
            await expect(systemConsolePage.page.getByTestId('attributeAppliesToRow-channel')).toBeVisible();
            await expect(systemConsolePage.page.getByTestId('attributeAppliesToRow-post')).toBeVisible();

            // * Both triggers are gone now that all three types are selected
            await expect(
                systemConsolePage.page.getByTestId('attributeAppliesToAddResourceButtonHeader'),
            ).not.toBeVisible();
            await expect(
                systemConsolePage.page.getByTestId('attributeAppliesToAddResourceButtonInline'),
            ).not.toBeVisible();
        });

        /**
         * @objective Ensure removing a not-yet-saved resource is an immediate local change -- no
         * confirmation modal, no network call -- and the removed type becomes available in the
         * picker again.
         */
        test('removes a pending resource locally with no confirm modal and no delete request', async ({pw}) => {
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
            await systemConsolePage.page.getByTestId('newAttributeButton').click();

            // Regression guard: no property-field delete request fires for a pre-save removal.
            let deleteRequestFired = false;
            await systemConsolePage.page.route(
                '**/api/v4/properties/groups/access_control/*/fields/*',
                async (route) => {
                    if (route.request().method() === 'DELETE') {
                        deleteRequestFired = true;
                    }
                    await route.continue();
                },
            );

            // # Add Channels
            await systemConsolePage.page.getByTestId('attributeAppliesToAddResourceButtonHeader').click();
            await systemConsolePage.page.getByRole('menuitem', {name: 'Channels'}).click();
            await expect(systemConsolePage.page.getByTestId('attributeAppliesToRow-channel')).toBeVisible();

            // # Remove is only reachable once the row is expanded
            await expect(systemConsolePage.page.getByTestId('attributeAppliesToRow-channel-remove')).not.toBeVisible();
            await systemConsolePage.page.getByTestId('attributeAppliesToRow-channel-toggle').click();
            await systemConsolePage.page.getByTestId('attributeAppliesToRow-channel-remove').click();

            // * The row disappears immediately, no modal/dialog ever rendered
            await expect(systemConsolePage.page.getByTestId('attributeAppliesToRow-channel')).not.toBeVisible();
            await expect(systemConsolePage.page.getByRole('dialog')).not.toBeVisible();

            // # Reopen the picker -- Channels is offered again
            await systemConsolePage.page.getByTestId('attributeAppliesToAddResourceButtonHeader').click();
            await expect(systemConsolePage.page.getByRole('menuitem', {name: 'Channels'})).toBeVisible();

            expect(deleteRequestFired).toBe(false);
        });

        /**
         * @objective Ensure Save creates the template, then one linked field per selected
         * resource, each correctly pointing back at the template -- verified end-to-end against
         * the real server via the admin API, since the listing table's Applies-to column is a
         * hardcoded placeholder (see Out of Scope).
         */
        test('saves the template plus one linked field per selected resource', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const displayName = `Playwright Applies To ${timestamp}`;
            const expectedName = `playwright_applies_to_${timestamp}`;

            try {
                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
                await systemConsolePage.page.getByTestId('newAttributeButton').click();

                // # Fill Display name, add Users and Channels
                await systemConsolePage.page.getByTestId('attributeDisplayNameInput').fill(displayName);
                await systemConsolePage.page.getByTestId('attributeAppliesToAddResourceButtonHeader').click();
                await systemConsolePage.page.getByRole('menuitem', {name: 'Users'}).click();
                await systemConsolePage.page.getByTestId('attributeAppliesToAddResourceButtonHeader').click();
                await systemConsolePage.page.getByRole('menuitem', {name: 'Channels'}).click();

                // # Save
                await systemConsolePage.page.getByTestId('saveSetting').click();

                // * Redirected back to the Manage Attributes list
                await expect(systemConsolePage.page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));

                // * Exactly two linked fields exist, pointing back at the template
                const templateFields = await adminClient.getPropertyFields(
                    'access_control',
                    'template',
                    'system',
                    undefined,
                    {perPage: 200},
                );
                const templateField = templateFields.find((f) => f.name === expectedName && f.delete_at === 0);
                expect(templateField).toBeDefined();

                const linkedFields = await fetchLinkedFieldsForTemplate(adminClient, templateField!.id);
                expect(linkedFields).toHaveLength(2);

                const userField = linkedFields.find((f) => f.object_type === 'user');
                const channelField = linkedFields.find((f) => f.object_type === 'channel');
                expect(userField).toBeDefined();
                expect(channelField).toBeDefined();
                for (const field of [userField!, channelField!]) {
                    expect(field.target_type).toBe('system');
                    expect(field.linked_field_id).toBe(templateField!.id);
                    expect(field.attrs?.display_name).toBe(displayName);
                }
            } finally {
                await deleteAppliesToAttributeAndLinkedFieldsIfExists(adminClient, expectedName);
            }
        });

        /**
         * @objective Ensure a mid-save failure rolls back everything created in that attempt and
         * leaves Save retryable, rather than leaving an orphaned template or linked field behind.
         */
        test('rolls back a partial save and lets the admin retry successfully', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const displayName = `Playwright Applies To Retry ${timestamp}`;
            const expectedName = `playwright_applies_to_retry_${timestamp}`;

            try {
                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
                await systemConsolePage.page.getByTestId('newAttributeButton').click();

                // # Fill Display name, add Users, Channels, and Posts
                await systemConsolePage.page.getByTestId('attributeDisplayNameInput').fill(displayName);
                for (const label of ['Users', 'Channels', 'Posts']) {
                    await systemConsolePage.page.getByTestId('attributeAppliesToAddResourceButtonHeader').click();
                    await systemConsolePage.page.getByRole('menuitem', {name: label}).click();
                }

                // # Force the "post" linked-field creation request to fail; let user/channel/template through
                await systemConsolePage.page.route(
                    '**/api/v4/properties/groups/access_control/post/fields',
                    async (route) => {
                        if (route.request().method() === 'POST') {
                            await route.fulfill({
                                status: 500,
                                contentType: 'application/json',
                                body: JSON.stringify({message: 'forced failure'}),
                            });
                        } else {
                            await route.continue();
                        }
                    },
                );

                // # Click Save
                await systemConsolePage.page.getByTestId('saveSetting').click();

                // * The banner names the failed resource, and Save is re-clickable
                await expect(systemConsolePage.page.getByTestId('attributeSaveError')).toContainText('Posts');
                await expect(systemConsolePage.page.getByTestId('saveSetting')).not.toBeDisabled();

                // * Nothing survived the rollback -- no template, no user/channel linked fields
                const templateFieldsAfterFailure = await adminClient.getPropertyFields(
                    'access_control',
                    'template',
                    'system',
                    undefined,
                    {perPage: 200},
                );
                expect(
                    templateFieldsAfterFailure.find((f) => f.name === expectedName && f.delete_at === 0),
                ).toBeUndefined();

                const userFields = await adminClient.getPropertyFields('access_control', 'user', 'system', undefined, {
                    perPage: 200,
                });
                const channelFields = await adminClient.getPropertyFields(
                    'access_control',
                    'channel',
                    'system',
                    undefined,
                    {perPage: 200},
                );
                expect(userFields.find((f) => f.name === expectedName && f.delete_at === 0)).toBeUndefined();
                expect(channelFields.find((f) => f.name === expectedName && f.delete_at === 0)).toBeUndefined();

                // # Remove the interception and retry
                await systemConsolePage.page.unroute('**/api/v4/properties/groups/access_control/post/fields');
                await systemConsolePage.page.getByTestId('saveSetting').click();

                // * This time it succeeds
                await expect(systemConsolePage.page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));

                const templateFieldsAfterRetry = await adminClient.getPropertyFields(
                    'access_control',
                    'template',
                    'system',
                    undefined,
                    {perPage: 200},
                );
                const templateField = templateFieldsAfterRetry.find(
                    (f) => f.name === expectedName && f.delete_at === 0,
                );
                expect(templateField).toBeDefined();

                const linkedFields = await fetchLinkedFieldsForTemplate(adminClient, templateField!.id);
                expect(linkedFields).toHaveLength(3);
            } finally {
                await deleteAppliesToAttributeAndLinkedFieldsIfExists(adminClient, expectedName);
            }
        });
    });

    test.describe('edit attribute', () => {
        /**
         * @objective Opening Edit on a managed attribute prefills the Definition form and Save
         * PATCHes the existing template rather than creating a second one.
         */
        test('opens an existing attribute, PATCHes a display-name change, and shows it in the list', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const name = `e2e_global_attribute_edit_${timestamp}`;
            const displayName = `Playwright Edit ${timestamp}`;
            const updatedDisplayName = `${displayName} Updated`;

            try {
                const field = await createGlobalAttributeField(adminClient, name, {
                    type: 'text',
                    attrs: {display_name: displayName},
                });

                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                const {page} = systemConsolePage;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await page.getByTestId(`global-attribute-actions-${field.id}`).click();
                await page.locator(`#global-attribute-actions-${field.id}-edit`).click();

                await expect(page).toHaveURL(new RegExp(`attribute_details/${field.id}$`));
                await expect(page.getByRole('heading', {name: 'Edit attribute'})).toBeVisible();
                await expect(page.getByTestId('attributeDisplayNameInput')).toHaveValue(displayName);
                await expect(page.getByTestId('attributeUniqueNameValue')).toHaveText(name);

                await page.getByTestId('attributeDisplayNameInput').fill(updatedDisplayName);
                await page.getByTestId('saveSetting').click();

                await expect(page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));
                await expect(
                    page.getByTestId('global-attribute-name').filter({hasText: updatedDisplayName}),
                ).toBeVisible();
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, name);
            }
        });

        /**
         * @objective Type is locked while a persisted Applies-to resource is on the form.
         * Remove is local until Save, which DELETEs the linked field and leaves the template.
         */
        test('locks Type while a resource is applied, and Save deletes a removed linked field', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const name = `e2e_global_attribute_edit_remove_${timestamp}`;
            const displayName = `Playwright Remove ${timestamp}`;

            try {
                const field = await createGlobalAttributeField(adminClient, name, {
                    type: 'text',
                    attrs: {display_name: displayName},
                });
                await createLinkedDependentField(adminClient, name, field.id, 'text', 'user');

                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                const {page} = systemConsolePage;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await page.getByTestId(`global-attribute-actions-${field.id}`).click();
                await page.locator(`#global-attribute-actions-${field.id}-edit`).click();

                await expect(page.getByTestId('attributeAppliesToRow-user')).toBeVisible();
                await expect(page.getByTestId('attributeTypeMenuButton')).toBeDisabled();

                await page.getByTestId('attributeAppliesToRow-user-toggle').click();
                await page.getByTestId('attributeAppliesToRow-user-remove').click();
                await expect(page.getByTestId('attributeAppliesToRow-user')).toHaveCount(0);
                await expect(page.getByTestId('attributeTypeMenuButton')).toBeEnabled();

                await page.getByTestId('saveSetting').click();

                // # Removing a resource with stored values warns before deleting it
                await expect(page.getByRole('dialog')).toBeVisible();
                await page.getByRole('button', {name: 'Remove and save', exact: true}).click();

                await expect(page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));

                const remaining = await fetchLinkedFieldsForTemplate(adminClient, field.id);
                expect(remaining).toHaveLength(0);
                const templates = await adminClient.getPropertyFields(
                    'access_control',
                    'template',
                    'system',
                    undefined,
                    {
                        perPage: 200,
                    },
                );
                expect(templates.some((template) => template.id === field.id && template.delete_at === 0)).toBe(true);
            } finally {
                await deleteAppliesToAttributeAndLinkedFieldsIfExists(adminClient, name);
            }
        });

        /**
         * @objective Removing then re-adding the same resource before Save must not delete the
         * persisted linked field (and therefore must not wipe stored values).
         */
        test('does not delete a linked field that is removed then re-added before Save', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const name = `e2e_global_attribute_edit_readd_${timestamp}`;
            const displayName = `Playwright Readd ${timestamp}`;

            try {
                const field = await createGlobalAttributeField(adminClient, name, {
                    type: 'text',
                    attrs: {display_name: displayName},
                });
                const linked = await createLinkedDependentField(adminClient, name, field.id, 'text', 'user');

                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                const {page} = systemConsolePage;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await page.getByTestId(`global-attribute-actions-${field.id}`).click();
                await page.locator(`#global-attribute-actions-${field.id}-edit`).click();

                await page.getByTestId('attributeAppliesToRow-user-toggle').click();
                await page.getByTestId('attributeAppliesToRow-user-remove').click();
                await expect(page.getByTestId('attributeAppliesToRow-user')).toHaveCount(0);

                await page.getByTestId('attributeAppliesToAddResourceButtonHeader').click();
                await page.getByRole('menuitem', {name: 'Users'}).click();
                await expect(page.getByTestId('attributeAppliesToRow-user')).toBeVisible();

                await page.getByTestId('saveSetting').click();
                await expect(page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));

                const remaining = await fetchLinkedFieldsForTemplate(adminClient, field.id);
                expect(remaining).toHaveLength(1);
                expect(remaining[0].id).toBe(linked.id);
            } finally {
                await deleteAppliesToAttributeAndLinkedFieldsIfExists(adminClient, name);
            }
        });

        /**
         * @objective Locks the Unique name while any Applies-to resource is persisted -- renaming
         * would leave those linked fields on the old identifier, since the server does not
         * propagate a template rename onto them.
         */
        test('locks Unique name editing while a resource is applied, and unlocks only once Save persists its removal', async ({
            pw,
        }) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const name = `e2e_global_attribute_edit_name_lock_${timestamp}`;
            const displayName = `Playwright Name Lock ${timestamp}`;

            try {
                const field = await createGlobalAttributeField(adminClient, name, {
                    type: 'text',
                    attrs: {display_name: displayName},
                });
                await createLinkedDependentField(adminClient, name, field.id, 'text', 'user');

                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                const {page} = systemConsolePage;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await page.getByTestId(`global-attribute-actions-${field.id}`).click();
                await page.locator(`#global-attribute-actions-${field.id}-edit`).click();

                await expect(page.getByTestId('attributeAppliesToRow-user')).toBeVisible();
                await expect(page.getByTestId('attributeNameEditLink')).toBeDisabled();

                // # A pending local removal does not unlock the Name -- the dependent field is
                // still live on the server until Save actually removes it
                await page.getByTestId('attributeAppliesToRow-user-toggle').click();
                await page.getByTestId('attributeAppliesToRow-user-remove').click();
                await expect(page.getByTestId('attributeAppliesToRow-user')).toHaveCount(0);
                await expect(page.getByTestId('attributeNameEditLink')).toBeDisabled();

                await page.getByTestId('saveSetting').click();
                await expect(page.getByRole('dialog')).toBeVisible();
                await page.getByRole('button', {name: 'Remove and save', exact: true}).click();
                await expect(page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));

                // * Only once the removal is actually persisted does re-opening the attribute
                // show the Name as editable
                await page.getByTestId(`global-attribute-actions-${field.id}`).click();
                await page.locator(`#global-attribute-actions-${field.id}-edit`).click();
                await expect(page.getByTestId('attributeAppliesToRow-user')).toHaveCount(0);
                await expect(page.getByTestId('attributeNameEditLink')).toBeEnabled();
            } finally {
                await deleteAppliesToAttributeAndLinkedFieldsIfExists(adminClient, name);
            }
        });

        /**
         * @objective Declining the remove-applies-to warning aborts the save entirely -- no PATCH,
         * no DELETE, and the admin stays on the form with the persisted linked field untouched.
         */
        test('cancelling the remove-applies-to warning leaves the linked field untouched', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const name = `e2e_global_attribute_edit_cancel_remove_${timestamp}`;
            const displayName = `Playwright Cancel Remove ${timestamp}`;

            try {
                const field = await createGlobalAttributeField(adminClient, name, {
                    type: 'text',
                    attrs: {display_name: displayName},
                });
                const linked = await createLinkedDependentField(adminClient, name, field.id, 'text', 'user');

                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                const {page} = systemConsolePage;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await page.getByTestId(`global-attribute-actions-${field.id}`).click();
                await page.locator(`#global-attribute-actions-${field.id}-edit`).click();

                await page.getByTestId('attributeAppliesToRow-user-toggle').click();
                await page.getByTestId('attributeAppliesToRow-user-remove').click();
                await expect(page.getByTestId('attributeAppliesToRow-user')).toHaveCount(0);

                await page.getByTestId('saveSetting').click();
                await expect(page.getByRole('dialog')).toBeVisible();
                await page.getByRole('button', {name: 'Cancel', exact: true}).click();

                // * Still on the form, Save re-clickable, nothing sent to the server
                await expect(page).toHaveURL(new RegExp(`attribute_details/${field.id}$`));
                await expect(page.getByTestId('saveSetting')).toBeEnabled();

                const remaining = await fetchLinkedFieldsForTemplate(adminClient, field.id);
                expect(remaining).toHaveLength(1);
                expect(remaining[0].id).toBe(linked.id);
            } finally {
                await deleteAppliesToAttributeAndLinkedFieldsIfExists(adminClient, name);
            }
        });

        /**
         * @objective Regression guard for the ordering bug: when the type is not changing, a
         * failed PATCH (e.g. a name conflict) must abort the save before the confirmed removal's
         * DELETE ever runs -- otherwise the linked field's stored values are lost even though
         * Save reported failure.
         */
        test('does not delete a confirmed-removed linked field when the PATCH fails and type is unchanged', async ({
            pw,
        }) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const name = `e2e_global_attribute_edit_patch_fail_${timestamp}`;
            const displayName = `Playwright Patch Fail ${timestamp}`;

            try {
                const field = await createGlobalAttributeField(adminClient, name, {
                    type: 'text',
                    attrs: {display_name: displayName},
                });
                const linked = await createLinkedDependentField(adminClient, name, field.id, 'text', 'user');

                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                const {page} = systemConsolePage;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await page.getByTestId(`global-attribute-actions-${field.id}`).click();
                await page.locator(`#global-attribute-actions-${field.id}-edit`).click();

                await page.getByTestId('attributeAppliesToRow-user-toggle').click();
                await page.getByTestId('attributeAppliesToRow-user-remove').click();
                await expect(page.getByTestId('attributeAppliesToRow-user')).toHaveCount(0);

                // # Force the template PATCH to fail for a reason unrelated to type (e.g. a
                // name conflict), without touching the DELETE/POST linked-field requests
                await page.route(
                    `**/api/v4/properties/groups/access_control/template/fields/${field.id}`,
                    async (route) => {
                        if (route.request().method() === 'PATCH') {
                            await route.fulfill({
                                status: 400,
                                contentType: 'application/json',
                                body: JSON.stringify({
                                    id: 'app.property_field.update.name_conflict.app_error',
                                    message: 'forced name conflict',
                                }),
                            });
                        } else {
                            await route.continue();
                        }
                    },
                );

                await page.getByTestId('saveSetting').click();
                await expect(page.getByRole('dialog')).toBeVisible();
                await page.getByRole('button', {name: 'Remove and save', exact: true}).click();

                // * Save reports failure and stays on the form
                await expect(page.getByTestId('attributeSaveError')).toBeVisible();
                await expect(page).toHaveURL(new RegExp(`attribute_details/${field.id}$`));

                // * The linked field survives -- PATCH ran (and failed) before any DELETE could
                const remaining = await fetchLinkedFieldsForTemplate(adminClient, field.id);
                expect(remaining).toHaveLength(1);
                expect(remaining[0].id).toBe(linked.id);
            } finally {
                await deleteAppliesToAttributeAndLinkedFieldsIfExists(adminClient, name);
            }
        });
    });
});
