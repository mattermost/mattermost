// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import {expect, test} from '@mattermost/playwright-lib';

import {cleanupCustomBoardFields, setupBoardAttributesTest} from './setup';

// Spec-scoped test data prefix. afterEach cleanup is filtered by this so
// concurrent specs sharing the same server (or running in alternation on a
// given worker) can't delete each other's fields.
const BA_DND_PREFIX = 'BA_DND_';

// Row reorder is driven through the drag handle's keyboard interface
// (ArrowUp / ArrowDown — see DraggableRow in webapp's list_table.tsx). That
// codepath dispatches the same `meta.onReorder` callback the native HTML5
// drag flow uses, so a passing keyboard test proves the wiring end-to-end.
//
// Chip-level option reorder uses @atlaskit/pragmatic-drag-and-drop with no
// keyboard fallback in the product, and PDND requires real HTML5 drag
// events (Playwright's locator.dragTo() only emulates mouse events). A
// dedicated chip-reorder E2E is therefore deferred to a follow-up that
// either (a) adds keyboard a11y to chip reorder, or (b) introduces a
// shared playwright-lib helper for synthetic HTML5 drag dispatch.
test.describe('Board Attributes - reorder', {tag: '@board_attributes'}, () => {
    test.afterEach(async () => {
        await cleanupCustomBoardFields((name) => name.startsWith(BA_DND_PREFIX));
    });

    test('reorders custom rows via drag-handle keyboard and persists order across reload', async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        const a = `${BA_DND_PREFIX}Row_A_${Date.now()}`;
        const b = `${BA_DND_PREFIX}Row_B_${Date.now()}`;

        // # Add two custom rows: A first (so it sits above B), then B
        await ba.addAttribute(a);
        await ba.addAttribute(b);
        await ba.saveAndWaitForSettled();

        // # Reload so both rows render with their persisted sort_order and
        //   can be addressed by name
        await ba.goto();
        await ba.toBeVisible();

        // # Focus A's drag handle and press ArrowDown to swap A past B.
        //   The handler in list_table.tsx clamps moves above the protected
        //   region, so moving custom A down by one cannot collide with the
        //   seeded protected rows.
        const aHandle = ba.rowByName(a).locator('button.dragHandle');
        await aHandle.press('ArrowDown');

        await ba.saveAndWaitForSettled();

        // * Persisted sort_order reflects the swap: A is now below B
        const fields = await adminClient.getPropertyFields('boards', 'post', 'system');
        const aField = (fields ?? []).find((f) => f.name === a);
        const bField = (fields ?? []).find((f) => f.name === b);
        const aOrder = (aField?.attrs as {sort_order?: number})?.sort_order ?? 0;
        const bOrder = (bField?.attrs as {sort_order?: number})?.sort_order ?? 0;
        expect(aOrder).toBeGreaterThan(bOrder);
    });
});
