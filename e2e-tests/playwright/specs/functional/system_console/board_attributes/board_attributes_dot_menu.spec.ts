// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import {expect, test} from '@mattermost/playwright-lib';

import {setupBoardAttributesTest, cleanupCustomBoardFields} from './setup';

test.describe('Board Attributes - row dot menu', {tag: '@board_attributes'}, () => {
    test.afterEach(async () => {
        await cleanupCustomBoardFields();
    });

    test('duplicates a custom attribute via the dot menu — copy gets a (2) suffix and persists', async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        const original = `Dup_${Date.now()}`;

        // # Add a saved custom attribute
        await ba.addAttribute(original);
        await ba.saveAndWaitForSettled();

        // # Open the row's dot menu and click Duplicate
        await ba.openDotMenuByName(original);
        await ba.clickDuplicate();

        // * A new row appears with the "(2)" suffix
        const copy = `${original} (2)`;
        await expect(ba.nameInputByValue(copy)).toBeVisible();

        // # Save and reload
        await ba.saveAndWaitForSettled();
        await ba.goto();
        await ba.toBeVisible();

        // * Both the original and the (2)-suffixed copy persist
        await expect(ba.nameInputByValue(original)).toBeVisible();
        await expect(ba.nameInputByValue(copy)).toBeVisible();

        const fields = await adminClient.getPropertyFields('boards', 'post', 'system');
        const names = (fields ?? []).map((f) => f.name);
        expect(names).toEqual(expect.arrayContaining([original, copy]));
    });

    test('deletes a saved custom attribute via the confirm modal — row disappears, server reflects', async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        const name = `Del_${Date.now()}`;

        // # Add a saved custom attribute
        await ba.addAttribute(name);
        await ba.saveAndWaitForSettled();

        // # Open the dot menu, click Delete attribute
        await ba.openDotMenuByName(name);
        await ba.clickDeleteAttribute();

        // * The confirmation modal appears
        await expect(ba.container.page().getByRole('heading', {name: 'Delete board attribute'})).toBeVisible();

        // # Confirm
        await ba.container.page().getByRole('button', {name: 'Delete', exact: true}).click();

        // # Save the delete
        await ba.saveAndWaitForSettled();

        // * The row is gone
        await expect(ba.nameInputByValue(name)).toHaveCount(0);

        // * The server no longer lists the attribute
        const fields = await adminClient.getPropertyFields('boards', 'post', 'system');
        const names = (fields ?? []).map((f) => f.name);
        expect(names).not.toContain(name);
    });

    test('dismissing the delete-confirm modal keeps the row intact', async ({pw}) => {
        const {systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        const name = `Keep_${Date.now()}`;

        // # Add and save a custom attribute
        await ba.addAttribute(name);
        await ba.saveAndWaitForSettled();

        // # Open dot menu, click Delete, then Cancel the modal
        await ba.openDotMenuByName(name);
        await ba.clickDeleteAttribute();
        await ba.container.page().getByRole('button', {name: 'Cancel'}).click();

        // * Modal is closed
        await expect(ba.container.page().getByRole('heading', {name: 'Delete board attribute'})).toHaveCount(0);

        // * Row is still present
        await expect(ba.nameInputByValue(name)).toBeVisible();

        // * Save remains disabled — no pending changes were committed
        await expect(ba.saveButton).toBeDisabled();
    });

    test('Duplicate and Delete items are disabled on protected (seeded) rows', async ({pw}) => {
        const {systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        // # Open the dot menu on the seeded Status row
        await ba.openDotMenuByName('status');

        // * Both menu items render but are aria-disabled
        const duplicate = ba.container
            .page()
            .getByText('Duplicate', {exact: true})
            .locator('xpath=ancestor::*[@role="menuitem"][1]');
        const del = ba.container
            .page()
            .getByText('Delete attribute', {exact: true})
            .locator('xpath=ancestor::*[@role="menuitem"][1]');
        await expect(duplicate).toHaveAttribute('aria-disabled', 'true');
        await expect(del).toHaveAttribute('aria-disabled', 'true');
    });
});
