// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {
    type CustomProfileAttribute,
    setupCustomProfileAttributeFields,
    setupCustomProfileAttributeValues,
} from './helpers';

function matchingOrder(actual: string[], expected: string[]) {
    return actual.filter((value) => expected.includes(value));
}

/**
 * @objective Verify custom attributes preserve their configured order in profile settings and profile popovers.
 */
test(
    'MM-T5747 MM-T5751 keeps attribute order consistent in profile settings and the profile popover',
    {tag: '@custom_profile_attributes'},
    async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('CustomProfileAttributes', true);
        const {adminClient, team, user, userClient} = await pw.initSetup();
        const suffix = pw.random.id();
        const labels = [`First ${suffix}`, `Second ${suffix}`, `Third ${suffix}`];
        const attributes: CustomProfileAttribute[] = labels.map((label, index) => ({
            name: `order_${index}_${suffix}`,
            type: 'text',
            value: `Value ${index + 1}`,
            attrs: {display_name: label, visibility: 'always'},
        }));
        // # Create ordered attributes and values
        const fields = await setupCustomProfileAttributeFields(adminClient, attributes);

        await setupCustomProfileAttributeValues(userClient, attributes, fields);
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');

        // * Verify the order in profile settings
        const profileModal = await channelsPage.openProfileModal();
        const settingsHeadings = await profileModal.sectionHeadings.allTextContents();
        expect(matchingOrder(settingsHeadings, labels)).toEqual(labels);
        await profileModal.closeModal();

        // # Open the user's profile popover
        await channelsPage.postMessage(`Attribute order ${suffix}`);
        const post = await channelsPage.getLastPost();
        const popover = await channelsPage.openProfilePopover(post);
        // * Verify the same order in the profile popover
        const popoverHeadings = await popover.attributeHeadings.allTextContents();
        expect(matchingOrder(popoverHeadings, labels)).toEqual(labels);
    },
);
