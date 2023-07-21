// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Bot} from '@mattermost/types/bots';
import {GlobalState} from '@mattermost/types/store';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getUsers} from 'mattermost-redux/selectors/entities/common';

export const ExternalBotAccountNames: string[] = ['mattermost-advisor'];

export function getBotAccounts(state: GlobalState) {
    return state.entities.bots.accounts;
}

export const getExternalBotAccounts: (state: GlobalState) => Record<string, Bot> = createSelector(
    'getExternalBotAccounts',
    getBotAccounts,
    getUsers,
    (botAccounts, userProfiles) => {
        const nextState: Record<string, Bot> = {};
        Object.values(botAccounts).forEach((botAccount) => {
            const botUser = userProfiles[botAccount.user_id];
            if (botUser && !ExternalBotAccountNames.includes(botUser.username)) {
                nextState[botAccount.user_id] = botAccount;
            }
        });

        return nextState;
    },
);
