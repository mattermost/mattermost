// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import PropertyTypes from '../action_types/properties';

/**
 * Fetches property fields for a given group, object type, and target scope,
 * then stores them in the Redux property fields state.
 */
export function fetchPropertyFields(groupName: string, objectType: string, targetType: string, targetId?: string): ActionFuncAsync<PropertyField[]> {
    return async (dispatch) => {
        let fields: PropertyField[] = [];
        const maxItems = 500;
        let fetched = 0;
        let cursorId: string | undefined;
        let cursorCreateAt: number | undefined;

        while (fetched < maxItems) {
            // eslint-disable-next-line no-await-in-loop
            const page = await Client4.getPropertyFields(groupName, objectType, targetType, targetId, {cursorId, cursorCreateAt});
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

        return {data: fields};
    };
}
