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

import {
    setupCustomProfileAttributeFields,
    CustomProfileAttribute,
} from '../../channels/custom_profile_attributes/helpers';

import {cleanupFields, getFieldsMap, setupTest} from './support';

test.describe('System Console - User Attributes Management', () => {
    /**
     * @objective Verify editing an existing attribute name and saving persists
     * the rename to the server.
     *
     * @precondition
     * A custom profile attribute named "Old Name" exists via API setup.
     */
    test('edits an existing attribute name and saves', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Create an attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'Old Name', type: 'text'}];
        const fieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);

        // # Navigate to User Attributes page
        await sp.goto();

        // # Find the attribute name input and edit it
        const nameInput = sp.nameInput(0);
        await expect(nameInput).toHaveValue('Old Name');
        await nameInput.fill('New Name');
        await nameInput.blur();

        await sp.saveAndWaitForSettled();

        // * Verify field was updated via API
        const updatedMap = await getFieldsMap(adminClient);
        expect(Object.values(updatedMap).find((f) => f.name === 'New Name')).toBeDefined();

        await cleanupFields(adminClient, {...fieldsMap, ...updatedMap});
    });

    /**
     * @objective Verify changing an attribute type from Text to Phone via the type
     * selector saves the updated value_type to the server.
     *
     * @precondition
     * A text attribute named "Contact Number" exists via API setup.
     */
    test('changes attribute type from text to phone', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Create a text attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'Contact Number', type: 'text'}];
        await setupCustomProfileAttributeFields(adminClient, attributes);

        // # Navigate to User Attributes page
        await sp.goto();

        // # Select "Phone" type
        await sp.selectType(0, 'Phone');

        await sp.saveAndWaitForSettled();

        // * Verify field type was updated via API
        const updatedMap = await getFieldsMap(adminClient);
        const updatedField = Object.values(updatedMap).find((f) => f.name === 'Contact Number');
        expect(updatedField).toBeDefined();
        expect(updatedField!.type).toBe('text');
        expect(updatedField!.attrs.value_type).toBe('phone');

        await cleanupFields(adminClient, updatedMap);
    });

    /**
     * @objective Verify creating multiple text attributes in a single session
     * and saving them all at once persists both to the server.
     */
    test('creates multiple text attributes and saves all at once', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Navigate to User Attributes page
        await sp.goto();

        // # Create first attribute (text)
        await sp.addAttribute();
        const firstInput = sp.nameInput(0);
        await firstInput.fill('Job Title');
        await firstInput.blur();

        // # Create second attribute (text)
        await sp.addAttribute();
        const secondInput = sp.nameInput(1);
        await secondInput.fill('Team Name');
        await secondInput.blur();

        await sp.saveAndWaitForSettled();

        // * Verify both fields were created via API
        const fieldsMap = await getFieldsMap(adminClient);
        expect(Object.values(fieldsMap).find((f) => f.name === 'Job Title')).toBeDefined();
        expect(Object.values(fieldsMap).find((f) => f.name === 'Team Name')).toBeDefined();

        await cleanupFields(adminClient, fieldsMap);
    });
});
