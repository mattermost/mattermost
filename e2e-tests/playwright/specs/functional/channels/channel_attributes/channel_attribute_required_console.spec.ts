// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console - Channel Configuration page for a channel that lacks a value
 * for a required attribute. The page refuses Save until the value is filled.
 */

import type {PropertyField} from '@mattermost/types/properties';

import {Msg, expect, getAdminClient, systemConsolePath, test} from '@mattermost/playwright-lib';

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

                const {app} = await pw.testBrowser.login(adminUser);
                await app.page.goto(systemConsolePath(`user_management/channels/${offTopic.id}`));
                const {attributes, savePanel} = app.admin.channel;

                const trigger = attributes.selectValue(field.id);
                await expect(trigger).toBeVisible();

                // * The field is flagged and Save is disabled with the reason
                await expect(attributes.requiredError(field.id)).toHaveMessage(
                    Msg.admin.channel_settings.channel_detail.attributes.required_error,
                );
                await expect(savePanel.saveButton).toBeDisabled();
                await expect(app.admin.channel.attributesRequiredText).toContainText(
                    /Set a value for .+ before saving\. This attribute is required\./,
                );

                // # Choose an option
                const option = attributes.selectOption(optionId(field, 'AURORA'));
                await trigger.clickTo(option);
                await option.click();
                await expect(option).toHaveCount(0);

                // * The error clears and Save is enabled
                await expect(attributes.requiredError(field.id)).toHaveCount(0);
                await expect(savePanel.saveButton).toBeEnabled();

                // # Save the page
                await savePanel.saveButton.click();
                await expect(app.page).toHavePath(systemConsolePath('user_management/channels'));

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
