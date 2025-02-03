// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Channel, ChannelSearchOpts, ChannelWithTeamData} from '@mattermost/types/channels';
import type {DataRetentionCustomPolicy} from '@mattermost/types/data_retention';

import {getDataRetentionCustomPolicyChannels, searchDataRetentionCustomPolicyChannels as searchChannels} from 'mattermost-redux/actions/admin';
import {getDataRetentionCustomPolicy} from 'mattermost-redux/selectors/entities/admin';
import {filterChannelList, getChannelsInPolicy, searchChannelsInPolicy} from 'mattermost-redux/selectors/entities/channels';
import {filterChannelsMatchingTerm, channelListToMap} from 'mattermost-redux/utils/channel_utils';

import {setChannelListSearch, setChannelListFilters} from 'actions/views/search';

import type {GlobalState} from 'types/store';

import ChannelList from './channel_list';

type OwnProps = {
    policyId?: string;
    channelsToAdd: Record<string, ChannelWithTeamData>;
}

function searchChannelsToAdd(channels: Record<string, Channel>, term: string, filters: ChannelSearchOpts): Record<string, Channel> {
    let filteredTeams = filterChannelsMatchingTerm(Object.keys(channels).map((key) => channels[key]), term);
    filteredTeams = filterChannelList(filteredTeams, filters);
    return channelListToMap(filteredTeams);
}

function mapStateToProps() {
    const getPolicyChannels = getChannelsInPolicy();
    return (state: GlobalState, ownProps: OwnProps) => {
        let {channelsToAdd} = ownProps;

        let channels: ChannelWithTeamData[] = [];
        let totalCount = 0;
        const policyId = ownProps.policyId;
        const policy = policyId ? getDataRetentionCustomPolicy(state, policyId) : {} as DataRetentionCustomPolicy;
        const searchTerm = state.views.search.channelListSearch.term || '';
        const filters = state.views.search.channelListSearch?.filters || {};

        if (searchTerm || (filters && Object.keys(filters).length !== 0)) {
            channels = policyId ? searchChannelsInPolicy(state, policyId, searchTerm, filters) as ChannelWithTeamData[] : [];
            channelsToAdd = searchChannelsToAdd(channelsToAdd, searchTerm, filters) as Record<string, ChannelWithTeamData>;
            totalCount = channels.length;
        } else {
            channels = policyId ? getPolicyChannels(state, {policyId}) as ChannelWithTeamData[] : [];
            if (policy?.channel_count) {
                totalCount = policy.channel_count;
            }
        }
        return {
            channels,
            totalCount,
            searchTerm,
            channelsToAdd,
            filters,
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getDataRetentionCustomPolicyChannels,
            searchChannels,
            setChannelListSearch,
            setChannelListFilters,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ChannelList);
