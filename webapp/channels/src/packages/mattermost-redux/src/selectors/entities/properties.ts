// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyGroup, PropertyValue} from '@mattermost/types/properties';
import type {GlobalState} from '@mattermost/types/store';

import {createSelector} from 'mattermost-redux/selectors/create_selector';

// Field selectors

function getPropertyFieldsById(state: GlobalState) {
    return state.entities.properties.fields.byId;
}

export const getPropertyFieldsForObjectTypeAndGroup = createSelector(
    'getPropertyFieldsForObjectTypeAndGroup',
    (state: GlobalState, objectType: string, groupId: string) => state.entities.properties.fields.byObjectType[objectType]?.[groupId],
    (fields) => {
        if (!fields) {
            return [];
        }
        return Object.values(fields);
    },
);

export function getPropertyFieldById(state: GlobalState, fieldId: string): PropertyField | undefined {
    return getPropertyFieldsById(state)[fieldId];
}

export const getPropertyFieldsByIds = createSelector(
    'getPropertyFieldsByIds',
    getPropertyFieldsById,
    (state: GlobalState, fieldIds: string[]) => fieldIds,
    (byId, fieldIds) => {
        return fieldIds.reduce<PropertyField[]>((acc, id) => {
            const field = byId[id];
            if (field) {
                acc.push(field);
            }
            return acc;
        }, []);
    },
);

// Group selectors

export function getPropertyGroupById(state: GlobalState, groupId: string): PropertyGroup | undefined {
    return state.entities.properties.groups.byId[groupId];
}

export function getPropertyGroupByName(state: GlobalState, name: string): PropertyGroup | undefined {
    return state.entities.properties.groups.byName[name];
}

// Value selectors

export const getPropertyValuesForTarget = createSelector(
    'getPropertyValuesForTarget',
    (state: GlobalState, targetId: string) => state.entities.properties.values.byTargetId[targetId],
    (targetValues) => {
        if (!targetValues) {
            return [];
        }
        return Object.values(targetValues);
    },
);

export function getPropertyValueForTargetField(
    state: GlobalState,
    targetId: string,
    fieldId: string,
): PropertyValue<unknown> | undefined {
    return state.entities.properties.values.byTargetId[targetId]?.[fieldId];
}

export const getPropertyValuesForTargetByFieldIds = createSelector(
    'getPropertyValuesForTargetByFieldIds',
    (state: GlobalState, targetId: string) => state.entities.properties.values.byTargetId[targetId],
    (state: GlobalState, targetId: string, fieldIds: string[]) => fieldIds,
    (targetValues, fieldIds) => {
        if (!targetValues) {
            return [];
        }
        return fieldIds.reduce<Array<PropertyValue<unknown>>>((acc, fieldId) => {
            const value = targetValues[fieldId];
            if (value) {
                acc.push(value);
            }
            return acc;
        }, []);
    },
);

export const getPropertyValuesForField = createSelector(
    'getPropertyValuesForField',
    (state: GlobalState, fieldId: string) => state.entities.properties.values.byFieldId[fieldId],
    (fieldValues) => {
        if (!fieldValues) {
            return [];
        }
        return Object.values(fieldValues);
    },
);
