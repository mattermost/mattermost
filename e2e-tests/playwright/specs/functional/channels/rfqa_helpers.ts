// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {Locator} from '@playwright/test';

import {expect, type ChannelsPage, type PlaywrightExtended} from '@mattermost/playwright-lib';

export async function createPublicChannel(
    pw: PlaywrightExtended,
    adminClient: Client4,
    team: Team,
    displayName: string,
) {
    return adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            name: displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            displayName,
            unique: true,
        }),
    );
}

export async function createUsers(
    pw: PlaywrightExtended,
    adminClient: Client4,
    team: Team,
    count: number,
    prefix = 'rfqa-user',
) {
    const users: UserProfile[] = [];

    for (let i = 0; i < count; i++) {
        const user = await pw.createNewUserProfile(adminClient, {prefix});
        await adminClient.addToTeam(team.id, user.id);
        users.push(user);
    }

    return users;
}

export async function createPost(
    adminClient: Client4,
    user: UserProfile,
    channel: Channel,
    message: string,
    rootId = '',
    createAt?: number,
) {
    return adminClient.createPost({
        channel_id: channel.id,
        user_id: user.id,
        message,
        root_id: rootId,
        create_at: createAt,
    } as Post);
}

export async function openPostDotMenu(channelsPage: ChannelsPage, postId: string, rhs = false) {
    const post = rhs
        ? await channelsPage.sidebarRight.getPostById(postId)
        : await channelsPage.centerView.getPostById(postId);

    await post.hover();
    await post.postMenu.toBeVisible();
    await post.postMenu.openDotMenu();
    await channelsPage.postDotMenu.toBeVisible();

    return post;
}

export async function markPostAsUnreadFromMenu(channelsPage: ChannelsPage, postId: string, rhs = false) {
    await openPostDotMenu(channelsPage, postId, rhs);
    await channelsPage.postDotMenu.markAsUnreadMenuItem.click();
}

export async function expectUnreadSeparator(channelsPage: ChannelsPage, message: string) {
    await expect(channelsPage.page.locator('.NotificationSeparator')).toBeVisible();
    await expect(channelsPage.page.getByTestId('postView').filter({hasText: message})).toBeVisible();
}

export async function expectSidebarUnread(channelsPage: ChannelsPage, channelName: string) {
    await expect(sidebarItem(channelsPage, channelName)).toHaveClass(/unread|unread-title/);
}

export async function expectSidebarRead(channelsPage: ChannelsPage, channelName: string) {
    await expect(sidebarItem(channelsPage, channelName)).not.toHaveClass(/unread|unread-title/);
}

export async function goToSidebarItem(channelsPage: ChannelsPage, channelName: string) {
    await sidebarItem(channelsPage, channelName).click();
}

function sidebarItem(channelsPage: ChannelsPage, channelName: string): Locator {
    return channelsPage.page
        .locator(`#sidebarItem_${channelName}`)
        .or(channelsPage.sidebarLeft.container.locator('.SidebarLink').filter({hasText: channelName}))
        .first();
}

export async function submitSearch(channelsPage: ChannelsPage, query: string) {
    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.clearIfPossible();
    await channelsPage.searchBox.searchInput.fill(query);
    await channelsPage.searchBox.searchInput.press('Enter');
    await expect(channelsPage.page.locator('#search-items-container')).toBeVisible();
}

export async function expectSearchResult(channelsPage: ChannelsPage, text: string) {
    await expect(channelsPage.page.getByTestId('search-item-container').filter({hasText: text})).toBeVisible();
}

export async function expectNoSearchResult(channelsPage: ChannelsPage, text: string) {
    await expect(channelsPage.page.getByTestId('search-item-container').filter({hasText: text})).toHaveCount(0);
}

export async function openDirectMessagesModal(channelsPage: ChannelsPage) {
    await channelsPage.sidebarLeft.openDirectMessageButton.click();
    await channelsPage.directChannelsModal.toBeVisible();

    return channelsPage.directChannelsModal;
}

export async function selectUsersForDirectMessage(channelsPage: ChannelsPage, users: UserProfile[]) {
    const modal = await openDirectMessagesModal(channelsPage);

    for (const user of users) {
        await modal.selectUser(user);
    }

    return modal;
}
