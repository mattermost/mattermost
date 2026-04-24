// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * E2E tests for System Console > User Attributes page.
 *
 * Tests the admin UI for managing Custom Profile Attribute (CPA) field definitions,
 * including creating, editing, deleting, and configuring attribute fields.
 *
 * Related: MM-62558 / PR #30722 (Profile Popup CPA tests pattern reference)
 */

import {expect, test} from '@mattermost/playwright-lib';

import {cleanupFields, getFieldsMap, setupTest} from './support';

test.describe('System Console - User Attributes Management', () => {
    /**
     * @objective Verify creating a new text attribute via the UI and saving it
     * persists the field to the server.
     */
    test('creates a new text attribute and saves', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Navigate to User Attributes page
        await sp.goto();

        // # Click "Add attribute"
        await sp.addAttribute();

        // * Verify a new row with an input appears in the table
        const nameInput = sp.nameInput(0);
        await expect(nameInput).toBeVisible();

        // # Type attribute name
        await nameInput.fill('Test Department');
        await nameInput.blur();

        await sp.saveAndWaitForSettled();

        // * Verify the field was created by fetching from API
        const fieldsMap = await getFieldsMap(adminClient);
        const createdField = Object.values(fieldsMap).find((f) => f.name === 'Test Department');
        expect(createdField).toBeDefined();
        expect(createdField!.type).toBe('text');

        await cleanupFields(adminClient, fieldsMap);
    });

    /**
     * @objective Verify creating a select attribute with multiple options saves
     * the field and its options to the server.
     */
    test('creates a select attribute with options and saves', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Navigate to User Attributes page
        await sp.goto();

        // # Click "Add attribute"
        await sp.addAttribute();

        // # Type attribute name
        const nameInput = sp.nameInput(0);
        await nameInput.fill('Office Location');
        await nameInput.blur();

        // # Change type to Select
        await sp.selectType(0, 'Select');

        // # Add options
        await sp.addOptions(0, ['Remote', 'Office', 'Hybrid']);

        await sp.saveAndWaitForSettled();

        // * Verify field was created with correct type via API
        const fieldsMap = await getFieldsMap(adminClient);
        const createdField = Object.values(fieldsMap).find((f) => f.name === 'Office Location');
        expect(createdField).toBeDefined();
        expect(createdField!.type).toBe('select');
        expect(createdField!.attrs.options).toBeDefined();
        expect(createdField!.attrs.options!.length).toBe(3);

        await cleanupFields(adminClient, fieldsMap);
    });

    /**
     * @objective Verify creating a multiselect attribute with options saves
     * the field and its options to the server.
     */
    test('creates a multiselect attribute with options and saves', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Navigate to User Attributes page
        await sp.goto();

        // # Click "Add attribute"
        await sp.addAttribute();

        // # Type attribute name
        const nameInput = sp.nameInput(0);
        await nameInput.fill('Skills');
        await nameInput.blur();

        // # Change type to Multi-select
        await sp.selectType(0, 'Multi-select');

        // # Add options
        await sp.addOptions(0, ['JavaScript', 'Python', 'Go']);

        await sp.saveAndWaitForSettled();

        // * Verify field was created with correct type via API
        const fieldsMap = await getFieldsMap(adminClient);
        const createdField = Object.values(fieldsMap).find((f) => f.name === 'Skills');
        expect(createdField).toBeDefined();
        expect(createdField!.type).toBe('multiselect');
        expect(createdField!.attrs.options).toBeDefined();
        expect(createdField!.attrs.options!.length).toBe(3);

        await cleanupFields(adminClient, fieldsMap);
    });
});
