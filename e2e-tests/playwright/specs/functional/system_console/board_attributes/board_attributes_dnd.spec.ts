// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import {expect, test} from '@mattermost/playwright-lib';

import {setupBoardAttributesTest, cleanupCustomBoardFields} from './setup';

// Why fixme: the table and chip reorders use @atlaskit/pragmatic-drag-and-drop,
// which is driven by native HTML5 drag events. Playwright's locator.dragTo()
// only emulates mouse events ("native drag operations are not implemented"
// per Playwright docs), so it does not trigger the drag library. A reliable
// test requires dispatching real dragstart/dragover/drop events with a
// DataTransfer object — tracked separately. Keep the specs in source so the
// shape of the missing coverage is visible.

test.describe('Board Attributes - drag-and-drop reorder', {tag: '@board_attributes'}, () => {
    test.afterEach(async () => {
        await cleanupCustomBoardFields();
    });

    test.fixme('reorders custom rows via drag and persists order across reload', async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        const a = `Row_A_${Date.now()}`;
        const b = `Row_B_${Date.now()}`;

        await ba.addAttribute(a);
        await ba.addAttribute(b);
        await ba.saveAndWaitForSettled();

        const rowAHandle = ba.rowByName(a).locator('.dragHandle');
        const rowBHandle = ba.rowByName(b).locator('.dragHandle');
        await rowAHandle.dragTo(rowBHandle);

        await ba.saveAndWaitForSettled();

        const fields = await adminClient.getPropertyFields('boards', 'post', 'system');
        const aField = (fields ?? []).find((f) => f.name === a);
        const bField = (fields ?? []).find((f) => f.name === b);
        const aOrder = (aField?.attrs as {sort_order?: number})?.sort_order ?? 0;
        const bOrder = (bField?.attrs as {sort_order?: number})?.sort_order ?? 0;
        expect(aOrder).toBeGreaterThan(bOrder);
    });

    test.fixme('reorders select options within a row via drag and persists across reload', async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        const attrName = `OptDnd_${Date.now()}`;

        const row = await ba.addAttribute(attrName);
        await ba.changeTypeInRow(row, 'Select');
        await ba.addOptionInRow(row, 'First');
        await ba.addOptionInRow(row, 'Second');
        await ba.addOptionInRow(row, 'Third');
        await ba.saveAndWaitForSettled();

        await ba.optionChip('Third').dragTo(ba.optionChip('First'));

        await ba.saveAndWaitForSettled();
        await ba.goto();
        await ba.toBeVisible();

        const fields = await adminClient.getPropertyFields('boards', 'post', 'system');
        const updated = (fields ?? []).find((f) => f.name === attrName);
        const optionNames = ((updated!.attrs as {options?: Array<{name: string}>})?.options ?? []).map((o) => o.name);
        expect(optionNames.indexOf('Third')).toBeLessThan(optionNames.indexOf('First'));
    });
});
