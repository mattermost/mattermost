// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Page} from '@playwright/test';
import type {UserProfile} from '@mattermost/types/users';

import {duration, expect, type ChannelsPage, type PlaywrightExtended} from '@mattermost/playwright-lib';

type DesktopNotificationLevel = 'all' | 'mention' | 'none';
type NameFormat = 'username' | 'nickname_full_name' | 'full_name';

type DisplayNameCase = {
    nameFormat: NameFormat;
    senderName: (sender: UserProfile) => string;
    messageSuffix: string;
    removeNickname?: boolean;
};

type NotificationSettingCase = {
    desktop: DesktopNotificationLevel;
    channelMessages: Array<{message: (receiver: UserProfile) => string; shouldNotify: boolean}>;
    directMessageShouldNotify: boolean;
};

export const displayNameCases = {
    username: {
        nameFormat: 'username',
        senderName: (sender) => sender.username,
        messageSuffix: 'How are things?',
    },
    nickname: {
        nameFormat: 'nickname_full_name',
        senderName: (sender) => sender.nickname,
        messageSuffix: 'first',
    },
    nicknameFallback: {
        nameFormat: 'nickname_full_name',
        senderName: (sender) => `${sender.first_name} ${sender.last_name}`,
        messageSuffix: 'second',
        removeNickname: true,
    },
    fullName: {
        nameFormat: 'full_name',
        senderName: (sender) => `${sender.first_name} ${sender.last_name}`,
        messageSuffix: 'How are things?',
    },
} satisfies Record<string, DisplayNameCase>;

export const notificationSettingCases = {
    mentions: {
        desktop: 'mention',
        channelMessages: [
            {message: () => 'message without notification', shouldNotify: false},
            {message: (receiver) => `random message with mention @${receiver.username}`, shouldNotify: true},
        ],
        directMessageShouldNotify: true,
    },
    never: {
        desktop: 'none',
        channelMessages: [
            {message: (receiver) => `random message with mention @${receiver.username}`, shouldNotify: false},
        ],
        directMessageShouldNotify: false,
    },
} satisfies Record<string, NotificationSettingCase>;

export async function setDesktopNotificationLevel(
    adminClient: Client4,
    user: UserProfile,
    desktop: DesktopNotificationLevel,
) {
    await adminClient.patchUser({
        id: user.id,
        notify_props: {...user.notify_props, desktop},
    });
}

async function setNameFormat(adminClient: Client4, user: UserProfile, value: NameFormat) {
    await adminClient.savePreferences(user.id, [
        {
            user_id: user.id,
            category: 'display_settings',
            name: 'name_format',
            value,
        },
    ]);
}

export async function expectSingleNotification(
    pw: PlaywrightExtended,
    page: Page,
    expected: {title: string; body: string},
) {
    const notifications = await pw.waitForNotification(page);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe(expected.title);
    expect(notifications[0].body).toBe(expected.body);
}

export async function expectNoNotification(pw: PlaywrightExtended, page: Page) {
    await pw.wait(duration.one_sec);
    expect(await page.evaluate(() => window.getNotifications())).toHaveLength(0);
}

export async function runDisplayNameCase(pw: PlaywrightExtended, testCase: DisplayNameCase) {
    const {adminClient, team, user: sender, userClient: senderClient} = await pw.initSetup();
    const receiver = await pw.createNewUserProfile(adminClient, {prefix: 'notification-receiver'});
    await adminClient.addToTeam(team.id, receiver.id);
    await setDesktopNotificationLevel(adminClient, receiver, 'mention');
    await setNameFormat(adminClient, receiver, testCase.nameFormat);

    if (testCase.removeNickname) {
        await adminClient.patchUser({id: sender.id, nickname: ''});
        sender.nickname = '';
    }

    const channel = await adminClient.getChannelByName(team.id, 'off-topic');
    const {page, channelsPage} = await pw.testBrowser.login(receiver);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    await pw.stubNotification(page, 'granted');

    const message = `@${receiver.username} ${testCase.messageSuffix}`;
    await senderClient.createPost({channel_id: channel.id, message});

    await expectSingleNotification(pw, page, {
        title: channel.display_name,
        body: `@${testCase.senderName(sender)}: ${message}`,
    });
}

async function waitForDirectMessageProcessing(
    senderClient: Client4,
    channelsPage: ChannelsPage,
    syncChannelId: string,
    syncChannelName: string,
) {
    await senderClient.createPost({
        channel_id: syncChannelId,
        message: `notification sync ${Date.now()}`,
    });
    await channelsPage.sidebarLeft.assertItemUnread(syncChannelName);
}

export async function runNotificationSettingCase(pw: PlaywrightExtended, testCase: NotificationSettingCase) {
    const {adminClient, team, user: sender, userClient: senderClient} = await pw.initSetup();
    const receiver = await pw.createNewUserProfile(adminClient, {prefix: 'notification-receiver'});
    await adminClient.addToTeam(team.id, receiver.id);
    await setDesktopNotificationLevel(adminClient, receiver, testCase.desktop);

    const channel = await adminClient.getChannelByName(team.id, 'off-topic');
    const syncChannel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            name: 'notification-sync',
            displayName: 'Notification Sync',
            unique: true,
        }),
    );
    await adminClient.addToChannel(receiver.id, syncChannel.id);
    await adminClient.addToChannel(sender.id, syncChannel.id);

    const {page, channelsPage} = await pw.testBrowser.login(receiver);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    await pw.stubNotification(page, 'granted');

    for (const channelMessage of testCase.channelMessages) {
        const message = channelMessage.message(receiver);
        await senderClient.createPost({channel_id: channel.id, message});

        if (channelMessage.shouldNotify) {
            await expectSingleNotification(pw, page, {
                title: channel.display_name,
                body: `@${sender.username}: ${message}`,
            });
        } else {
            await channelsPage.sidebarLeft.assertItemUnread(channel.name);
            await expectNoNotification(pw, page);
        }

        await pw.clearCapturedNotifications(page);
    }

    const directChannel = await adminClient.createDirectChannel([receiver.id, sender.id]);
    await senderClient.createPost({channel_id: directChannel.id, message: 'hi'});
    await waitForDirectMessageProcessing(senderClient, channelsPage, syncChannel.id, syncChannel.name);

    if (testCase.directMessageShouldNotify) {
        const notifications = await pw.waitForNotification(page);
        expect(notifications).toHaveLength(1);
    } else {
        await expectNoNotification(pw, page);
    }
}
