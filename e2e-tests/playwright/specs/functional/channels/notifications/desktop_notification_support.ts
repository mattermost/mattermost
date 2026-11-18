// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Page} from '@playwright/test';
import type {UserProfile} from '@mattermost/types/users';
import type {Channel} from '@mattermost/types/channels';

import {duration, expect, type App, type PlaywrightExtended, DefaultChannel} from '@mattermost/playwright-lib';

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

/** No notification fired. Call it after a signal that the client processed the post (an unread channel, a later post). */
export async function expectNoNotification(pw: PlaywrightExtended, page: Page) {
    // An absence check: the notification is sent asynchronously after the post is processed.
    await pw.wait(duration.one_sec);
    expect(await page.evaluate(() => window.getNotifications())).toHaveLength(0);
}

/**
 * Posts into the channel the receiver is viewing so the sender profile is in the client store.
 * Notification bodies use displayUsername only when that profile is already loaded; otherwise
 * they fall back to websocket `sender_name`, which already includes '@' and becomes '@@user'.
 */
export async function ensureSenderProfileLoaded(
    senderClient: Client4,
    app: App,
    viewedChannelId: string,
    pw: PlaywrightExtended,
    page: Page,
) {
    const marker = `notification-profile-sync ${Date.now()}`;
    const post = await senderClient.createPost({channel_id: viewedChannelId, message: marker});
    await expect(app.center.postList.post(post).message.container.locator).toHaveText(marker);
    await pw.clearCapturedNotifications(page);
}

/** The channel's sidebar link reads as unread: "… unread", or "… N mention(s)" when it has mentions. */
export async function expectUnread(app: App, channel: Channel) {
    await expect(app.lhs.channelList.channel(channel).container.locator).toHaveAccessibleName(
        / (unread|\d+ mentions?)$/,
    );
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

    const channel = await adminClient.getChannelByName(team.id, DefaultChannel.OffTopic);
    const townSquare = await adminClient.getChannelByName(team.id, DefaultChannel.TownSquare);
    const {page, app} = await pw.testBrowser.login(receiver);
    await app.channelsPage.goto({team, channel: townSquare});
    await pw.stubNotification(page, 'granted');
    await ensureSenderProfileLoaded(senderClient, app, townSquare.id, pw, page);

    const message = `@${receiver.username} ${testCase.messageSuffix}`;
    await senderClient.createPost({channel_id: channel.id, message});

    await expectSingleNotification(pw, page, {
        title: channel.display_name,
        body: `@${testCase.senderName(sender)}: ${message}`,
    });
}

async function waitForDirectMessageProcessing(senderClient: Client4, app: App, syncChannel: Channel) {
    // Posting to a second channel after the DM forces the sender's websocket events to land in
    // order before we assert DM notification behavior.
    await senderClient.createPost({
        channel_id: syncChannel.id,
        message: `notification sync ${Date.now()}`,
    });
    await expectUnread(app, syncChannel);
}

export async function runNotificationSettingCase(pw: PlaywrightExtended, testCase: NotificationSettingCase) {
    const {
        adminClient,
        team,
        user: sender,
        userClient: senderClient,
        offTopic: channel,
        townSquare,
    } = await pw.initSetup();
    const receiver = await pw.createNewUserProfile(adminClient, {prefix: 'notification-receiver'});
    await adminClient.addToTeam(team.id, receiver.id);
    await setDesktopNotificationLevel(adminClient, receiver, testCase.desktop);
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
    const {page, app} = await pw.testBrowser.login(receiver);
    await app.channelsPage.goto({team, channel: townSquare});
    await pw.stubNotification(page, 'granted');
    await ensureSenderProfileLoaded(senderClient, app, townSquare.id, pw, page);

    for (const channelMessage of testCase.channelMessages) {
        const message = channelMessage.message(receiver);
        await senderClient.createPost({channel_id: channel.id, message});

        if (channelMessage.shouldNotify) {
            await expectSingleNotification(pw, page, {
                title: channel.display_name,
                body: `@${sender.username}: ${message}`,
            });
        } else {
            await expectUnread(app, channel);
            await expectNoNotification(pw, page);
        }

        await pw.clearCapturedNotifications(page);
    }

    const directChannel = await adminClient.createDirectChannel([receiver.id, sender.id]);
    await senderClient.createPost({channel_id: directChannel.id, message: 'hi'});
    await waitForDirectMessageProcessing(senderClient, app, syncChannel);

    if (testCase.directMessageShouldNotify) {
        const notifications = await pw.waitForNotification(page);
        expect(notifications).toHaveLength(1);
    } else {
        await expectNoNotification(pw, page);
    }
}
