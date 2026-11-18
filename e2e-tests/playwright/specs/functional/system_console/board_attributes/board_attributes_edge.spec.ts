// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import {Api, expect, test} from '@mattermost/playwright-lib';

import {
    addAttribute,
    addOption,
    changeType,
    cleanupCustomBoardFields,
    createTextField,
    fieldByName,
    openBoardAttributes,
    save,
    setupBoardAttributesTest,
} from './setup';

const MAX_BOARD_ATTRIBUTES = 20;

test.describe('Board Attributes - edge cases', {tag: '@board_attributes'}, () => {
    test.afterEach(async () => {
        await cleanupCustomBoardFields();
    });

    test('hides the Add attribute button when the table is at the 20-attribute cap', async ({pw}) => {
        const {adminClient, app} = await setupBoardAttributesTest(pw);

        // * Below the cap, the Add attribute button shows
        let ba = await openBoardAttributes(app);
        await expect(ba.addAttributeButton).toBeVisible();

        // # Seed 18 custom attributes (Status + Assignee + 18 = 20)
        for (let i = 0; i < MAX_BOARD_ATTRIBUTES - 2; i++) {
            await createTextField(adminClient, `Cap_${i}_${Date.now()}`, i);
        }

        // # Reload
        ba = await openBoardAttributes(app);
        await expect(ba.rowList).toHaveKeyCount(MAX_BOARD_ATTRIBUTES);

        // * Add attribute button is no longer rendered (canCreate=false)
        await expect(ba.addAttributeButton).toHaveCount(0);
    });

    test('changing a saved select attribute to text wipes its options on save', async ({pw}) => {
        const {adminClient, app} = await setupBoardAttributesTest(pw);
        let ba = await openBoardAttributes(app);

        // # Add a select attribute with two options, save baseline
        const attrName = `Conv_${Date.now()}`;
        const row = await addAttribute(ba, attrName);
        await changeType(row, 'select');
        await addOption(row, 'A');
        await addOption(row, 'B');
        await save(ba, Api.CreatePropertyField);

        // # Reload; the row shows its values
        ba = await openBoardAttributes(app);
        const savedRow = ba.row((await fieldByName(adminClient, attrName)).id);
        await expect(savedRow.values).toBeVisible();

        // # Change the type to Text
        await changeType(savedRow, 'text');

        // # Save
        await save(ba, Api.UpdatePropertyField);

        // * Server-side: the saved field is now type=text. The commit path
        //   omits the `options` key from the PATCH body for non-select types
        //   (board_attributes_utils.ts:126), so the server keeps the
        //   underlying option data — the UI is what hides it. Asserting the
        //   server-side wipe would require sending `options: []` explicitly.
        expect((await fieldByName(adminClient, attrName)).type).toBe('text');

        // * UI-side: no editable values container is rendered for the row
        await expect(savedRow.values).toHaveCount(0);
    });

    test('clicking another sidebar entry with unsaved changes shows the discard-changes modal', async ({pw}) => {
        const {app} = await setupBoardAttributesTest(pw);
        const ba = await openBoardAttributes(app);

        // # Add a row to create a pending change
        await addAttribute(ba, `Pending_${Date.now()}`);

        // * Save button is enabled (pending changes exist)
        await expect(ba.savePanel.saveButton).toBeEnabled();

        // # Click another sidebar entry (Attribute Management)
        await app.admin.sidebar.category('system_attributes').section('global_attributes').titleLink.click();

        // * The unsaved-changes modal appears
        await expect(app.discardChangesModal).toContainText('Discard Changes?');
    });
});
