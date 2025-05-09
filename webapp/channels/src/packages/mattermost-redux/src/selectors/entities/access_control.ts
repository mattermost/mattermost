// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel, ChannelWithTeamData, ChannelSearchOpts} from '@mattermost/types/channels';
import type {GlobalState} from '@mattermost/types/store';

import {filterChannelsMatchingTerm} from 'mattermost-redux/utils/channel_utils';

import {filterChannelList} from './channels';

import {createSelector} from '../create_selector';

export function getAccessControlPolicy(state: GlobalState, id: string) {
    return state.entities.admin.accessControlPolicies[id];
}

export const getChannelIdsForAccessControlPolicy = createSelector(
    'getChannelIdsForAccessControlPolicy',
    (state: GlobalState, parentId: string) => state.entities.admin.channelsForAccessControlPolicy[parentId],
    (channelIds) => (Array.isArray(channelIds) ? channelIds : []),
) as (state: GlobalState, parentId: string) => string[];

export function makeGetChannelsInAccessControlPolicy() {
    return (createSelector(
        'getChannelsInAccessControlPolicy',
        (state: GlobalState) => state.entities.channels.channels,
        (state: GlobalState, props: {policyId: string}) => getChannelIdsForAccessControlPolicy(state, props.policyId),
        (state: GlobalState) => state.entities.teams.teams,
        (channels, ids, teams) => {
            if (!ids) {
                return [];
            }

            const policyChannels: ChannelWithTeamData[] = [];

            ids.forEach((channelId) => {
                const channel = channels[channelId];
                if (channel) {
                    const team = teams[channel.team_id] || {};
                    policyChannels.push({
                        ...channel,
                        team_id: channel.team_id,
                        team_display_name: team.display_name || '',
                        team_name: team.name || '',
                        team_update_at: team.update_at || 0,
                    });
                }
            });

            return policyChannels;
        }) as (b: GlobalState, a: {
        policyId: string;
    }) => ChannelWithTeamData[]);
}

export function searchChannelsInheritsPolicy(state: GlobalState, policyId: string, term: string, filters: ChannelSearchOpts): Channel[] {
    const channelsInPolicy = makeGetChannelsInAccessControlPolicy();
    const channelArray = channelsInPolicy(state, {policyId});
    let channels = filterChannelList(channelArray, filters);
    channels = filterChannelsMatchingTerm(channels, term);

    return channels;
}
