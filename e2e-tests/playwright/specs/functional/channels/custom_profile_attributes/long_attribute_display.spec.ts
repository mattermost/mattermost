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
