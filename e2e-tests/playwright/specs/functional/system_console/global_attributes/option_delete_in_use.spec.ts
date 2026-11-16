// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * A channel attribute option that channels use can't be deleted, from the System
 * Console or the API, so no channel is left holding a value that no longer exists.
 */

import type {Channel} from '@mattermost/types/channels';
import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
    GROUP,
    attributeName,
    createAttribute,
    deleteAttributes,
    optionId,
    purgeAttributes,
} from '../../channels/channel_attributes/helpers';

import {requireGlobalAttributesEnabled} from './global_attributes_helpers';
import {
    OPTION_IN_USE_ERROR_ID,
    OPTION_IN_USE_MESSAGE,
    archiveChannels,
    createValuedChannel,
    deleteFieldOptions,
    optionNames,
} from './option_delete_helpers';
import {
    ATTRIBUTE_DETAILS_PATH,
    GLOBAL_ATTRIBUTES_PATH,
    createChannelAttributeField,
    deleteChannelAttributeField,
    fieldName,
    optionId as templateOptionId,
    purgeRequiredGateFields,
} from './required_gate_helpers';

type ClientErrorLike = {status_code?: number; server_error_id?: string};

async function expectInUseConflict(request: Promise<unknown>) {
    const error = (await request.then(
        () => {
            throw new Error('expected the server to refuse removing an option channels use');
        },
        (e: unknown) => e,
    )) as ClientErrorLike;
    expect(error.status_code).toBe(409);
    expect(error.server_error_id).toBe(OPTION_IN_USE_ERROR_ID);
}

test.describe(
    'System Console - deleting a channel attribute option that channels use',
    {tag: ['@system_console', '@channel_attributes']},
    () => {
        /**
         * @objective Verify the System Console refuses removing an option a channel
         * holds, says why, and still removes an option no channel holds.
         */
        test('refuses removing an option a channel uses, and removes an unused one', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();
            await purgeRequiredGateFields(adminClient);
            const {team} = await pw.initSetup();

            // The console edits the template; its linked channel field holds the values,
            // which carry the template's option IDs.
            const pair = await createChannelAttributeField(adminClient, fieldName('console', suffix), {
                options: ['Value A', 'Value B'],
                displayName: `Option Delete ${suffix}`,
            });
            const {templateField, channelField} = pair;
            const channels: Channel[] = [];

            try {
                channels.push(
                    await createValuedChannel(
                        adminClient,
                        team,
                        suffix,
                        channelField,
                        templateOptionId(templateField, 'Value A'),
                    ),
                );

                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                const {page, globalAttributes} = systemConsolePage;

                await page.goto(`${ATTRIBUTE_DETAILS_PATH}/${templateField.id}`);
                await expect(globalAttributes.displayNameInput).toBeVisible();

                // # Remove the option the channel holds
                await globalAttributes.removeOption('Value A');

                // * Refused inline, and the option stays
                await expect(
                    page.getByTestId(`optionInUseError-${templateOptionId(templateField, 'Value A')}`),
                ).toHaveText(OPTION_IN_USE_MESSAGE);
                await expect(globalAttributes.optionChip('Value A')).toBeVisible();

                // * Still there after a reload
                await page.reload();
                await expect(globalAttributes.displayNameInput).toBeVisible();
                await expect(globalAttributes.optionChip('Value A')).toBeVisible();

                // # Remove the option no channel holds, and save
                await globalAttributes.removeOption('Value B');
                await expect(globalAttributes.optionChip('Value B')).toHaveCount(0);
                await globalAttributes.save();
                await expect(page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_PATH}$`));

                // * Only the unused option is gone
                expect(await optionNames(adminClient, templateField.id, 'template')).toEqual(['Value A']);
            } finally {
                await archiveChannels(adminClient, channels);
                await deleteChannelAttributeField(adminClient, pair);
            }
        });

        /**
         * @objective Verify the API refuses deleting an option a channel holds, archived
         * channels included, whether through the options route or a field update.
         */
        test('refuses deleting an option channels use through the API, archived channels included', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
            const {adminClient} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();
            await purgeAttributes(adminClient);
            const {team} = await pw.initSetup();

            const fields: PropertyField[] = [];
            const channels: Channel[] = [];

            try {
                // # DELETE an option an active channel holds
                const select = await createAttribute(adminClient, attributeName('api_select', suffix), {
                    type: 'select',
                    options: ['Value A', 'Value B'],
                });
                fields.push(select);
                channels.push(
                    await createValuedChannel(adminClient, team, `${suffix}s`, select, optionId(select, 'Value A')),
                );

                // * Conflict, and the option stays
                await expectInUseConflict(deleteFieldOptions(adminClient, select, [optionId(select, 'Value A')]));
                expect(await optionNames(adminClient, select.id)).toEqual(['Value A', 'Value B']);

                // # Drop an option only an archived channel holds, through a field update
                const multiselect = await createAttribute(adminClient, attributeName('api_multi', suffix), {
                    type: 'multiselect',
                    options: ['Value A', 'Value B'],
                });
                fields.push(multiselect);
                const archived = await createValuedChannel(adminClient, team, `${suffix}m`, multiselect, [
                    optionId(multiselect, 'Value A'),
                ]);
                channels.push(archived);
                await adminClient.deleteChannel(archived.id);

                const kept = ((multiselect.attrs?.options ?? []) as Array<{id: string; name: string}>).filter(
                    (option) => option.name !== 'Value A',
                );

                // * Conflict, and the option stays
                await expectInUseConflict(
                    adminClient.patchPropertyField(GROUP, 'channel', multiselect.id, {
                        attrs: {...multiselect.attrs, options: kept},
                    }),
                );
                expect(await optionNames(adminClient, multiselect.id)).toEqual(['Value A', 'Value B']);
            } finally {
                await archiveChannels(adminClient, channels);
                await deleteAttributes(adminClient, fields);
            }
        });
    },
);
