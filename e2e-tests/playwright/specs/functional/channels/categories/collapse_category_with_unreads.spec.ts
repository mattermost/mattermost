// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

const categoryName = 'Noisy';
const unreadChannelName = 'noisy-unread';
const mutedChannelName = 'noisy-muted';
const openChannelName = 'noisy-open';

/**
 * Creates a "Noisy" category for the user with three channels:
 * - noisy-unread: has a new message, so it is unread
 * - noisy-muted: is muted and has a message that mentions the user
 * - noisy-open: has a new message, and the test opens it to make it the current channel
 */
async function setupNoisyCategory(pw: PlaywrightExtended, collapseCategoryWithUnreads?: boolean) {
    const {user, userClient, adminClient, team} = await pw.initSetup();

    const channelIds: Record<string, string> = {};
    for (const name of [unreadChannelName, mutedChannelName, openChannelName]) {
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name,
            display_name: name,
            type: 'O',
        });
        await adminClient.addToChannel(user.id, channel.id);
        channelIds[name] = channel.id;
    }

    await userClient.createChannelCategory(user.id, team.id, {
        team_id: team.id,
        user_id: user.id,
        display_name: categoryName,
        channel_ids: Object.values(channelIds),
    });

    await userClient.updateChannelNotifyProps({
        channel_id: channelIds[mutedChannelName],
        user_id: user.id,
        mark_unread: 'mention',
    });

    if (collapseCategoryWithUnreads !== undefined) {
        await userClient.savePreferences(user.id, [
            {
                user_id: user.id,
                category: 'display_settings',
                name: 'collapse_category_with_unreads',
                value: String(collapseCategoryWithUnreads),
            },
        ]);
    }

    // # Post as the admin so the channels are unread for the user
    await adminClient.createPost({channel_id: channelIds[unreadChannelName], message: 'Deploy finished'});
    await adminClient.createPost({channel_id: channelIds[openChannelName], message: 'Nightly build passed'});
    await adminClient.createPost({
        channel_id: channelIds[mutedChannelName],
        message: `@${user.username} can you take a look?`,
    });

    return {user, userClient, team};
}

test.describe('Collapse category with unread channels', () => {
    /**
     * @objective Verify that a collapsed category keeps its unread channels visible when the setting is off
     */
    test(
        'keeps unread channels in a collapsed category when the setting is off',
        {tag: '@channel_sidebar'},
        async ({pw}) => {
            // # Set up the category without saving the setting, so the default (off) applies
            const {user, team} = await setupNoisyCategory(pw);

            // # Log in and open Town Square
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const sidebar = channelsPage.sidebarLeft;

            // * Verify the channels are unread and the muted channel has a mention count
            await sidebar.assertItemUnread(unreadChannelName);
            await expect(sidebar.unreadMentionsBadge(mutedChannelName)).toBeVisible();

            // # Collapse the category
            const categoryHeader = sidebar.container.getByRole('button', {name: categoryName, exact: true});
            await categoryHeader.click();
            await expect(categoryHeader).toHaveAttribute('aria-expanded', 'false');

            // * Verify the unread channel and the muted channel with a mention stay visible
            await expect(sidebar.container.locator(`#sidebarItem_${unreadChannelName}`)).toBeVisible();
            await expect(sidebar.container.locator(`#sidebarItem_${mutedChannelName}`)).toBeVisible();
            await expect(sidebar.container.locator(`#sidebarItem_${openChannelName}`)).toBeVisible();
        },
    );

    /**
     * @objective Verify that turning the setting on in Display settings saves it and hides unread channels in a
     * collapsed category
     */
    test(
        'hides unread channels in a collapsed category when the setting is on',
        {tag: '@channel_sidebar'},
        async ({pw}) => {
            // # Set up the category without saving the setting
            const {user, userClient, team} = await setupNoisyCategory(pw);

            // # Log in and open Town Square
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            // # Open Settings > Display and turn the setting on
            const settingsModal = await channelsPage.openSettings();
            const displaySettings = await settingsModal.openDisplayTab();
            await displaySettings.collapseCategoryWithUnreadsEditButton.click();
            await displaySettings.verifySectionIsExpanded('collapseCategoryWithUnreads');
            await displaySettings.container.getByRole('radio', {name: 'On', exact: true}).check();
            await displaySettings.container.getByRole('button', {name: 'Save', exact: true}).click();
            await expect(displaySettings.container.locator('#collapse_category_with_unreadsDesc')).toHaveText('On');
            await settingsModal.closeButton.click();

            // * Verify the save wrote the value true
            await expect
                .poll(async () => {
                    const preferences = await userClient.getUserPreferences(user.id);
                    return preferences.find(
                        (preference) =>
                            preference.category === 'display_settings' &&
                            preference.name === 'collapse_category_with_unreads',
                    )?.value;
                })
                .toBe('true');

            const sidebar = channelsPage.sidebarLeft;

            // # Collapse the category
            const categoryHeader = sidebar.container.getByRole('button', {name: categoryName, exact: true});
            await categoryHeader.click();
            await expect(categoryHeader).toHaveAttribute('aria-expanded', 'false');

            // * Verify the unread channel and the muted channel with a mention are hidden
            await expect(sidebar.container.locator(`#sidebarItem_${unreadChannelName}`)).not.toBeVisible();
            await expect(sidebar.container.locator(`#sidebarItem_${mutedChannelName}`)).not.toBeVisible();
            await expect(sidebar.container.locator(`#sidebarItem_${openChannelName}`)).not.toBeVisible();

            // # Expand the category
            await categoryHeader.click();
            await expect(categoryHeader).toHaveAttribute('aria-expanded', 'true');

            // * Verify every channel is visible in the open category
            await expect(sidebar.container.locator(`#sidebarItem_${unreadChannelName}`)).toBeVisible();
            await expect(sidebar.container.locator(`#sidebarItem_${mutedChannelName}`)).toBeVisible();
            await expect(sidebar.container.locator(`#sidebarItem_${openChannelName}`)).toBeVisible();
        },
    );

    /**
     * @objective Verify that a collapsed category keeps the current channel visible when the setting is on
     */
    test(
        'keeps the current channel in a collapsed category when the setting is on',
        {tag: '@channel_sidebar'},
        async ({pw}) => {
            // # Set up the category with the setting on
            const {user, team} = await setupNoisyCategory(pw, true);

            // # Log in and open a channel in the category
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, openChannelName);
            await channelsPage.toBeVisible();

            const sidebar = channelsPage.sidebarLeft;

            // # Collapse the category
            const categoryHeader = sidebar.container.getByRole('button', {name: categoryName, exact: true});
            await categoryHeader.click();
            await expect(categoryHeader).toHaveAttribute('aria-expanded', 'false');

            // * Verify only the current channel stays visible
            await expect(sidebar.container.locator(`#sidebarItem_${openChannelName}`)).toBeVisible();
            await expect(sidebar.container.locator(`#sidebarItem_${unreadChannelName}`)).not.toBeVisible();
            await expect(sidebar.container.locator(`#sidebarItem_${mutedChannelName}`)).not.toBeVisible();
        },
    );
});
