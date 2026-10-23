// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BotEventSubscription, BotEventSubscriptionMode, BotEventSubscriptionPatch} from '@mattermost/types/bots';

export type EventDeliveryMode = 'none' | BotEventSubscriptionMode;

export type EventDeliveryState = {
    status: 'loading' | 'ready' | 'error';
    existing: BotEventSubscription | null;
    mode: EventDeliveryMode;
    callbackUrl: string;
    ignoreBotAuthors: boolean;
};

export type EventDeliveryChange = {kind: 'none'} | {kind: 'delete'} | {kind: 'upsert'; patch: BotEventSubscriptionPatch};

export function eventDeliveryState(sub: BotEventSubscription | null): EventDeliveryState {
    return {
        status: 'ready',
        existing: sub,
        mode: sub?.mode ?? 'none',
        callbackUrl: sub?.callback_url ?? '',
        ignoreBotAuthors: sub?.ignore_bot_authors ?? true,
    };
}

export function eventDeliveryPatch(state: EventDeliveryState): BotEventSubscriptionPatch | undefined {
    const {mode, callbackUrl, ignoreBotAuthors} = state;
    switch (mode) {
    case 'none':
        return undefined;
    case 'push':
        return {mode, callback_url: callbackUrl.trim(), ignore_bot_authors: ignoreBotAuthors};
    case 'pull':
        return {mode, ignore_bot_authors: ignoreBotAuthors};
    default: {
        const unhandled: never = mode;
        throw new Error(`Unhandled event delivery mode: ${unhandled}`);
    }
    }
}

export function planEventDeliveryChange(state: EventDeliveryState): EventDeliveryChange {
    if (state.status !== 'ready') {
        return {kind: 'none'};
    }
    const patch = eventDeliveryPatch(state);
    const {existing} = state;
    if (!patch) {
        return existing ? {kind: 'delete'} : {kind: 'none'};
    }
    const unchanged = existing && existing.mode === patch.mode &&
        existing.ignore_bot_authors === patch.ignore_bot_authors &&
        (patch.mode === 'pull' || existing.callback_url === patch.callback_url);
    return unchanged ? {kind: 'none'} : {kind: 'upsert', patch};
}
