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
