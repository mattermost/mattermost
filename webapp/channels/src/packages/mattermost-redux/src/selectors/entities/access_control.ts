// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import { AccessControlPolicy } from "@mattermost/types/admin";
import { createSelector } from '../create_selector';
import { filterChannelList } from './channels';
import { filterChannelsMatchingTerm } from 'mattermost-redux/utils/channel_utils';
import { Channel, ChannelWithTeamData, ChannelSearchOpts } from '@mattermost/types/channels';

export function getAccessControlPolicies(state: GlobalState): AccessControlPolicy[] {
    return Array.isArray(state.entities.admin.accessControlPolicies) 
        ? state.entities.admin.accessControlPolicies 
        : [];
}

export function getAccessControlPolicy(state: GlobalState, id: string): AccessControlPolicy | undefined | null {
    const policies = getAccessControlPolicies(state);
    return policies.find((policy) => policy.id === id) || null;
}

export function getChannelIdsForAccessControlPolicy(state: GlobalState, parentId: string): string[] {
    return Array.isArray(state.entities.admin.channelsForAccessControlPolicy[parentId]) 
        ? state.entities.admin.channelsForAccessControlPolicy[parentId]
        : [];
}

export function getAllChildAccessControlPolicies(state: GlobalState) {
    return state.entities.admin.channelsForAccessControlPolicy;
}

export function getChannelsInAccessControlPolicy() {
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
    const channelsInPolicy = getChannelsInAccessControlPolicy();
    const channelArray = channelsInPolicy(state, {policyId});
    let channels = filterChannelList(channelArray, filters);
    channels = filterChannelsMatchingTerm(channels, term);

    return channels;
}
