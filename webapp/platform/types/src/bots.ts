// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type Bot = {
    user_id: string;
    username: string;
    display_name?: string;
    description?: string;
    owner_id: string;
    create_at: number;
    update_at: number;
    delete_at: number;

    // system_owned is true for protected, system-owned bots (e.g. system-bot,
    // content-review) that the server prevents from being disabled.
    system_owned?: boolean;
};

// BotPatch is a description of what fields to update on an existing bot.
export type BotPatch = {
    username: string;
    display_name: string;
    description: string;
};

export type BotEventSubscriptionMode = 'push' | 'pull';
export type BotEventDisabledReason = '' | 'delivery_failures' | 'callback_gone';

export type BotEventSubscription = {
    bot_user_id: string;
    mode: BotEventSubscriptionMode;
    callback_url: string;
    secret?: string;
    ignore_bot_authors: boolean;
    enabled: boolean;
    disabled_reason: BotEventDisabledReason;
    last_delivered_at: number;
};

export type BotEventSubscriptionPatch = Partial<Pick<BotEventSubscription, 'mode' | 'callback_url' | 'ignore_bot_authors'>>;
export type BotWithEventSubscription = Bot & {event_subscription: BotEventSubscription};
