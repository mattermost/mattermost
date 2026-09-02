// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that releasing a mouse drag that started inside a modal but ends outside it does not
 * close the modal, while a genuine click outside the modal does close it.
 */
test('MM-T841 keeps a modal open when a drag is released outside it', {tag: '@channel_settings'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();

    // # Open the Channel Settings modal
    const channelSettings = await channelsPage.openChannelSettings();
    const modal = channelSettings.container;

    // # Press the mouse down inside the modal, drag to outside the modal, then release
    const box = await modal.boundingBox();
    if (!box) {
        throw new Error('Channel Settings modal has no bounding box');
    }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(5, 5);
    await page.mouse.up();

    // * Verify the modal remains open because the press started inside it
    await expect(modal).toBeVisible();

    // # Click outside the modal (both press and release on the backdrop)
    await page.mouse.click(5, 5);

    // * Verify the modal now closes
    await expect(modal).not.toBeVisible();
});

/**
 * @objective Verify that cancelling the create-channel modal does not create or join a channel, and that
 * leaving a channel removes it from the sidebar.
 */
test(
    'MM-T861 cancelling the create channel modal does not join a channel',
    {tag: '@channel_settings'},
    async ({pw}) => {
        const {user, team} = await pw.initSetup();
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Create a new public channel via the modal
        const createdChannel = `Random ${pw.random.id()}`;
        await channelsPage.newChannel(createdChannel, 'O');

        // * Verify the new channel is opened
        await channelsPage.centerView.header.toHaveTitle(createdChannel);

        // # Leave the channel via the channel header menu
        const channelMenu = await channelsPage.openChannelMenu();
        await channelMenu.leaveChannel.click();

        // * Verify the user is redirected to the default channel and the channel is no longer in the sidebar
        await channelsPage.centerView.header.toHaveTitle('Town Square');
        await expect(channelsPage.sidebarLeft.container.getByText(createdChannel)).not.toBeVisible();

        // # Open the create-channel modal, enter a name, and cancel without creating
        const cancelledChannel = `AB ${pw.random.id()}`;
        const newChannelModal = await channelsPage.openNewChannelModal();
        await newChannelModal.displayNameInput.fill(cancelledChannel);
        await newChannelModal.cancel();

        // * Verify the modal is closed and the cancelled channel was never created or joined
        await expect(newChannelModal.container).not.toBeVisible();
        await expect(channelsPage.sidebarLeft.container.getByText(cancelledChannel)).not.toBeVisible();

        // * Verify the previously left channel remains absent from the sidebar
        await expect(channelsPage.sidebarLeft.container.getByText(createdChannel)).not.toBeVisible();
    },
);
