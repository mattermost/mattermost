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
        const headerText = channelsPage.centerView.header.container.getByText('Header text line one');
        await expect(headerText).toBeVisible();

        // # Hover the header text to open the popover. Force the hover because opening the popover mounts a
        // full-screen floating overlay that would otherwise be reported as intercepting the pointer.
        await headerText.hover({force: true});

        // * Verify the popover opens with the full header and a link to the correct URL
        const popover = page.getByRole('tooltip');
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
