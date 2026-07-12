// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {
    type CustomProfileAttribute,
    deleteCustomProfileAttributes,
    setupCustomProfileAttributeFields,
    setupCustomProfileAttributeValues,
} from './helpers';

/**
 * @objective Verify a long profile popover scrolls while its bottom action row remains fixed.
 */
test(
    'MM-T5752 keeps the profile popover bottom row fixed while attributes scroll',
    {tag: '@custom_profile_attributes'},
    async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('CustomProfileAttributes', true);
        const {adminClient, team, user, userClient} = await pw.initSetup();
        const suffix = pw.random.id();
        const attributes: CustomProfileAttribute[] = Array.from({length: 10}, (_, index) => ({
            name: `scroll_${index}_${suffix}`,
            type: 'text',
            value: `Value ${index + 1}`,
            attrs: {display_name: `Attribute ${index + 1} ${suffix}`, visibility: 'always'},
        }));
        const fields = await setupCustomProfileAttributeFields(adminClient, attributes);

        try {
            // # Open a profile popover containing ten populated attributes
            await setupCustomProfileAttributeValues(userClient, attributes, fields);
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.postMessage(`Popover scroll ${suffix}`);
            const post = await channelsPage.getLastPost();
            const popover = await channelsPage.openProfilePopover(post);

            // * Verify the popover is scrollable
            expect(
                await popover.container.evaluate((element: HTMLElement) => element.scrollHeight > element.clientHeight),
            ).toBe(true);
            const bottomBefore = await popover.bottomRow.boundingBox();
            if (!bottomBefore) {
                throw new Error('Expected the profile popover bottom row to have a bounding box');
            }

            // # Scroll to the bottom of the popover
            await popover.container.evaluate((element: HTMLElement) => {
                element.scrollTop = element.scrollHeight;
            });
            await expect
                .poll(() => popover.container.evaluate((element: HTMLElement) => element.scrollTop))
                .toBeGreaterThan(0);
            // * Verify the bottom action row remains visible and fixed
            await expect(popover.bottomRow).toBeVisible();
            const bottomAfter = await popover.bottomRow.boundingBox();
            if (!bottomAfter) {
                throw new Error('Expected the profile popover bottom row to remain visible after scrolling');
            }
            expect(Math.abs(bottomAfter.y - bottomBefore.y)).toBeLessThan(2);
        } finally {
            await deleteCustomProfileAttributes(adminClient, fields);
        }
    },
);
