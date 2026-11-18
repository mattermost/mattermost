// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, settle, test, Api} from '@mattermost/playwright-lib';

/**
 * @objective Verify the channel info panel shows the channel's details, mutes the channel and opens
 * channel settings from its menu.
 */
test(
    'shows channel details, mutes the channel and opens settings from the info panel',
    {tag: '@channels'},
    async ({pw}) => {
        const {adminClient, team, user, userClient} = await pw.initSetup();
        const purpose = `purpose ${pw.random.id()}`;
        const channel = await adminClient.createPublicChannel(team.id, `Info ${pw.random.id()}`);
        await adminClient.patchChannel(channel.id, {purpose});
        await adminClient.addToChannel(user.id, channel.id);

        // # Log in, open the channel and its info panel
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel});
        const info = await app.channelHeader.infoButton.clickTo(app.rhs.channelInfo);

        // * The panel shows the channel's name, purpose, handle and id
        await expect(info.header.channelName).toHaveText(channel.display_name);
        await expect(info.about.name).toHaveText(channel.display_name);
        await expect(info.about.purpose).toContainText(purpose);
        await expect(info.about.handle).toContainText(channel.name);
        await expect(info.about.id).toContainText(channel.id);

        // # Mute the channel
        await expect(info.muteButton).not.toBePressed();
        await settle(info.muteButton, {wait: Api.UpdateChannelNotifyProps}).click();

        // * The button shows it pressed (its label stays "Mute"), and the server has the channel muted for the user
        await expect(info.muteButton).toBePressed();
        await expect
            .poll(async () => (await userClient.getChannelMember(channel.id, user.id)).notify_props.mark_unread)
            .toBe('mention');

        // # Open channel settings from the menu
        const settings = await info.menu.settingsButton.clickTo(app.channelSettingsModal);

        // * The channel settings modal opens
        await expect(settings).toBeVisible();
    },
);
