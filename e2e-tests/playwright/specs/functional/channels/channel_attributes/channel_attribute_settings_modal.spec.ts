// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';
import type {Client4} from '@mattermost/client';
import type {Team} from '@mattermost/types/teams';

import type {PlaywrightExtended} from '@mattermost/playwright-lib';
import {expect, test, openChannelSettingsInfoTab, Api, settle, Msg} from '@mattermost/playwright-lib';

import {
    DISPLAY_LABEL_INFO,
    attributeName,
    createAttribute,
    createChannelForAttributes,
    deleteAttributes,
    purgeAttributes,
    readChannelValues,
    setChannelValue,
    valueFor,
} from './helpers';

// Editing in Channel Info (and this same editor reused in Channel Settings) is
// admin-only, whatever an attribute's own setter tier says.
async function promoteToChannelAdmin(
    pw: PlaywrightExtended,
    adminClient: Client4,
    team: Team,
    channelId: string,
    prefix: string,
) {
    const channelAdmin = await pw.createNewUserProfile(adminClient, {prefix});
    await adminClient.addToTeam(team.id, channelAdmin.id);
    await adminClient.addToChannel(channelAdmin.id, channelId);
    await adminClient.updateChannelMemberSchemeRoles(channelId, channelAdmin.id, true, true);
    return channelAdmin;
}

test.describe('Channel attribute editing in Channel Settings', {tag: ['@channel_attributes']}, () => {
    test.describe.configure({mode: 'serial'});

    /**
     * @objective Verify an attribute edit made in the Channel Settings modal's Info
     * tab is staged locally -- not written until the tab's own Save is clicked --
     * unlike the same editor in the Channel Info RHS, which writes immediately.
     */
    test('stages an attribute edit and writes it only when Save is clicked', async ({pw}) => {
        await pw.ensureFeatureFlag('ChannelAttributes', true);
        await pw.skipIfNoLicense();

        const {adminClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const note = await createAttribute(adminClient, attributeName('modal_stage', suffix), {
                type: 'text',
                actions: [DISPLAY_LABEL_INFO],
            });
            created.push(note);

            const channel = await createChannelForAttributes(adminClient, team, `settings-stage-${suffix}`);
            const channelAdmin = await promoteToChannelAdmin(
                pw,
                adminClient,
                team,
                channel.id,
                `chanadmin-stage-${suffix}`,
            );

            const {channelsPage} = await pw.testBrowser.login(channelAdmin);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const channelSettings = await channelsPage.openChannelSettings();
            const infoSettings = await openChannelSettingsInfoTab(channelSettings);

            // # Add the unset attribute in the modal and commit with Enter, as the
            // # inline editor expects. An unset optional attribute has no row until added.
            await infoSettings.attributes.addButton.click();
            await expect(infoSettings.attributes.addMenu.attribute(note.id)).toBeVisible();
            await infoSettings.attributes.addMenu.attribute(note.id).click();
            await expect(infoSettings.attributes.attribute(note.id).editorTextbox).toBeVisible();
            await infoSettings.attributes.attribute(note.id).editorTextbox.fill('drafted in modal');
            await infoSettings.attributes.attribute(note.id).editorTextbox.press('Enter');

            // * The row reflects the edit immediately, and the tab reports an unsaved
            // * change, but nothing has reached the server yet
            await expect(infoSettings.attributes.attribute(note.id).editButton.locator).toHaveText('drafted in modal');
            await expect(channelSettings.savePanel.messageText).toHaveMessage(Msg.saveChangesPanel.message);
            expect(valueFor(await readChannelValues(adminClient, channel.id), note)).toBeUndefined();

            // # Save the tab
            await settle(channelSettings.savePanel.saveButton, {wait: Api.UpdatePropertyValues}).click();

            // * The panel leaves the unsaved state and the value is now stored
            await expect(channelSettings.savePanel).not.toBeVisible();
            await expect
                .poll(async () => {
                    return valueFor(await readChannelValues(adminClient, channel.id), note);
                })
                .toBe('drafted in modal');
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify Reset in the Channel Settings modal discards a staged
     * attribute edit -- reverting the row in the UI -- without ever writing it.
     */
    test('Reset discards a staged attribute edit without writing it', async ({pw}) => {
        await pw.ensureFeatureFlag('ChannelAttributes', true);
        await pw.skipIfNoLicense();

        const {adminClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const note = await createAttribute(adminClient, attributeName('modal_reset', suffix), {
                type: 'text',
                actions: [DISPLAY_LABEL_INFO],
            });
            created.push(note);

            const channel = await createChannelForAttributes(adminClient, team, `settings-reset-${suffix}`);
            const channelAdmin = await promoteToChannelAdmin(
                pw,
                adminClient,
                team,
                channel.id,
                `chanadmin-reset-${suffix}`,
            );
            await setChannelValue(adminClient, channel.id, note, 'original');

            const {channelsPage} = await pw.testBrowser.login(channelAdmin);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const channelSettings = await channelsPage.openChannelSettings();
            const infoSettings = await openChannelSettingsInfoTab(channelSettings);
            await expect(infoSettings.attributes.attribute(note.id).editButton.locator).toHaveText('original');

            // # Edit the attribute, then discard it with Reset instead of Save
            await infoSettings.attributes.attribute(note.id).editButton.click();
            await expect(infoSettings.attributes.attribute(note.id).editorTextbox).toBeVisible();
            await infoSettings.attributes.attribute(note.id).editorTextbox.fill('discarded');
            await infoSettings.attributes.attribute(note.id).editorTextbox.press('Enter');
            await expect(infoSettings.attributes.attribute(note.id).editButton.locator).toHaveText('discarded');
            await channelSettings.savePanel.cancelButton.click();

            // * The row reverts to the stored value, and the panel clears
            await expect(infoSettings.attributes.attribute(note.id).editButton.locator).toHaveText('original');
            await expect(channelSettings.savePanel).not.toBeVisible();

            // * The discarded edit never reached the server
            expect(valueFor(await readChannelValues(adminClient, channel.id), note)).toBe('original');
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});
