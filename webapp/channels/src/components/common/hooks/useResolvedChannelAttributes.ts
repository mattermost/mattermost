// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';
import {makeGetResolvedChannelAttributes} from 'mattermost-redux/selectors/entities/properties';

import useChannelAttributes from './useChannelAttributes';

const EMPTY: ResolvedChannelAttribute[] = [];

/**
 * Every channel attribute paired with this channel's value, unset ones included —
 * the banner composer offers those as tokens, since a template is written once and
 * expected to keep working once a value is filled in.
 */
export default function useResolvedChannelAttributes(channelId: string): ResolvedChannelAttribute[] {
    const {enabled} = useChannelAttributes();
    const getResolvedChannelAttributes = useMemo(() => makeGetResolvedChannelAttributes(), []);
    const resolved = useSelector((state: GlobalState) => getResolvedChannelAttributes(state, channelId));

    return useMemo(() => {
        if (!enabled || !channelId) {
            return EMPTY;
        }
        return resolved;
    }, [enabled, channelId, resolved]);
}
