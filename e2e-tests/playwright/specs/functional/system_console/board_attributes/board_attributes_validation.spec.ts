// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import {expect, test, Msg} from '@mattermost/playwright-lib';

import {
    addAttribute,
    addOption,
    changeType,
    cleanupCustomBoardFields,
    createTextField,
    openBoardAttributes,
    setupBoardAttributesTest,
} from './setup';

test.describe('Board Attributes - validation', {tag: '@board_attributes'}, () => {
    test.afterEach(async () => {
        await cleanupCustomBoardFields();
    });

    test('blocks save while a new row has an empty name (name_required)', async ({pw}) => {
        const {app} = await setupBoardAttributesTest(pw);
        const ba = await openBoardAttributes(app);

        // # Add a row but leave the name empty
        const row = await addAttribute(ba, '');

        // * The "please enter a name" warning is visible
        await expect(row.nameErrorText).toHaveMessage(Msg.admin.board_attributes.table.validation.name_required);

        // * Save is disabled
        await expect(ba.savePanel.saveButton).toBeDisabled();

        // # Name the row
        await row.nameTextbox.fill(`Named_${Date.now()}`);
        await row.nameTextbox.blur();

        // * The warning clears and Save is enabled
        await expect(row.nameErrorText).not.toBeVisible();
        await expect(ba.savePanel.saveButton).toBeEnabled();
    });

    test('blocks save when two pending rows share the same name (name_unique)', async ({pw}) => {
        const {app} = await setupBoardAttributesTest(pw);
        const ba = await openBoardAttributes(app);

        // # Add two new rows with the same name
        const shared = `Dup_${Date.now()}`;
        const first = await addAttribute(ba, shared);
        const second = await addAttribute(ba, shared);

        // * Uniqueness warning surfaces on both rows
        await expect(first.nameErrorText).toHaveMessage(Msg.admin.board_attributes.table.validation.name_unique);
        await expect(second.nameErrorText).toHaveMessage(Msg.admin.board_attributes.table.validation.name_unique);

        // * Save is disabled
        await expect(ba.savePanel.saveButton).toBeDisabled();
    });

    test('blocks save when a new row reuses a protected/seeded name', async ({pw}) => {
        const {app} = await setupBoardAttributesTest(pw);
        const ba = await openBoardAttributes(app);

        // # Add a new row and name it after the seeded protected "status" field
        const row = await addAttribute(ba, 'status');

        // * A uniqueness warning surfaces. The validator's pendingByName lookup
        //   sees both the seeded status (always in the pending collection)
        //   and the new row, so name_unique fires first — name_taken is
        //   reserved for rename-against-a-saved-name conflicts.
        await expect(row.nameErrorText).toHaveMessage(Msg.admin.board_attributes.table.validation.name_unique);

        // * Save is disabled
        await expect(ba.savePanel.saveButton).toBeDisabled();
    });

    test('blocks save when renaming a saved attribute to match another saved name (name_taken)', async ({pw}) => {
        const {adminClient, app} = await setupBoardAttributesTest(pw);

        // # Seed two saved attributes via API for deterministic setup —
        //   two rapid UI addAttribute calls can race the React dispatch
        //   batching, leaving the second's name update unflushed.
        const a = `NameTakenA_${Date.now()}`;
        const b = `NameTakenB_${Date.now()}`;
        const tmp = `NameTakenTmp_${Date.now()}`;
        const fieldA = await createTextField(adminClient, a, 0);
        const fieldB = await createTextField(adminClient, b, 1);

        const ba = await openBoardAttributes(app);

        // # Rename A out of the way first, then rename B to A's saved name.
        //   The validator runs name_unique BEFORE name_taken, so if both rows
        //   shared the name 'a' in pending state name_unique would fire and
        //   mask the name_taken path. Renaming A → tmp leaves pendingByName
        //   ['a'] with only one entry (the renamed B), so the
        //   currentByName['a'] lookup fires name_taken against the saved A.
        await ba.row(fieldA.id).nameTextbox.fill(tmp);
        await ba.row(fieldA.id).nameTextbox.press('Tab');
        await expect(ba.row(fieldA.id).nameTextbox).toHaveValue(tmp);
        await ba.row(fieldB.id).nameTextbox.fill(a);
        await ba.row(fieldB.id).nameTextbox.press('Tab');

        // * The "name already taken" warning surfaces
        await expect(ba.row(fieldB.id).nameErrorText).toHaveMessage(
            Msg.admin.board_attributes.table.validation.name_taken,
        );

        // * Save is disabled
        await expect(ba.savePanel.saveButton).toBeDisabled();
    });

    test('blocks save when two options in the same select share a name (values_unique)', async ({pw}) => {
        const {app} = await setupBoardAttributesTest(pw);
        const ba = await openBoardAttributes(app);

        // # Add a select attribute with two options committed to the same name.
        //   The rename commits even a duplicate name into the options
        //   collection, which is what triggers values_unique.
        const row = await addAttribute(ba, `OptDup_${Date.now()}`);
        await changeType(row, 'select');
        await addOption(row, 'Alpha');

        // * No warning with one option
        await expect(row.valuesErrorText).not.toBeVisible();

        await addOption(row, 'Alpha', {duplicate: true});

        // * Collection-level uniqueness warning surfaces under the chip list
        await expect(row.valuesErrorText).toHaveMessage(Msg.admin.board_attributes.table.validation.values_unique);

        // * Save is disabled
        await expect(ba.savePanel.saveButton).toBeDisabled();
    });
});
