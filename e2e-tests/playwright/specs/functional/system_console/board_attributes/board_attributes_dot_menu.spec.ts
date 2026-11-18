// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import {Api, expect, test, Msg} from '@mattermost/playwright-lib';

import {
    addAttribute,
    addedKey,
    cleanupCustomBoardFields,
    openBoardAttributes,
    rowByName,
    save,
    setupBoardAttributesTest,
} from './setup';

test.describe('Board Attributes - row dot menu', {tag: '@board_attributes'}, () => {
    test.afterEach(async () => {
        await cleanupCustomBoardFields();
    });

    test('duplicates a custom attribute via the dot menu — copy gets a (2) suffix and persists', async ({pw}) => {
        const {adminClient, app} = await setupBoardAttributesTest(pw);
        let ba = await openBoardAttributes(app);

        // # Add a saved custom attribute
        const original = `Dup_${Date.now()}`;
        await addAttribute(ba, original);
        await save(ba, Api.CreatePropertyField);

        // # Open the row's dot menu and click Duplicate
        const before = await ba.rowList.keys();
        const originalRow = await rowByName(ba, adminClient, original);
        await originalRow.actionsButton.click();
        await expect(app.boardAttributeActionsMenu.duplicateMenuItem).toBeVisible();
        const menu = app.boardAttributeActionsMenu;
        await menu.duplicateMenuItem.click();

        // * A new row appears with the "(2)" suffix
        const copy = `${original} (2)`;
        await expect(ba.rowList).toHaveKeyCount(before.length + 1);
        const copyKey = addedKey(before, await ba.rowList.keys());
        await expect(ba.row(copyKey).nameTextbox).toHaveValue(copy);

        // # Save and reload
        await save(ba, Api.CreatePropertyField);
        ba = await openBoardAttributes(app);

        // * Both the original and the (2)-suffixed copy persist
        await expect((await rowByName(ba, adminClient, original)).nameTextbox).toHaveValue(original);
        await expect((await rowByName(ba, adminClient, copy)).nameTextbox).toHaveValue(copy);
    });

    test('deletes a saved custom attribute via the confirm modal — row disappears, server reflects', async ({pw}) => {
        const {adminClient, app} = await setupBoardAttributesTest(pw);
        const ba = await openBoardAttributes(app);

        // # Add a saved custom attribute
        const name = `Del_${Date.now()}`;
        await addAttribute(ba, name);
        await save(ba, Api.CreatePropertyField);
        const row = await rowByName(ba, adminClient, name);

        // # Open the dot menu, click Delete attribute
        await row.actionsButton.click();
        await expect(app.boardAttributeActionsMenu.deleteMenuItem).toBeVisible();
        await app.boardAttributeActionsMenu.deleteMenuItem.click();
        const modal = ba.deleteModal;

        // * The confirmation modal appears
        await expect(modal).toContainMessage(Msg.admin.board_attributes.delete_modal.title);

        // # Confirm
        await modal.confirmButton.click();
        await expect(modal).not.toBeVisible();
        await expect(row.nameTextbox).toBeDisabled();

        // # Save the delete
        await save(ba, Api.DeletePropertyField);

        // * The row is gone
        await expect(row).toHaveCount(0);

        // * The server no longer lists the attribute
        const fields = await adminClient.getPropertyFields('boards', 'post', {targetType: 'system'});
        expect((fields ?? []).map((f) => f.name)).not.toContain(name);
    });

    test('dismissing the delete-confirm modal keeps the row intact', async ({pw}) => {
        const {adminClient, app} = await setupBoardAttributesTest(pw);
        const ba = await openBoardAttributes(app);

        // # Add and save a custom attribute
        const name = `Keep_${Date.now()}`;
        await addAttribute(ba, name);
        await save(ba, Api.CreatePropertyField);
        const row = await rowByName(ba, adminClient, name);

        // # Open dot menu, click Delete, then Cancel the modal
        await row.actionsButton.click();
        await expect(app.boardAttributeActionsMenu.deleteMenuItem).toBeVisible();
        await app.boardAttributeActionsMenu.deleteMenuItem.click();
        const modal = ba.deleteModal;
        await expect(modal).toBeVisible();
        await modal.cancelButton.click();

        // * Modal is closed
        await expect(modal).not.toBeVisible();

        // * Row is still present
        await expect(row.nameTextbox).toHaveValue(name);

        // * Save remains disabled — no pending changes were committed
        await expect(ba.savePanel.saveButton).toBeDisabled();
    });

    test('Duplicate and Delete items are disabled on protected (seeded) rows', async ({pw}) => {
        const {adminClient, app} = await setupBoardAttributesTest(pw);
        const ba = await openBoardAttributes(app);

        // # Open the dot menu on a new custom row
        const customRow = await addAttribute(ba, `Custom_${Date.now()}`);
        await customRow.actionsButton.click();
        const custom = app.boardAttributeActionsMenu;

        // * Both menu items are enabled there
        await expect(custom.duplicateMenuItem).not.toHaveAttribute('aria-disabled', 'true');
        await expect(custom.deleteMenuItem).not.toHaveAttribute('aria-disabled', 'true');
        await app.page.keyboard.press('Escape');
        await expect(custom.deleteMenuItem).not.toBeVisible();

        // # Open the dot menu on the seeded Status row
        const status = await rowByName(ba, adminClient, 'status');
        await status.actionsButton.click();
        const menu = app.boardAttributeActionsMenu;

        // * Both menu items render but are aria-disabled
        await expect(menu.duplicateMenuItem).toHaveAttribute('aria-disabled', 'true');
        await expect(menu.deleteMenuItem).toHaveAttribute('aria-disabled', 'true');
    });
});
