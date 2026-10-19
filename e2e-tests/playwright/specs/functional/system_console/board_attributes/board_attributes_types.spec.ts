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
import type {BoardAttributeType} from './setup';

const SERVER_TYPE_BY_UI_LABEL: Record<BoardAttributeType, string> = {
    Text: 'text',
    Select: 'select',
    'Multi-select': 'multiselect',
    Date: 'date',
    User: 'user',
};

const TYPES: BoardAttributeType[] = ['Text', 'Select', 'Multi-select', 'Date', 'User'];

test.describe('Board Attributes - attribute types', {tag: '@board_attributes'}, () => {
    test.afterEach(async () => {
        await cleanupCustomBoardFields();
    });

    for (const uiType of TYPES) {
        test(`adds a new attribute and changes its type to ${uiType} — persists across reload`, async ({pw}) => {
            const {adminClient, systemConsolePage} = await setupBoardAttributesTest(pw);
            const ba = systemConsolePage.boardAttributes;

            await ba.goto();
            await ba.toBeVisible();

            const name = `Type_${uiType.replace(/[^A-Za-z]/g, '')}_${Date.now()}`;

            // # Add a new attribute, fill its name, change the type
            const row = await ba.addAttribute(name);
            await ba.changeTypeInRow(row, uiType);

            // # Select / Multi-select require at least one option, otherwise
            //   validation gates save (ValidationWarningOptionsRequired).
            if (uiType === 'Select' || uiType === 'Multi-select') {
                await ba.addOptionInRow(row, 'Initial');
            }

            // # Save
            await ba.saveAndWaitForSettled();

            // * Server reflects the chosen type
            const fields = await adminClient.getPropertyFields(BOARDS_GROUP, OBJECT_TYPE_POST, SYSTEM_TARGET_TYPE);
            const created = (fields ?? []).find((f) => f.name === name);
            expect(created).toBeDefined();
            expect(created!.type).toBe(SERVER_TYPE_BY_UI_LABEL[uiType]);

            // # Reload
            await ba.goto();
            await ba.toBeVisible();

            // * Row is still rendered
            await expect(ba.nameInputByValue(name)).toBeVisible();

            // * Row's type selector reflects the chosen type
            await expect(ba.typeSelectorByName(name)).toContainText(uiType);
        });
    }

    test('type menu opens with all five types and the default (Text) is checked', async ({pw}) => {
        const {systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        // # Add a row (defaults to Text)
        const row = await ba.addAttribute(`Menu_${Date.now()}`);

        // # Open the type menu
        await ba.openTypeMenuInRow(row);

        // * All five types are listed
        for (const uiType of TYPES) {
            await expect(ba.container.page().getByRole('menuitemradio', {name: uiType, exact: true})).toBeVisible();
        }

        // * Default type (Text) is marked as the current selection
        const textItem = ba.container.page().getByRole('menuitemradio', {name: 'Text', exact: true});
        await expect(textItem).toHaveAttribute('aria-checked', 'true');
    });

    test('type selector is disabled on protected (seeded) rows', async ({pw}) => {
        const {systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        // * Status and Assignee type selectors are disabled
        await expect(ba.typeSelectorByName('status')).toBeDisabled();
        await expect(ba.typeSelectorByName('assignee')).toBeDisabled();
    });
});
