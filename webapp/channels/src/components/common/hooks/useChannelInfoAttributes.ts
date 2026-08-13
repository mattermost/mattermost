// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {DISPLAY_LABEL_INFO} from 'mattermost-redux/constants/properties';
import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';
import {makeGetResolvedChannelAttributes} from 'mattermost-redux/selectors/entities/properties';
import {isPropertyFieldRequired} from 'mattermost-redux/utils/property_utils';

import useChannelAttributes from './useChannelAttributes';

const EMPTY: ResolvedChannelAttribute[] = [];

// Split from the hook so a caller holding the resolved list avoids mounting a
// second useChannelAttributes, which would fire a duplicate fetch.
export function selectChannelInfoAttributes(resolved: ResolvedChannelAttribute[]): ResolvedChannelAttribute[] {
    const listed = resolved.filter((attribute) => {
        const actions = attribute.field.attrs?.actions;
        if (!Array.isArray(actions) || !actions.includes(DISPLAY_LABEL_INFO)) {
            return false;
        }
        return Boolean(attribute.displayValue) || isPropertyFieldRequired(attribute.field);
    });

    return listed.length === 0 ? EMPTY : listed;
}

/**
 * Wider than useChannelLabels' 'info' surface: a required attribute is listed even
 * unset, because that empty row is the only thing telling an admin the channel is
 * incomplete. Optional unset ones are reached through Add Attribute instead.
 */
export default function useChannelInfoAttributes(channelId: string): ResolvedChannelAttribute[] {
    const {enabled} = useChannelAttributes();
    const getResolvedChannelAttributes = useMemo(() => makeGetResolvedChannelAttributes(), []);
    const resolved = useSelector((state: GlobalState) => getResolvedChannelAttributes(state, channelId));

    return useMemo(() => {
        if (!enabled || !channelId) {
            return EMPTY;
        }
        return selectChannelInfoAttributes(resolved);
    }, [enabled, channelId, resolved]);
}
