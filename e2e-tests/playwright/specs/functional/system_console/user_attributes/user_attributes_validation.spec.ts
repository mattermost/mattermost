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

import {cleanupFields, setupTest} from './support';

test.describe('System Console - User Attributes Management', () => {
    /**
     * @objective Verify that leaving an attribute name empty shows a validation
     * warning and disables the Save button.
     */
    test('shows validation warning for empty attribute name', {tag: '@user_attributes'}, async ({pw}) => {
        const {systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Navigate to User Attributes page
        await sp.goto();

        // # Add a new attribute
        await sp.addAttribute();

        // # Clear the auto-focused name input (leave it empty)
        const nameInput = sp.nameInput(0);
        await nameInput.clear();
        await nameInput.blur();

        // * Verify validation warning about empty name is shown
        await expect(sp.validationMessage('Please enter an attribute name.')).toBeVisible();

        // * Verify Save button is disabled due to validation error
        await expect(sp.saveButton).toBeDisabled();
    });

    /**
     * @objective Verify that entering a duplicate attribute name shows a "must be
     * unique" warning and disables the Save button.
     *
     * @precondition
     * A custom profile attribute named "Unique Name" exists via API setup.
     */
    test('shows validation warning for duplicate attribute names', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Create an attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'Unique Name', type: 'text'}];
        const fieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);

        // # Navigate to User Attributes page
        await sp.goto();

        // # Add a new attribute with the same name
        await sp.addAttribute();

        const newNameInput = sp.nameInput(1);
        await newNameInput.clear();
        await newNameInput.fill('Unique Name');
        await newNameInput.blur();

        // * Verify validation warning about duplicate name is shown
        await expect(sp.validationMessage('Attribute names must be unique.').first()).toBeVisible();

        // * Verify Save button is disabled
        await expect(sp.saveButton).toBeDisabled();

        await cleanupFields(adminClient, fieldsMap);
    });
});
