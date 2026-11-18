// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines -- the suite shares one server setup; splitting it would restart the server once per file */

/**
 * System Console — Global Attributes create/edit form (Definition, options, external
 * source, Applies-to).
 *
 * Local runs: upload or use a license with SkuShortName `enterprise`, `entry`, or `advanced`.
 */

import type {Locator} from '@playwright/test';
import type {PropertyField} from '@mattermost/types/properties';

import {expect, keyOfElement, Msg, postWith, test, type App, Api, settle} from '@mattermost/playwright-lib';

import {
    GLOBAL_ATTRIBUTES_ADMIN_PATH,
    attributeDetailsPath,
    attributesPath,
    createGlobalAttributeField,
    defined,
    listedAttribute,
    createLinkedDependentField,
    deleteAppliesToAttributeAndLinkedFieldsIfExists,
    deleteGlobalAttributeFieldIfExists,
    deleteLinkedDependentField,
    fetchLinkedFieldsForTemplate,
    getGlobalAttributeFieldByName,
    getGlobalAttributeFieldOptions,
    requireGlobalAttributesEnabled,
    requireHierarchicalAttributesEnabled,
} from './global_attributes_helpers';

test.describe('System Console - Global Attributes form', {tag: '@system_console'}, () => {
    // Serial so create/edit/applies-to tests on the shared server do not overlap mid-save.
    test.describe.configure({mode: 'serial'});

    test.describe('create attribute', () => {
        /**
         * @objective Ensure the full create flow works end-to-end: the "New attribute" button
         * navigates to the create page, the Unique name live-updates from Display name, the
         * Edit/Done toggle round-trips correctly, and Save creates a real bare Text template
         * that shows up back in the Attribute Management list.
         */
        test('creates a bare Text attribute via the New attribute page and shows it in the list', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
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
                // # Log in and open the Attribute Management page
                const {app} = await pw.testBrowser.login(adminUser);
                await app.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                // # Click "New attribute" to open the create page
                await app.admin.attributes.newButton.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();
                await expect(app.page).toHavePath(attributeDetailsPath(app));

                // # Fill in the Display name; the Unique name caption auto-derives live
                await app.admin.attribute.displayName.container.fill(displayName);
                await expect(app.admin.attribute.uniqueName.valueText).toHaveText(expectedName);

                // # Exercise the Edit/Done round-trip once, confirming the input is focused
                // and seeded, then revert back to static display without changing the value
                await app.admin.attribute.uniqueName.editButton.click();
                await expect(app.admin.attribute.uniqueName.inputTextbox).toBeVisible();
                const nameInput = app.admin.attribute.uniqueName.inputTextbox;
                await expect(nameInput).toBeFocused();
                await expect(nameInput).toHaveValue(expectedName);
                await app.admin.attribute.uniqueName.editButton.click();
                await expect(app.admin.attribute.uniqueName.valueText).toHaveText(expectedName);

                // # Save
                await app.admin.saveButton.click();

                // * Redirected back to the Attribute Management list
                await expect(app.page).toHavePath(attributesPath(app));

                // * The new attribute renders with the expected Display name, Type, and Source
                const row = await listedAttribute(app.admin.attributes, displayName);
                await expect(app.admin.attributes.row(row.id).nameText).toHaveText(displayName);
                await expect(app.admin.attributes.row(row.id).typeText).toContainText('Text');
                await expect(app.admin.attributes.row(row.id).sourceText).toContainMessage(
                    Msg.admin.global_attributes.table.source.managed,
                );
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
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            // # Log in and open the Attribute Management page
            const {app} = await pw.testBrowser.login(adminUser);
            await app.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

            // # Open the create page
            await app.admin.attributes.newButton.click();
            await expect(app.admin.attribute.displayName.container).toBeVisible();
            await expect(app.page).toHavePath(attributeDetailsPath(app));

            // # Type a Display name that auto-slugs straight to a reserved CEL keyword
            await app.admin.attribute.displayName.container.fill('For');

            // * Inline validation error is shown without ever clicking "Edit"
            await expect(app.admin.attribute.uniqueName.errorAlert).toContainText('reserved word');
            // * Save is disabled
            await expect(app.admin.saveButton).toBeDisabled();

            // * No navigation occurred
            await expect(app.page).toHavePath(attributeDetailsPath(app));
        });

        /**
         * @objective Ensure "Done", Enter, and blur all refuse to commit an invalid manual Unique
         * name, so a reserved word can never be left sitting in the field, and that correcting the
         * value unblocks the commit and lets the attribute save for real.
         */
        test('blocks Done, Enter, and blur while the manual Unique name is a reserved word, then commits once corrected', async ({
            pw,
        }) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
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
                const {app} = await pw.testBrowser.login(adminUser);
                await app.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
                await app.admin.attributes.newButton.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();
                await expect(app.page).toHavePath(attributeDetailsPath(app));

                await app.admin.attribute.displayName.container.fill(displayName);
                await expect(app.admin.attribute.uniqueName.valueText).toHaveText(autoDerivedName);

                // # Open the manual Name editor and replace the auto-derived slug with a reserved word
                await app.admin.attribute.uniqueName.editButton.click();
                await expect(app.admin.attribute.uniqueName.inputTextbox).toBeVisible();
                const nameInput = app.admin.attribute.uniqueName.inputTextbox;
                await nameInput.fill('for');

                // * The inline error appears and Done reports itself as unavailable, while staying
                // focusable (aria-disabled, not the disabled attribute) and pointing at the reason
                const doneLink = app.admin.attribute.uniqueName.editButton.locator;
                await expect(app.admin.attribute.uniqueName.errorAlert).toContainText('reserved word');
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
                await expect(app.admin.attribute.uniqueName.errorAlert).toContainText('reserved word');

                // # Click away onto the Display name field (blur), same commit path as Done/Enter
                await app.admin.attribute.displayName.container.focus();

                // * Also rejected -- the editor stays open rather than committing on click-away
                await expect(nameInput).toBeVisible();
                await expect(nameInput).toHaveValue('for');
                await expect(doneLink).toHaveText('Done');

                // # Correct the value by typing the rest of the identifier
                await nameInput.focus();
                await nameInput.press('End');
                // End moves the native caret; verify its position before appending the correction.
                await expect
                    .poll(() =>
                        nameInput.locator.evaluate((el) => (el instanceof HTMLInputElement ? el.selectionStart : null)),
                    )
                    .toBe(3);
                await nameInput.type(`_${timestamp}`);

                // * The error clears and Done is live again
                await expect(app.admin.attribute.uniqueName.errorAlert).toHaveCount(0);
                await expect(doneLink).not.toHaveAttribute('aria-disabled', 'true');

                // # Commit with Enter this time
                await nameInput.press('Enter');

                // * Committed -- the editor closed and the corrected Name is shown
                await expect(app.admin.attribute.uniqueName.inputTextbox).toHaveCount(0);
                await expect(app.admin.attribute.uniqueName.valueText).toHaveText(correctedName);

                // # Save
                await app.admin.saveButton.click();

                // * The attribute was created with the corrected Name
                await expect(app.page).toHavePath(attributesPath(app));
                const row = await listedAttribute(app.admin.attributes, displayName);
                await expect(app.admin.attributes.row(row.id).nameText).toHaveText(displayName);
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
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            // Short prefix: see the 40-char Unique name cap noted in the reserved-word test above
            const displayName = `Playwright Esc ${timestamp}`;
            const autoDerivedName = `playwright_esc_${timestamp}`;

            // # Log in and open the create page
            const {app} = await pw.testBrowser.login(adminUser);
            await app.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
            await app.admin.attributes.newButton.click();
            await expect(app.admin.attribute.displayName.container).toBeVisible();
            await expect(app.page).toHavePath(attributeDetailsPath(app));

            await app.admin.attribute.displayName.container.fill(displayName);

            // # Escape hatch 1: clear the field. An empty Name has no validation error, so Done
            // goes live again and applies its usual revert.
            await app.admin.attribute.uniqueName.editButton.click();
            await expect(app.admin.attribute.uniqueName.inputTextbox).toBeVisible();
            const nameInput = app.admin.attribute.uniqueName.inputTextbox;
            await nameInput.fill('for');

            const doneLink = app.admin.attribute.uniqueName.editButton.locator;
            await expect(doneLink).toHaveAttribute('aria-disabled', 'true');

            await nameInput.fill('');
            await expect(doneLink).not.toHaveAttribute('aria-disabled', 'true');
            await doneLink.click();

            // * Exited edit mode, reverted to the auto-derived slug, no error left behind
            await expect(app.admin.attribute.uniqueName.inputTextbox).toHaveCount(0);
            await expect(app.admin.attribute.uniqueName.valueText).toHaveText(autoDerivedName);
            await expect(app.admin.attribute.uniqueName.errorAlert).toHaveCount(0);

            // # Escape hatch 2: press Escape while the field is invalid, discarding the edit
            await app.admin.attribute.uniqueName.editButton.click();
            await expect(app.admin.attribute.uniqueName.inputTextbox).toBeVisible();
            await app.admin.attribute.uniqueName.inputTextbox.fill('for');
            await expect(app.admin.attribute.uniqueName.editButton).toHaveAttribute('aria-disabled', 'true');
            await app.admin.attribute.uniqueName.inputTextbox.press('Escape');

            // * Exited edit mode with the reserved word discarded
            await expect(app.admin.attribute.uniqueName.inputTextbox).toHaveCount(0);
            await expect(app.admin.attribute.uniqueName.valueText).toHaveText(autoDerivedName);
            await expect(app.admin.attribute.uniqueName.errorAlert).toHaveCount(0);

            // * Save is available again, since the Name is back to a valid auto-derived slug
            await expect(app.admin.saveButton).toBeEnabled();
        });

        /**
         * @objective Ensure clicking away from the Unique name input is the same as Done: an
         * unchanged seed keeps auto-derivation live, and an actual edit pins the Name so further
         * Display name changes no longer rewrite it. Mirrors the channel URL field in create/settings.
         */
        test('treats clicking away from Unique name as Done: no-op keeps derivation, an edit pins', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            // Short prefix: see the 40-char Unique name cap noted in the reserved-word test above
            const displayName = `Playwright Blur ${timestamp}`;
            const autoDerivedName = `playwright_blur_${timestamp}`;
            const extendedDisplayName = `${displayName} Two`;
            const extendedAutoDerivedName = `${autoDerivedName}_two`;
            const pinnedName = `custom_blur_${timestamp}`;

            // # Log in and open the create page
            const {app} = await pw.testBrowser.login(adminUser);
            await app.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
            await app.admin.attributes.newButton.click();
            await expect(app.admin.attribute.displayName.container).toBeVisible();
            await expect(app.page).toHavePath(attributeDetailsPath(app));

            const displayNameInput = app.admin.attribute.displayName.container;
            await displayNameInput.fill(displayName);
            await expect(app.admin.attribute.uniqueName.valueText).toHaveText(autoDerivedName);

            // # Open the editor and click away without changing the seeded value
            await app.admin.attribute.uniqueName.editButton.click();
            await expect(app.admin.attribute.uniqueName.inputTextbox).toBeVisible();
            await expect(app.admin.attribute.uniqueName.inputTextbox).toBeFocused();
            await displayNameInput.focus();

            // * Exited edit mode, still showing the auto-derived slug
            await expect(app.admin.attribute.uniqueName.inputTextbox).toHaveCount(0);
            await expect(app.admin.attribute.uniqueName.editButton).toHaveMessage(
                Msg.admin.global_attributes.attribute_details.unique_name.edit,
            );
            await expect(app.admin.attribute.uniqueName.valueText).toHaveText(autoDerivedName);

            // * Auto-derivation is still live
            await displayNameInput.fill(extendedDisplayName);
            await expect(app.admin.attribute.uniqueName.valueText).toHaveText(extendedAutoDerivedName);

            // # Open the editor, type a different Name, and click away
            await app.admin.attribute.uniqueName.editButton.click();
            await expect(app.admin.attribute.uniqueName.inputTextbox).toBeVisible();
            await app.admin.attribute.uniqueName.inputTextbox.fill(pinnedName);
            await displayNameInput.focus();

            // * Committed -- the editor closed and the typed Name is shown
            await expect(app.admin.attribute.uniqueName.inputTextbox).toHaveCount(0);
            await expect(app.admin.attribute.uniqueName.valueText).toHaveText(pinnedName);

            // * Manual override stays in effect -- further Display name edits do not overwrite it
            await displayNameInput.fill(`${extendedDisplayName} Three`);
            await expect(app.admin.attribute.uniqueName.valueText).toHaveText(pinnedName);
        });

        /**
         * @objective Ensure a Select attribute can be created end-to-end with a real options
         * editor: type switch, add two options via Enter, Save is blocked until an option exists,
         * and the saved attribute shows the correct type/option count back in the list.
         */
        test('creates a Select attribute with two options via the options editor', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            // Short prefix: see the 40-char Unique name cap noted in the bare-Text test above
            const displayName = `Playwright Select ${timestamp}`;
            const expectedName = `playwright_select_${timestamp}`;

            try {
                const {app} = await pw.testBrowser.login(adminUser);
                await app.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await app.admin.attributes.newButton.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();
                await expect(app.page).toHavePath(attributeDetailsPath(app));

                await app.admin.attribute.displayName.container.fill(displayName);
                await expect(app.admin.attribute.uniqueName.valueText).toHaveText(expectedName);

                // # Switch type to Select
                await app.admin.attribute.type.container.click();
                await expect(app.admin.attribute.type.option('text')).toBeVisible();
                await app.admin.attribute.type.option('select').click();
                await expect(app.admin.attribute.type.option('select')).not.toBeVisible();

                // * Save is disabled with zero options, with an inline reason shown
                await expect(app.admin.attribute.options.requiredAlert).toContainText(
                    'At least one option is required',
                );
                await expect(app.admin.saveButton).toBeDisabled();

                // # Add two options via Enter
                const optionsInput = app.admin.attribute.values.addTextbox;
                await optionsInput.fill('Engineering');
                await optionsInput.press('Enter');
                await expect(app.admin.attribute.values.optionList.locator).toContainText(['Engineering']);
                await optionsInput.fill('Sales');
                await optionsInput.press('Enter');
                await expect(app.admin.attribute.values.optionList.locator).toContainText(['Sales']);

                // * Save is now enabled
                await expect(app.admin.saveButton).toBeEnabled();
                await app.admin.saveButton.click();

                // * Redirected back to the list, showing the correct type and option count
                await expect(app.page).toHavePath(attributesPath(app));
                const row = await listedAttribute(app.admin.attributes, displayName);
                await expect(app.admin.attributes.row(row.id).typeText).toContainText('Select');
                await expect(app.admin.attributes.row(row.id).optionsText).toContainText('2 options');
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
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            // Short prefix: see the 40-char Unique name cap noted in the bare-Text test above
            const displayName = `Playwright Ranked ${timestamp}`;
            const expectedName = `playwright_ranked_${timestamp}`;

            try {
                const {app} = await pw.testBrowser.login(adminUser);
                await app.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await app.admin.attributes.newButton.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();
                await app.admin.attribute.displayName.container.fill(displayName);
                await expect(app.admin.attribute.uniqueName.valueText).toHaveText(expectedName);

                await app.admin.attribute.type.container.click();
                await expect(app.admin.attribute.type.option('text')).toBeVisible();
                await app.admin.attribute.type.option('rank').click();
                await expect(app.admin.attribute.type.option('rank')).not.toBeVisible();

                const optionsInput = app.admin.attribute.ranks.addTextbox;
                await optionsInput.fill('Low');
                await optionsInput.press('Enter');
                await expect(app.admin.attribute.ranks.optionList).toHaveKeyCount(1);
                await optionsInput.fill('High');
                await optionsInput.press('Enter');
                await expect(app.admin.attribute.ranks.optionList).toHaveKeyCount(2);

                // * Chips render in ascending rank order
                const {ranks} = app.admin.attribute;
                // Chips are keyed by position (lowest rank first), so order is read from their text.
                const high = await ranks.optionList.keyWith({text: 'High'});
                await expect(ranks.optionList.locator).toHaveText([/Low/, /High/]);

                // # Reorder "High" to position 1 via its popover's Rank submenu.
                // The submenu opens on hover (components/menu/sub_menu.tsx) and closes
                // as soon as the pointer leaves the "Rank" trigger -- a second .click()
                // on the nested item would move the mouse off the trigger first, racing
                // the close and detaching the item mid-click. Hover to open, then select
                // with the keyboard so the pointer never leaves the trigger.
                await ranks.option(high).editButton.click();
                await expect(ranks.optionMenu.rankMenuItem).toBeVisible();
                const {optionMenu} = ranks;
                await optionMenu.rankMenuItem.hover();
                const rankOneOption = optionMenu.rankPosition(1);
                await expect(rankOneOption).toBeVisible();
                await rankOneOption.focus();
                await app.page.keyboard.press('Enter');

                // * Reordered — "High" now renders first
                await expect(ranks.optionList.locator).toHaveText([/High/, /Low/]);

                await app.admin.saveButton.click();

                await expect(app.page).toHavePath(attributesPath(app));
                const row = await listedAttribute(app.admin.attributes, displayName);
                await expect(app.admin.attributes.row(row.id).typeText).toContainMessage(
                    Msg.admin.global_attributes.table.type.rank,
                );
                await expect(app.admin.attributes.row(row.id).optionsText).toContainText('2 options');
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, expectedName);
            }
        });

        /**
         * @objective Ensure the Type menu lists Phone and URL alongside the other createable
         * types, defaults to Text, and hides Email (CPA already hid it; the server still
         * accepts value_type email via the API).
         */
        test('type menu lists Text, Phone, URL, Select, Multiselect, and Ranked, with Text checked and Email hidden', async ({
            pw,
        }) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const {app} = await pw.testBrowser.login(adminUser);
            await app.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
            await app.admin.attributes.newButton.click();
            await expect(app.admin.attribute.displayName.container).toBeVisible();
            await expect(app.page).toHavePath(attributeDetailsPath(app));

            await app.admin.attribute.type.container.click();
            await expect(app.admin.attribute.type.option('text')).toBeVisible();

            for (const [key, label] of [
                ['text', 'Text'],
                ['phone', 'Phone'],
                ['url', 'URL'],
                ['select', 'Select'],
                ['multiselect', 'Multiselect'],
                ['rank', 'Ranked'],
            ] as const) {
                const option = app.admin.attribute.type.option(key);
                await expect(option).toBeVisible();
                await expect(option).toHaveRole('menuitemradio');
                await expect(option).toHaveAccessibleName(label);
            }
            await expect(app.admin.attribute.type.option('text')).toHaveAttribute('aria-checked', 'true');
            await expect(app.admin.attribute.type.option('email')).toHaveCount(0);
        });

        for (const {uiType, valueType, displayPrefix, expectedNamePrefix} of [
            {
                uiType: 'Phone',
                valueType: 'phone',
                displayPrefix: 'Playwright Phone',
                expectedNamePrefix: 'playwright_phone',
            },
            {uiType: 'URL', valueType: 'url', displayPrefix: 'Playwright Url', expectedNamePrefix: 'playwright_url'},
        ] as const) {
            /**
             * @objective Ensure a Phone or URL attribute can be created end-to-end as type
             * text with the matching attrs.value_type, and the list Type column shows that
             * subtype rather than Text.
             */
            test(`creates a ${uiType} attribute as type text with attrs.value_type ${valueType}`, async ({pw}) => {
                await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
                const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

                const timestamp = Date.now();
                // Short prefix: see the 40-char Unique name cap noted in the bare-Text test above
                const displayName = `${displayPrefix} ${timestamp}`;
                const expectedName = `${expectedNamePrefix}_${timestamp}`;

                try {
                    const {app} = await pw.testBrowser.login(adminUser);
                    await app.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                    await app.admin.attributes.newButton.click();
                    await expect(app.admin.attribute.displayName.container).toBeVisible();
                    await expect(app.page).toHavePath(attributeDetailsPath(app));

                    await app.admin.attribute.displayName.container.fill(displayName);
                    await expect(app.admin.attribute.uniqueName.valueText).toHaveText(expectedName);

                    await app.admin.attribute.type.container.click();
                    await expect(app.admin.attribute.type.option('text')).toBeVisible();
                    await app.admin.attribute.type.option(valueType).click();
                    await expect(app.admin.attribute.type.option(valueType)).not.toBeVisible();

                    // * Phone/URL keep the free-text options help — they are text subtypes,
                    // not option lists
                    await expect(app.admin.attribute.options.helpText).toBeVisible();
                    await expect(app.admin.attribute.values).toHaveCount(0);
                    await expect(app.admin.attribute.type.container).toContainText(uiType);

                    await app.admin.saveButton.click();

                    await expect(app.page).toHavePath(attributesPath(app));
                    const row = await listedAttribute(app.admin.attributes, displayName);
                    await expect(app.admin.attributes.row(row.id).typeText).toContainText(uiType);
                    await expect(app.admin.attributes.row(row.id).optionsText).toContainMessage(
                        Msg.admin.global_attributes.table.options.free_text,
                    );

                    const field = await getGlobalAttributeFieldByName(adminClient, expectedName);
                    expect(field?.type).toBe('text');
                    expect(field?.attrs?.value_type).toBe(valueType);
                } finally {
                    await deleteGlobalAttributeFieldIfExists(adminClient, expectedName);
                }
            });
        }

        /**
         * @objective Ensure switching type mid-form preserves already-entered options rather than
         * discarding them, per the ticket's "freely switch types" requirement.
         */
        test('preserves already-entered options when switching type away and back', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const {app} = await pw.testBrowser.login(adminUser);
            await app.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

            await app.admin.attributes.newButton.click();
            await expect(app.admin.attribute.displayName.container).toBeVisible();

            await app.admin.attribute.type.container.click();
            await expect(app.admin.attribute.type.option('text')).toBeVisible();
            await app.admin.attribute.type.option('select').click();
            await expect(app.admin.attribute.type.option('select')).not.toBeVisible();
            const optionsInput = app.admin.attribute.values.addTextbox;
            await optionsInput.fill('Engineering');
            await optionsInput.press('Enter');
            await expect(app.admin.attribute.values.optionList.locator).toContainText(['Engineering']);

            // # Switch to Text (options editor unmounts) and back to Select
            await app.admin.attribute.type.container.click();
            await expect(app.admin.attribute.type.option('text')).toBeVisible();
            await app.admin.attribute.type.option('text').click();
            await expect(app.admin.attribute.type.option('text')).not.toBeVisible();
            await expect(app.admin.attribute.values).toHaveCount(0);

            await app.admin.attribute.type.container.click();
            await expect(app.admin.attribute.type.option('text')).toBeVisible();
            await app.admin.attribute.type.option('select').click();
            await expect(app.admin.attribute.type.option('select')).not.toBeVisible();

            // * The previously-entered option is still there, not discarded
            await expect.poll(() => visibleOptionLabels(app)).toEqual(['Engineering']);
        });

        /**
         * @objective Ensure a Text attribute can be linked to AD/LDAP via the external source
         * picker end-to-end, and that the Attribute Management list picks up the new attrs.ldap
         * value with no further changes needed on that page.
         */
        test('creates a Text attribute linked to AD/LDAP via the external source picker', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            // Short prefix: see the 40-char Unique name cap noted in the bare-Text test above.
            // This one only uses expectedName for cleanup, so an over-long prefix leaked the
            // created field onto the shared server instead of failing loudly.
            const displayName = `Playwright Ldap ${timestamp}`;
            const expectedName = `playwright_ldap_${timestamp}`;

            try {
                const {app} = await pw.testBrowser.login(adminUser);
                await app.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await app.admin.attributes.newButton.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();
                await app.admin.attribute.displayName.container.fill(displayName);

                // # Open the external source picker and link AD/LDAP
                await app.admin.attribute.externalSource.linkButton.click();
                // The remaining sources vary; observe that the generated menu collection opens with entries.
                await expect(app.admin.attribute.externalSource.linkMenu.sourceList.locator).not.toHaveCount(0);
                await app.admin.attribute.externalSource.linkMenu.source('ldap').click();
                await expect(app.attributeModal.valueTextbox).toBeVisible();
                await expect(app.attributeModal).toBeVisible();
                await app.attributeModal.valueTextbox.fill('employeeID');
                await app.attributeModal.confirmButton.click();

                // * A chip for AD/LDAP now appears on the Options line, prefixed by Synced with, and Type shows Text
                await expect(app.admin.attribute.externalSource.source('ldap')).toBeVisible();
                await expect(app.admin.attribute.type.container).toContainText('Text');
                await expect(app.admin.attribute.externalSource.synced).toContainMessage(
                    Msg.admin.global_attributes.attribute_details.external_source.synced_with,
                );

                await app.admin.saveButton.click();

                // * The new attribute shows "AD/LDAP" in the Source column
                await expect(app.page).toHavePath(attributesPath(app));
                const row = await listedAttribute(app.admin.attributes, displayName);
                await expect(app.admin.attributes.row(row.id).sourceText).toContainText('AD/LDAP');
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, expectedName);
            }
        });

        /**
         * @objective Ensure both AD/LDAP and SAML can be linked on the same attribute, that an
         * already-linked source is excluded from the "add" menu (once both are linked, only
         * OpenID Connect is left, disabled because it can't be combined with them), and that
         * each chip shows the actual linked value, not just the source name.
         */
        test('links both AD/LDAP and SAML, excludes an already-linked source from the menu, and shows the linked value in each chip', async ({
            pw,
        }) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            // Short prefix: see the 40-char Unique name cap noted in the bare-Text test above
            const displayName = `Playwright Dual ${timestamp}`;
            const expectedName = `playwright_dual_${timestamp}`;

            try {
                const {app} = await pw.testBrowser.login(adminUser);
                await app.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await app.admin.attributes.newButton.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();
                await app.admin.attribute.displayName.container.fill(displayName);

                // # Before anything is linked, the menu offers both sources
                await app.admin.attribute.externalSource.linkButton.click();
                // The remaining sources vary; observe that the generated menu collection opens with entries.
                await expect(app.admin.attribute.externalSource.linkMenu.sourceList.locator).not.toHaveCount(0);
                await expect(app.admin.attribute.externalSource.linkMenu.source('ldap')).toBeVisible();
                await expect(app.admin.attribute.externalSource.linkMenu.source('saml')).toBeVisible();

                // # Link AD/LDAP
                await app.admin.attribute.externalSource.linkMenu.source('ldap').click();
                await expect(app.attributeModal.valueTextbox).toBeVisible();
                await app.attributeModal.valueTextbox.fill('employeeID');
                await app.attributeModal.confirmButton.click();

                // * The chip shows the source and the value that was actually typed
                await expect(app.admin.attribute.externalSource.source('ldap')).toHaveText('AD/LDAP: employeeID');

                // # Reopen the trigger -- AD/LDAP is no longer offered, only SAML
                await app.admin.attribute.externalSource.linkButton.click();
                // The remaining sources vary; observe that the generated menu collection opens with entries.
                await expect(app.admin.attribute.externalSource.linkMenu.sourceList.locator).not.toHaveCount(0);
                await expect(app.admin.attribute.externalSource.linkMenu.source('saml')).toBeVisible();
                await expect(app.admin.attribute.externalSource.linkMenu.source('ldap')).not.toBeVisible();

                // # Link SAML too
                await app.admin.attribute.externalSource.linkMenu.source('saml').click();
                await expect(app.attributeModal.valueTextbox).toBeVisible();
                await app.attributeModal.valueTextbox.fill('position');
                await app.attributeModal.confirmButton.click();

                // * Both chips are shown with their own values
                await expect(app.admin.attribute.externalSource.source('ldap')).toHaveText('AD/LDAP: employeeID');
                await expect(app.admin.attribute.externalSource.source('saml')).toHaveText('SAML: position');

                // * Only OpenID Connect is left, disabled because it can't be combined with them
                await app.admin.attribute.externalSource.linkButton.click();
                // The remaining sources vary; observe that the generated menu collection opens with entries.
                await expect(app.admin.attribute.externalSource.linkMenu.sourceList.locator).not.toHaveCount(0);
                const linkMenu = app.admin.attribute.externalSource.linkMenu;
                await expect.poll(() => linkMenu.sourceList.keys()).toEqual(['openid']);
                const openIdItem = linkMenu.source('openid');
                await expect(openIdItem).toBeDisabled();
                await expect(openIdItem).toContainText("Can't be combined with AD/LDAP and SAML");
                await app.page.keyboard.press('Escape');
                await expect(openIdItem).not.toBeVisible();

                await app.admin.saveButton.click();

                // * With both linked, the list's Source column shows both sources together
                await expect(app.page).toHavePath(attributesPath(app));
                const row = await listedAttribute(app.admin.attributes, displayName);
                await expect(app.admin.attributes.row(row.id).sourceText).toContainText('AD/LDAP, SAML');
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, expectedName);
            }
        });

        /**
         * @objective Ensure changing a template's AD/LDAP sync source on Save also updates the
         * already-linked Users field. LDAP sync reads attrs.ldap on the Users field (copied only
         * at create), so a template-only edit would otherwise leave sync on the stale mapping.
         */
        test('cascades an edited AD/LDAP sync source onto an already-linked Users field on Save', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const name = `e2e_sync_cascade_${timestamp}`;
            const displayName = `Playwright Sync Cascade ${timestamp}`;

            try {
                const template = await createGlobalAttributeField(adminClient, name, {
                    type: 'text',
                    attrs: {display_name: displayName, ldap: 'oldDept'},
                });
                await createLinkedDependentField(adminClient, name, template.id, 'text', 'user', {
                    display_name: displayName,
                });

                // * Create copied ldap onto the Users field (the sync mapping LDAP actually reads)
                let linkedFields = await fetchLinkedFieldsForTemplate(adminClient, template.id);
                let userField = linkedFields.find((f) => f.object_type === 'user');
                expect(userField?.attrs?.ldap).toBe('oldDept');

                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}/attribute_details/${template.id}`);

                // # Edit the AD/LDAP chip to a new directory attribute and save
                await app.admin.attribute.externalSource.source('ldap').editButton.click();
                const input = app.attributeModal.valueTextbox.locator;
                await expect(input).toHaveValue('oldDept');
                await input.fill('newDept');
                await app.attributeModal.confirmButton.click();
                await expect(app.admin.attribute.externalSource.source('ldap')).toHaveText('AD/LDAP: newDept');

                await app.admin.saveButton.click();
                await expect(page).toHavePath(attributesPath(app));

                // * The linked Users field's attrs.ldap moved with the template — not left at oldDept
                linkedFields = await fetchLinkedFieldsForTemplate(adminClient, template.id);
                userField = linkedFields.find((f) => f.object_type === 'user');
                expect(userField?.attrs?.ldap).toBe('newDept');
            } finally {
                await deleteAppliesToAttributeAndLinkedFieldsIfExists(adminClient, name);
            }
        });

        /**
         * @objective Ensure clearing a template's AD/LDAP sync source on Save also clears it on
         * the already-linked Users field, so LDAP sync stops writing that field.
         */
        test('clears ldap on an already-linked Users field when the template sync source is removed', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const name = `e2e_sync_clear_${timestamp}`;
            const displayName = `Playwright Sync Clear ${timestamp}`;

            try {
                const template = await createGlobalAttributeField(adminClient, name, {
                    type: 'text',
                    attrs: {display_name: displayName, ldap: 'oldDept'},
                });
                await createLinkedDependentField(adminClient, name, template.id, 'text', 'user', {
                    display_name: displayName,
                });

                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}/attribute_details/${template.id}`);

                // # Remove the AD/LDAP link and save
                await app.admin.attribute.externalSource.source('ldap').removeButton.click();
                await expect(app.admin.attribute.externalSource.source('ldap')).toHaveCount(0);
                await app.admin.saveButton.click();
                await expect(page).toHavePath(attributesPath(app));

                // * Users field no longer carries attrs.ldap (empty/absent — sync will skip it)
                const linkedFields = await fetchLinkedFieldsForTemplate(adminClient, template.id);
                const userField = linkedFields.find((f) => f.object_type === 'user');
                expect(userField?.attrs?.ldap || '').toBe('');
            } finally {
                await deleteAppliesToAttributeAndLinkedFieldsIfExists(adminClient, name);
            }
        });

        /**
         * @objective Ensure a linked chip's edit action reopens the modal pre-filled and commits
         * a changed value, and that its remove action clears the link immediately with no modal.
         */
        test("edits a linked chip's value via its edit action, and removes a link via its remove action with no modal", async ({
            pw,
        }) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const {app} = await pw.testBrowser.login(adminUser);
            await app.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

            await app.admin.attributes.newButton.click();
            await expect(app.admin.attribute.displayName.container).toBeVisible();

            // # Link AD/LDAP
            await app.admin.attribute.externalSource.linkButton.click();
            // The remaining sources vary; observe that the generated menu collection opens with entries.
            await expect(app.admin.attribute.externalSource.linkMenu.sourceList.locator).not.toHaveCount(0);
            await app.admin.attribute.externalSource.linkMenu.source('ldap').click();
            await expect(app.attributeModal.valueTextbox).toBeVisible();
            await app.attributeModal.valueTextbox.fill('employeeID');
            await app.attributeModal.confirmButton.click();
            await expect(app.admin.attribute.externalSource.source('ldap')).toHaveText('AD/LDAP: employeeID');

            // # Click the chip's edit action -- the modal reopens pre-filled with the current value
            await app.admin.attribute.externalSource.source('ldap').editButton.click();
            await expect(app.attributeModal.valueTextbox).toHaveValue('employeeID');

            // # Change the value and save
            await app.attributeModal.valueTextbox.fill('newEmployeeID');
            await app.attributeModal.confirmButton.click();
            await expect(app.admin.attribute.externalSource.source('ldap')).toHaveText('AD/LDAP: newEmployeeID');

            // # Click the chip's remove action -- the link clears immediately, no modal opens
            await app.admin.attribute.externalSource.source('ldap').removeButton.click();
            await expect(app.admin.attribute.externalSource.source('ldap')).not.toBeVisible();
            await expect(app.attributeModal.valueTextbox).not.toBeVisible();

            // * The trigger is back, offering AD/LDAP again since nothing is linked anymore
            await expect(app.admin.attribute.externalSource.linkButton).toBeVisible();
        });

        /**
         * @objective Ensure linking a source keeps a Select, hands its options to the sync and holds
         * Save until the attribute applies to Users, whose sync provides them, while a type the source
         * cannot populate is converted to Text after a warning. Either way Type stays locked until
         * the last chip is removed.
         */
        test('keeps a Select linked to a source, and warns before converting a type the source cannot populate', async ({
            pw,
        }) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const {app} = await pw.testBrowser.login(adminUser);
            const {page} = app;
            await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

            await app.admin.attributes.newButton.click();
            await expect(app.admin.attribute.displayName.container).toBeVisible();
            await app.admin.attribute.displayName.container.fill(`Playwright Synced Select ${Date.now()}`);

            // # Switch to Select, then link AD/LDAP
            const typeButton = app.admin.attribute.type.container;
            await typeButton.click();
            await expect(app.admin.attribute.type.option('text')).toBeVisible();
            await app.admin.attribute.type.option('select').click();
            await expect(app.admin.attribute.type.option('select')).not.toBeVisible();
            await app.admin.attribute.externalSource.linkButton.click();
            // The remaining sources vary; observe that the generated menu collection opens with entries.
            await expect(app.admin.attribute.externalSource.linkMenu.sourceList.locator).not.toHaveCount(0);
            await app.admin.attribute.externalSource.linkMenu.source('ldap').click();
            await expect(app.attributeModal.valueTextbox).toBeVisible();

            // * The source can populate a Select, so the modal warns of no conversion
            await expect(app.attributeModal.valueTextbox).toBeVisible();
            await expect(app.attributeModal.typeWarningText).not.toBeVisible();

            await app.attributeModal.valueTextbox.fill('departmentNumber');
            await app.attributeModal.confirmButton.click();

            // * Type stays Select and is locked, and the sync owns the options
            await expect(app.admin.attribute.externalSource.source('ldap')).toBeVisible();
            await expect(typeButton).toContainText('Select');
            await expect(typeButton).toBeDisabled();
            await expect(app.admin.attribute.options.syncedHelpText).toContainText(
                'Options are managed by the AD/LDAP sync.',
            );

            // * Save waits for Users, whose sync provides the options
            await expect(app.admin.attribute.options.needUsersAlert).toBeVisible();
            await expect(app.admin.saveButton).toBeDisabled();

            // # Apply it to Users
            await app.admin.attribute.appliesTo.add.container.click();
            // Resource availability varies with prior additions; observe the generated picker collection.
            await expect(app.admin.attribute.appliesTo.add.resourceList.locator).not.toHaveCount(0);
            await app.admin.attribute.appliesTo.add.resource('user').click();
            await expect(app.admin.attribute.appliesTo.user).toBeVisible();

            // * Save is available
            await expect(app.admin.attribute.options.needUsersAlert).not.toBeVisible();
            await expect(app.admin.saveButton).toBeEnabled();

            // # Remove the chip and switch to Ranked, a type the source cannot populate
            await app.admin.attribute.externalSource.source('ldap').removeButton.click();
            await expect(typeButton).toBeEnabled();
            await typeButton.click();
            await expect(app.admin.attribute.type.option('text')).toBeVisible();
            await app.admin.attribute.type.option('rank').click();
            await expect(app.admin.attribute.type.option('rank')).not.toBeVisible();
            await app.admin.attribute.externalSource.linkButton.click();
            // The remaining sources vary; observe that the generated menu collection opens with entries.
            await expect(app.admin.attribute.externalSource.linkMenu.sourceList.locator).not.toHaveCount(0);
            await app.admin.attribute.externalSource.linkMenu.source('ldap').click();
            await expect(app.attributeModal.valueTextbox).toBeVisible();

            // * The modal warns the field will convert to Text
            await expect(app.attributeModal.typeWarningText).toBeVisible();

            // # Save the link anyway
            await app.attributeModal.valueTextbox.fill('employeeID');
            await app.attributeModal.confirmButton.click();

            // * Type switched to Text and is locked
            await expect(app.admin.attribute.externalSource.source('ldap')).toBeVisible();
            await expect(typeButton).toContainText('Text');
            await expect(typeButton).toBeDisabled();

            // # Remove the chip
            await app.admin.attribute.externalSource.source('ldap').removeButton.click();

            // * Type is editable again
            await expect(typeButton).toBeEnabled();
        });
    });

    test.describe('applies to', () => {
        /**
         * @objective Ensure a brand-new attribute's Applies-to card renders its empty state
         * correctly, with no resources and both "Add resource" triggers available.
         */
        test('shows the empty state with both Add-resource triggers, and no rows', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const {app} = await pw.testBrowser.login(adminUser);
            await app.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
            await app.admin.attributes.newButton.click();
            await expect(app.admin.attribute.displayName.container).toBeVisible();

            // * Empty state renders with its heading/helper text
            await expect(app.admin.attribute.appliesTo.empty).toBeVisible();

            // * No resource rows exist yet
            const {appliesTo} = app.admin.attribute;
            for (const resource of [appliesTo.user, appliesTo.channel, appliesTo.post]) {
                await expect(resource).not.toBeVisible();
            }

            // * Both triggers are available
            await expect(app.admin.attribute.appliesTo.add.container).toBeVisible();
            await expect(app.admin.attribute.appliesTo.addInline.container).toBeVisible();
        });

        /**
         * @objective Ensure the picker offers exactly the not-yet-selected types, adding one
         * removes it from the picker and renders its row, and once all three are added both
         * triggers disappear entirely.
         */
        test('offers only unselected types, renders a row per addition, and hides both triggers once all three are added', async ({
            pw,
        }) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const {app} = await pw.testBrowser.login(adminUser);
            await app.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
            await app.admin.attributes.newButton.click();
            await expect(app.admin.attribute.displayName.container).toBeVisible();

            // # Open the picker; all three types are offered, in order
            await app.admin.attribute.appliesTo.add.container.click();
            // Resource availability varies with prior additions; observe the generated picker collection.
            await expect(app.admin.attribute.appliesTo.add.resourceList.locator).not.toHaveCount(0);
            const menuItems = app.admin.attribute.appliesTo.add.resourceList.locator;
            await expect(menuItems).toHaveText(['Users', 'Channels', 'Posts']);

            // # Pick Users
            await app.admin.attribute.appliesTo.add.resource('user').click();
            await expect(app.admin.attribute.appliesTo.user).toBeVisible();

            // * Users row renders, empty state is gone
            await expect(app.admin.attribute.appliesTo.user).toBeVisible();
            await expect(app.admin.attribute.appliesTo.empty).not.toBeVisible();

            // # Reopen the picker -- only Channels and Posts remain
            await app.admin.attribute.appliesTo.add.container.click();
            // Resource availability varies with prior additions; observe the generated picker collection.
            await expect(app.admin.attribute.appliesTo.add.resourceList.locator).not.toHaveCount(0);
            await expect(menuItems).toHaveText(['Channels', 'Posts']);

            // # Add Channels, then Posts
            await app.admin.attribute.appliesTo.add.resource('channel').click();
            await expect(app.admin.attribute.appliesTo.channel).toBeVisible();
            await app.admin.attribute.appliesTo.add.container.click();
            // Resource availability varies with prior additions; observe the generated picker collection.
            await expect(app.admin.attribute.appliesTo.add.resourceList.locator).not.toHaveCount(0);
            await app.admin.attribute.appliesTo.add.resource('post').click();
            await expect(app.admin.attribute.appliesTo.post).toBeVisible();

            // * All three rows render, in insertion order
            await expect(app.admin.attribute.appliesTo.user).toBeVisible();
            await expect(app.admin.attribute.appliesTo.channel).toBeVisible();
            await expect(app.admin.attribute.appliesTo.post).toBeVisible();

            // * Both triggers are gone now that all three types are selected
            await expect(app.admin.attribute.appliesTo.add.container).not.toBeVisible();
            await expect(app.admin.attribute.appliesTo.addInline.container).not.toBeVisible();
        });

        /**
         * @objective Ensure removing a not-yet-saved resource is an immediate local change -- no
         * confirmation modal, no network call -- and the removed type becomes available in the
         * picker again.
         */
        test('removes a pending resource locally with no confirm modal and no delete request', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const {app} = await pw.testBrowser.login(adminUser);
            await app.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
            await app.admin.attributes.newButton.click();
            await expect(app.admin.attribute.displayName.container).toBeVisible();

            // Regression guard: no property-field delete request fires for a pre-save removal.
            let deleteRequestFired = false;
            await app.page.route('**/api/v4/properties/groups/access_control/*/fields/*', async (route) => {
                if (route.request().method() === 'DELETE') {
                    deleteRequestFired = true;
                }
                await route.continue();
            });

            // # Add Channels
            await app.admin.attribute.appliesTo.add.container.click();
            // Resource availability varies with prior additions; observe the generated picker collection.
            await expect(app.admin.attribute.appliesTo.add.resourceList.locator).not.toHaveCount(0);
            await app.admin.attribute.appliesTo.add.resource('channel').click();
            await expect(app.admin.attribute.appliesTo.channel).toBeVisible();
            await expect(app.admin.attribute.appliesTo.channel).toBeVisible();

            // # Remove is only reachable once the row is expanded
            await expect(app.admin.attribute.appliesTo.channel.removeButton).not.toBeVisible();
            await app.admin.attribute.appliesTo.channel.toggleButton.click();
            await expect(app.admin.attribute.appliesTo.channel.toggleButton).toHaveAttribute('aria-expanded', 'true');
            await app.admin.attribute.appliesTo.channel.removeButton.click();

            // * The row disappears immediately, no modal/dialog ever rendered
            await expect(app.admin.attribute.appliesTo.channel).not.toBeVisible();
            await expect(app.admin.attribute.removeAppliesToModal).not.toBeVisible();

            // # Reopen the picker -- Channels is offered again
            await app.admin.attribute.appliesTo.add.container.click();
            // Resource availability varies with prior additions; observe the generated picker collection.
            await expect(app.admin.attribute.appliesTo.add.resourceList.locator).not.toHaveCount(0);
            await expect(app.admin.attribute.appliesTo.add.resource('channel')).toBeVisible();

            expect(deleteRequestFired).toBe(false);
        });

        /**
         * @objective Ensure Save creates the template, then one linked field per selected
         * resource, each correctly pointing back at the template -- verified end-to-end against
         * the real server via the admin API, since the listing table's Applies-to column is a
         * hardcoded placeholder (see Out of Scope).
         */
        test('saves the template plus one linked field per selected resource', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const displayName = `Playwright Applies To ${timestamp}`;
            const expectedName = `playwright_applies_to_${timestamp}`;

            try {
                const {app} = await pw.testBrowser.login(adminUser);
                await app.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
                await app.admin.attributes.newButton.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();

                // # Fill Display name, add Users and Channels
                await app.admin.attribute.displayName.container.fill(displayName);
                await app.admin.attribute.appliesTo.add.container.click();
                // Resource availability varies with prior additions; observe the generated picker collection.
                await expect(app.admin.attribute.appliesTo.add.resourceList.locator).not.toHaveCount(0);
                await app.admin.attribute.appliesTo.add.resource('user').click();
                await expect(app.admin.attribute.appliesTo.user).toBeVisible();
                await app.admin.attribute.appliesTo.add.container.click();
                // Resource availability varies with prior additions; observe the generated picker collection.
                await expect(app.admin.attribute.appliesTo.add.resourceList.locator).not.toHaveCount(0);
                await app.admin.attribute.appliesTo.add.resource('channel').click();
                await expect(app.admin.attribute.appliesTo.channel).toBeVisible();

                // # Save
                await app.admin.saveButton.click();

                // * Redirected back to the Attribute Management list
                await expect(app.page).toHavePath(attributesPath(app));

                // * Exactly two linked fields exist, pointing back at the template
                const templateFields = await adminClient.getPropertyFields('access_control', 'template', {
                    targetType: 'system',
                    perPage: 200,
                });
                const templateField = defined(
                    templateFields.find((f) => f.name === expectedName && f.delete_at === 0),
                    'the saved template field',
                );

                const linkedFields = await fetchLinkedFieldsForTemplate(adminClient, templateField.id);
                expect(linkedFields).toHaveLength(2);

                const userField = defined(linkedFields.find((f) => f.object_type === 'user'));
                const channelField = defined(linkedFields.find((f) => f.object_type === 'channel'));
                for (const field of [userField, channelField]) {
                    expect(field.target_type).toBe('system');
                    expect(field.linked_field_id).toBe(templateField.id);
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
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            // Kept short: see the "saves Profile display..." test below -- a full
            // "Playwright Applies To Retry <timestamp>" exceeds the Display name input's
            // 40-char maxLength, so the server persists a silently truncated name that
            // this test's own hand-computed expectedName then never matches.
            const displayName = `PW Applies Retry ${timestamp}`;
            const expectedName = `pw_applies_retry_${timestamp}`;

            try {
                const {app} = await pw.testBrowser.login(adminUser);
                await app.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
                await app.admin.attributes.newButton.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();

                // # Fill Display name, add Users, Channels, and Posts
                await app.admin.attribute.displayName.container.fill(displayName);
                await expect(app.admin.attribute.displayName.container).toHaveValue(displayName);
                for (const resource of ['user', 'channel', 'post'] as const) {
                    await app.admin.attribute.appliesTo.add.container.click();
                    // Resource availability varies with prior additions; observe the generated picker collection.
                    await expect(app.admin.attribute.appliesTo.add.resourceList.locator).not.toHaveCount(0);
                    await app.admin.attribute.appliesTo.add.resource(resource).click();
                    await expect(app.admin.attribute.appliesTo[resource]).toBeVisible();
                }

                // # Force the "post" linked-field creation request to fail; let user/channel/template through
                await app.page.route('**/api/v4/properties/groups/access_control/post/fields', async (route) => {
                    if (route.request().method() === 'POST') {
                        await route.fulfill({
                            status: 500,
                            contentType: 'application/json',
                            body: JSON.stringify({message: 'forced failure'}),
                        });
                    } else {
                        await route.continue();
                    }
                });

                // # Click Save
                await app.admin.saveButton.click();

                // * The banner names the failed resource, and Save is re-clickable
                await expect(app.admin.attribute.saveErrorAlert).toContainText('Posts');
                await expect(app.admin.saveButton).not.toBeDisabled();

                // * Nothing survived the rollback -- no template, no user/channel linked fields
                const templateFieldsAfterFailure = await adminClient.getPropertyFields('access_control', 'template', {
                    targetType: 'system',
                    perPage: 200,
                });
                expect(
                    templateFieldsAfterFailure.find((f) => f.name === expectedName && f.delete_at === 0),
                ).toBeUndefined();

                const userFields = await adminClient.getPropertyFields('access_control', 'user', {
                    targetType: 'system',
                    perPage: 200,
                });
                const channelFields = await adminClient.getPropertyFields('access_control', 'channel', {
                    targetType: 'system',
                    perPage: 200,
                });
                expect(userFields.find((f) => f.name === expectedName && f.delete_at === 0)).toBeUndefined();
                expect(channelFields.find((f) => f.name === expectedName && f.delete_at === 0)).toBeUndefined();

                // # Remove the interception and retry
                await app.page.unroute('**/api/v4/properties/groups/access_control/post/fields');
                await app.admin.saveButton.click();

                // * This time it succeeds
                await expect(app.page).toHavePath(attributesPath(app));

                const templateFieldsAfterRetry = await adminClient.getPropertyFields('access_control', 'template', {
                    targetType: 'system',
                    perPage: 200,
                });
                const templateField = defined(
                    templateFieldsAfterRetry.find((f) => f.name === expectedName && f.delete_at === 0),
                    'the saved template field',
                );

                const linkedFields = await fetchLinkedFieldsForTemplate(adminClient, templateField.id);
                expect(linkedFields).toHaveLength(3);
            } finally {
                await deleteAppliesToAttributeAndLinkedFieldsIfExists(adminClient, expectedName);
            }
        });

        /**
         * @objective Ensure Hierarchical is a first-class type on New attribute: the empty
         * canvas disables Save without extra copy, External source is hidden, and a parent/child
         * graph saves with named parents and shows Hierarchical in the list.
         */
        test('creates a Hierarchical attribute with a parent and child and persists named parents', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser, adminClient} = await requireHierarchicalAttributesEnabled(pw);

            const timestamp = Date.now();
            const displayName = `Playwright Graph ${timestamp}`;
            const expectedName = `playwright_graph_${timestamp}`;

            try {
                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await app.admin.attributes.newButton.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();
                await expect(page).toHavePath(attributeDetailsPath(app));

                await app.admin.attribute.displayName.container.fill(displayName);
                await expect(app.admin.attribute.uniqueName.valueText).toHaveText(expectedName);

                // # Switch type to Hierarchical
                await app.admin.attribute.type.container.click();
                await expect(app.admin.attribute.type.option('text')).toBeVisible();
                await app.admin.attribute.type.option('graph').click();
                await expect(app.admin.attribute.type.option('graph')).not.toBeVisible();

                // * Empty canvas, no extra required-options copy, External source hidden, Save disabled
                await expect(app.admin.attribute.type.container).toContainMessage(
                    Msg.admin.global_attributes.table.type.graph,
                );
                await expect(app.admin.attribute.graph.empty).toBeVisible();
                await expect(app.admin.attribute.externalSource).toHaveCount(0);
                await expect(app.admin.attribute.options.requiredAlert).toHaveCount(0);
                await expect(app.admin.saveButton).toBeDisabled();

                // # Add a root, then a child from its row menu
                await app.admin.attribute.graph.empty.name.container.fill('Air');
                await app.admin.attribute.graph.empty.addButton.click();
                await expect(graphRow(app, 'Air')).toBeVisible();
                await expect(graphRow(app, 'Air')).toBeVisible();
                await expect(app.admin.saveButton).toBeEnabled();

                await openGraphRowAddChild(app, 'Air');
                await app.admin.attribute.graph.childDraft.name.container.fill('Fighter');
                await app.admin.attribute.graph.childDraft.addButton.click();
                await expect(graphRow(app, 'Fighter', 'Air')).toBeVisible();

                await expect(graphRow(app, 'Fighter', 'Air')).toBeVisible();
                await expect(graphRow(app, 'Fighter', 'Air')).toHaveAttribute('data-depth', '1');

                await app.admin.saveButton.click();

                // * List shows Hierarchical with two options
                await expect(page).toHavePath(attributesPath(app));
                const row = await listedAttribute(app.admin.attributes, displayName);
                await expect(app.admin.attributes.row(row.id).typeText).toContainMessage(
                    Msg.admin.global_attributes.table.type.graph,
                );
                await expect(app.admin.attributes.row(row.id).optionsText).toContainText('2 options');

                // * Saved payload is a graph field; named parents live on the options route
                const field = await getGlobalAttributeFieldByName(adminClient, expectedName);
                expect(field?.type).toBe('graph');
                const options = await getGlobalAttributeFieldOptions(adminClient, defined(field).id);
                expect(options.find((option) => option.name === 'Air')?.parents ?? []).toEqual([]);
                expect(options.find((option) => option.name === 'Fighter')?.parents).toEqual(['Air']);
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, expectedName);
            }
        });

        /**
         * @objective Ensure a duplicate graph value is rejected in the canvas and does not
         * disable Save on the already-valid graph.
         */
        test('rejects a duplicate graph value name and leaves Save enabled for the existing graph', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser} = await requireHierarchicalAttributesEnabled(pw);

            const timestamp = Date.now();
            const displayName = `Playwright Graph ${timestamp}`;
            const expectedName = `playwright_graph_${timestamp}`;

            const {app} = await pw.testBrowser.login(adminUser);
            const {page} = app;
            await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
            await app.admin.attributes.newButton.click();
            await expect(app.admin.attribute.displayName.container).toBeVisible();

            await app.admin.attribute.displayName.container.fill(displayName);
            await expect(app.admin.attribute.uniqueName.valueText).toHaveText(expectedName);

            await app.admin.attribute.type.container.click();
            await expect(app.admin.attribute.type.option('text')).toBeVisible();
            await app.admin.attribute.type.option('graph').click();
            await expect(app.admin.attribute.type.option('graph')).not.toBeVisible();

            await app.admin.attribute.graph.empty.name.container.fill('Engineering');
            await app.admin.attribute.graph.empty.addButton.click();
            await expect(graphRow(app, 'Engineering')).toBeVisible();
            await expect(graphRow(app, 'Engineering')).toBeVisible();
            await expect(app.admin.saveButton).toBeEnabled();

            // # Try to add the same name again (case-insensitive)
            await app.admin.attribute.graph.addTop.name.container.fill('engineering');
            await app.admin.attribute.graph.addTop.name.container.press('Enter');

            // * Duplicate is refused; the unique-name alert is shown; Save stays enabled
            await expect(app.admin.attribute.graph.addTop.name.validationAlert).toContainText(
                '"engineering" already exists in this field.',
            );
            await expect(app.admin.attribute.graph.addTop.name.container).toHaveAttribute('aria-invalid', 'true');
            await expect(graphRow(app, 'Engineering')).toHaveCount(1);
            await expect(app.admin.saveButton).toBeEnabled();
        });

        /**
         * @objective Ensure switching to Hierarchical drops Select options, and switching away
         * from Hierarchical drops graph values.
         */
        test('clears options when switching to Hierarchical and when switching away', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser} = await requireHierarchicalAttributesEnabled(pw);

            const {app} = await pw.testBrowser.login(adminUser);
            const {page} = app;
            await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
            await app.admin.attributes.newButton.click();
            await expect(app.admin.attribute.displayName.container).toBeVisible();

            await app.admin.attribute.type.container.click();
            await expect(app.admin.attribute.type.option('text')).toBeVisible();
            await app.admin.attribute.type.option('select').click();
            await expect(app.admin.attribute.type.option('select')).not.toBeVisible();
            const selectInput = app.admin.attribute.values.addTextbox;
            await selectInput.fill('Engineering');
            await selectInput.press('Enter');
            await expect(app.admin.attribute.values.optionList.locator).toContainText(['Engineering']);
            await expect.poll(() => visibleOptionLabels(app)).toEqual(['Engineering']);

            await app.admin.attribute.type.container.click();
            await expect(app.admin.attribute.type.option('text')).toBeVisible();
            await app.admin.attribute.type.option('graph').click();
            await expect(app.admin.attribute.type.option('graph')).not.toBeVisible();
            await expect(app.admin.attribute.values.optionList).toHaveKeyCount(0);
            await expect(app.admin.attribute.graph.empty).toBeVisible();

            await app.admin.attribute.graph.empty.name.container.fill('Root');
            await app.admin.attribute.graph.empty.addButton.click();
            await expect(graphRow(app, 'Root')).toBeVisible();
            await expect(graphRow(app, 'Root')).toBeVisible();

            await app.admin.attribute.type.container.click();
            await expect(app.admin.attribute.type.option('text')).toBeVisible();
            await app.admin.attribute.type.option('select').click();
            await expect(app.admin.attribute.type.option('select')).not.toBeVisible();
            await expect(graphRow(app, 'Root')).toHaveCount(0);
            await expect(app.admin.attribute.values.optionList).toHaveKeyCount(0);
        });

        /**
         * @objective Ensure Parents-of search suggestions float in their own popover so the
         * value menu stays a fixed-height list, the candidate list is not clipped, and picking
         * a candidate still applies.
         */
        test('keeps the Parents of menu fixed-height when search suggestions open', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser, adminClient} = await requireHierarchicalAttributesEnabled(pw);

            const timestamp = Date.now();
            const displayName = `Playwright Suggest ${timestamp}`;
            const expectedName = `playwright_suggest_${timestamp}`;

            try {
                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
                await app.admin.attributes.newButton.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();
                await app.admin.attribute.displayName.container.fill(displayName);

                await app.admin.attribute.type.container.click();
                await expect(app.admin.attribute.type.option('text')).toBeVisible();
                await app.admin.attribute.type.option('graph').click();
                await expect(app.admin.attribute.type.option('graph')).not.toBeVisible();

                // # Air and Maritime as sibling roots
                await app.admin.attribute.graph.empty.name.container.fill('Air');
                await app.admin.attribute.graph.empty.addButton.click();
                await expect(graphRow(app, 'Air')).toBeVisible();
                await app.admin.attribute.graph.addTop.name.container.fill('Maritime');
                await app.admin.attribute.graph.addTop.addButton.click();
                await expect(graphRow(app, 'Maritime')).toBeVisible();

                // # Open Air's Parents pane and focus the search field
                await openGraphRowParents(app, 'Air');
                const valueMenu = app.admin.attribute.graph.pane.locator;
                await expect(app.admin.attribute.graph.pane.backButton).toHaveText('Parents of Air');
                await expect(valueMenu).toBeVisible();
                await expect(valueMenu).toHaveAccessibleName('Edit Air');

                // Measure the pane, not role=menu. Nested MUI Modal aria-hides the
                // parent menu paper; its getBoundingClientRect can shift ~16px even
                // when the suggestion list is portaled.
                //
                // The menu itself mounts with a grow transition, so read the height only
                // once that has settled — otherwise this baseline lands mid-animation
                // and every later reading looks like unrelated growth.
                const pane = valueMenu;
                const heightBeforeSearch = await waitForStableRectHeight(pane);
                await app.admin.attribute.graph.pane.parents.searchTextbox.focus();
                await expect(app.admin.attribute.graph.pane.parents.suggestionsList).toBeVisible();

                const suggestions = app.admin.attribute.graph.pane.parents.suggestionsList.locator;
                await expect(suggestions).toBeVisible();
                await expect(
                    await app.admin.attribute.graph.pane.candidateList.itemWith({text: 'Maritime'}),
                ).toBeVisible();

                // * Suggestions live in a portal below the field, not inside the pane
                const suggestionsAreInsideMenu = await suggestions.evaluate((el) =>
                    Boolean(el.closest('.attribute-graph-parents-pane')),
                );
                expect(suggestionsAreInsideMenu).toBe(false);

                const listBox = defined(await suggestions.boundingBox());
                const searchBox = defined(
                    await app.admin.attribute.graph.pane.parents.searchTextbox.locator.boundingBox(),
                );
                expect(listBox.height).toBeGreaterThan(0);
                expect(listBox.y).toBeGreaterThan(searchBox.y);

                // offsetWidth is the value we assign to the paper. boundingBox can
                // disagree by 8–18px once the list is portaled onto document.body.
                const {searchField, suggestionsPaper} = app.admin.attribute.graph.pane.parents;
                const fieldWidth = await searchField.locator.evaluate((el) => (el as HTMLElement).offsetWidth);
                const paperWidth = await suggestionsPaper.locator.evaluate((el) => (el as HTMLElement).offsetWidth);
                const widthDelta = Math.abs(paperWidth - fieldWidth);
                expect(widthDelta).toBeLessThan(1);

                // Nested MUI popover aria-hides the parent menu, so boundingBox visibility
                // checks cannot resolve it: check it is still mounted instead.
                const mountedValueMenu = valueMenu;

                // * Pane does not grow by a suggestion row (~36px). Focus and the
                // nested modal can still shift getBoundingClientRect by ~6–16px. Read the
                // height only once the focus/modal transition has stopped moving it —
                // sampling mid-transition is what made this assertion flaky.
                const heightAfterSearch = await waitForStableRectHeight(pane);
                expect(Math.abs(heightAfterSearch - heightBeforeSearch)).toBeLessThan(24);
                await expect(mountedValueMenu).toBeAttached();

                await (await app.admin.attribute.graph.pane.candidateList.itemWith({text: 'Maritime'})).click();
                await expect(graphRow(app, 'Air', 'Maritime')).toBeVisible();
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, expectedName);
            }
        });

        /**
         * @objective Ensure adding a second parent through the Parents pane asks Add
         * {parent} as a parent? and, once confirmed with Add, records both parent names.
         */
        test('confirms a parent grant from the Parents pane and records both parents', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser, adminClient} = await requireHierarchicalAttributesEnabled(pw);

            const timestamp = Date.now();
            const displayName = `Playwright Grant ${timestamp}`;
            const expectedName = `playwright_grant_${timestamp}`;

            try {
                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
                await app.admin.attributes.newButton.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();
                await app.admin.attribute.displayName.container.fill(displayName);

                await app.admin.attribute.type.container.click();
                await expect(app.admin.attribute.type.option('text')).toBeVisible();
                await app.admin.attribute.type.option('graph').click();
                await expect(app.admin.attribute.type.option('graph')).not.toBeVisible();

                // # Maritime (root), Air (root) with child Fighter
                await app.admin.attribute.graph.empty.name.container.fill('Maritime');
                await app.admin.attribute.graph.empty.addButton.click();
                await expect(graphRow(app, 'Maritime')).toBeVisible();
                await app.admin.attribute.graph.addTop.name.container.fill('Air');
                await app.admin.attribute.graph.addTop.addButton.click();
                await expect(graphRow(app, 'Air')).toBeVisible();
                await openGraphRowAddChild(app, 'Air');
                await app.admin.attribute.graph.childDraft.name.container.fill('Fighter');
                await app.admin.attribute.graph.childDraft.addButton.click();
                await expect(graphRow(app, 'Fighter', 'Air')).toBeVisible();

                // # Open Air's Parents pane and grant Maritime as a parent (newly reaches Fighter)
                await openGraphRowParents(app, 'Air');
                await expect(app.admin.attribute.graph.pane.backButton).toHaveText('Parents of Air');
                await app.admin.attribute.graph.pane.parents.searchTextbox.focus();
                await expect(app.admin.attribute.graph.pane.parents.suggestionsList).toBeVisible();
                await (await app.admin.attribute.graph.pane.candidateList.itemWith({text: 'Maritime'})).click();

                const {grantModal} = app.admin.attribute.graph;
                await expect(grantModal).toBeVisible();
                await expect(grantModal).toContainText('Add Maritime as a parent?');
                await expect(grantModal).toContainText(
                    'Air and all of its child values will also sit under Maritime. Are you sure you want to add this parent?',
                );

                // * The value menu (and its backdrop with it) has closed under the dialog
                await expect(app.admin.attribute.graph.pane).toHaveCount(0);

                await expect(grantModal.confirmButton).toHaveText(/^add$/i);
                await grantModal.confirmButton.click();

                // * Air now sits under Maritime as well as at the root of Fighter
                await expect(graphRow(app, 'Air', 'Maritime')).toBeVisible();
                await expect(graphRow(app, 'Fighter', 'Air')).toBeVisible();

                await app.admin.saveButton.click();
                await expect(page).toHavePath(attributesPath(app));

                const field = await getGlobalAttributeFieldByName(adminClient, expectedName);
                const options = await getGlobalAttributeFieldOptions(adminClient, defined(field).id);
                expect(options.find((option) => option.name === 'Air')?.parents).toEqual(
                    expect.arrayContaining(['Maritime']),
                );
                expect(options.find((option) => option.name === 'Fighter')?.parents).toEqual(['Air']);
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, expectedName);
            }
        });

        /**
         * @objective Ensure Delete this value blocks when it would orphan a child
         * (Can't delete {name} + Go to first orphan), then deletes the leaf immediately
         * and saves the remaining root.
         */
        test('blocks deleting a parent that would orphan a child, then deletes the leaf', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser, adminClient} = await requireHierarchicalAttributesEnabled(pw);

            const timestamp = Date.now();
            const displayName = `Playwright Del ${timestamp}`;
            const expectedName = `playwright_del_${timestamp}`;

            try {
                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
                await app.admin.attributes.newButton.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();
                await app.admin.attribute.displayName.container.fill(displayName);

                await app.admin.attribute.type.container.click();
                await expect(app.admin.attribute.type.option('text')).toBeVisible();
                await app.admin.attribute.type.option('graph').click();
                await expect(app.admin.attribute.type.option('graph')).not.toBeVisible();

                await app.admin.attribute.graph.empty.name.container.fill('Air');
                await app.admin.attribute.graph.empty.addButton.click();
                await expect(graphRow(app, 'Air')).toBeVisible();
                await openGraphRowAddChild(app, 'Air');
                await app.admin.attribute.graph.childDraft.name.container.fill('Fighter');
                await app.admin.attribute.graph.childDraft.addButton.click();
                await expect(graphRow(app, 'Fighter', 'Air')).toBeVisible();

                // # Delete Air — blocked because Fighter would be orphaned
                await openGraphRowDelete(app, 'Air');
                const {deleteModal} = app.admin.attribute.graph;
                await expect(deleteModal).toContainText("Can't delete Air");
                await expect(deleteModal).toContainText(
                    /Child values need a parent\. Air is the only parent of 1 child value/,
                );
                await expect(deleteModal.confirmButton).toHaveText('Go to Fighter');
                await deleteModal.confirmButton.click();

                // * Air and Fighter are both still on the canvas, and Go to flashes Fighter
                await expect(graphRow(app, 'Air')).toBeVisible();
                await expect(graphRow(app, 'Fighter', 'Air')).toBeVisible();
                await expect(graphRow(app, 'Fighter', 'Air')).toHaveClass(
                    /attribute-options-graph-values__row--highlight/,
                );

                // # Delete the leaf — no confirm; the row is removed immediately
                await openGraphRowDelete(app, 'Fighter', 'Air');

                await expect(graphRow(app, 'Fighter', 'Air')).toHaveCount(0);
                await expect(graphRow(app, 'Air')).toBeVisible();

                await app.admin.saveButton.click();
                await expect(page).toHavePath(attributesPath(app));

                const field = await getGlobalAttributeFieldByName(adminClient, expectedName);
                const options = await getGlobalAttributeFieldOptions(adminClient, defined(field).id);
                expect(options.map((option) => option.name)).toEqual(['Air']);
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, expectedName);
            }
        });

        /**
         * @objective Ensure a Users row added and configured in the same session bundles its
         * Profile display / Who can set the value config directly into the create request --
         * rather than creating bare and immediately patching -- and that every option of both
         * controls (all 3 Profile display values, both Who can set the value options) is
         * individually selectable and persists correctly, not just the one combination picked at
         * creation.
         */
        test('saves Profile display and Who can set the value directly on a new Users row, for every option', async ({
            pw,
        }) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            // Kept short (well under Constants.MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH = 40, the
            // Display name input's maxLength) so the auto-derived unique name below isn't
            // silently truncated -- unlike sibling Applies-to tests, this one's assertions
            // depend on the exact expected name matching what's actually persisted.
            const displayName = `PW Cfg ${timestamp}`;
            const expectedName = `pw_cfg_${timestamp}`;

            try {
                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
                await app.admin.attributes.newButton.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();

                // # Fill Display name, add Users, expand the row, and set both controls to their
                // first values (Always / Member -- the picker's default and Member need an
                // explicit pick here too, not just an assumed default)
                await app.admin.attribute.displayName.container.fill(displayName);
                await app.admin.attribute.appliesTo.add.container.click();
                // Resource availability varies with prior additions; observe the generated picker collection.
                await expect(app.admin.attribute.appliesTo.add.resourceList.locator).not.toHaveCount(0);
                await app.admin.attribute.appliesTo.add.resource('user').click();
                await expect(app.admin.attribute.appliesTo.user).toBeVisible();
                await app.admin.attribute.appliesTo.user.toggleButton.click();
                await expect(app.admin.attribute.appliesTo.user.toggleButton).toHaveAttribute('aria-expanded', 'true');
                await app.admin.attribute.appliesTo.user.profileDisplay('always').toggle();
                await expect(app.admin.attribute.appliesTo.user.profileDisplay('always')).toHaveAttribute(
                    'aria-pressed',
                    'true',
                );
                await app.admin.attribute.appliesTo.user.whoCanSet.memberRadio.check();
                await expect(app.admin.attribute.appliesTo.user.whoCanSet.memberRadio).toBeChecked();

                // # Save
                await app.admin.saveButton.click();
                await expect(page).toHavePath(attributesPath(app));

                const templateFields = await adminClient.getPropertyFields('access_control', 'template', {
                    targetType: 'system',
                    perPage: 200,
                });
                const templateField = defined(
                    templateFields.find((f) => f.name === expectedName && f.delete_at === 0),
                    'the saved template field',
                );

                let linkedFields = await fetchLinkedFieldsForTemplate(adminClient, templateField.id);
                let userField = linkedFields.find((f) => f.object_type === 'user');
                expect(userField?.attrs?.visibility).toBe('always');
                expect(userField?.attrs?.managed).toBe('');

                // # Reopen Edit and switch Who can set the value to System Administrator -- the
                // other option not covered by the create above
                await app.admin.attributes.row(templateField.id).actionsButton.click();
                await expect(app.admin.attributes.actionsMenu.editMenuItem).toBeVisible();
                await app.admin.attributes.actionsMenu.editMenuItem.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();
                await expect(page).toHavePath(attributeDetailsPath(app, templateField.id));
                await app.admin.attribute.appliesTo.user.toggleButton.click();
                await expect(app.admin.attribute.appliesTo.user.toggleButton).toHaveAttribute('aria-expanded', 'true');
                await app.admin.attribute.appliesTo.user.whoCanSet.adminRadio.check();
                await expect(app.admin.attribute.appliesTo.user.whoCanSet.adminRadio).toBeChecked();
                await app.admin.saveButton.click();
                await expect(page).toHavePath(attributesPath(app));

                linkedFields = await fetchLinkedFieldsForTemplate(adminClient, templateField.id);
                userField = linkedFields.find((f) => f.object_type === 'user');
                expect(userField?.attrs?.managed).toBe('admin');

                // * Every remaining Profile display option (When set, Hidden) is individually
                // selectable and persists correctly, one save per value
                for (const value of ['when_set', 'hidden'] as const) {
                    await app.admin.attributes.row(templateField.id).actionsButton.click();
                    await expect(app.admin.attributes.actionsMenu.editMenuItem).toBeVisible();
                    await app.admin.attributes.actionsMenu.editMenuItem.click();
                    await expect(app.admin.attribute.displayName.container).toBeVisible();
                    await expect(page).toHavePath(attributeDetailsPath(app, templateField.id));
                    await app.admin.attribute.appliesTo.user.toggleButton.click();
                    await expect(app.admin.attribute.appliesTo.user.toggleButton).toHaveAttribute(
                        'aria-expanded',
                        'true',
                    );
                    await app.admin.attribute.appliesTo.user.profileDisplay(value).toggle();
                    await expect(app.admin.attribute.appliesTo.user.profileDisplay(value)).toHaveAttribute(
                        'aria-pressed',
                        'true',
                    );
                    await app.admin.saveButton.click();
                    await expect(page).toHavePath(attributesPath(app));

                    linkedFields = await fetchLinkedFieldsForTemplate(adminClient, templateField.id);
                    userField = linkedFields.find((f) => f.object_type === 'user');
                    expect(userField?.attrs?.visibility).toBe(value);
                    // Who can set the value is untouched by this loop -- confirms one control's
                    // save doesn't clobber the other's already-persisted value.
                    expect(userField?.attrs?.managed).toBe('admin');
                }
            } finally {
                await deleteAppliesToAttributeAndLinkedFieldsIfExists(adminClient, expectedName);
            }
        });

        /**
         * @objective Ensure changing config on an already-saved Users row issues its own patch
         * (rather than needing a delete-and-recreate), and that toggling Who can set the value
         * updates both attrs.managed and the field's actual permission_values in both
         * directions.
         */
        test('updates config on an already-saved Users row via patch, in both directions', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const name = `e2e_applies_to_config_update_${timestamp}`;
            const displayName = `Playwright Applies To Config Update ${timestamp}`;

            try {
                const template = await createGlobalAttributeField(adminClient, name, {
                    type: 'text',
                    attrs: {display_name: displayName},
                });
                await createLinkedDependentField(adminClient, name, template.id, 'text', 'user', {
                    display_name: displayName,
                });

                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
                await app.admin.attributes.row(template.id).actionsButton.click();
                await expect(app.admin.attributes.actionsMenu.editMenuItem).toBeVisible();
                await app.admin.attributes.actionsMenu.editMenuItem.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();
                await expect(page).toHavePath(attributeDetailsPath(app, template.id));

                // # Set Who can set the value to System Administrator, save
                await app.admin.attribute.appliesTo.user.toggleButton.click();
                await expect(app.admin.attribute.appliesTo.user.toggleButton).toHaveAttribute('aria-expanded', 'true');
                await app.admin.attribute.appliesTo.user.whoCanSet.adminRadio.check();
                await expect(app.admin.attribute.appliesTo.user.whoCanSet.adminRadio).toBeChecked();
                await app.admin.saveButton.click();
                await expect(page).toHavePath(attributesPath(app));

                let linkedFields = await fetchLinkedFieldsForTemplate(adminClient, template.id);
                let userField = linkedFields.find((f) => f.object_type === 'user');
                expect(userField?.attrs?.managed).toBe('admin');
                expect(userField?.permission_values).toBe('sysadmin');

                // # Switch it back to Member, save again
                await app.admin.attributes.row(template.id).actionsButton.click();
                await expect(app.admin.attributes.actionsMenu.editMenuItem).toBeVisible();
                await app.admin.attributes.actionsMenu.editMenuItem.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();
                await app.admin.attribute.appliesTo.user.toggleButton.click();
                await expect(app.admin.attribute.appliesTo.user.toggleButton).toHaveAttribute('aria-expanded', 'true');
                await app.admin.attribute.appliesTo.user.whoCanSet.memberRadio.check();
                await expect(app.admin.attribute.appliesTo.user.whoCanSet.memberRadio).toBeChecked();
                await app.admin.saveButton.click();
                await expect(page).toHavePath(attributesPath(app));

                linkedFields = await fetchLinkedFieldsForTemplate(adminClient, template.id);
                userField = linkedFields.find((f) => f.object_type === 'user');

                // * The UI-visible attrs.managed correctly round-trips to Member
                expect(userField?.attrs?.managed).toBe('');

                // * The field's actual write permission is unlocked back to member too -- not
                // just the UI-visible attrs.managed.
                expect(userField?.permission_values).toBe('member');
            } finally {
                await deleteAppliesToAttributeAndLinkedFieldsIfExists(adminClient, name);
            }
        });

        /**
         * @objective Ensure a Users row on an AD/LDAP-synced attribute surfaces a Managed by
         * indicator naming that source, greyed out and impossible to interact with, carrying the
         * same sync icon the Definition block's synced chip uses, alongside helper text saying
         * the values are not editable in Mattermost.
         */
        test('shows a disabled AD/LDAP Managed by indicator on the Users row of a synced attribute', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const name = `e2e_managed_by_ldap_${timestamp}`;
            const displayName = `Playwright Managed By Ldap ${timestamp}`;

            try {
                const template = await createGlobalAttributeField(adminClient, name, {
                    type: 'text',
                    attrs: {display_name: displayName, ldap: 'employeeID'},
                });
                await createLinkedDependentField(adminClient, name, template.id, 'text', 'user', {
                    display_name: displayName,
                });

                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}/attribute_details/${template.id}`);
                await app.admin.attribute.appliesTo.user.toggleButton.click();
                await expect(app.admin.attribute.appliesTo.user.toggleButton).toHaveAttribute('aria-expanded', 'true');

                // * The Managed by indicator names AD/LDAP, above the "not editable" helper text
                const managedBy = app.admin.attribute.appliesTo.user.managedBy.container.locator;
                await expect(managedBy).toContainText('AD/LDAP');
                await expect(app.admin.attribute.appliesTo.user.managedByHelpText).toHaveMessage(
                    Msg.admin.global_attributes.attribute_details.applies_to.item.user.managed_by.help,
                );

                // * It carries the same glyph as the Definition block's synced chip, compared by
                // its markup so the two cannot drift apart unnoticed
                const chipIcon = await app.admin.attribute.externalSource.source('ldap').icon.locator.innerHTML();
                expect(chipIcon).toBeTruthy();
                // Compare the rendered SVG markup; the driver has no HTML-reading verb.
                expect(await app.admin.attribute.appliesTo.user.managedBy.icon.locator.innerHTML()).toBe(chipIcon);

                // * It is greyed out and cannot be operated: forcing a click past the disabled state still opens
                // no menu (a locked select renders no chevron or option parts at all)
                await expect(managedBy).toBeDisabled();
                await expect(managedBy).toHaveAccessibleName(/^Managed by: AD\/LDAP\./);
                await expect(app.admin.attribute.appliesTo.user.managedBy.value).toHaveCSS('opacity', '0.6');
                await managedBy.click({force: true});
                await expect(app.admin.attribute.appliesTo.user.managedBy.container).not.toBeExpanded();

                // * The row's editable settings are still there -- the indicator reports the
                // source, it does not lock the rest of the card
                await expect(app.admin.attribute.appliesTo.user.profileDisplay('always')).toBeEnabled();
                await expect(app.admin.attribute.appliesTo.user.whoCanSet.adminRadio).toBeEnabled();
            } finally {
                await deleteAppliesToAttributeAndLinkedFieldsIfExists(adminClient, name);
            }
        });

        /**
         * @objective Ensure the Managed by indicator tracks the linked source live: absent while
         * the attribute is managed in Mattermost, naming SAML once SAML is linked, and gone again
         * once the link is removed.
         */
        test('adds and removes the Managed by indicator as a source is linked and unlinked', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const {app} = await pw.testBrowser.login(adminUser);
            const {page} = app;
            await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
            await app.admin.attributes.newButton.click();
            await expect(app.admin.attribute.displayName.container).toBeVisible();

            await app.admin.attribute.appliesTo.add.container.click();
            // Resource availability varies with prior additions; observe the generated picker collection.
            await expect(app.admin.attribute.appliesTo.add.resourceList.locator).not.toHaveCount(0);
            await app.admin.attribute.appliesTo.add.resource('user').click();
            await expect(app.admin.attribute.appliesTo.user).toBeVisible();
            await app.admin.attribute.appliesTo.user.toggleButton.click();
            await expect(app.admin.attribute.appliesTo.user.toggleButton).toHaveAttribute('aria-expanded', 'true');

            // * An attribute managed in Mattermost has no Managed by row at all
            await expect(app.admin.attribute.appliesTo.user.bodyRegion).toBeVisible();
            await expect(app.admin.attribute.appliesTo.user.managedBy.container).toHaveCount(0);
            await expect(app.admin.attribute.appliesTo.user.managedByHelpText).toHaveCount(0);

            // # Link SAML
            await app.admin.attribute.externalSource.linkButton.click();
            // The remaining sources vary; observe that the generated menu collection opens with entries.
            await expect(app.admin.attribute.externalSource.linkMenu.sourceList.locator).not.toHaveCount(0);
            await app.admin.attribute.externalSource.linkMenu.source('saml').click();
            await expect(app.attributeModal.valueTextbox).toBeVisible();
            await app.attributeModal.valueTextbox.fill('position');
            await app.attributeModal.confirmButton.click();

            // * The indicator appears naming SAML, not AD/LDAP
            const managedBy = app.admin.attribute.appliesTo.user.managedBy.container.locator;
            await expect(managedBy).toContainText('SAML');
            await expect(managedBy).not.toContainText('AD/LDAP');

            // * ...with the same glyph the SAML chip in the Definition block carries
            // Compare the rendered SVG markup; the driver has no HTML-reading verb.
            const chipIcon = await app.admin.attribute.externalSource.source('saml').icon.locator.innerHTML();
            expect(chipIcon).toBeTruthy();
            // Compare the rendered SVG markup; the driver has no HTML-reading verb.
            expect(await app.admin.attribute.appliesTo.user.managedBy.icon.locator.innerHTML()).toBe(chipIcon);

            // # Unlink it again
            await app.admin.attribute.externalSource.source('saml').removeButton.click();

            // * The indicator and its helper text go away with the link
            await expect(app.admin.attribute.appliesTo.user.managedBy.container).toHaveCount(0);
            await expect(app.admin.attribute.appliesTo.user.managedByHelpText).toHaveCount(0);
        });
    });

    test.describe('display name rendering', () => {
        /**
         * @objective Verify a Global Attributes user-linked field's display_name renders as the
         * user-facing label across the profile popover, account settings, and admin user detail.
         */
        test('renders display name across the profile popover, account settings, and admin user detail page', async ({
            pw,
        }) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            await requireGlobalAttributesEnabled(pw);
            const {adminClient, adminUser, team, user, townSquare} = await pw.initSetup();

            const timestamp = Date.now();
            const name = `e2e_global_attribute_display_name_${timestamp}`;
            const displayName = `Playwright Display Name ${timestamp}`;
            const attributeValue = 'Engineering';

            let userField: PropertyField | undefined;

            try {
                const template = await createGlobalAttributeField(adminClient, name, {
                    type: 'text',
                    attrs: {display_name: displayName},
                });
                userField = await createLinkedDependentField(adminClient, name, template.id, 'text', 'user', {
                    display_name: displayName,
                    visibility: 'always',
                });

                // # Set a value for the target user directly through the CPA-compatible values route
                await adminClient.updateUserCustomProfileAttributesValues(user.id, {
                    [userField.id]: attributeValue,
                });

                // # Post a message as the user and open their own profile popover
                const {app: asUser} = await pw.testBrowser.login(user);
                await asUser.channelsPage.goto({team, channel: townSquare});
                const message = `display-name-rendering-${timestamp}`;
                await asUser.center.postCreate.message.container.fill(message);
                await settle(asUser.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
                const {postList} = asUser.center;
                const post = await postWith(postList, {text: message});
                // ProfilePicture exposes a role-free container, so the popover trigger has no click driver.
                await post.avatar.container.click();

                // * The profile popover renders the display_name, not the internal name
                await expect(asUser.profilePopover.attribute(userField)).toContainText(displayName);
                await expect(asUser.profilePopover.attribute(userField)).not.toContainText(name);
                await asUser.page.keyboard.press('Escape');
                await expect(asUser.profilePopover).not.toBeVisible();

                // * Account settings (Settings > Profile) also renders the display_name, both as
                // the section heading and as the input's accessible name once in edit mode
                await asUser.globalHeader.openAccountMenuButton.click();
                await expect(asUser.globalHeader.accountMenu.profileMenuItem).toBeVisible();
                const settings = await asUser.globalHeader.accountMenu.profileMenuItem.clickTo(
                    asUser.userSettingsModal,
                );
                const section = asUser.settings.customAttribute(userField);
                await expect(section.titleText).toHaveText(displayName);
                await section.editButton.click();
                await expect(section.value.container).toHaveAccessibleName(displayName);
                await settings.closeButton.click();
                await expect(settings).not.toBeVisible();

                // # Open the admin user detail page for the target user
                const {app} = await pw.testBrowser.login(adminUser);
                await app.page.goto(`/admin_console/user_management/user/${user.id}`);

                // * The admin user detail label also uses display_name
                await expect(app.admin.user.attribute(userField)).toContainText(displayName);
            } finally {
                if (userField) {
                    await deleteLinkedDependentField(adminClient, userField.id);
                }
                await deleteGlobalAttributeFieldIfExists(adminClient, name);
            }
        });
    });

    test.describe('edit attribute', () => {
        /**
         * @objective Opening Edit on a managed attribute prefills the Definition form and Save
         * PATCHes the existing template rather than creating a second one.
         */
        test('opens an existing attribute, PATCHes a display-name change, and shows it in the list', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
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

                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await app.admin.attributes.row(field.id).actionsButton.click();
                await expect(app.admin.attributes.actionsMenu.editMenuItem).toBeVisible();
                await app.admin.attributes.actionsMenu.editMenuItem.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();

                await expect(page).toHavePath(attributeDetailsPath(app, field.id));
                // Heading is "Edit {name} Attribute" (attribute_details.tsx's editTitle), not
                // a static "Edit attribute" -- it includes the attribute's own display name.
                await expect(app.admin.header).toContainMessage(
                    Msg.admin.global_attributes.attribute_details.edit_title,
                    {
                        name: displayName,
                    },
                );
                await expect(app.admin.attribute.displayName.container).toHaveValue(displayName);
                await expect(app.admin.attribute.uniqueName.valueText).toHaveText(name);

                await app.admin.attribute.displayName.container.fill(updatedDisplayName);
                await app.admin.saveButton.click();

                await expect(page).toHavePath(attributesPath(app));
                await expect(app.admin.attributes.row(field.id).nameText).toHaveText(updatedDisplayName);
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, name);
            }
        });

        /**
         * @objective Renaming a template's display_name also renames a linked channel
         * field that still shares that label -- Channel Info reads the linked field's
         * display_name, and the Save path cascades only when it still matches.
         */
        test('renames a matching linked channel display_name when the template display name changes', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const name = `business_unit_${timestamp}`;
            const displayName = `Business Unit ${timestamp}`;
            const updatedDisplayName = `Cost Center ${timestamp}`;

            try {
                const field = await createGlobalAttributeField(adminClient, name, {
                    type: 'text',
                    attrs: {display_name: displayName},
                });
                await createLinkedDependentField(adminClient, name, field.id, 'text', 'channel', {
                    display_name: displayName,
                    actions: ['display_label_info'],
                });

                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await app.admin.attributes.row(field.id).actionsButton.click();
                await expect(app.admin.attributes.actionsMenu.editMenuItem).toBeVisible();
                await app.admin.attributes.actionsMenu.editMenuItem.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();
                await expect(page).toHavePath(attributeDetailsPath(app, field.id));
                await expect(app.admin.attribute.appliesTo.channel).toBeVisible();

                await app.admin.attribute.displayName.container.fill(updatedDisplayName);
                await app.admin.saveButton.click();
                await expect(page).toHavePath(attributesPath(app));

                const linkedFields = await fetchLinkedFieldsForTemplate(adminClient, field.id);
                const channelField = linkedFields.find((f) => f.object_type === 'channel');
                expect(channelField?.attrs?.display_name).toBe(updatedDisplayName);
            } finally {
                await deleteAppliesToAttributeAndLinkedFieldsIfExists(adminClient, name);
            }
        });

        /**
         * @objective A linked field whose display_name already diverged from the template
         * must keep that custom label when the template is renamed.
         */
        test('does not overwrite a diverged linked channel display_name when renaming the template', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const name = `department_${timestamp}`;
            const displayName = `Department ${timestamp}`;
            const customLinkedDisplayName = `Org Unit ${timestamp}`;
            const updatedDisplayName = `Division ${timestamp}`;

            try {
                const field = await createGlobalAttributeField(adminClient, name, {
                    type: 'text',
                    attrs: {display_name: displayName},
                });
                await createLinkedDependentField(adminClient, name, field.id, 'text', 'channel', {
                    display_name: customLinkedDisplayName,
                    actions: ['display_label_info'],
                });

                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await app.admin.attributes.row(field.id).actionsButton.click();
                await expect(app.admin.attributes.actionsMenu.editMenuItem).toBeVisible();
                await app.admin.attributes.actionsMenu.editMenuItem.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();
                await expect(page).toHavePath(attributeDetailsPath(app, field.id));

                await app.admin.attribute.displayName.container.fill(updatedDisplayName);
                await app.admin.saveButton.click();
                await expect(page).toHavePath(attributesPath(app));

                const linkedFields = await fetchLinkedFieldsForTemplate(adminClient, field.id);
                const channelField = linkedFields.find((f) => f.object_type === 'channel');
                expect(channelField?.attrs?.display_name).toBe(customLinkedDisplayName);

                const template = await getGlobalAttributeFieldByName(adminClient, name);
                expect(template?.attrs?.display_name).toBe(updatedDisplayName);
            } finally {
                await deleteAppliesToAttributeAndLinkedFieldsIfExists(adminClient, name);
            }
        });

        /**
         * @objective Regression test: a no-op Edit/Done round-trip on the Unique name must not
         * unpin it, even when the loaded name happens to equal the current auto-slug of the
         * Display name -- Done's "did the committed value change from the auto-slug" check
         * previously mistook that coincidence for "not manually set" and re-enabled live
         * derivation, so a later Display name edit silently changed the persisted Unique name.
         */
        test('does not unpin Unique name after a no-op Edit/Done round-trip, even when the loaded name matches the current auto-slug', async ({
            pw,
        }) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const displayName = `Playwright Pin ${timestamp}`;

            // Matches the auto-slug of displayName exactly -- the coincidence that triggered
            // the regression (see slugifyForCEL: lowercase, spaces to underscores).
            const name = `playwright_pin_${timestamp}`;

            try {
                const field = await createGlobalAttributeField(adminClient, name, {
                    type: 'text',
                    attrs: {display_name: displayName},
                });

                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await app.admin.attributes.row(field.id).actionsButton.click();
                await expect(app.admin.attributes.actionsMenu.editMenuItem).toBeVisible();
                await app.admin.attributes.actionsMenu.editMenuItem.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();
                await expect(app.admin.attribute.uniqueName.valueText).toHaveText(name);

                // # No-op Edit/Done round-trip -- open Edit, change nothing, click Done
                await app.admin.attribute.uniqueName.editButton.click();
                await expect(app.admin.attribute.uniqueName.inputTextbox).toBeVisible();
                await app.admin.attribute.uniqueName.editButton.click();
                await expect(app.admin.attribute.uniqueName.valueText).toHaveText(name);

                // * Changing Display name afterward must not re-slug the pinned Unique name
                await app.admin.attribute.displayName.container.fill(`${displayName} Updated`);
                await expect(app.admin.attribute.uniqueName.valueText).toHaveText(name);
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, name);
            }
        });

        /**
         * @objective Same regression, via the Escape-only variant of a no-op edit session --
         * confirms Escape (which never touches the pin) was never the problem, only Done was.
         */
        test('does not unpin Unique name after a no-op Edit/Escape round-trip', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const displayName = `Playwright Pin Escape ${timestamp}`;
            const name = `playwright_pin_escape_${timestamp}`;

            try {
                const field = await createGlobalAttributeField(adminClient, name, {
                    type: 'text',
                    attrs: {display_name: displayName},
                });

                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await app.admin.attributes.row(field.id).actionsButton.click();
                await expect(app.admin.attributes.actionsMenu.editMenuItem).toBeVisible();
                await app.admin.attributes.actionsMenu.editMenuItem.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();
                await expect(app.admin.attribute.uniqueName.valueText).toHaveText(name);

                await app.admin.attribute.uniqueName.editButton.click();
                await expect(app.admin.attribute.uniqueName.inputTextbox).toBeVisible();
                await app.admin.attribute.uniqueName.inputTextbox.press('Escape');
                await expect(app.admin.attribute.uniqueName.valueText).toHaveText(name);

                await app.admin.attribute.displayName.container.fill(`${displayName} Updated`);
                await expect(app.admin.attribute.uniqueName.valueText).toHaveText(name);
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, name);
            }
        });

        /**
         * @objective Type is locked while a persisted Applies-to resource is on the form.
         * Remove is local until Save, which DELETEs the linked field and leaves the template.
         */
        test('locks Type while a resource is applied, and Save deletes a removed linked field', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
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

                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await app.admin.attributes.row(field.id).actionsButton.click();
                await expect(app.admin.attributes.actionsMenu.editMenuItem).toBeVisible();
                await app.admin.attributes.actionsMenu.editMenuItem.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();

                await expect(app.admin.attribute.appliesTo.user).toBeVisible();
                await expect(app.admin.attribute.type.container).toBeDisabled();

                await app.admin.attribute.appliesTo.user.toggleButton.click();
                await expect(app.admin.attribute.appliesTo.user.toggleButton).toHaveAttribute('aria-expanded', 'true');
                await app.admin.attribute.appliesTo.user.removeButton.click();
                await expect(app.admin.attribute.appliesTo.user).toHaveCount(0);
                await expect(app.admin.attribute.type.container).toBeEnabled();

                await app.admin.saveButton.click();

                // # Removing a resource with stored values warns before deleting it
                await expect(app.admin.attribute.removeAppliesToModal).toBeVisible();
                await app.admin.attribute.removeAppliesToModal.confirmButton.click();

                await expect(page).toHavePath(attributesPath(app));

                const remaining = await fetchLinkedFieldsForTemplate(adminClient, field.id);
                expect(remaining).toHaveLength(0);
                const templates = await adminClient.getPropertyFields('access_control', 'template', {
                    targetType: 'system',
                    perPage: 200,
                });
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
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
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

                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await app.admin.attributes.row(field.id).actionsButton.click();
                await expect(app.admin.attributes.actionsMenu.editMenuItem).toBeVisible();
                await app.admin.attributes.actionsMenu.editMenuItem.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();

                await app.admin.attribute.appliesTo.user.toggleButton.click();
                await expect(app.admin.attribute.appliesTo.user.toggleButton).toHaveAttribute('aria-expanded', 'true');
                await app.admin.attribute.appliesTo.user.removeButton.click();
                await expect(app.admin.attribute.appliesTo.user).toHaveCount(0);

                await app.admin.attribute.appliesTo.add.container.click();
                // Resource availability varies with prior additions; observe the generated picker collection.
                await expect(app.admin.attribute.appliesTo.add.resourceList.locator).not.toHaveCount(0);
                await app.admin.attribute.appliesTo.add.resource('user').click();
                await expect(app.admin.attribute.appliesTo.user).toBeVisible();
                await expect(app.admin.attribute.appliesTo.user).toBeVisible();

                await app.admin.saveButton.click();
                await expect(page).toHavePath(attributesPath(app));

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
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
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

                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await app.admin.attributes.row(field.id).actionsButton.click();
                await expect(app.admin.attributes.actionsMenu.editMenuItem).toBeVisible();
                await app.admin.attributes.actionsMenu.editMenuItem.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();

                await expect(app.admin.attribute.appliesTo.user).toBeVisible();
                await expect(app.admin.attribute.uniqueName.editButton).toBeDisabled();

                // # A pending local removal does not unlock the Name -- the dependent field is
                // still live on the server until Save actually removes it
                await app.admin.attribute.appliesTo.user.toggleButton.click();
                await expect(app.admin.attribute.appliesTo.user.toggleButton).toHaveAttribute('aria-expanded', 'true');
                await app.admin.attribute.appliesTo.user.removeButton.click();
                await expect(app.admin.attribute.appliesTo.user).toHaveCount(0);
                await expect(app.admin.attribute.uniqueName.editButton).toBeDisabled();

                await app.admin.saveButton.click();
                await expect(app.admin.attribute.removeAppliesToModal).toBeVisible();
                await app.admin.attribute.removeAppliesToModal.confirmButton.click();
                await expect(page).toHavePath(attributesPath(app));

                // * Only once the removal is actually persisted does re-opening the attribute
                // show the Name as editable
                await app.admin.attributes.row(field.id).actionsButton.click();
                await expect(app.admin.attributes.actionsMenu.editMenuItem).toBeVisible();
                await app.admin.attributes.actionsMenu.editMenuItem.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();
                await expect(app.admin.attribute.appliesTo.user).toHaveCount(0);
                await expect(app.admin.attribute.uniqueName.editButton).toBeEnabled();
            } finally {
                await deleteAppliesToAttributeAndLinkedFieldsIfExists(adminClient, name);
            }
        });

        /**
         * @objective Declining the remove-applies-to warning aborts the save entirely -- no PATCH,
         * no DELETE, and the admin stays on the form with the persisted linked field untouched.
         */
        test('cancelling the remove-applies-to warning leaves the linked field untouched', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
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

                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await app.admin.attributes.row(field.id).actionsButton.click();
                await expect(app.admin.attributes.actionsMenu.editMenuItem).toBeVisible();
                await app.admin.attributes.actionsMenu.editMenuItem.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();

                await app.admin.attribute.appliesTo.user.toggleButton.click();
                await expect(app.admin.attribute.appliesTo.user.toggleButton).toHaveAttribute('aria-expanded', 'true');
                await app.admin.attribute.appliesTo.user.removeButton.click();
                await expect(app.admin.attribute.appliesTo.user).toHaveCount(0);

                await app.admin.saveButton.click();
                await expect(app.admin.attribute.removeAppliesToModal).toBeVisible();
                await app.admin.attribute.removeAppliesToModal.cancelButton.click();

                // * Still on the form, Save re-clickable, nothing sent to the server
                await expect(page).toHavePath(attributeDetailsPath(app, field.id));
                await expect(app.admin.saveButton).toBeEnabled();

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
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
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

                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await app.admin.attributes.row(field.id).actionsButton.click();
                await expect(app.admin.attributes.actionsMenu.editMenuItem).toBeVisible();
                await app.admin.attributes.actionsMenu.editMenuItem.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();

                await app.admin.attribute.appliesTo.user.toggleButton.click();
                await expect(app.admin.attribute.appliesTo.user.toggleButton).toHaveAttribute('aria-expanded', 'true');
                await app.admin.attribute.appliesTo.user.removeButton.click();
                await expect(app.admin.attribute.appliesTo.user).toHaveCount(0);

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

                await app.admin.saveButton.click();
                await expect(app.admin.attribute.removeAppliesToModal).toBeVisible();
                await app.admin.attribute.removeAppliesToModal.confirmButton.click();

                // * Save reports failure and stays on the form
                await expect(app.admin.attribute.saveErrorAlert).toBeVisible();
                await expect(page).toHavePath(attributeDetailsPath(app, field.id));

                // * The linked field survives -- PATCH ran (and failed) before any DELETE could
                const remaining = await fetchLinkedFieldsForTemplate(adminClient, field.id);
                expect(remaining).toHaveLength(1);
                expect(remaining[0].id).toBe(linked.id);
            } finally {
                await deleteAppliesToAttributeAndLinkedFieldsIfExists(adminClient, name);
            }
        });

        /**
         * @objective Ensure renaming an attribute to a name already taken by another surfaces the
         * real server name_conflict error (not stubbed) and leaves the rename uncommitted.
         */
        test('shows the real server name_conflict error when renaming to a name already taken by another attribute', async ({
            pw,
        }) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const takenName = `e2e_global_attribute_name_taken_${timestamp}`;
            const takenDisplayName = `Playwright Name Taken ${timestamp}`;
            const renamingName = `e2e_global_attribute_renaming_${timestamp}`;
            const renamingDisplayName = `Playwright Renaming ${timestamp}`;

            try {
                await createGlobalAttributeField(adminClient, takenName, {
                    type: 'text',
                    attrs: {display_name: takenDisplayName},
                });
                const renamingField = await createGlobalAttributeField(adminClient, renamingName, {
                    type: 'text',
                    attrs: {display_name: renamingDisplayName},
                });

                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await app.admin.attributes.row(renamingField.id).actionsButton.click();
                await expect(app.admin.attributes.actionsMenu.editMenuItem).toBeVisible();
                await app.admin.attributes.actionsMenu.editMenuItem.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();
                await expect(page).toHavePath(attributeDetailsPath(app, renamingField.id));

                // # Rename the second attribute's Unique Name to the first attribute's Unique Name
                await app.admin.attribute.uniqueName.editButton.click();
                await expect(app.admin.attribute.uniqueName.inputTextbox).toBeVisible();
                const nameInput = app.admin.attribute.uniqueName.inputTextbox;
                await nameInput.fill(takenName);
                await nameInput.press('Enter');
                await expect(app.admin.attribute.uniqueName.valueText).toHaveText(takenName);

                await app.admin.saveButton.click();

                // * The real server 409 surfaces via the Save error banner, naming the conflicting
                // attribute, and the admin stays on the form with Save re-clickable
                const banner = app.admin.attribute.saveErrorAlert.locator;
                await expect(banner).toBeVisible();
                await expect(banner).toContainText(takenName);
                await expect(banner).toContainText('already exists');
                await expect(page).toHavePath(attributeDetailsPath(app, renamingField.id));
                await expect(app.admin.saveButton).toBeEnabled();

                // * The rename was never persisted
                const templates = await adminClient.getPropertyFields('access_control', 'template', {
                    targetType: 'system',
                    perPage: 200,
                });
                const stillRenaming = templates.find((f) => f.id === renamingField.id);
                expect(stillRenaming?.name).toBe(renamingName);
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, takenName);
                await deleteGlobalAttributeFieldIfExists(adminClient, renamingName);
            }
        });

        /**
         * @objective Ensure the options editor on an already-persisted Select attribute supports
         * adding an option, renaming one via its chip popover, and rejects a duplicate label.
         */
        test('adds, renames, and rejects a duplicate option on an already-persisted Select attribute', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const name = `e2e_global_attribute_edit_options_${timestamp}`;
            const displayName = `Playwright Edit Options ${timestamp}`;

            try {
                const field = await createGlobalAttributeField(adminClient, name, {
                    type: 'select',
                    attrs: {
                        display_name: displayName,
                        options: [
                            {id: '', name: 'Engineering'},
                            {id: '', name: 'Sales'},
                        ],
                    },
                });

                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await app.admin.attributes.row(field.id).actionsButton.click();
                await expect(app.admin.attributes.actionsMenu.editMenuItem).toBeVisible();
                await app.admin.attributes.actionsMenu.editMenuItem.click();
                await expect(app.admin.attribute.displayName.container).toBeVisible();
                await expect(page).toHavePath(attributeDetailsPath(app, field.id));

                const chips = app.admin.attribute.values.optionList;
                await expect.poll(() => visibleOptionLabels(app)).toEqual(['Engineering', 'Sales']);

                // # Add a new option to the already-persisted field
                const optionsInput = app.admin.attribute.values.addTextbox;
                await optionsInput.fill('Marketing');
                await optionsInput.press('Enter');
                await expect(app.admin.attribute.values.optionList.locator).toContainText(['Marketing']);
                await expect.poll(() => visibleOptionLabels(app)).toEqual(['Engineering', 'Sales', 'Marketing']);

                // # Rename the existing "Sales" option via its chip's popover
                const sales = await chips.itemWith({text: /^Sales$/});
                await sales.editButton.click();
                const labelInput = app.admin.attribute.values.optionMenu.label.container;
                await expect(labelInput).toHaveValue('Sales');
                await labelInput.fill('Retail');
                await labelInput.press('Enter');
                await expect.poll(() => visibleOptionLabels(app)).toEqual(['Engineering', 'Retail', 'Marketing']);

                // # Close the chip's popover (the rename already committed above)
                await labelInput.press('Escape');
                await expect(labelInput).not.toBeVisible();

                // # Attempt to add a value that duplicates an existing option's label
                await optionsInput.fill('Retail');
                await optionsInput.press('Enter');

                // * Rejected -- a "Values must be unique." error appears and no fourth chip commits
                await expect(app.admin.attribute.values.uniqueErrorAlert).toHaveMessage(
                    Msg.admin.global_attributes.attribute_details.options.values_unique,
                );
                await expect.poll(() => visibleOptionLabels(app)).toEqual(['Engineering', 'Retail', 'Marketing']);
                await optionsInput.fill('');

                await app.admin.saveButton.click();
                await expect(page).toHavePath(attributesPath(app));

                // * The saved attribute reflects the edited options, both in the list and via the API
                const row = await listedAttribute(app.admin.attributes, displayName);
                await expect(app.admin.attributes.row(row.id).optionsText).toContainText('3 options');

                const templates = await adminClient.getPropertyFields('access_control', 'template', {
                    targetType: 'system',
                    perPage: 200,
                });
                const updated = templates.find((f) => f.id === field.id);
                const optionNames = (updated?.attrs?.options as Array<{name: string}> | undefined)
                    ?.map((option) => option.name)
                    .sort();
                expect(optionNames).toEqual(['Engineering', 'Marketing', 'Retail'].sort());
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, name);
            }
        });
    });
});

/** Reads the visible Select labels in rendered ID order, preserving both count and order. */
async function visibleOptionLabels(app: App): Promise<string[]> {
    const {values} = app.admin.attribute;
    const labels: string[] = [];
    for (const id of await values.optionList.keys()) {
        const label = values.option(id).labelText;
        await expect(label).toBeVisible();
        labels.push(await label.text());
    }
    return labels;
}

/** Finds an occurrence by its existing name and parent metadata, including when asserting its absence. */
function graphRow(app: App, option: string, parent = ''): Locator {
    // Rows are keyed by position, so an occurrence is identified by its option and parent name; an absent one has no key.
    return app.admin.attribute.graph.rowList.locator.and(
        app.admin.attribute.graph.container.locator.locator(
            // eslint-disable-next-line test-surface/e2e-no-literal-locators -- graph rows are keyed by position; the option and parent name data attributes are the only identity of an occurrence, and an absent one has no key
            `[data-option-name=${JSON.stringify(option)}][data-parent-name=${JSON.stringify(parent)}]`,
        ),
    );
}

async function graphItem(app: App, option: string, parent = '') {
    const occurrence = graphRow(app, option, parent);
    await expect(occurrence).toHaveCount(1);
    return app.admin.attribute.graph.row(Number(await keyOfElement(occurrence)));
}

async function openGraphRowAddChild(app: App, option: string, parent = '') {
    const row = await graphItem(app, option, parent);
    await row.container.hover();
    await row.addChildButton.click();
    await expect(app.admin.attribute.graph.childDraft.name.container).toBeVisible();
}

async function openGraphRowParents(app: App, option: string, parent = '') {
    const row = await graphItem(app, option, parent);
    await row.container.hover();
    await row.parentsButton.click();
    await expect(app.admin.attribute.graph.pane.backButton).toHaveText(`Parents of ${option}`);
}

async function openGraphRowDelete(app: App, option: string, parent = '') {
    const row = await graphItem(app, option, parent);
    await row.container.hover();
    await row.deleteButton.click();
    // A leaf disappears immediately; a parent that would orphan a child opens the blocking dialog.
    await expect(async () => {
        const removed = (await graphRow(app, option, parent).count()) === 0;
        expect(removed || (await app.admin.attribute.graph.deleteModal.container.isVisible())).toBe(true);
    }).toPass();
}

// Polls getBoundingClientRect().height until two consecutive reads agree, so callers
// don't sample a value mid CSS-transition (e.g. a focus ring or nested modal mount).
// expect.poll runs the first probe immediately, so that reading is only a baseline;
// compare only after a later probe that has waited for the poll interval.
async function waitForStableRectHeight(locator: Locator): Promise<number> {
    let lastHeight: number | undefined;
    let latestHeight = 0;

    await expect
        .poll(
            async () => {
                const height = await locator.evaluate((el) => el.getBoundingClientRect().height);
                const isStable = lastHeight !== undefined && height === lastHeight;
                lastHeight = height;
                latestHeight = height;
                return isStable;
            },
            {intervals: [50, 100, 150, 300]},
        )
        .toBe(true);

    return latestHeight;
}
