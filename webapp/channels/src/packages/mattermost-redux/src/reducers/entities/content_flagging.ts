// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {
    ContentFlaggingConfig,
    ContentFlaggingState,
} from '@mattermost/types/content_flagging';
import type {NameMappedPropertyFields, PropertyValue} from '@mattermost/types/properties';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import {ContentFlaggingTypes, UserTypes} from 'mattermost-redux/action_types';

function parsePropertyValues(propertyValues: string): Array<PropertyValue<unknown>> | null {
    try {
        const parsedPropertyValues = JSON.parse(propertyValues);
        return Array.isArray(parsedPropertyValues) ? parsedPropertyValues : null;
    } catch {
        return null;
    }
}

function settings(state: ContentFlaggingState['settings'] = {} as ContentFlaggingConfig, action: MMReduxAction) {
    switch (action.type) {
    case ContentFlaggingTypes.RECEIVED_CONTENT_FLAGGING_CONFIG: {
        return {
            ...state,
            ...action.data,
        };
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function fields(state: ContentFlaggingState['fields'] = {} as NameMappedPropertyFields, action: MMReduxAction) {
    switch (action.type) {
    case ContentFlaggingTypes.RECEIVED_POST_CONTENT_FLAGGING_FIELDS: {
        return {
            ...state,
            ...action.data,
        };
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function postValues(state: ContentFlaggingState['postValues'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case ContentFlaggingTypes.RECEIVED_POST_CONTENT_FLAGGING_VALUES: {
        return {
            ...state,
            [action.data.postId]: action.data.values,
        };
    }
    case ContentFlaggingTypes.CONTENT_FLAGGING_REPORT_VALUE_UPDATED: {
        const postId = action.data.target_id as string;
        const existingPropertyValues = Array.isArray(state[postId]) ? state[postId] : [];
        const updatedPropertyValues = parsePropertyValues(action.data.property_values);
        if (!updatedPropertyValues) {
            return state;
        }

        const valuesByFieldId = {} as Record<string, PropertyValue<unknown>>;
        existingPropertyValues.forEach((property: PropertyValue<unknown>) => {
            valuesByFieldId[property.field_id] = property;
        });
        updatedPropertyValues.forEach((property: PropertyValue<unknown>) => {
            valuesByFieldId[property.field_id] = property;
        });

        return {
            ...state,
            [postId]: Object.values(valuesByFieldId),
        };
    }
    case ContentFlaggingTypes.FLAGGED_POST_REMOVED: {
        const postId = action.data?.postId as string | undefined;
        if (!postId || !(postId in state)) {
            return state;
        }
        const nextState = {...state};
        Reflect.deleteProperty(nextState, postId);
        return nextState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function flaggedPosts(state: ContentFlaggingState['flaggedPosts'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case ContentFlaggingTypes.RECEIVED_FLAGGED_POST: {
        return {
            ...state,
            [action.data.id]: action.data,
        };
    }
    case ContentFlaggingTypes.FLAGGED_POST_REMOVED: {
        const postId = action.data?.postId as string | undefined;
        if (!postId || !(postId in state)) {
            return state;
        }
        const nextState = {...state};
        Reflect.deleteProperty(nextState, postId);
        return nextState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function channels(state: ContentFlaggingState['channels'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case ContentFlaggingTypes.RECEIVED_CONTENT_FLAGGING_CHANNEL: {
        return {
            ...state,
            [action.data.id]: action.data,
        };
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function teams(state: ContentFlaggingState['teams'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case ContentFlaggingTypes.RECEIVED_CONTENT_FLAGGING_TEAM: {
        return {
            ...state,
            [action.data.id]: action.data,
        };
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export default combineReducers({
    settings,
    fields,
    postValues,
    flaggedPosts,
    channels,
    teams,
});
