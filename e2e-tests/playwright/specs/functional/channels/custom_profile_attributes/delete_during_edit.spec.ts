// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {
    type CustomProfileAttribute,
    setupCustomProfileAttributeFields,
    setupCustomProfileAttributeValues,
} from './helpers';

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
