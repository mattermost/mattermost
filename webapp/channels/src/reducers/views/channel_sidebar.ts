// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {ChannelCategoryTypes, UserTypes} from 'mattermost-redux/action_types';
import {removeItem} from 'mattermost-redux/utils/array_utils';

import {ActionTypes} from 'utils/constants';

import type {ChannelCategory} from '@mattermost/types/channel_categories';
import type {GenericAction} from 'mattermost-redux/types/actions';
import type {DraggingState} from 'types/store';

export function unreadFilterEnabled(state = false, action: GenericAction) {
    switch (action.type) {
    case ActionTypes.SET_UNREAD_FILTER_ENABLED:
        return action.enabled;

    case UserTypes.LOGOUT_SUCCESS:
        return false;
    default:
        return state;
    }
}

export function draggingState(state: DraggingState = {}, action: GenericAction): DraggingState {
    switch (action.type) {
    case ActionTypes.SIDEBAR_DRAGGING_SET_STATE:
        return {
            state: action.data.state || state?.state,
            type: action.data.type || state?.type,
            id: action.data.id || state?.id,
        };

    case ActionTypes.SIDEBAR_DRAGGING_STOP:
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export function newCategoryIds(state: string[] = [], action: GenericAction): string[] {
    switch (action.type) {
    case ActionTypes.ADD_NEW_CATEGORY_ID:
        return [...state, action.data];
    case ChannelCategoryTypes.RECEIVED_CATEGORY: {
        const category: ChannelCategory = action.data;

        if (category.channel_ids.length > 0) {
            return removeItem(state, category.id);
        }

        return state;
    }
    case ChannelCategoryTypes.RECEIVED_CATEGORIES: {
        const categories = action.data;

        return categories.reduce((nextState: string[], category: ChannelCategory) => {
            if (category.channel_ids.length > 0) {
                return removeItem(nextState, category.id);
            }

            return nextState;
        }, state);
    }

    case UserTypes.LOGOUT_SUCCESS:
        return [];
    default:
        return state;
    }
}

export function multiSelectedChannelIds(state: string[] = [], action: GenericAction): string[] {
    switch (action.type) {
    case ActionTypes.MULTISELECT_CHANNEL:
        // Channel was not previously selected
        // now will be the only selected item
        if (!state.includes(action.data)) {
            return [action.data];
        }

        // Channel was part of a selected group
        // will now become the only selected item
        if (state.length > 1) {
            return [action.data];
        }

        // Channel was previously selected but not in a group
        // we will now clear the selection
        return [];
    case ActionTypes.MULTISELECT_CHANNEL_ADD:
        // if not selected - add it to the selected items
        if (state.indexOf(action.data) === -1) {
            return [
                ...state,
                action.data,
            ];
        }

        // it was previously selected and now needs to be removed from the group
        return removeItem(state, action.data);
    case ActionTypes.MULTISELECT_CHANNEL_TO:
        return action.data;

    case ActionTypes.MULTISELECT_CHANNEL_CLEAR:
        return state.length > 0 ? [] : state;

    case UserTypes.LOGOUT_SUCCESS:
        return [];
    default:
        return state;
    }
}

export function lastSelectedChannel(state = '', action: GenericAction): string {
    switch (action.type) {
    case ActionTypes.MULTISELECT_CHANNEL:
    case ActionTypes.MULTISELECT_CHANNEL_ADD:
        return action.data;
    case ActionTypes.MULTISELECT_CHANNEL_CLEAR:
    case UserTypes.LOGOUT_SUCCESS:
        return '';
    default:
        return state;
    }
}

function firstChannelName(state = '', action: GenericAction) {
    switch (action.type) {
    case ActionTypes.FIRST_CHANNEL_NAME:
        return action.data;

    case UserTypes.LOGOUT_SUCCESS:
        return '';
    default:
        return state;
    }
}

export default combineReducers({
    unreadFilterEnabled,
    draggingState,
    newCategoryIds,
    multiSelectedChannelIds,
    lastSelectedChannel,
    firstChannelName,
});
