// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a channel can be moved to the Favorites category from its sidebar menu.
 */
test('moves a channel to Favorites from its sidebar menu', {tag: '@channel_sidebar'}, async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Move ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);
    const {categories} = await userClient.getChannelCategories(user.id, team.id);
    const favorites = categories.find((c) => c.type === 'favorites');
    if (!favorites) {
        throw new Error('The user has no Favorites category');
    }

    // # Log in and open the channel's sidebar menu
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});
    const row = app.lhs.channelList.channel(channel);
    await row.locator.hover();
    await row.openMenuButton.click();
    const menu = app.lhs.channelMenu;
    await expect(menu.moveToMenuItem).toBeVisible();

    // # Open "Move to" and choose Favorites
    await menu.moveToMenuItem.hover();
    await settle(menu.moveToMenu.category(favorites), {
        wait: Api.UpdateSidebarCategoriesForTeamForUser,
    }).click();

    // * The server has the channel in Favorites
    await expect
        .poll(
            async () =>
                (await userClient.getChannelCategories(user.id, team.id)).categories.find((c) => c.id === favorites.id)
                    ?.channel_ids,
        )
        .toContain(channel.id);
});
