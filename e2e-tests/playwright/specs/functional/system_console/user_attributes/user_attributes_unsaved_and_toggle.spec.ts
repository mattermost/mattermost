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
     * @objective Verify toggling "Editable by users" off via the dot menu sets
     * the attribute to admin-managed on the server.
     *
     * @precondition
     * A custom profile attribute named "Editable Test" exists via API setup.
     */
    test('toggles editable by users off via dot menu', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Create an attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'Editable Test', type: 'text'}];
        const fieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);
        const fieldId = Object.keys(fieldsMap)[0];

        // # Navigate to User Attributes page
        await sp.goto();

        // # Open dot menu
        await sp.openDotMenu(fieldId);

        // # Click "Editable by users" toggle
        await sp.toggleEditableByUsers();

        // # Close the dot menu — it stays open after toggling; backdrop would block Save click
        await sp.dismissMenu();

        await sp.saveAndWaitForSettled();

        // * Verify managed was set to 'admin' (not editable by users) via API
        const updatedMap = await getFieldsMap(adminClient);
        const updatedField = Object.values(updatedMap).find((f) => f.name === 'Editable Test');
        expect(updatedField).toBeDefined();
        expect(updatedField!.attrs.managed).toBe('admin');

        await cleanupFields(adminClient, updatedMap);
    });

    /**
     * @objective Verify that deleting a newly added (unsaved) attribute removes
     * the row without a confirmation modal.
     */
    test(
        'deletes a newly added unsaved attribute without confirmation modal',
        {tag: '@user_attributes'},
        async ({pw}) => {
            const {systemConsolePage} = await setupTest(pw);
            const sp = systemConsolePage.systemProperties;

            // # Navigate to User Attributes page
            await sp.goto();

            // # Add a new attribute
            await sp.addAttribute();

            // # Type a name
            const nameInput = sp.nameInput(0);
            await nameInput.fill('Temporary');
            await nameInput.blur();

            // # Open dot menu for the new (pending) field
            await sp.openDotMenuForUnsaved();

            await sp.deleteAttribute();

            // * Verify the row is removed (no confirmation modal for unsaved fields)
            await expect(sp.nameInputByValue('Temporary')).not.toBeVisible();

            // * Verify Save button returns to disabled state (no net changes)
            await expect(sp.saveButton).toBeDisabled({timeout: 10000});
        },
    );
});
