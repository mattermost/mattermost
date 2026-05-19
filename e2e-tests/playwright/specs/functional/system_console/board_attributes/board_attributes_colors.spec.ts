// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import {expect, test} from '@mattermost/playwright-lib';

import {COLOR_TOKEN_NAMES, SERVER_COLOR_BY_UI_LABEL, setupBoardAttributesTest, cleanupCustomBoardFields} from './setup';

test.describe('Board Attributes - option color picker', {tag: '@board_attributes'}, () => {
    test.afterEach(async () => {
        await cleanupCustomBoardFields();
    });

    // One test per color token so a single broken token doesn't mask the rest.
    for (const uiColor of COLOR_TOKEN_NAMES) {
        test(`assigns the ${uiColor} color to an option and persists across reload`, async ({pw}) => {
            const {adminClient, systemConsolePage} = await setupBoardAttributesTest(pw);
            const ba = systemConsolePage.boardAttributes;

            await ba.goto();
            await ba.toBeVisible();

            const attrName = `Color_${uiColor}_${Date.now()}`;
            const optionName = `Tagged_${uiColor}`;

            // # Add a select attribute with one option, save baseline
            const row = await ba.addAttribute(attrName);
            await ba.changeTypeInRow(row, 'Select');
            await ba.addOptionInRow(row, optionName);
            await ba.saveAndWaitForSettled();

            // # Select the color via the chip's menu picker
            await ba.setOptionColor(optionName, uiColor);

            // # Save
            await ba.saveAndWaitForSettled();

            // * Server reflects the color token
            const fields = await adminClient.getPropertyFields('boards', 'post', 'system');
            const updated = (fields ?? []).find((f) => f.name === attrName);
            const option = ((updated!.attrs as {options?: Array<{name: string; color?: string}>})?.options ?? []).find(
                (o) => o.name === optionName,
            );
            expect(option?.color).toBe(SERVER_COLOR_BY_UI_LABEL[uiColor]);

            // # Reload
            await ba.goto();
            await ba.toBeVisible();

            // * Chip is still rendered after reload
            await expect(ba.optionChip(optionName)).toBeVisible();

            await ba.openOptionMenu(optionName);

            // * The chosen color is the one marked as checked in the picker
            const checkedColor = ba.container.page().getByRole('menuitemradio', {name: uiColor, exact: true});
            await expect(checkedColor).toHaveAttribute('aria-checked', 'true');
        });
    }

    test('color picker exposes all nine color tokens', async ({pw}) => {
        const {systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        const attrName = `Picker_${Date.now()}`;

        // # Add a select with one option, open its menu
        const row = await ba.addAttribute(attrName);
        await ba.changeTypeInRow(row, 'Select');
        await ba.addOptionInRow(row, 'Pick me');
        await ba.openOptionMenu('Pick me');

        // * Every named color token is offered
        for (const uiColor of COLOR_TOKEN_NAMES) {
            await expect(ba.container.page().getByRole('menuitemradio', {name: uiColor, exact: true})).toBeVisible();
        }
    });
});
