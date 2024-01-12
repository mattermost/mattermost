// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Bot, BotPatch} from '@mattermost/types/bots';

import {BotTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import type {ActionFunc, NewActionFuncAsync} from 'mattermost-redux/types/actions';

import {bindClientFunc} from './helpers';

const BOTS_PER_PAGE_DEFAULT = 20;

export function createBot(bot: Partial<Bot>): NewActionFuncAsync<Bot> {
    return bindClientFunc({
        clientFunc: Client4.createBot,
        onSuccess: BotTypes.RECEIVED_BOT_ACCOUNT,
        params: [
            bot,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function patchBot(botUserId: string, botPatch: Partial<BotPatch>): NewActionFuncAsync<Bot> {
    return bindClientFunc({
        clientFunc: Client4.patchBot,
        onSuccess: BotTypes.RECEIVED_BOT_ACCOUNT,
        params: [
            botUserId,
            botPatch,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function loadBot(botUserId: string): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.getBot,
        onSuccess: BotTypes.RECEIVED_BOT_ACCOUNT,
        params: [
            botUserId,
        ],
    });
}

export function loadBots(page = 0, perPage = BOTS_PER_PAGE_DEFAULT): NewActionFuncAsync<Bot[]> {
    return bindClientFunc({
        clientFunc: Client4.getBotsIncludeDeleted,
        onSuccess: BotTypes.RECEIVED_BOT_ACCOUNTS,
        params: [
            page,
            perPage,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function disableBot(botUserId: string): NewActionFuncAsync<Bot> {
    return bindClientFunc({
        clientFunc: Client4.disableBot,
        onSuccess: BotTypes.RECEIVED_BOT_ACCOUNT,
        params: [
            botUserId,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function enableBot(botUserId: string): NewActionFuncAsync<Bot> {
    return bindClientFunc({
        clientFunc: Client4.enableBot,
        onSuccess: BotTypes.RECEIVED_BOT_ACCOUNT,
        params: [
            botUserId,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function assignBot(botUserId: string, newOwnerId: string): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.assignBot,
        onSuccess: BotTypes.RECEIVED_BOT_ACCOUNT,
        params: [
            botUserId,
            newOwnerId,
        ],
    });
}
