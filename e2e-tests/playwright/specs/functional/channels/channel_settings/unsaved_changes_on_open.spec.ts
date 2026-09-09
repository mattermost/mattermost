// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

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
        const infoSettings = await channelSettings.openInfoTab();

        // * Verify the stored text is shown as-is and the form does not report unsaved changes
        await expect(infoSettings.purposeInput).toHaveValue(paddedPurpose);
        await expect(infoSettings.headerInput).toHaveValue(paddedHeader);
        await expect(infoSettings.saveChangesPanel).not.toBeVisible();

        // * Verify no channel name validation error is shown for the populated name field
        await expect(infoSettings.nameInput).toHaveValue(channel.display_name);
        await expect(
            channelSettings.container.getByText('Channel names must have at least 1 character.'),
        ).not.toBeVisible();

        // # Close the modal with a single click
        await channelSettings.closeButton.click();

        // * Verify the modal closes without the second click that unsaved changes would demand
        await expect(channelSettings.container).not.toBeVisible();
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
        const infoSettings = await channelSettings.openInfoTab();
        await infoSettings.updatePurpose('A brand new purpose');

        // * Verify the edit is recognised as an unsaved change
        await expect(channelSettings.container.getByText('You have unsaved changes')).toBeVisible();

        // # Save the edit
        await channelSettings.save();

        // * Verify the save completes and the panel leaves the unsaved state
        await expect(channelSettings.saveButton).not.toBeVisible();

        // # Close and reopen Channel Settings
        await channelSettings.close();
        const reopenedSettings = await channelsPage.openChannelSettings();
        const reopenedInfo = await reopenedSettings.openInfoTab();

        // * Verify the saved purpose persisted, the untouched header was left exactly as stored, and the
        // * reopened form is clean
        await expect(reopenedInfo.purposeInput).toHaveValue('A brand new purpose');
        await expect(reopenedInfo.headerInput).toHaveValue(paddedHeader);
        await expect(reopenedInfo.saveChangesPanel).not.toBeVisible();
    },
);
