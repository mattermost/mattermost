// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    POST_ATTRIBUTES_PROPERTY_GROUP_NAME,
    POST_ATTRIBUTES_PROPERTY_OBJECT_TYPE,
} from '@mattermost/types/properties_post';

import {fetchPropertyFields} from 'mattermost-redux/actions/properties';
import {isPostAttributesEnabled} from 'mattermost-redux/selectors/entities/general';

import type {ActionFuncAsync} from 'types/store';


export function loadPostAttributeFields(channelId?: string): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        if (!channelId || !isPostAttributesEnabled(getState())) {
            return {data: false};
        }

        try {
            await dispatch(fetchPropertyFields(
                POST_ATTRIBUTES_PROPERTY_GROUP_NAME,
                POST_ATTRIBUTES_PROPERTY_OBJECT_TYPE,
                {channelId},
            ));
        } catch {
            return {data: false};
        }

        return {data: true};
    };
}
