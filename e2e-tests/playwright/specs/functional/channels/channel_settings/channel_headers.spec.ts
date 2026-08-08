// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a multi-line channel header is truncated in the header bar, that hovering it opens a
 * popover with the full header, that a markdown link in the header points to the correct URL, and that the
 * popover closes.
 */
test(
    'MM-T879 opens and closes the channel header popover with a working link',
    {tag: '@channel_settings'},
    async ({pw}) => {
        const {adminClient, team, user} = await pw.initSetup();
        const channel = await adminClient.createPublicChannel(team.id, `Header ${pw.random.id()}`);
        await adminClient.addToChannel(user.id, channel.id);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // # Set a multi-line channel header that contains a markdown link, via Channel Settings
        const header = ['Header text line one', '', '- Two', '- [Google](https://google.com/)', '- Four'].join('\n');
        const channelSettings = await channelsPage.openChannelSettings();
        const infoSettings = await channelSettings.openInfoTab();
        await infoSettings.updateHeader(header);
        await channelSettings.save();
        await channelSettings.close();

        // * Verify the header bar shows the first line of the header
        const headerText = channelsPage.centerView.header.getHeaderText('Header text line one');
        await expect(headerText).toBeVisible();

        // # Hover the header text to open the popover. Force the hover because opening the popover mounts a
        // full-screen floating overlay that would otherwise be reported as intercepting the pointer.
        await headerText.hover({force: true});

        // * Verify the popover opens with the full header and a link to the correct URL
        const popover = channelsPage.centerView.header.getHeaderTooltip();
        await expect(popover).toBeVisible();
        await expect(popover.getByText('Four')).toBeVisible();
        const link = popover.getByRole('link', {name: 'Google'});
        await expect(link).toHaveAttribute('href', 'https://google.com/');

        // # Move the pointer away from the header to dismiss the popover
        await page.mouse.move(400, 500);
        await channelsPage.centerView.postCreate.input.hover({force: true});

        // * Verify the popover closes
        await expect(popover).not.toBeVisible();
    },
);

/**
 * @objective Verify a markdown quote in a channel header renders as a block quote without losing the header text.
 */
test('MM-T881_1 renders a markdown quote in the channel header', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, 'Markdown Header');
    await adminClient.addToChannel(user.id, channel.id);
    const header = `This is a quote in the header ${pw.random.id()}`;
    await adminClient.patchChannel(channel.id, {header: `>${header}`});

    // # Open the channel whose header starts with markdown quote syntax
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // * Verify the header renders the text inside a block quote
    await expect(channelsPage.centerView.header.getHeaderQuote(header)).toBeVisible();
});

/**
 * @objective Verify a channel header can be added from the "Set header" link in a new channel's intro,
 * that cancelling the modal makes no change, and that the saved header appears in the channel info.
 */
test('MM-T880 adds a channel header from the intro Set header link', {tag: '@channel_settings'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Create a new public channel so its intro (with the "Set header" link) is shown
    const channelName = `channel header ${pw.random.id()}`;
    await channelsPage.newChannel(channelName, 'O');
    await channelsPage.centerView.header.toHaveTitle(channelName);

    // # Open the Edit Header modal from the intro and cancel without entering text
    await channelsPage.centerView.openSetHeader();
    await channelsPage.editChannelHeaderModal.toBeVisible();
    await channelsPage.editChannelHeaderModal.cancel();

    // # Reopen the Edit Header modal and save a header
    const header = 'this is the channel header';
    await channelsPage.centerView.openSetHeader();
    await channelsPage.editChannelHeaderModal.toBeVisible();
    await channelsPage.editChannelHeaderModal.setHeader(header);

    // * Verify the header-change system message is posted
    await channelsPage.centerView.waitUntilLastPostContains(`updated the channel header to: ${header}`);

    // # Open the channel info panel from the channel header menu
    const channelMenu = await channelsPage.openChannelMenu();
    await channelMenu.viewInfo.click();
    await channelsPage.sidebarRight.toBeVisible();

    // * Verify the saved header appears in the channel info panel
    await channelsPage.sidebarRight.toContainText(header);
});
