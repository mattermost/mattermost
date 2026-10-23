// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Bot, BotEventSubscription, BotEventSubscriptionPatch, BotPatch} from '@mattermost/types/bots';

import {BotTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {logError} from './errors';
import {bindClientFunc, forceLogoutIfNecessary} from './helpers';

const BOTS_PER_PAGE_DEFAULT = 20;

export function createBot(bot: Partial<Bot>) {
    return bindClientFunc({
        clientFunc: Client4.createBot,
        onSuccess: BotTypes.RECEIVED_BOT_ACCOUNT,
        params: [
            bot,
        ],
    });
}

export function patchBot(botUserId: string, botPatch: Partial<BotPatch>) {
    return bindClientFunc({
        clientFunc: Client4.patchBot,
        onSuccess: BotTypes.RECEIVED_BOT_ACCOUNT,
        params: [
            botUserId,
            botPatch,
        ],
    });
}

export function loadBot(botUserId: string) {
    return bindClientFunc({
        clientFunc: Client4.getBot,
        onSuccess: BotTypes.RECEIVED_BOT_ACCOUNT,
        params: [
            botUserId,
        ],
    });
}

export function loadBots(page = 0, perPage = BOTS_PER_PAGE_DEFAULT) {
    return bindClientFunc({
        clientFunc: Client4.getBotsIncludeDeleted,
        onSuccess: BotTypes.RECEIVED_BOT_ACCOUNTS,
        params: [
            page,
            perPage,
        ],
    });
}

export function disableBot(botUserId: string) {
    return bindClientFunc({
        clientFunc: Client4.disableBot,
        onSuccess: BotTypes.RECEIVED_BOT_ACCOUNT,
        params: [
            botUserId,
        ],
    });
}

export function enableBot(botUserId: string) {
    return bindClientFunc({
        clientFunc: Client4.enableBot,
        onSuccess: BotTypes.RECEIVED_BOT_ACCOUNT,
        params: [
            botUserId,
        ],
    });
}

export function assignBot(botUserId: string, newOwnerId: string) {
    return bindClientFunc({
        clientFunc: Client4.assignBot,
        onSuccess: BotTypes.RECEIVED_BOT_ACCOUNT,
        params: [
            botUserId,
            newOwnerId,
        ],
    });
}

// The secret in a create response must never reach the store, so this doesn't use bindClientFunc.
export function createBotWithEventSubscription(bot: Partial<Bot>, eventSubscription: BotEventSubscriptionPatch): ActionFuncAsync<{bot: Bot; eventSubscription: BotEventSubscription}> {
    return async (dispatch, getState) => {
        let response;
        try {
            response = await Client4.createBotWithEventSubscription(bot, eventSubscription);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const {event_subscription: subscription, ...created} = response;
        dispatch({type: BotTypes.RECEIVED_BOT_ACCOUNT, data: created});
        return {data: {bot: created, eventSubscription: subscription}};
    };
}

export function getBotEventSubscription(botUserId: string): ActionFuncAsync<BotEventSubscription | null> {
    return async (dispatch, getState) => {
        try {
            return {data: await Client4.getBotEventSubscription(botUserId)};
        } catch (error) {
            if (error.status_code === 404 || error.status_code === 403) {
                return {data: null};
            }
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

export function upsertBotEventSubscription(botUserId: string, patch: BotEventSubscriptionPatch) {
    return bindClientFunc({
        clientFunc: Client4.upsertBotEventSubscription,
        params: [botUserId, patch],
    });
}

export function deleteBotEventSubscription(botUserId: string) {
    return bindClientFunc({
        clientFunc: Client4.deleteBotEventSubscription,
        params: [botUserId],
    });
}

export function regenerateBotEventSubscriptionSecret(botUserId: string) {
    return bindClientFunc({
        clientFunc: Client4.regenerateBotEventSubscriptionSecret,
        params: [botUserId],
    });
}

export function enableBotEventSubscription(botUserId: string) {
    return bindClientFunc({
        clientFunc: Client4.enableBotEventSubscription,
        params: [botUserId],
    });
}
