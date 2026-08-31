// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import {expect, test} from '@mattermost/playwright-lib';

import {setupBoardAttributesTest, cleanupCustomBoardFields} from './setup';

test.describe('Board Attributes - select option values', {tag: '@board_attributes'}, () => {
    test.afterEach(async () => {
        await cleanupCustomBoardFields();
    });

    test('adds options and renames one — persists across reload', async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        const attrName = `Opts_${Date.now()}`;

        // # Add a select attribute with three options
        const row = await ba.addAttribute(attrName);
        await ba.changeTypeInRow(row, 'Select');
        await ba.addOptionInRow(row, 'Low');
        await ba.addOptionInRow(row, 'Medium');
        await ba.addOptionInRow(row, 'High');
        await ba.saveAndWaitForSettled();

        // # Rename "Medium" → "Mid" and save
        await ba.renameOption('Medium', 'Mid');
        await expect(ba.optionChip('Mid')).toBeVisible();
        await expect(ba.optionChip('Medium')).toHaveCount(0);
        await ba.saveAndWaitForSettled();

        // * Server reflects the create and rename
        const fields = await adminClient.getPropertyFields('boards', 'post', 'system');
        const created = (fields ?? []).find((f) => f.name === attrName);
        expect(created).toBeDefined();
        const optionNames = ((created!.attrs as {options?: Array<{name: string}>})?.options ?? []).map((o) => o.name);
        expect(optionNames).toEqual(expect.arrayContaining(['Low', 'Mid', 'High']));
        expect(optionNames).not.toContain('Medium');

        // # Reload
        await ba.goto();
        await ba.toBeVisible();

        // * Persisted state renders correctly
        await expect(ba.optionChip('Low')).toBeVisible();
        await expect(ba.optionChip('Mid')).toBeVisible();
        await expect(ba.optionChip('High')).toBeVisible();
    });

    test('deletes an option via the inline X button and persists across reload', async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        const attrName = `Del_${Date.now()}`;

        // # Add a select attribute with two options, save baseline
        const row = await ba.addAttribute(attrName);
        await ba.changeTypeInRow(row, 'Select');
        await ba.addOptionInRow(row, 'KeepMe');
        await ba.addOptionInRow(row, 'DeleteMe');
        await ba.saveAndWaitForSettled();

        // # Delete one option
        await ba.deleteOptionViaXButton('DeleteMe');
        await expect(ba.optionChip('DeleteMe')).toHaveCount(0);
        await expect(ba.optionChip('KeepMe')).toBeVisible();
        await ba.saveAndWaitForSettled();

        // * Server reflects the deletion
        const fields = await adminClient.getPropertyFields('boards', 'post', 'system');
        const updated = (fields ?? []).find((f) => f.name === attrName);
        const optionNames = ((updated!.attrs as {options?: Array<{name: string}>})?.options ?? []).map((o) => o.name);
        expect(optionNames).toContain('KeepMe');
        expect(optionNames).not.toContain('DeleteMe');

        // # Reload
        await ba.goto();
        await ba.toBeVisible();

        // * Only the kept option renders
        await expect(ba.optionChip('KeepMe')).toBeVisible();
        await expect(ba.optionChip('DeleteMe')).toHaveCount(0);
    });

    test('shows an in-menu duplicate-name warning while typing an existing option name', async ({pw}) => {
        const {systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        const attrName = `Dup_${Date.now()}`;

        // # Add a select attribute with two distinct options, save baseline
        const row = await ba.addAttribute(attrName);
        await ba.changeTypeInRow(row, 'Select');
        await ba.addOptionInRow(row, 'Alpha');
        await ba.addOptionInRow(row, 'Beta');
        await ba.saveAndWaitForSettled();

        // # Open Alpha's menu and type "Beta"
        await ba.openOptionMenu('Alpha');
        const renameInput = ba.container.page().getByPlaceholder('Option name');
        await renameInput.fill('Beta');

        // * In-menu duplicate warning appears
        await expect(
            ba.container.page().getByText('A value with this name already exists.', {exact: true}),
        ).toBeVisible();

        // * aria-invalid is set on the input
        await expect(renameInput).toHaveAttribute('aria-invalid', 'true');
    });

    test('appends a unique default name when adding multiple unnamed options in a row', async ({pw}) => {
        const {systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        const attrName = `Auto_${Date.now()}`;

        // # Add a select attribute
        const row = await ba.addAttribute(attrName);
        await ba.changeTypeInRow(row, 'Select');

        // # Click Add value three times without naming the options
        await row.getByRole('button', {name: 'Add value'}).click();
        await row.getByRole('button', {name: 'Add value'}).click();
        await row.getByRole('button', {name: 'Add value'}).click();

        // * Three default-named option chips appear with auto-incrementing suffixes
        await expect(ba.optionChip('Option 1')).toBeVisible();
        await expect(ba.optionChip('Option 2')).toBeVisible();
        await expect(ba.optionChip('Option 3')).toBeVisible();
    });
});
