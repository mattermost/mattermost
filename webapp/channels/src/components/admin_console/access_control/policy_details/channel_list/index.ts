// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Channel, ChannelSearchOpts, ChannelWithTeamData} from '@mattermost/types/channels';

import {searchAccessControlPolicyChannels as searchChannels} from 'mattermost-redux/actions/access_control';
import {searchChannelsInheritsPolicy, makeGetChannelsInAccessControlPolicy} from 'mattermost-redux/selectors/entities/access_control';
import {filterChannelList} from 'mattermost-redux/selectors/entities/channels';
import {filterChannelsMatchingTerm, channelListToMap} from 'mattermost-redux/utils/channel_utils';

import {setChannelListSearch, setChannelListFilters} from 'actions/views/search';

import type {GlobalState} from 'types/store';

import ChannelList from './channel_list';

type OwnProps = {
    policyId?: string;
    channelsToAdd: Record<string, ChannelWithTeamData>;
}

function searchChannelsToAdd(channels: Record<string, Channel>, term: string, filters: ChannelSearchOpts): Record<string, Channel> {
    const filteredChannels = filterChannelsMatchingTerm(Object.values(channels), term);
    const filteredWithFilters = filterChannelList(filteredChannels, filters);
    return channelListToMap(filteredWithFilters);
}

function mapStateToProps() {
    const getPolicyChannels = makeGetChannelsInAccessControlPolicy();
    return (state: GlobalState, ownProps: OwnProps) => {
        const {channelsToAdd, policyId} = ownProps;
        const searchTerm = state.views.search.channelListSearch.term || '';
        const filters = state.views.search.channelListSearch?.filters || {};

        let channels: ChannelWithTeamData[] = [];
        let totalCount = 0;

        if (searchTerm || Object.keys(filters).length !== 0) {
            channels = policyId ? searchChannelsInheritsPolicy(state, policyId, searchTerm, filters) as ChannelWithTeamData[] : [];
            const filteredChannelsToAdd = searchChannelsToAdd(channelsToAdd, searchTerm, filters) as Record<string, ChannelWithTeamData>;
            totalCount = channels.length;
            return {
                channels,
                totalCount,
                searchTerm,
                channelsToAdd: filteredChannelsToAdd,
                filters,
            };
        }

        channels = policyId ? getPolicyChannels(state, {policyId}) as ChannelWithTeamData[] : [];
        totalCount = channels.length;

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
            searchChannels,
            setChannelListSearch,
            setChannelListFilters,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ChannelList);
