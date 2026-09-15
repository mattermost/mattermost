// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {DISPLAY_LABEL_HEADER, DISPLAY_LABEL_INFO} from 'mattermost-redux/constants/properties';
import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';
import {makeGetResolvedChannelAttributes} from 'mattermost-redux/selectors/entities/properties';

import useChannelAttributes from './useChannelAttributes';

export type ChannelLabelSurface = 'header' | 'info';

const ACTION_BY_SURFACE: Record<ChannelLabelSurface, string> = {
    header: DISPLAY_LABEL_HEADER,
    info: DISPLAY_LABEL_INFO,
};

const EMPTY: ResolvedChannelAttribute[] = [];

/**
 * The attributes that should render as labels on a given surface for a channel,
 * in display order. An attribute designated for display but with no value on
 * this channel is omitted — a chip with nothing in it says nothing.
 *
 * Rendering is story 3; this exists so the data contract is defined and tested
 * alongside the assignment flow that produces the values.
 */
export default function useChannelLabels(channelId: string, surface: ChannelLabelSurface): ResolvedChannelAttribute[] {
    const {enabled} = useChannelAttributes();
    const getResolvedChannelAttributes = useMemo(() => makeGetResolvedChannelAttributes(), []);
    const resolved = useSelector((state: GlobalState) => getResolvedChannelAttributes(state, channelId));

    return useMemo(() => {
        if (!enabled || !channelId) {
            return EMPTY;
        }
        const action = ACTION_BY_SURFACE[surface];
        const labels = resolved.filter((attribute) => {
            if (!attribute.displayValue) {
                return false;
            }
            const actions = attribute.field.attrs?.actions;
            return Array.isArray(actions) && actions.includes(action);
        });
        return labels.length === 0 ? EMPTY : labels;
    }, [enabled, channelId, resolved, surface]);
}
