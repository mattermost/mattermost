// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import {Api, expect, test, Msg} from '@mattermost/playwright-lib';

import {
    addAttribute,
    addOption,
    changeType,
    cleanupCustomBoardFields,
    fieldByName,
    openBoardAttributes,
    optionByName,
    optionsOf,
    renameOption,
    save,
    setupBoardAttributesTest,
} from './setup';

test.describe('Board Attributes - select option values', {tag: '@board_attributes'}, () => {
    test.afterEach(async () => {
        await cleanupCustomBoardFields();
    });

    test('adds options and renames one — persists across reload', async ({pw}) => {
        const {adminClient, app} = await setupBoardAttributesTest(pw);
        let ba = await openBoardAttributes(app);

        // # Add a select attribute with three options
        const attrName = `Opts_${Date.now()}`;
        const row = await addAttribute(ba, attrName);
        await changeType(row, 'select');
        await addOption(row, 'Low');
        await addOption(row, 'Medium');
        await addOption(row, 'High');
        await save(ba, Api.CreatePropertyField);

        // # Rename "Medium" → "Mid" and save
        let field = await fieldByName(adminClient, attrName);
        const savedRow = ba.row(field.id);
        const medium = optionByName(field, 'Medium');
        await renameOption(savedRow, medium.id, 'Mid');
        await expect(savedRow.optionList.locator).toHaveText(['Low', 'Mid', 'High']);
        await save(ba, Api.UpdatePropertyField);

        // * Server reflects the create and rename
        field = await fieldByName(adminClient, attrName);
        const optionNames = optionsOf(field).map((o) => o.name);
        expect(optionNames).toEqual(expect.arrayContaining(['Low', 'Mid', 'High']));
        expect(optionNames).not.toContain('Medium');

        // # Reload
        ba = await openBoardAttributes(app);

        // * Persisted state renders correctly
        for (const option of optionsOf(field)) {
            await expect(ba.row(field.id).option(option)).toBeVisible();
            await expect(ba.row(field.id).option(option)).toHaveText(option.name);
        }
    });

    test('deletes an option via the inline X button and persists across reload', async ({pw}) => {
        const {adminClient, app} = await setupBoardAttributesTest(pw);
        let ba = await openBoardAttributes(app);

        // # Add a select attribute with two options, save baseline
        const attrName = `Del_${Date.now()}`;
        const row = await addAttribute(ba, attrName);
        await changeType(row, 'select');
        await addOption(row, 'KeepMe');
        await addOption(row, 'DeleteMe');
        await save(ba, Api.CreatePropertyField);

        // # Delete one option
        let field = await fieldByName(adminClient, attrName);
        const keep = optionByName(field, 'KeepMe');
        const remove = optionByName(field, 'DeleteMe');
        await ba.row(field.id).option(remove).deleteButton.click();
        await expect(ba.row(field.id).option(remove)).toHaveCount(0);
        await expect(ba.row(field.id).option(keep)).toHaveText('KeepMe');
        await save(ba, Api.UpdatePropertyField);

        // * Server reflects the deletion
        field = await fieldByName(adminClient, attrName);
        const optionNames = optionsOf(field).map((o) => o.name);
        expect(optionNames).toContain('KeepMe');
        expect(optionNames).not.toContain('DeleteMe');

        // # Reload
        ba = await openBoardAttributes(app);

        // * Only the kept option renders
        await expect(ba.row(field.id).optionList.locator).toHaveText(['KeepMe']);
    });

    test('shows an in-menu duplicate-name warning while typing an existing option name', async ({pw}) => {
        const {app} = await setupBoardAttributesTest(pw);
        const ba = await openBoardAttributes(app);

        // # Add a select attribute with two distinct options
        const row = await addAttribute(ba, `Dup_${Date.now()}`);
        await changeType(row, 'select');
        const alpha = await addOption(row, 'Alpha');
        await addOption(row, 'Beta');

        // # Open Alpha's menu and type a new name
        await row.option({id: alpha}).editButton.click();
        const optionMenu = app.boardAttributeOptionMenu;
        await expect(optionMenu.nameTextbox).toHaveValue('Alpha');
        await optionMenu.nameTextbox.fill('Gamma');

        // * No warning shows for a distinct name
        await expect(optionMenu.nameErrorAlert).not.toBeVisible();
        await expect(optionMenu.nameTextbox).toHaveAttribute('aria-invalid', 'false');

        // # Type "Beta"
        await optionMenu.nameTextbox.fill('Beta');

        // * In-menu duplicate warning appears
        await expect(optionMenu.nameErrorAlert).toHaveMessage(Msg.admin.board_attributes.values.rename_duplicate);

        // * aria-invalid is set on the input
        await expect(optionMenu.nameTextbox).toHaveAttribute('aria-invalid', 'true');
    });

    test('appends a unique default name when adding multiple unnamed options in a row', async ({pw}) => {
        const {app} = await setupBoardAttributesTest(pw);
        const ba = await openBoardAttributes(app);

        // # Add a select attribute
        const row = await addAttribute(ba, `Auto_${Date.now()}`);
        await changeType(row, 'select');

        // # Click Add value three times without naming the options
        await row.addValueButton.click();
        await expect(row.optionList.locator).toHaveText(['Option 1']);
        await row.addValueButton.click();
        await expect(row.optionList.locator).toHaveText(['Option 1', 'Option 2']);
        await row.addValueButton.click();

        // * Three default-named option chips appear with auto-incrementing suffixes
        await expect(row.optionList.locator).toHaveText(['Option 1', 'Option 2', 'Option 3']);
    });
});
