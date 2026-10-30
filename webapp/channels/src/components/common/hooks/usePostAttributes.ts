// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {
    makeGetPostAttributeFields,
    makeGetPropertyValuesForTarget,
} from 'mattermost-redux/selectors/entities/properties';

import type {GlobalState} from 'types/store';

export function usePostAttributeFields(channel?: Channel): PropertyField[] {
    const getFields = useMemo(() => makeGetPostAttributeFields(), []);

    const channelId = channel?.id ?? '';

    return useSelector((state: GlobalState) => getFields(state, channelId));
}

export function usePostAttributeValues(postId: string): Array<PropertyValue<unknown>> {
    const getValues = useMemo(() => makeGetPropertyValuesForTarget(), []);

    return useSelector((state: GlobalState) => getValues(state, postId));
}
