// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * ChannelAttributesRequired OFF: an option channels use is removed as before,
 * with no in-use check.
 */

import type {Channel} from '@mattermost/types/channels';

import {expect, test} from '@mattermost/playwright-lib';

import {requireGlobalAttributesEnabled} from './global_attributes_helpers';
import {archiveChannels, createValuedChannel, deleteFieldOptions, optionNames} from './option_delete_helpers';
import {
    ATTRIBUTE_DETAILS_PATH,
    GLOBAL_ATTRIBUTES_PATH,
    createChannelAttributeField,
    deleteChannelAttributeField,
    fieldName,
    optionId as templateOptionId,
    purgeRequiredGateFields,
} from './required_gate_helpers';

test.describe(
    'System Console - deleting a channel attribute option that channels use (ChannelAttributesRequired off)',
    {tag: ['@system_console', '@channel_attributes']},
    () => {
        /**
         * @objective Verify that with ChannelAttributesRequired off an option channels
         * use is removed from the System Console and through the API as before.
         */
        test('removes an option channels use when ChannelAttributesRequired is off', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: false});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();
            await purgeRequiredGateFields(adminClient);
            const {team} = await pw.initSetup();

            // The console edits the template; its linked channel field holds the values,
            // which carry the template's option IDs.
            const pair = await createChannelAttributeField(adminClient, fieldName('flag_off', suffix), {
                options: ['Value A', 'Value B', 'Value C'],
                displayName: `Option Delete ${suffix}`,
            });
            const {templateField, channelField} = pair;
            const channels: Channel[] = [];

            try {
                for (const [channelSuffix, option] of [
                    [`${suffix}a`, 'Value A'],
                    [`${suffix}b`, 'Value B'],
                ]) {
                    channels.push(
                        await createValuedChannel(
                            adminClient,
                            team,
                            channelSuffix,
                            channelField,
                            templateOptionId(templateField, option),
                        ),
                    );
                }

                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                const {page, globalAttributes} = systemConsolePage;

                await page.goto(`${ATTRIBUTE_DETAILS_PATH}/${templateField.id}`);
                await expect(globalAttributes.displayNameInput).toBeVisible();

                // # Remove an option a channel holds, and save
                await globalAttributes.removeOption('Value A');

                // * Removed straight away, with no error
                await expect(globalAttributes.optionChip('Value A')).toHaveCount(0);
                await globalAttributes.save();
                await expect(page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_PATH}$`));
                expect(await optionNames(adminClient, templateField.id, 'template')).toEqual(['Value B', 'Value C']);

                // # DELETE another option a channel holds through the API
                await deleteFieldOptions(adminClient, templateField, [templateOptionId(templateField, 'Value B')]);

                // * Deleted
                expect(await optionNames(adminClient, templateField.id, 'template')).toEqual(['Value C']);
            } finally {
                await archiveChannels(adminClient, channels);
                await deleteChannelAttributeField(adminClient, pair);
            }
        });
    },
);
