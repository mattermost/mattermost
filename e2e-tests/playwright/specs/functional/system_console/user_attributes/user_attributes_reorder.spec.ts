// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserPropertyField} from '@mattermost/types/properties_user';

import {expect, test} from '@mattermost/playwright-lib';

import {
    type CustomProfileAttribute,
    setupCustomProfileAttributeValuesForUser,
} from '../../channels/custom_profile_attributes/helpers';

function matchingOrder(actual: string[], expected: string[]) {
    return actual.filter((value) => expected.includes(value));
}

/**
 * @objective Verify reordering attributes in the System Console updates profile settings and popover order.
 */
test(
    'MM-T5766 propagates reordered user attributes to profile settings and popover',
    {tag: '@user_attributes'},
    async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('CustomProfileAttributes', true);
        const {adminClient, adminUser, team, user} = await pw.initSetup();
        const suffix = pw.random.id();
        const labels = [`First ${suffix}`, `Second ${suffix}`, `Favorite Food ${suffix}`];
        const fields: Record<string, UserPropertyField> = {};

        for (const [index, label] of labels.entries()) {
            const field = await adminClient.createCustomProfileAttributeField({
                name: `reorder_${index}_${suffix}`,
                type: 'text',
                attrs: {display_name: label, sort_order: 1000 + index, visibility: 'always'},
            } as any);
            fields[field.id] = field;
        }

        const attributes: CustomProfileAttribute[] = labels.map((label, index) => ({
            name: `reorder_${index}_${suffix}`,
            type: 'text',
            value: `Value ${index + 1}`,
            attrs: {display_name: label, visibility: 'always'},
        }));

        await setupCustomProfileAttributeValuesForUser(adminClient, attributes, fields, user.id);
        // # Move Favorite Food to the top in the System Console and save
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const sp = systemConsolePage.systemProperties;
        await sp.goto();
        await sp.reorderButtonByName(`reorder_2_${suffix}`).press('ArrowUp');
        await sp.reorderButtonByName(`reorder_2_${suffix}`).press('ArrowUp');
        await sp.saveAndWaitForSettled();

        const expectedOrder = [labels[2], labels[0], labels[1]];
        // * Verify the new order in profile settings
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        const profileModal = await channelsPage.openProfileModal();
        expect(matchingOrder(await profileModal.sectionHeadings.allTextContents(), labels)).toEqual(expectedOrder);
        await profileModal.closeModal();

        // # Open the user's profile popover
        await channelsPage.postMessage(`Reordered attributes ${suffix}`);
        const post = await channelsPage.getLastPost();
        const popover = await channelsPage.openProfilePopover(post);
        // * Verify the new order in the popover
        expect(matchingOrder(await popover.attributeHeadings.allTextContents(), labels)).toEqual(expectedOrder);
    },
);
