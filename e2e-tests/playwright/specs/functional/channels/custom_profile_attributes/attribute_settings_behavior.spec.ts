// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {
    type CustomProfileAttribute,
    setupCustomProfileAttributeFields,
    setupCustomProfileAttributeValues,
} from './helpers';

/**
 * @objective Verify maximum-length attribute names and values display with ellipsis styling in profile settings.
 */
test(
    'MM-T5748 displays long attribute names and values correctly in profile settings',
    {tag: '@custom_profile_attributes'},
    async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('CustomProfileAttributes', true);
        const {adminClient, user, userClient} = await pw.initSetup();
        const displayName = '40_characters_allowed_000000000000000000';
        const value = '64-characters-allowed-000000000000000000123456789012345678901234';
        const attributes: CustomProfileAttribute[] = [
            {
                name: `long_${pw.random.id()}`,
                type: 'text',
                value,
                attrs: {display_name: displayName},
            },
        ];
        const fields = await setupCustomProfileAttributeFields(adminClient, attributes);

        await setupCustomProfileAttributeValues(userClient, attributes, fields);
        // # Open profile settings containing the maximum-length attribute
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();
        const profileModal = await channelsPage.openProfileModal();
        // * Verify the full label/value exist and the value uses ellipsis styling
        await expect(profileModal.sectionHeadings.getByText(displayName, {exact: true})).toBeVisible();

        const displayedValue = profileModal.getAttributeValue(displayName, value);
        await expect(displayedValue).toBeVisible();
        await expect(displayedValue).toHaveCSS('text-overflow', 'ellipsis');
    },
);

/**
 * @objective Verify cancelling an attribute edit discards the unsaved value.
 */
test(
    'MM-T5749 cancels custom profile attribute changes without saving',
    {tag: '@custom_profile_attributes'},
    async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('CustomProfileAttributes', true);
        const {adminClient, user, userClient} = await pw.initSetup();
        const suffix = pw.random.id();
        const displayName = `Cancel Test ${suffix}`;
        const originalValue = `Original ${suffix}`;
        const attributes: CustomProfileAttribute[] = [
            {
                name: `cancel_${suffix}`,
                type: 'text',
                value: originalValue,
                attrs: {display_name: displayName},
            },
        ];
        const fields = await setupCustomProfileAttributeFields(adminClient, attributes);
        await setupCustomProfileAttributeValues(userClient, attributes, fields);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();
        const profileModal = await channelsPage.openProfileModal();

        // # Change the unique attribute value, then cancel the edit
        await profileModal.editAttribute(displayName);
        await profileModal.getAttributeInput(displayName).fill(`Unsaved ${suffix}`);
        await profileModal.cancelButton.click();

        // * Verify editing again shows the original persisted value
        await profileModal.editAttribute(displayName);
        await expect(profileModal.getAttributeInput(displayName)).toHaveValue(originalValue);
    },
);

/**
 * @objective Verify deleting an attribute while a user edits it removes the editor without crashing.
 */
test(
    'MM-T5750 does not crash when an attribute is deleted while the user edits it',
    {tag: '@custom_profile_attributes'},
    async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('CustomProfileAttributes', true);
        const {adminClient, user, userClient} = await pw.initSetup();
        const displayName = `Favorite Color ${pw.random.id()}`;
        const attributes: CustomProfileAttribute[] = [
            {
                name: `color_${pw.random.id()}`,
                type: 'text',
                value: 'Blue',
                attrs: {display_name: displayName},
            },
        ];
        const fields = await setupCustomProfileAttributeFields(adminClient, attributes);
        const fieldId = Object.keys(fields)[0];
        await setupCustomProfileAttributeValues(userClient, attributes, fields);

        // # Open the attribute editor and change its unsaved value
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();
        const profileModal = await channelsPage.openProfileModal();
        await profileModal.editAttribute(displayName);
        await profileModal.getAttributeInput(displayName).fill('Green');

        // # Delete the attribute concurrently through the admin API
        await adminClient.deleteCustomProfileAttributeField(fieldId);

        // * Verify the editor disappears and the application remains usable
        await expect(profileModal.getAttributeInput(displayName)).not.toBeVisible();
        await expect(profileModal.closeButton).toBeVisible();
        await profileModal.closeModal();
        await channelsPage.toBeVisible();
    },
);
