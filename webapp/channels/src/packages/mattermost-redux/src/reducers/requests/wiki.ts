// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import {UserTypes, WikiTypes} from 'mattermost-redux/action_types';

function loading(state: Record<string, boolean> = {}, action: AnyAction): Record<string, boolean> {
    switch (action.type) {
    case WikiTypes.GET_PAGES_REQUEST: {
        const {wikiId} = action.data;
        return {
            ...state,
            [wikiId]: true,
        };
    }
    case WikiTypes.GET_PAGES_SUCCESS:
    case WikiTypes.GET_PAGES_FAILURE: {
        const {wikiId} = action.data;
        return {
            ...state,
            [wikiId]: false,
        };
    }
    case WikiTypes.DELETED_WIKI: {
        const {wikiId} = action.data;
        const nextLoading = {...state};
        delete nextLoading[wikiId];
        return nextLoading;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function error(state: Record<string, string | null> = {}, action: AnyAction): Record<string, string | null> {
    switch (action.type) {
    case WikiTypes.GET_PAGES_REQUEST: {
        const {wikiId} = action.data;
        return {
            ...state,
            [wikiId]: null,
        };
    }
    case WikiTypes.GET_PAGES_FAILURE: {
        const {wikiId, error: errorMsg} = action.data;
        return {
            ...state,
            [wikiId]: errorMsg,
        };
    }
    case WikiTypes.DELETED_WIKI: {
        const {wikiId} = action.data;
        const nextError = {...state};
        delete nextError[wikiId];
        return nextError;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export default combineReducers({
    loading,
    error,
});
