// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    expect,
    test,
    closeChannelSettings,
    openChannelSettingsInfoTab,
    Api,
    settle,
    Msg,
} from '@mattermost/playwright-lib';

/**
 * @objective Verify that Channel Settings opens with no unsaved-changes warning and no channel name
 * validation error, and closes on a single click, for a channel whose stored purpose and header carry
 * leading or trailing whitespace. The server keeps that whitespace verbatim, so channels populated
 * outside this form reach it untidy.
 */
test(
    'opens Channel Settings cleanly for a channel whose stored text has surrounding whitespace',
    {tag: '@channel_settings'},
    async ({pw}) => {
        const {adminClient, team, user} = await pw.initSetup();

        // # Create a channel whose stored purpose and header have surrounding whitespace
        const channel = await adminClient.createPublicChannel(team.id, `Untidy ${pw.random.id()}`);
        const paddedPurpose = '  Small annoyances that add up  ';
        const paddedHeader = 'Runbook: [Ops guide](https://example.com/runbook)\nEscalate to the on-call\n';
        await adminClient.patchChannel(channel.id, {purpose: paddedPurpose, header: paddedHeader});
        await adminClient.addToChannel(user.id, channel.id);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // # Open Channel Settings without touching any field
        const channelSettings = await channelsPage.openChannelSettings();
        const infoSettings = await openChannelSettingsInfoTab(channelSettings);

        // * Verify the stored text is shown as-is and the form does not report unsaved changes
        await expect(infoSettings.purpose).toHaveValue(paddedPurpose);
        await expect(infoSettings.header).toHaveValue(paddedHeader);
        await expect(channelSettings.savePanel).not.toBeVisible();

        // * Verify no channel name validation error is shown for the populated name field
        await expect(infoSettings.name).toHaveValue(channel.display_name);
        await expect(infoSettings.name.validationAlert).not.toBeVisible();

        // # Close the modal with a single click
        await channelSettings.closeButton.click();

        // * Verify the modal closes without the second click that unsaved changes would demand
        await expect(channelSettings).not.toBeVisible();
    },
);

/**
 * @objective Verify that editing a channel whose stored text has surrounding whitespace still surfaces the
 * unsaved-changes panel and saves the edit.
 */
test(
    'saves an edit made on a channel whose stored text has surrounding whitespace',
    {tag: '@channel_settings'},
    async ({pw}) => {
        const {adminClient, team, user} = await pw.initSetup();

        // # Create a channel whose stored header ends in a newline
        const channel = await adminClient.createPublicChannel(team.id, `Untidy ${pw.random.id()}`);
        const paddedHeader = 'padded header\n';
        await adminClient.patchChannel(channel.id, {purpose: '  padded purpose  ', header: paddedHeader});
        await adminClient.addToChannel(user.id, channel.id);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // # Open Channel Settings and edit the purpose
        const channelSettings = await channelsPage.openChannelSettings();
        const infoSettings = await openChannelSettingsInfoTab(channelSettings);
        await infoSettings.purpose.container.fill('A brand new purpose');

        // * Verify the edit is recognised as an unsaved change
        await expect(channelSettings.savePanel.messageText).toHaveMessage(Msg.saveChangesPanel.message);

        // # Save the edit
        await settle(channelSettings.savePanel.saveButton, {wait: Api.PatchChannel}).click();

        // * Verify the save completes and the panel leaves the unsaved state
        await expect(channelSettings.savePanel.saveButton).not.toBeVisible();

        // # Close and reopen Channel Settings
        await closeChannelSettings(channelSettings);
        const reopenedSettings = await channelsPage.openChannelSettings();
        const reopenedInfo = await openChannelSettingsInfoTab(reopenedSettings);

        // * Verify the saved purpose persisted, the untouched header was left exactly as stored, and the
        // * reopened form is clean
        await expect(reopenedInfo.purpose).toHaveValue('A brand new purpose');
        await expect(reopenedInfo.header).toHaveValue(paddedHeader);
        await expect(reopenedSettings.savePanel).not.toBeVisible();
    },
);
