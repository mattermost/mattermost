// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {
    ContentFlaggingConfig,
    ContentFlaggingState,
} from '@mattermost/types/content_flagging';
import type {
    NameMappedPropertyFields,
    PropertyValue,
} from '@mattermost/types/properties';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import {ContentFlaggingTypes} from 'mattermost-redux/action_types';

function settings(state: ContentFlaggingState['settings'] = {} as ContentFlaggingConfig, action: MMReduxAction) {
    switch (action.type) {
    case ContentFlaggingTypes.RECEIVED_CONTENT_FLAGGING_CONFIG: {
        return {
            ...state,
            ...action.data,
        };
    }
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
        const existingPropertyValues = state[postId] || {};
        const updatedPropertyValues = JSON.parse(action.data.property_values);

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
    default:
        return state;
    }
}

export default combineReducers({
    settings,
    fields,
    postValues,
});
