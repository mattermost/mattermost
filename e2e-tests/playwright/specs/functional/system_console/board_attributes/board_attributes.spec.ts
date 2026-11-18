// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import {Api, expect, test} from '@mattermost/playwright-lib';

import {
    addAttribute,
    cleanupCustomBoardFields,
    fieldByName,
    openBoardAttributes,
    optionByName,
    rowByName,
    save,
    setupBoardAttributesTest,
} from './setup';

// Spec-scoped test data prefix. afterEach cleanup is filtered by this so
// concurrent specs sharing the same server can't delete each other's fields.
const BA_PREFIX = 'BA_';

test.describe('System Console - Board Attributes', {tag: '@board_attributes'}, () => {
    test.afterEach(async () => {
        await cleanupCustomBoardFields((name) => name.startsWith(BA_PREFIX));
    });

    test('renders page with seeded Status and Assignee rows and a disabled save button', async ({pw}) => {
        const {adminClient, app} = await setupBoardAttributesTest(pw);
        const status = await fieldByName(adminClient, 'status');
        const ba = app.admin.boardAttributes;

        // # Navigate via the sidebar entry
        await app.page.goto('/admin_console');
        await app.admin.sidebar.category('system_attributes').section('board_attributes').titleLink.click();

        // * Status row is present with its three seeded values
        const statusRow = ba.row(status.id);
        await expect(statusRow.nameTextbox).toBeVisible();
        await expect(statusRow.nameTextbox).toHaveValue('status');
        for (const name of ['Todo', 'In Progress', 'Complete']) {
            await expect(statusRow.option(optionByName(status, name)).lockedText).toBeVisible();
            await expect(statusRow.option(optionByName(status, name)).lockedText).toHaveText(name);
        }

        // * Assignee row is present
        await expect((await rowByName(ba, adminClient, 'assignee')).nameTextbox).toBeVisible();
        await expect((await rowByName(ba, adminClient, 'assignee')).nameTextbox).toHaveValue('assignee');

        // * Save button is present but disabled — no pending changes
        await expect(ba.savePanel.saveButton).toBeVisible();
        await expect(ba.savePanel.saveButton).toBeDisabled();
    });

    test('seeded Status row is protected: read-only values, disabled name input', async ({pw}) => {
        const {adminClient, app} = await setupBoardAttributesTest(pw);
        const status = await fieldByName(adminClient, 'status');
        const ba = await openBoardAttributes(app);
        const statusRow = ba.row(status.id);

        // * The Status row renders read-only values, with no editable ones
        await expect(statusRow.lockedValues).toBeVisible();
        await expect(statusRow.values).toHaveCount(0);

        // * Read-only chips render the seeded value names
        await expect(statusRow.option(optionByName(status, 'Todo')).lockedText).toHaveText('Todo');

        // * Status name input is disabled — protected fields cannot be renamed
        await expect(statusRow.nameTextbox).toBeDisabled();

        // * A new row's name input is enabled
        const row = await addAttribute(ba, `${BA_PREFIX}Editable_${Date.now()}`);
        await expect(row.nameTextbox).toBeEnabled();
    });

    test('Assignee row uses the placeholder values column (user type renders an em-dash)', async ({pw}) => {
        const {adminClient, app} = await setupBoardAttributesTest(pw);
        const ba = await openBoardAttributes(app);

        // * Assignee row exists
        const assigneeRow = await rowByName(ba, adminClient, 'assignee');
        await expect(assigneeRow.nameTextbox).toHaveValue('assignee');

        // * Its values cell renders the em-dash placeholder (no options panel)
        await expect(assigneeRow.cell('options')).toHaveText('—');
        await expect(assigneeRow.lockedValues).toHaveCount(0);
        await expect(assigneeRow.values).toHaveCount(0);
    });

    test('adds, names, saves, and persists a custom text attribute across reload', async ({pw}) => {
        const {adminClient, app} = await setupBoardAttributesTest(pw);
        let ba = await openBoardAttributes(app);

        // # Add a new attribute and name it
        const name = `${BA_PREFIX}Priority_${Date.now()}`;
        await addAttribute(ba, name);

        // # Save
        await save(ba, Api.CreatePropertyField);

        // * Field exists on the server
        const created = await fieldByName(adminClient, name);
        expect(created.type).toBe('text');

        // # Reload
        ba = await openBoardAttributes(app);

        // * Field is still rendered
        await expect(ba.row(created.id).nameTextbox).toHaveValue(name);
    });
});
