// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Unarchive with ChannelAttributesRequired off (MM-70717).
 *
 * With the sub-flag off the server enforces Required on no channel attribute,
 * so a channel missing a value for a field still marked Required has nothing
 * to be warned about. Its own file because it needs the sub-flag off, unlike
 * unarchive_required_attribute_warning.spec.ts.
 *
 * This file calls ensureFeatureFlag with two combinations on purpose. The server
 * reads the sub-flag at runtime, but the Testcontainers server sets it through an
 * MM_FEATUREFLAGS_* env var, and the config store re-applies env overrides on every
 * config save, so patchConfig cannot turn it off. Only a restart can.
 */

import {Api, Msg, expect, getAdminClient, openChannel, settle, test} from '@mattermost/playwright-lib';

import {
    requireGlobalAttributesEnabled,
    setGlobalAttributesFeatureFlag,
} from '../../system_console/global_attributes/global_attributes_helpers';
import {
    createChannelAttributeField,
    createComplianceChannel,
    deleteChannelAttributeField,
    fieldName,
    purgeRequiredGateFields,
    type ChannelAttributeFieldPair,
} from '../../system_console/global_attributes/required_gate_helpers';

test.describe(
    'Unarchive - required channel attribute warning (ChannelAttributesRequired off)',
    {tag: ['@channel_attributes']},
    () => {
        let originalGlobalAttributes: boolean | undefined;

        // The field a test created, removed after it whether it passed or not.
        const pairs: ChannelAttributeFieldPair[] = [];

        test.afterEach(async ({pw}) => {
            // The test may have restarted the server, so fetch a fresh client.
            const {adminClient} = await pw.getAdminClient();
            for (const pair of pairs.splice(0)) {
                await deleteChannelAttributeField(adminClient, pair);
            }
        });

        test.beforeAll(async () => {
            const {adminClient} = await getAdminClient();
            const {FeatureFlags} = await adminClient.getConfig();
            originalGlobalAttributes = FeatureFlags.GlobalAttributes === true;
        });

        test.afterAll(async () => {
            const {adminClient} = await getAdminClient();
            if (adminClient && originalGlobalAttributes !== undefined) {
                await setGlobalAttributesFeatureFlag(adminClient, originalGlobalAttributes);
            }
        });

        /**
         * @objective Verify unarchiving shows no missing-attribute warning and keeps the
         * plain "Unarchive" label while ChannelAttributesRequired is off.
         *
         * The field can only be marked Required while the sub-flag is on, so this test
         * sets it up first and then restarts the server with the sub-flag off. The
         * field stays Required across the restart; only enforcement is turned off.
         */
        test('shows no warning for a channel missing a required value', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
            const {adminClient} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();
            await purgeRequiredGateFields(adminClient);

            const {team} = await pw.initSetup();
            const channel = await createComplianceChannel(adminClient, team, suffix, `Unarchive Flag Off ${suffix}`);
            await adminClient.deleteChannel(channel.id);

            pairs.push(
                await createChannelAttributeField(adminClient, fieldName('unarchive_flag_off', suffix), {
                    options: ['Value A'],
                    required: true,
                }),
            );

            // # Turn required enforcement off. The restart replaces the server, so fetch fresh clients.
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: false});
            const enabled = await requireGlobalAttributesEnabled(pw);

            const app = await openChannel(pw, enabled.adminUser, {team, channel});
            await expect(app.center.archivedNotice).toBeVisible();

            const {channelHeader} = app;
            await channelHeader.openMenuButton.clickTo(channelHeader.menu.unarchiveChannelMenuItem);
            const modal = await channelHeader.menu.unarchiveChannelMenuItem.clickTo(channelHeader.menu.unarchiveModal);

            // * Nothing to warn about while Required is not enforced. With enforcement off the modal
            // * never asks for the channel's values, so there is no later state to wait for.
            await expect(modal.confirmButton).toHaveMessage(Msg.unarchive_channel.del);
            await expect(modal.missingAttributes).not.toBeVisible();

            await settle(modal.confirmButton, {wait: Api.RestoreChannel, params: {channel_id: channel.id}}).click();
            await expect(modal).not.toBeVisible();
            await expect(app.center.archivedNotice).not.toBeVisible();
        });
    },
);
