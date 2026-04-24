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
     * @objective Verify deleting a saved attribute via the dot menu removes it
     * from the server after confirmation and save.
     *
     * @precondition
     * A custom profile attribute named "To Delete" exists via API setup.
     */
    test('deletes an attribute via dot menu', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Create an attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'To Delete', type: 'text'}];
        const fieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);
        const fieldId = Object.keys(fieldsMap)[0];

        // # Navigate to User Attributes page
        await sp.goto();

        // * Verify the attribute exists
        await expect(sp.nameInputByValue('To Delete')).toBeVisible();

        // # Open dot menu for the field
        await sp.openDotMenu(fieldId);

        // # Click "Delete attribute"
        await sp.deleteAttribute();

        // # Confirm deletion in modal
        await sp.confirmDeletion();

        await sp.saveAndWaitForSettled();

        // * Verify field was deleted via API
        const updatedMap = await getFieldsMap(adminClient);
        expect(Object.values(updatedMap).find((f) => f.name === 'To Delete')).toBeUndefined();

        await cleanupFields(adminClient, updatedMap);
    });

    /**
     * @objective Verify duplicating an attribute via the dot menu creates a copy
     * with "(copy)" suffix that persists after save.
     *
     * @precondition
     * A custom profile attribute named "Original" exists via API setup.
     */
    test('duplicates an attribute via dot menu', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Create an attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'Original', type: 'text'}];
        const fieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);
        const fieldId = Object.keys(fieldsMap)[0];

        // # Navigate to User Attributes page
        await sp.goto();

        // # Open dot menu for the field
        await sp.openDotMenu(fieldId);

        // # Click "Duplicate attribute"
        await sp.duplicateAttribute();

        // * Verify a copy row appeared with "(copy)" in the name
        await expect(sp.nameInputByValue('Original (copy)')).toBeVisible();

        await sp.saveAndWaitForSettled();

        // * Verify both fields exist via API
        const updatedMap = await getFieldsMap(adminClient);
        expect(Object.values(updatedMap).find((f) => f.name === 'Original')).toBeDefined();
        expect(Object.values(updatedMap).find((f) => f.name === 'Original (copy)')).toBeDefined();

        await cleanupFields(adminClient, updatedMap);
    });

    /**
     * @objective Verify changing attribute visibility to "Always hide" via the
     * dot menu persists the hidden state to the server.
     *
     * @precondition
     * A custom profile attribute named "Visibility Test" exists via API setup.
     */
    test('changes attribute visibility via dot menu', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Create an attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'Visibility Test', type: 'text'}];
        const fieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);
        const fieldId = Object.keys(fieldsMap)[0];

        // # Navigate to User Attributes page
        await sp.goto();

        // # Open dot menu
        await sp.openDotMenu(fieldId);

        // # Select "Always hide" visibility
        await sp.setVisibility('Always hide');

        await sp.saveAndWaitForSettled();

        // * Verify visibility was updated via API
        const updatedMap = await getFieldsMap(adminClient);
        const updatedField = Object.values(updatedMap).find((f) => f.name === 'Visibility Test');
        expect(updatedField).toBeDefined();
        expect(updatedField!.attrs.visibility).toBe('hidden');

        await cleanupFields(adminClient, updatedMap);
    });
});
