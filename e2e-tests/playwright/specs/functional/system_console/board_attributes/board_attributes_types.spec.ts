// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import {Api, expect, test} from '@mattermost/playwright-lib';

import {
    TYPE_LABEL,
    addAttribute,
    addOption,
    changeType,
    cleanupCustomBoardFields,
    fieldByName,
    openBoardAttributes,
    rowByName,
    save,
    setupBoardAttributesTest,
} from './setup';

const TYPES = ['text', 'select', 'multiselect', 'date', 'user'] as const;

test.describe('Board Attributes - attribute types', {tag: '@board_attributes'}, () => {
    test.afterEach(async () => {
        await cleanupCustomBoardFields();
    });

    for (const type of TYPES) {
        const label = TYPE_LABEL[type];

        test(`adds a new attribute and changes its type to ${label} — persists across reload`, async ({pw}) => {
            const {adminClient, app} = await setupBoardAttributesTest(pw);
            let ba = await openBoardAttributes(app);

            // # Add a new attribute, fill its name, change the type
            const name = `Type_${label.replace(/[^A-Za-z]/g, '')}_${Date.now()}`;
            const row = await addAttribute(ba, name);
            await changeType(row, type);

            // # Select / Multi-select require at least one option, otherwise
            //   validation gates save (ValidationWarningOptionsRequired).
            if (type === 'select' || type === 'multiselect') {
                await addOption(row, 'Initial');
            }

            // # Save
            await save(ba, Api.CreatePropertyField);

            // * Server reflects the chosen type
            const created = await fieldByName(adminClient, name);
            expect(created.type).toBe(type);

            // # Reload
            ba = await openBoardAttributes(app);

            // * Row is still rendered
            await expect(ba.row(created.id).nameTextbox).toHaveValue(name);

            // * Row's type selector reflects the chosen type
            await expect(ba.row(created.id).typeButton).toContainText(label);
        });
    }

    test('type menu opens with all five types and the default (Text) is checked', async ({pw}) => {
        const {app} = await setupBoardAttributesTest(pw);
        const ba = await openBoardAttributes(app);

        // # Add a row (defaults to Text)
        const row = await addAttribute(ba, `Menu_${Date.now()}`);

        // # Open the type menu
        await row.typeButton.click();
        const menu = app.boardAttributeTypeMenu;

        // * All five types are listed
        await expect(menu.typeList).toHaveKeyCount(TYPES.length);
        for (const type of TYPES) {
            await expect(menu.type(type)).toBeVisible();
        }

        // * Default type (Text) is marked as the current selection
        await expect(menu.type('text')).toHaveAttribute('aria-checked', 'true');
        await expect(menu.type('select')).toHaveAttribute('aria-checked', 'false');
    });

    test('type selector is disabled on protected (seeded) rows', async ({pw}) => {
        const {adminClient, app} = await setupBoardAttributesTest(pw);
        const ba = await openBoardAttributes(app);

        // * A new row's type selector is enabled
        await expect((await addAttribute(ba, `Enabled_${Date.now()}`)).typeButton).toBeEnabled();

        // * Status and Assignee type selectors are disabled
        await expect((await rowByName(ba, adminClient, 'status')).typeButton).toBeDisabled();
        await expect((await rowByName(ba, adminClient, 'assignee')).typeButton).toBeDisabled();
    });
});
