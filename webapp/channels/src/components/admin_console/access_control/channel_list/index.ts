// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Channel, ChannelSearchOpts, ChannelWithTeamData} from '@mattermost/types/channels';

import { searchAccessControlPolicyChannels as searchChannels} from 'mattermost-redux/actions/access_control';
import {searchChannelsInheritsPolicy} from 'mattermost-redux/selectors/entities/access_control';
import {filterChannelList} from 'mattermost-redux/selectors/entities/channels';
import {getChannelsInAccessControlPolicy} from 'mattermost-redux/selectors/entities/access_control';
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
    const getPolicyChannels = getChannelsInAccessControlPolicy();
    return (state: GlobalState, ownProps: OwnProps) => {
        let {channelsToAdd} = ownProps;

        let channels: ChannelWithTeamData[] = [];
        let totalCount = 0;
        const policyId = ownProps.policyId;
        const searchTerm = state.views.search.channelListSearch.term || '';
        const filters = state.views.search.channelListSearch?.filters || {};

        if (searchTerm || (filters && Object.keys(filters).length !== 0)) {
            channels = policyId ? searchChannelsInheritsPolicy(state, policyId, searchTerm, filters) as ChannelWithTeamData[] : [];
            channelsToAdd = searchChannelsToAdd(channelsToAdd, searchTerm, filters) as Record<string, ChannelWithTeamData>;
            totalCount = channels.length;
        } else {
            channels = policyId ? getPolicyChannels(state, {policyId}) as ChannelWithTeamData[] : [];
            totalCount = channels.length;
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
            searchChannels,
            setChannelListSearch,
            setChannelListFilters,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ChannelList);
