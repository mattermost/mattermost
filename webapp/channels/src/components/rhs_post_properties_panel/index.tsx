// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {loadPostPropertyValues, patchPostPropertyValues} from 'mattermost-redux/actions/properties';
import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';
import {getPostPropertyFieldsForChannel} from 'mattermost-redux/selectors/entities/properties';

import type {DispatchFunc, GlobalState} from 'types/store';

import RhsPostPropertiesPanel from './rhs_post_properties_panel';

type Props = {
    postId: string;
    channelId: string;
};

export default function RhsPostPropertiesPanelConnected({postId, channelId}: Props) {
    const dispatch = useDispatch<DispatchFunc>();

    const integratedBoardsEnabled = useSelector(
        (state: GlobalState) => getFeatureFlagValue(state, 'IntegratedBoards') === 'true',
    );

    const fields = useSelector(
        (state: GlobalState) => getPostPropertyFieldsForChannel(state, channelId),
    );

    const valuesByFieldId = useSelector(
        (state: GlobalState) => state.entities.properties.values.byTargetId[postId] ?? {},
    );

    const handleLoadValues = useCallback((targetId: string) => {
        dispatch(loadPostPropertyValues(targetId));
    }, [dispatch]);

    const handleChangeValue = useCallback((fieldId: string, value: unknown) => {
        dispatch(patchPostPropertyValues(postId, [{field_id: fieldId, value}]));
    }, [dispatch, postId]);

    if (!integratedBoardsEnabled) {
        return null;
    }

    return (
        <RhsPostPropertiesPanel
            postId={postId}
            channelId={channelId}
            fields={fields}
            valuesByFieldId={valuesByFieldId}
            loadPostPropertyValues={handleLoadValues}
            onChangeValue={handleChangeValue}
        />
    );
}
