// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';
import {makeGetResolvedChannelAttributes} from 'mattermost-redux/selectors/entities/properties';
import {isPropertyFieldRequired, isPropertyValueSet} from 'mattermost-redux/utils/property_utils';

import useChannelAttributes from './useChannelAttributes';
import useIsChannelAttributeAdmin from './useIsChannelAttributeAdmin';

const EMPTY: ResolvedChannelAttribute[] = [];

// Split from the hook so a caller holding the resolved list avoids mounting a
// second useChannelAttributes, which would fire a duplicate fetch.
export function selectChannelInfoAttributes(resolved: ResolvedChannelAttribute[], isChannelAdmin: boolean): ResolvedChannelAttribute[] {
    const listed = resolved.filter((attribute) => {
        // The stored value, not the rendered one -- the same check the rows use.
        // A value that renders as nothing is still a value, and Add Attribute
        // won't offer it back, so a row here is the only way to reach it.
        if (isPropertyValueSet(attribute.value?.value)) {
            return true;
        }
        return isChannelAdmin && isPropertyFieldRequired(attribute.field);
    });

    return listed.length === 0 ? EMPTY : listed;
}

/**
 * Channel Info lists attributes by role, not by display configuration. An admin
 * sees every attribute the channel holds plus every required one still unset --
 * that empty row is the only thing telling them the channel is incomplete, and
 * this panel is the only place a value can be edited, so a display setting must
 * not be able to strand one. A member sees what the channel actually holds.
 *
 * Optional unset attributes are reached through Add Attribute instead.
 */
export default function useChannelInfoAttributes(channelId: string): ResolvedChannelAttribute[] {
    const {enabled} = useChannelAttributes();
    const getResolvedChannelAttributes = useMemo(() => makeGetResolvedChannelAttributes(), []);
    const resolved = useSelector((state: GlobalState) => getResolvedChannelAttributes(state, channelId));
    const isChannelAdmin = useIsChannelAttributeAdmin(channelId);

    return useMemo(() => {
        if (!enabled || !channelId) {
            return EMPTY;
        }
        return selectChannelInfoAttributes(resolved, isChannelAdmin);
    }, [enabled, channelId, resolved, isChannelAdmin]);
}
