// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';

import {DISPLAY_LABEL_HEADER, DISPLAY_LABEL_INFO} from 'mattermost-redux/constants/properties';
import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';

import useResolvedChannelAttributes from './useResolvedChannelAttributes';

export const ChannelLabelSurface = {
    HEADER: 'header',
    INFO: 'info',
} as const;

export type ChannelLabelSurface = (typeof ChannelLabelSurface)[keyof typeof ChannelLabelSurface];

const ACTION_BY_SURFACE: Record<ChannelLabelSurface, string> = {
    [ChannelLabelSurface.HEADER]: DISPLAY_LABEL_HEADER,
    [ChannelLabelSurface.INFO]: DISPLAY_LABEL_INFO,
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
export default function useChannelLabels(
    channelId: string,
    surface: ChannelLabelSurface | ChannelLabelSurface[],
): ResolvedChannelAttribute[] {
    const resolved = useResolvedChannelAttributes(channelId);

    // Join so an inline `['info', 'header']` from a class parent is a stable dep.
    const surfacesKey = Array.isArray(surface) ? surface.join(',') : surface;

    return useMemo(() => {
        if (resolved.length === 0) {
            return EMPTY;
        }
        const actions = new Set(
            (surfacesKey.split(',') as ChannelLabelSurface[]).map((requested) => ACTION_BY_SURFACE[requested]),
        );
        const labels = resolved.filter((attribute) => {
            if (!attribute.displayValue) {
                return false;
            }
            const fieldActions = attribute.field.attrs?.actions;
            return Array.isArray(fieldActions) && fieldActions.some((action) => actions.has(action));
        });
        return labels.length === 0 ? EMPTY : labels;
    }, [resolved, surfacesKey]);
}
