// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {UserTypes} from 'mattermost-redux/action_types';

import {SearchTypes} from 'utils/constants';

import type {MMAction} from 'types/store';
import type {ViewsState} from 'types/store/views';

function modalSearch(state = '', action: MMAction) {
    switch (action.type) {
    case SearchTypes.SET_MODAL_SEARCH: {
        return action.data.trim();
    }

    case UserTypes.LOGOUT_SUCCESS:
        return '';
    default:
        return state;
    }
}

function popoverSearch(state = '', action: MMAction) {
    switch (action.type) {
    case SearchTypes.SET_POPOVER_SEARCH: {
        return action.data.trim();
    }

    default:
        return state;
    }
}

function channelMembersRhsSearch(state = '', action: MMAction) {
    switch (action.type) {
    case SearchTypes.SET_CHANNEL_MEMBERS_RHS_SEARCH: {
        return action.data;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return '';
    default:
        return state;
    }
}

function modalFilters(state: ViewsState['search']['modalFilters'] = {}, action: MMAction) {
    switch (action.type) {
    case SearchTypes.SET_MODAL_FILTERS: {
        const filters = action.data;
        return {
            ...filters,
        };
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function userGridSearch(state: Partial<ViewsState['search']['userGridSearch']> = {}, action: MMAction) {
    switch (action.type) {
    case SearchTypes.SET_USER_GRID_SEARCH: {
        const term = action.data.trim();
        return {
            ...state,
            term,
        };
    }
    case SearchTypes.SET_USER_GRID_FILTERS: {
        const filters = action.data;
        return {
            ...state,
            filters,
        };
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function teamListSearch(state = '', action: MMAction) {
    switch (action.type) {
    case SearchTypes.SET_TEAM_LIST_SEARCH: {
        return action.data.trim();
    }

    case UserTypes.LOGOUT_SUCCESS:
        return '';
    default:
        return state;
    }
}

function channelListSearch(state: Partial<ViewsState['search']['channelListSearch']> = {}, action: MMAction) {
    switch (action.type) {
    case SearchTypes.SET_CHANNEL_LIST_SEARCH: {
        const term = action.data.trim();
        return {
            ...state,
            term,
        };
    }
    case SearchTypes.SET_CHANNEL_LIST_FILTERS: {
        const filters = action.data;
        return {
            ...state,
            filters,
        };
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export default combineReducers({
    modalSearch,
    popoverSearch,
    channelMembersRhsSearch,
    modalFilters,
    userGridSearch,
    teamListSearch,
    channelListSearch,
});
