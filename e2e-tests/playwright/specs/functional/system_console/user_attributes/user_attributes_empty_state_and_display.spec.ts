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
     * @objective Verify that navigating to the User Attributes page shows the empty state
     * with the Add attribute button and a disabled Save button.
     */
    test('navigates to user attributes page and displays empty state', {tag: '@user_attributes'}, async ({pw}) => {
        const {systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Navigate to User Attributes via sidebar
        await systemConsolePage.sidebar.systemAttributes.userAttributes.click();

        // * Verify the page loaded
        await sp.toBeVisible();

        // * Verify the "Add attribute" link button is visible
        await expect(sp.addAttributeButton).toBeVisible();

        // * Verify Save button is present but disabled (no changes)
        await expect(sp.saveButton).toBeVisible();
        await expect(sp.saveButton).toBeDisabled();
    });

    /**
     * @objective Verify that attributes created via API are displayed in the table
     * when the User Attributes page loads.
     *
     * @precondition
     * Two custom profile attributes (Department, Role) exist via API setup.
     */
    test('displays pre-existing attributes in the table', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Set up attributes via API
        const attributes: CustomProfileAttribute[] = [
            {name: 'Department', type: 'text'},
            {name: 'Role', type: 'text', attrs: {value_type: 'url'}},
        ];
        const fieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);

        // # Navigate to User Attributes page
        await sp.goto();

        // * Verify attributes appear in the table
        await expect(sp.nameInputByValue('Department')).toBeVisible();
        await expect(sp.nameInputByValue('Role')).toBeVisible();

        await cleanupFields(adminClient, fieldsMap);
    });

    /**
     * @objective Verify that renaming an attribute and saving persists the change
     * after a full page reload.
     *
     * @precondition
     * A custom profile attribute named "Persistent Field" exists via API setup.
     */
    test('persists attribute changes after page reload', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Create an attribute via API
        await setupCustomProfileAttributeFields(adminClient, [{name: 'Persistent Field', type: 'text'}]);

        // # Navigate to User Attributes page
        await sp.goto();

        // * Verify attribute exists
        await expect(sp.nameInputByValue('Persistent Field')).toBeVisible();

        // # Edit the name
        const nameInput = sp.nameInput(0);
        await expect(nameInput).toHaveValue('Persistent Field');
        await nameInput.fill('Updated Persistent');
        await nameInput.blur();

        await sp.saveAndWaitForSettled();

        // # Reload the page
        await sp.goto();

        // * Verify the updated name persisted
        await expect(sp.nameInputByValue('Updated Persistent')).toBeVisible();

        await cleanupFields(adminClient, await getFieldsMap(adminClient));
    });
});
