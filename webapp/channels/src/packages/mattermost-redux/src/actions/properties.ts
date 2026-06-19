// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {
    PropertyField,
    PropertyValue,
} from '@mattermost/types/properties';

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
        const perPage = 60;
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
                {cursorId, cursorCreateAt, perPage},
            );
            fields = fields.concat(page);
            fetched += page.length;

            // A page smaller than perPage means we've reached the last page;
            // no need for an extra round-trip to confirm with an empty response.
            if (page.length < perPage) {
                break;
            }

            const last = page[page.length - 1];
            cursorId = last.id;
            cursorCreateAt = last.create_at;
        }

        dispatch({
            type: PropertyTypes.RECEIVED_PROPERTY_FIELDS,
            data: {fields},
        });

        return {data: fields};
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
