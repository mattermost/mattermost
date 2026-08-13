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

/**
 * The attributes Channel Info should list for a channel, in display order.
 *
 * Deliberately a wider set than useChannelLabels returns for the 'info' surface:
 * a required attribute is listed even with no value, because an empty required
 * row is the only thing that tells a channel admin the channel is incomplete and
 * gives them somewhere to fix it. Optional unset attributes stay hidden — they
 * are reached through Add Attribute instead, so the section doesn't fill with
 * empty rows for every attribute the server happens to define.
 */
export default function useChannelInfoAttributes(channelId: string): ResolvedChannelAttribute[] {
    const {enabled} = useChannelAttributes();
    const getResolvedChannelAttributes = useMemo(() => makeGetResolvedChannelAttributes(), []);
    const resolved = useSelector((state: GlobalState) => getResolvedChannelAttributes(state, channelId));

    return useMemo(() => {
        if (!enabled || !channelId) {
            return EMPTY;
        }

        const listed = resolved.filter((attribute) => {
            const actions = attribute.field.attrs?.actions;
            if (!Array.isArray(actions) || !actions.includes(DISPLAY_LABEL_INFO)) {
                return false;
            }
            return Boolean(attribute.displayValue) || isPropertyFieldRequired(attribute.field);
        });

        return listed.length === 0 ? EMPTY : listed;
    }, [enabled, channelId, resolved]);
}
