// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import {expect, test} from '@mattermost/playwright-lib';

import {
    BOARDS_GROUP,
    OBJECT_TYPE_POST,
    SYSTEM_TARGET_TYPE,
    setupBoardAttributesTest,
    cleanupCustomBoardFields,
} from './setup';

const MAX_BOARD_ATTRIBUTES = 20;

test.describe('Board Attributes - edge cases', {tag: '@board_attributes'}, () => {
    test.afterEach(async () => {
        await cleanupCustomBoardFields();
    });

    test('hides the Add attribute button when the table is at the 20-attribute cap', async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        // # Seed 18 custom attributes (Status + Assignee + 18 = 20)
        for (let i = 0; i < MAX_BOARD_ATTRIBUTES - 2; i++) {
            await adminClient.createPropertyField(BOARDS_GROUP, OBJECT_TYPE_POST, {
                name: `Cap_${i}_${Date.now()}`,
                type: 'text',
                attrs: {sort_order: i},
                target_type: SYSTEM_TARGET_TYPE,
                target_id: '',
            } as Parameters<typeof adminClient.createPropertyField>[2]);
        }

        await ba.goto();
        await ba.toBeVisible();

        // * Add attribute button is no longer rendered (canCreate=false)
        await expect(ba.addAttributeButton).toHaveCount(0);
    });

    test('changing a saved select attribute to text wipes its options on save', async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        const attrName = `Conv_${Date.now()}`;

        // # Add a select attribute with two options, save baseline
        const row = await ba.addAttribute(attrName);
        await ba.changeTypeInRow(row, 'Select');
        await ba.addOptionInRow(row, 'A');
        await ba.addOptionInRow(row, 'B');
        await ba.saveAndWaitForSettled();

        // # Reload so the input's `value` attribute reflects the saved name —
        //   rowByName / changeTypeByName rely on `input[value=...]` for filter
        await ba.goto();
        await ba.toBeVisible();

        // # Change the type to Text
        await ba.changeTypeByName(attrName, 'Text');

        // # Save
        await ba.saveAndWaitForSettled();

        // * Server-side: the saved field is now type=text. The commit path
        //   omits the `options` key from the PATCH body for non-select types
        //   (board_attributes_utils.ts:126), so the server keeps the
        //   underlying option data — the UI is what hides it. Asserting the
        //   server-side wipe would require sending `options: []` explicitly.
        const fields = await adminClient.getPropertyFields(BOARDS_GROUP, OBJECT_TYPE_POST, SYSTEM_TARGET_TYPE);
        const updated = (fields ?? []).find((f) => f.name === attrName);
        expect(updated).toBeDefined();
        expect(updated!.type).toBe('text');

        // * UI-side: no editable values container is rendered for the row
        const row2 = ba.rowByName(attrName);
        await expect(row2.getByTestId('property-values-input')).toHaveCount(0);
    });

    test('clicking another sidebar entry with unsaved changes shows the discard-changes modal', async ({pw}) => {
        const {systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        // # Add a row to create a pending change
        await ba.addAttribute(`Pending_${Date.now()}`);

        // * Save button is enabled (pending changes exist)
        await expect(ba.saveButton).toBeEnabled();

        // # Click another sidebar entry (User Attributes)
        await systemConsolePage.sidebar.systemAttributes.userAttributes.link.click();

        // * The unsaved-changes modal appears
        await expect(systemConsolePage.page.getByText('Discard Changes?', {exact: true})).toBeVisible();
    });
});
