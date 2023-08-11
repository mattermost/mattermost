// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Dispatch} from 'redux';

import {getChannelIdsForCurrentTeam} from 'mattermost-redux/selectors/entities/channels';

import {trackEvent} from 'actions/telemetry_actions';

import type {GlobalState} from 'types/store';

let isFirstPreload = true;

export function trackPreloadedChannels(prefetchQueueObj: Record<string, string[]>) {
    return (dispatch: Dispatch, getState: () => GlobalState) => {
        const state = getState();
        const channelIdsForTeam = getChannelIdsForCurrentTeam(state);

        trackEvent('performance', 'preloaded_channels', {
            numHigh: prefetchQueueObj[1]?.length || 0,
            numMedium: prefetchQueueObj[2]?.length || 0,
            numLow: prefetchQueueObj[3]?.length || 0,

            numTotal: channelIdsForTeam.length,

            // Tracks whether this is the first team that we've preloaded channels for in this session since
            // the first preload will likely include DMs and GMs
            isFirstPreload,
        });

        isFirstPreload = false;
    };
}
