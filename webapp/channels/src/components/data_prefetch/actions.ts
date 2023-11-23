// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Dispatch} from 'redux';

import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import {getChannelIdsForCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {isChannelMuted} from 'mattermost-redux/utils/channel_utils';
import {memoizeResult} from 'mattermost-redux/utils/helpers';

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

enum Priority {
    high = 1,
    medium,
    low
}

enum PrefetchLimits {
    mentionMax = 10,
    unreadMax = 20,
}

// function to return a queue obj with priotiy as key and array of channelIds as values.
// high priority has channels with mentions
// medium priority has channels with unreads
// <10 unread channels. Prefetch everything.
// 10-20 unread. Prefetch only mentions, capped to 10.
// >20 unread. Don't prefetch anything.
export const prefetchQueue = memoizeResult((
    unreadChannels: Channel[],
    memberships: RelationOneToOne<Channel, ChannelMembership>,
    collapsedThreads: boolean,
) => {
    const unreadChannelsCount = unreadChannels.length;
    let result: {
        1: string[];
        2: string[];
        3: string[];
    } = {
        [Priority.high]: [], // 1 being high priority requests
        [Priority.medium]: [],
        [Priority.low]: [], //TODO: add chanenls such as fav.
    };
    if (!unreadChannelsCount || unreadChannelsCount > PrefetchLimits.unreadMax) {
        return result;
    }
    for (const channel of unreadChannels) {
        const channelId = channel.id;
        const membership = memberships[channelId];

        if (unreadChannelsCount >= PrefetchLimits.mentionMax && result[Priority.high].length >= PrefetchLimits.mentionMax) {
            break;
        }

        // TODO We check for muted channels 3 times here: getUnreadChannels checks it, this checks it, and the mark_unread
        // check below is equivalent to checking if its muted.
        if (membership && !isChannelMuted(membership)) {
            if (collapsedThreads ? membership.mention_count_root : membership.mention_count) {
                result = {
                    ...result,
                    [Priority.high]: [...result[Priority.high], channelId],
                };
            } else if (
                membership.notify_props &&
                membership.notify_props.mark_unread !== 'mention' &&
                unreadChannelsCount < PrefetchLimits.mentionMax
            ) {
                result = {
                    ...result,
                    [Priority.medium]: [...result[Priority.medium], channelId],
                };
            }
        }
    }
    return result;
});
