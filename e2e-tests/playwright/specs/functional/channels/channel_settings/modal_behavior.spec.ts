// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createChannelFromModal, expect, openNewChannelModal, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that releasing a mouse drag that started inside a modal but ends outside it does not
 * close the modal, while a genuine click outside the modal does close it.
 */
test('MM-T841 keeps a modal open when a drag is released outside it', {tag: '@channel_settings'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: 'off-topic'});
    await expect(app.center.postCreate).toBeVisible();

    // # Open the Channel Settings modal
    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
    const channelSettings = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);
    const modal = channelSettings.container;

    // # Press the mouse down inside the modal, drag to outside the modal, then release
    const box = await modal.locator.boundingBox();
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
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: 'town-square'});
        await expect(app.center.postCreate).toBeVisible();

        // # Create a new public channel via the modal
        const createdName = `Random ${pw.random.id()}`;
        const createdChannel = await createChannelFromModal(app, createdName, 'O');

        // * Verify the new channel is opened
        await expect(app.channelHeader.openMenuButton).toContainText(createdName);
        await expect(app.lhs.channelList.channel(createdChannel).container).toBeVisible();

        // # Leave the channel via the channel header menu
        await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.leaveChannelMenuItem);
        await app.channelHeader.menu.leaveChannelMenuItem.click();

        // * Verify the user is redirected to the default channel and the channel is no longer in the sidebar
        await expect(app.channelHeader.openMenuButton).toContainText('Town Square');
        await expect(app.lhs.channelList.channel(createdChannel).container).not.toBeVisible();
        const sidebarChannels = await app.lhs.channelList.channelList.keys();

        // # Open the create-channel modal, enter a name, and cancel without creating
        const cancelledChannel = `AB ${pw.random.id()}`;
        const newChannelModal = await openNewChannelModal(app);
        await newChannelModal.name.container.fill(cancelledChannel);
        await expect(newChannelModal.name.container).toHaveValue(cancelledChannel);
        await newChannelModal.cancelButton.click();

        // * Verify the modal is closed and the cancelled channel was never created or joined
        await expect(newChannelModal.container).not.toBeVisible();
        await expect(app.lhs.channelList.channelList).toHaveKeys(sidebarChannels, {ordered: false});

        // * Verify the previously left channel remains absent from the sidebar
        await expect(app.lhs.channelList.channel(createdChannel).container).not.toBeVisible();
    },
);
