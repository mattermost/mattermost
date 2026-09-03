// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import {expect, test} from '@mattermost/playwright-lib';

import {setupBoardAttributesTest, cleanupCustomBoardFields} from './setup';

// Spec-scoped test data prefix. afterEach cleanup is filtered by this so
// concurrent specs sharing the same server can't delete each other's fields.
const BA_PREFIX = 'BA_';

test.describe('System Console - Board Attributes', {tag: '@board_attributes'}, () => {
    test.afterEach(async () => {
        await cleanupCustomBoardFields((name) => name.startsWith(BA_PREFIX));
    });

    test('renders page with seeded Status and Assignee rows and a disabled save button', async ({pw}) => {
        const {systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        // # Navigate via the sidebar entry
        await systemConsolePage.sidebar.systemAttributes.boardAttributes.click();
        await ba.toBeVisible();

        // * Status row is present with its three seeded values
        await expect(ba.nameInputByValue('status')).toBeVisible();
        await expect(ba.optionChip('Todo')).toBeVisible();
        await expect(ba.optionChip('In Progress')).toBeVisible();
        await expect(ba.optionChip('Complete')).toBeVisible();

        // * Assignee row is present
        await expect(ba.nameInputByValue('assignee')).toBeVisible();

        // * Save button is present but disabled — no pending changes
        await expect(ba.saveButton).toBeVisible();
        await expect(ba.saveButton).toBeDisabled();
    });

    test('seeded Status row is protected: read-only values, disabled name input', async ({pw}) => {
        const {systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        // * The read-only values container exists exactly once — only the
        //   seeded protected select renders it
        await expect(ba.container.getByTestId('property-values-readonly')).toHaveCount(1);

        // * Read-only chips render the seeded value names
        await expect(
            ba.container.getByTestId('property-values-readonly').getByText('Todo', {exact: true}),
        ).toBeVisible();

        // * Status name input is disabled — protected fields cannot be renamed
        await expect(ba.nameInputByValue('status')).toBeDisabled();
    });

    test('Assignee row uses the placeholder values column (user type renders an em-dash)', async ({pw}) => {
        const {systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        // * Assignee row exists
        await expect(ba.nameInputByValue('assignee')).toBeVisible();

        // * Its values cell renders the em-dash placeholder (no options panel)
        const assigneeRow = ba.rowByName('assignee');
        await expect(assigneeRow.getByText('—')).toBeVisible();
        await expect(assigneeRow.getByTestId('property-values-readonly')).toHaveCount(0);
        await expect(assigneeRow.getByTestId('property-values-input')).toHaveCount(0);
    });

    test('adds, names, saves, and persists a custom text attribute across reload', async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupBoardAttributesTest(pw);
        const ba = systemConsolePage.boardAttributes;

        await ba.goto();
        await ba.toBeVisible();

        const name = `${BA_PREFIX}Priority_${Date.now()}`;

        // # Add a new attribute and name it
        await ba.addAttribute(name);

        // # Save
        await ba.saveAndWaitForSettled();

        // * Field exists on the server
        const fields = await adminClient.getPropertyFields('boards', 'post', 'system');
        const created = (fields ?? []).find((f) => f.name === name);
        expect(created).toBeDefined();
        expect(created!.type).toBe('text');

        // # Reload
        await ba.goto();
        await ba.toBeVisible();

        // * Field is still rendered
        await expect(ba.nameInputByValue(name)).toBeVisible();
    });
});
