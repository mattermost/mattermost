// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import PropertyTypes from '../action_types/properties';

/**
 * Fetches property fields for a given group, object type, and target scope,
 * then stores them in the Redux property fields state.
 */
export function fetchPropertyFields(
    groupName: string,
    objectType: string,
    targetType: string,
    targetId?: string,
): ActionFuncAsync<PropertyField[]> {
    return async (dispatch) => {
        let fields: PropertyField[] = [];
        const maxItems = 500;
        let fetched = 0;
        let cursorId: string | undefined;
        let cursorCreateAt: number | undefined;

        while (fetched < maxItems) {
            // eslint-disable-next-line no-await-in-loop
            const page = await Client4.getPropertyFields(
                groupName,
                objectType,
                targetType,
                targetId,
                {cursorId, cursorCreateAt},
            );
            fields = fields.concat(page);

            if (page.length === 0) {
                break;
            }

            fetched += page.length;
            const last = page[page.length - 1];
            cursorId = last.id;
            cursorCreateAt = last.create_at;
        }

        dispatch({
            type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
            data: {fields},
        });

        // Fields are stored keyed by their real group UUID, so expose the
        // name -> group mapping that consumers use to resolve that id.
        if (fields.length > 0) {
            dispatch({
                type: PropertyTypes.RECEIVED_PROPERTY_GROUP,
                data: {id: fields[0].group_id, name: groupName},
            });
        }

        return {data: fields};
    };
}

/**
 * Patches a single property field's attrs and, on success, reconciles the
 * returned field into the Redux property fields state via an upsert.
 */
export function patchPropertyField(
    groupName: string,
    objectType: string,
    fieldId: string,
    patch: Partial<PropertyField> & Record<string, unknown>,
): ActionFuncAsync<PropertyField> {
    return async (dispatch) => {
        let field: PropertyField;
        try {
            field = await Client4.patchPropertyField(groupName, objectType, fieldId, patch);
        } catch (error) {
            return {error};
        }

        dispatch({
            type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
            data: {fields: [field]},
        });

        return {data: field};
    };
}

/**
 * Fetches all system-scoped property values for a given group via the
 * dedicated `/system/values` endpoint, then stores them in Redux.
 */
export function fetchSystemPropertyValues<T = unknown>(
    groupName: string,
): ActionFuncAsync<Array<PropertyValue<T>>> {
    return async (dispatch) => {
        const values =
            (await Client4.getSystemPropertyValues<T>(groupName)) ?? [];

        dispatch({
            type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
            data: {values},
        });

        return {data: values};
    };
}
