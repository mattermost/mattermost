// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'reselect';

import {GlobalState} from '@mattermost/types/store';

function regexFilter<T>(state: T[], regex?: RegExp): T[] {
    if (!regex) {
        return state;
    }

    return state.filter((v) => regex.test(JSON.stringify(v)));
}

export const getLogs = createSelector(
    'getLogs',
    (state: GlobalState) => state.entities.debugbar.logs,
    (_state: GlobalState, level: string) => level,
    (_state: GlobalState, _level: string, regex?: RegExp) => regex,
    (logs, level, regex) => {
        let filtered = logs;
        if (regex) {
            filtered = regexFilter(logs, regex);
        }

        if (level && level !== 'debug') {
            const levels = ['error'];

            if (level === 'warn' || level === 'info') {
                levels.push('warn');
            }

            if (level === 'info') {
                levels.push('info');
            }

            filtered = filtered.filter((v) => levels.includes(v.level.toLowerCase()));
        }

        return filtered;
    },
);

export const getApiCalls = createSelector(
    'getApiCalls',
    (state: GlobalState) => state.entities.debugbar.apiCalls,
    (_state: GlobalState, regex: RegExp|undefined) => regex,
    regexFilter,
);

export const getStoreCalls = createSelector(
    'getStoreCalls',
    (state: GlobalState) => state.entities.debugbar.storeCalls,
    (_state: GlobalState, regex: RegExp|undefined) => regex,
    regexFilter,
);

export const getSqlQueries = createSelector(
    'getSqlQueries',
    (state: GlobalState) => state.entities.debugbar.sqlQueries,
    (_state: GlobalState, regex: RegExp|undefined) => regex,
    regexFilter,
);

export const getEmailsSent = (state: GlobalState) => state.entities.debugbar.emailsSent;
