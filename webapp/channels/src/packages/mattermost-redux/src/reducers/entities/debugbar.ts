// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {GenericAction} from 'mattermost-redux/types/actions';
import {DebugBarTypes} from 'mattermost-redux/action_types';

import type {
    DebugBarState,
    DebugBarAPICall,
    DebugBarSQLQuery,
    DebugBarStoreCall,
    DebugBarEmailSent,
    DebugBarLog,
} from '@mattermost/types/debugbar';

import {DebugBarKeys} from '@mattermost/types/debugbar';

const {API, STORE, SQL, LOGS, EMAILS} = DebugBarKeys;

export function emailsSent(state: DebugBarEmailSent[] = [], action: GenericAction): DebugBarEmailSent[] {
    switch (action.type) {
    case DebugBarTypes.ADD_LINE: {
        if (action.data?.type === 'email-sent') {
            return [action.data, ...state];
        }
        return state;
    }
    case DebugBarTypes.CLEAR_LINES: {
        if (action.key && action.key !== EMAILS) {
            return state;
        }
        return [];
    }
    default:
        return state;
    }
}

export function apiCalls(state: DebugBarAPICall[] = [], action: GenericAction): DebugBarAPICall[] {
    switch (action.type) {
    case DebugBarTypes.ADD_LINE: {
        if (action.data?.type === 'api-call') {
            return [action.data, ...state];
        }
        return state;
    }
    case DebugBarTypes.CLEAR_LINES: {
        if (action.key && action.key !== API) {
            return state;
        }
        return [];
    }
    default:
        return state;
    }
}

export function storeCalls(state: DebugBarStoreCall[] = [], action: GenericAction): DebugBarStoreCall[] {
    switch (action.type) {
    case DebugBarTypes.ADD_LINE: {
        if (action.data?.type === 'store-call') {
            return [action.data, ...state];
        }
        return state;
    }
    case DebugBarTypes.CLEAR_LINES: {
        if (action.key && action.key !== STORE) {
            return state;
        }
        return [];
    }
    default:
        return state;
    }
}

export function sqlQueries(state: DebugBarSQLQuery[] = [], action: GenericAction): DebugBarSQLQuery[] {
    switch (action.type) {
    case DebugBarTypes.ADD_LINE: {
        if (action.data?.type === 'sql-query') {
            return [action.data, ...state];
        }
        return state;
    }
    case DebugBarTypes.CLEAR_LINES: {
        if (action.key && action.key !== SQL) {
            return state;
        }
        return [];
    }
    default:
        return state;
    }
}

export function logs(state: DebugBarLog[] = [], action: GenericAction): DebugBarLog[] {
    switch (action.type) {
    case DebugBarTypes.ADD_LINE: {
        if (action.data?.type === 'log-line') {
            return [action.data, ...state];
        }
        return state;
    }
    case DebugBarTypes.CLEAR_LINES: {
        if (action.key && action.key !== LOGS) {
            return state;
        }
        return [];
    }
    default:
        return state;
    }
}

export default (combineReducers({
    apiCalls,
    storeCalls,
    sqlQueries,
    logs,
    emailsSent,
}) as (b: DebugBarState, a: GenericAction) => DebugBarState);
