// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Unarchiving a channel that lacks a value for a required channel attribute
 * (MM-70717). Warn-only by design: the warning never blocks the restore, it
 * only explains what is missing and relabels the confirm button "Unarchive
 * anyway". There was no unarchive spec in the suite before this file.
 */

import {Api, Msg, expect, getAdminClient, openChannel, settle, test, type App} from '@mattermost/playwright-lib';

import {
    requireGlobalAttributesEnabled,
    setGlobalAttributesFeatureFlag,
} from '../../system_console/global_attributes/global_attributes_helpers';
import {
    createChannelAttributeField,
    createComplianceChannel,
    deleteChannelAttributeField,
    fieldName,
    type ChannelAttributeFieldPair,
    optionId,
    purgeRequiredGateFields,
} from '../../system_console/global_attributes/required_gate_helpers';

/** Opens the Unarchive confirmation from the channel header menu, on an already-archived channel. */
async function openUnarchiveModal(app: App) {
    const {channelHeader} = app;
    await channelHeader.openMenuButton.clickTo(channelHeader.menu.unarchiveChannelMenuItem);
    return channelHeader.menu.unarchiveChannelMenuItem.clickTo(channelHeader.menu.unarchiveModal);
}

test.describe('Unarchive - required channel attribute warning', {tag: ['@channel_attributes']}, () => {
    test.describe.configure({mode: 'serial'});

    // Fields a test created, removed after it whether it passed or not.
    const pairs: ChannelAttributeFieldPair[] = [];

    test.afterEach(async () => {
        const {adminClient} = await getAdminClient();
        for (const pair of pairs.splice(0)) {
            await deleteChannelAttributeField(adminClient, pair);
        }
    });

    let originalGlobalAttributes: boolean | undefined;

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
     * @objective Verify unarchiving a channel that predates a now-required
     * attribute warns, but still restores the channel successfully.
     *
     * The channel is archived before the field is created, so the helper can
     * create the field optional, backfill every active channel, and mark it
     * Required while this channel remains outside the gate population.
     */
    test('warns and offers "Unarchive anyway" for a channel missing a required value, and restores it anyway', async ({
        pw,
    }) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

        const suffix = pw.random.id();
        await purgeRequiredGateFields(adminClient);

        const {team} = await pw.initSetup();
        const channel = await createComplianceChannel(adminClient, team, suffix, `Unarchive Warn ${suffix}`);
        await adminClient.deleteChannel(channel.id);

        pairs.push(
            await createChannelAttributeField(adminClient, fieldName('unarchive_warn', suffix), {
                options: ['Value A'],
                required: true,
            }),
        );

        const app = await openChannel(pw, adminUser, {team, channel});
        await expect(app.center.archivedNotice).toBeVisible();

        const modal = await openUnarchiveModal(app);

        // * Warns, naming this being about a required attribute
        await expect(modal.missingAttributes).toBeVisible();
        await expect(modal.missingAttributes).toContainMessage(Msg.unarchive_channel.missing_attributes.title);

        // * The confirm button reflects the warning
        await expect(modal.confirmButton).toHaveMessage(Msg.unarchive_channel.missing_attributes.confirm);

        // # Confirming still restores the channel -- never a dead end
        await settle(modal.confirmButton, {wait: Api.RestoreChannel, params: {channel_id: channel.id}}).click();
        await expect(modal).not.toBeVisible();
        await expect(app.center.archivedNotice).not.toBeVisible();
    });

    /**
     * @objective Verify no warning appears, and the plain "Unarchive" label is
     * kept, when the channel already has a value for the required attribute.
     */
    test('shows no warning and the plain "Unarchive" label when the channel already has a value', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

        const suffix = pw.random.id();
        await purgeRequiredGateFields(adminClient);

        const {team} = await pw.initSetup();
        const pair = await createChannelAttributeField(adminClient, fieldName('unarchive_ok', suffix), {
            options: ['Value A'],
            required: true,
        });
        pairs.push(pair);

        // Creation-time enforcement (pre-existing, unrelated to MM-70717) requires
        // a value up front since the field is already required.
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `unarchive-ok-${suffix}`.toLowerCase(),
            display_name: `Unarchive OK ${suffix}`,
            type: 'O',
            property_values: [{field_id: pair.channelField.id, value: optionId(pair.templateField, 'Value A')}],
        } as Parameters<typeof adminClient.createChannel>[0]);
        await adminClient.deleteChannel(channel.id);

        const app = await openChannel(pw, adminUser, {team, channel});
        await expect(app.center.archivedNotice).toBeVisible();

        const modal = await openUnarchiveModal(app);

        await expect(modal.missingAttributes).not.toBeVisible();
        await expect(modal.confirmButton).toHaveMessage(Msg.unarchive_channel.del);

        await settle(modal.confirmButton, {wait: Api.RestoreChannel, params: {channel_id: channel.id}}).click();
        await expect(modal).not.toBeVisible();
        await expect(app.center.archivedNotice).not.toBeVisible();
    });

    /**
     * @objective Verify the confirm button has focus when the warning is shown, so
     * Enter restores the channel as it did before the warning was added.
     */
    test('Enter confirms the unarchive while the warning is shown', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

        const suffix = pw.random.id();
        await purgeRequiredGateFields(adminClient);

        const {team} = await pw.initSetup();
        const channel = await createComplianceChannel(adminClient, team, suffix, `Unarchive Enter ${suffix}`);
        await adminClient.deleteChannel(channel.id);

        pairs.push(
            await createChannelAttributeField(adminClient, fieldName('unarchive_enter', suffix), {
                options: ['Value A'],
                required: true,
            }),
        );

        const app = await openChannel(pw, adminUser, {team, channel});
        await expect(app.center.archivedNotice).toBeVisible();

        const modal = await openUnarchiveModal(app);
        await expect(modal.missingAttributes).toBeVisible();

        // * Focus is on the confirm button
        await expect(modal.confirmButton).toBeFocused();

        // # Enter restores the channel
        await settle(modal.confirmButton, {wait: Api.RestoreChannel, params: {channel_id: channel.id}}).press('Enter');
        await expect(modal).not.toBeVisible();
        await expect(app.center.archivedNotice).not.toBeVisible();
    });
});
