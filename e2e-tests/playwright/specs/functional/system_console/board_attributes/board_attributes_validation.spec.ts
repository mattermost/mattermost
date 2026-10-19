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

test.describe('Board Attributes - validation', {tag: '@board_attributes'}, () => {
    test.afterEach(async () => {
        await cleanupCustomBoardFields();
    });

    test('blocks save while a new row has an empty name (name_required)', async ({pw}) => {
        const {systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        // # Add a row but leave the name empty
        await ba.addAttribute('');

        // * The "please enter a name" warning is visible
        await expect(ba.container.getByText('Please enter an attribute name.', {exact: true})).toBeVisible();

        // * Save is disabled
        await expect(ba.saveButton).toBeDisabled();
    });

    test('blocks save when two pending rows share the same name (name_unique)', async ({pw}) => {
        const {systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        const shared = `Dup_${Date.now()}`;

        // # Add two new rows with the same name
        await ba.addAttribute(shared);
        await ba.addAttribute(shared);

        // * Uniqueness warning surfaces on at least one row
        await expect(ba.container.getByText('Attribute names must be unique.', {exact: true}).first()).toBeVisible();

        // * Save is disabled
        await expect(ba.saveButton).toBeDisabled();
    });

    test('blocks save when a new row reuses a protected/seeded name', async ({pw}) => {
        const {systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        // # Add a new row and name it after the seeded protected "status" field
        await ba.addAttribute('status');

        // * A uniqueness warning surfaces. The validator's pendingByName lookup
        //   sees both the seeded status (always in the pending collection)
        //   and the new row, so name_unique fires first — name_taken is
        //   reserved for rename-against-a-saved-name conflicts.
        await expect(ba.container.getByText('Attribute names must be unique.', {exact: true}).first()).toBeVisible();

        // * Save is disabled
        await expect(ba.saveButton).toBeDisabled();
    });

    test('blocks save when renaming a saved attribute to match another saved name (name_taken)', async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        const a = `NameTakenA_${Date.now()}`;
        const b = `NameTakenB_${Date.now()}`;
        const tmp = `NameTakenTmp_${Date.now()}`;

        // # Seed two saved attributes via API for deterministic setup —
        //   two rapid UI addAttribute calls can race the React dispatch
        //   batching, leaving the second's name update unflushed.
        await adminClient.createPropertyField(BOARDS_GROUP, OBJECT_TYPE_POST, {
            name: a,
            type: 'text',
            attrs: {sort_order: 0},
            target_type: SYSTEM_TARGET_TYPE,
            target_id: '',
        } as Parameters<typeof adminClient.createPropertyField>[2]);
        await adminClient.createPropertyField(BOARDS_GROUP, OBJECT_TYPE_POST, {
            name: b,
            type: 'text',
            attrs: {sort_order: 1},
            target_type: SYSTEM_TARGET_TYPE,
            target_id: '',
        } as Parameters<typeof adminClient.createPropertyField>[2]);

        await ba.goto();
        await ba.toBeVisible();

        // # Rename A out of the way first, then rename B to A's saved name.
        //   The validator runs name_unique BEFORE name_taken, so if both rows
        //   shared the name 'a' in pending state name_unique would fire and
        //   mask the name_taken path. Renaming A → tmp leaves pendingByName
        //   ['a'] with only one entry (the renamed B), so the
        //   currentByName['a'] lookup fires name_taken against the saved A.
        //
        //   React updates the `value` HTML attribute on re-render for
        //   controlled inputs, so once fill() commits the attribute changes
        //   and `rowByName(...)` can no longer locate the row by its
        //   original value — capture the input first, then blur via keyboard
        //   so the locator isn't re-resolved against a stale name.
        const aInput = ba.rowByName(a).locator('[data-testid="board-attribute-field-input"]');
        await aInput.fill(tmp);
        await systemConsolePage.page.keyboard.press('Tab');

        const bInput = ba.rowByName(b).locator('[data-testid="board-attribute-field-input"]');
        await bInput.fill(a);
        await systemConsolePage.page.keyboard.press('Tab');

        // * The "name already taken" warning surfaces
        await expect(ba.container.getByText('Attribute name already taken.', {exact: true})).toBeVisible();

        // * Save is disabled
        await expect(ba.saveButton).toBeDisabled();
    });

    test('blocks save when two options in the same select share a name (values_unique)', async ({pw}) => {
        const {systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        const attrName = `OptDup_${Date.now()}`;

        // # Add a select attribute with two options committed to the same name.
        //   addOptionInRow opens the new chip's menu, fills its name, and blurs
        //   to commit — calling it twice with the same name commits a duplicate
        //   into the options collection, which is what triggers values_unique.
        const row = await ba.addAttribute(attrName);
        await ba.changeTypeInRow(row, 'Select');
        await ba.addOptionInRow(row, 'Alpha');
        await ba.addOptionInRow(row, 'Alpha');

        // * Collection-level uniqueness warning surfaces under the chip list
        await expect(ba.container.getByText('Values must be unique.', {exact: true})).toBeVisible();

        // * Save is disabled
        await expect(ba.saveButton).toBeDisabled();
    });
});
