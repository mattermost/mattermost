// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console - Channel Configuration page for a channel that lacks a value
 * for a required attribute. The page refuses Save until the value is filled.
 */

import type {PropertyField} from '@mattermost/types/properties';

import {expect, getAdminClient, test} from '@mattermost/playwright-lib';

import {deleteAttributes, optionId, purgeAttributes, readChannelValues, valueFor} from './helpers';
import {setUpTeamMissingRequiredValue} from './missing_required_helpers';

test.describe(
    'System Console - required channel attribute on the channel page',
    {tag: ['@channel_attributes', '@system_console']},
    () => {
        test.describe.configure({mode: 'serial'});

        /**
         * @objective Verify the channel page flags an empty required attribute, keeps Save disabled with an
         * explanation, enables Save once an option is chosen, and stores the value when saved.
         */
        test('requires the missing value before the page can be saved', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
            await pw.skipIfNoLicense();

            const {adminUser, adminClient} = await getAdminClient();
            if (!adminUser || !adminClient) {
                throw new Error('Admin user/client not available');
            }
            const suffix = pw.random.id();
            const created: PropertyField[] = [];

            try {
                await purgeAttributes(adminClient);
                const {field, offTopic} = await setUpTeamMissingRequiredValue(pw, adminClient, suffix, created);

                const {page} = await pw.testBrowser.login(adminUser);
                await page.goto(`/admin_console/user_management/channels/${offTopic.id}`);

                const trigger = page.getByTestId(`channelAttributesSettings-${field.name}`);
                await expect(trigger).toBeVisible();

                // * The field is flagged and Save is disabled with the reason
                await expect(page.getByTestId(`channelAttributeRequiredError-${field.name}`)).toHaveText(
                    'This attribute is required.',
                );
                const saveButton = page.getByTestId('saveSetting');
                await expect(saveButton).toBeDisabled();
                await expect(page.getByTestId('channelAttributesRequiredToSave')).toHaveText(
                    'Set the required channel attributes to save.',
                );

                // # Choose an option
                await trigger.click();
                await page.getByText('AURORA', {exact: true}).click();

                // * The error clears and Save is enabled
                await expect(page.getByTestId(`channelAttributeRequiredError-${field.name}`)).toHaveCount(0);
                await expect(saveButton).toBeEnabled();

                // # Save the page
                await saveButton.click();
                await expect(page).toHaveURL(/\/admin_console\/user_management\/channels$/);

                // * The value is stored
                await expect
                    .poll(async () => valueFor(await readChannelValues(adminClient, offTopic.id), field))
                    .toBe(optionId(field, 'AURORA'));
            } finally {
                await deleteAttributes(adminClient, created);
            }
        });
    },
);
