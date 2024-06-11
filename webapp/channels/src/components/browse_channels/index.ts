// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Channel} from '@mattermost/types/channels';

import {getChannels, getArchivedChannels, joinChannel, getChannelsMemberCount, searchAllChannels} from 'mattermost-redux/actions/channels';
import {RequestStatus} from 'mattermost-redux/constants';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getChannelsInCurrentTeam, getMyChannelMemberships, getChannelsMemberCount as getChannelsMemberCountSelector} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeam, getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {setGlobalItem} from 'actions/storage';
import {openModal, closeModal} from 'actions/views/modals';
import {closeRightHandSide} from 'actions/views/rhs';
import {getIsRhsOpen, getRhsState} from 'selectors/rhs';
import {makeGetGlobalItem} from 'selectors/storage';

import Constants, {StoragePrefixes} from 'utils/constants';

import type {GlobalState} from 'types/store';

import BrowseChannels from './browse_channels';

const getChannelsWithoutArchived = createSelector(
    'getChannelsWithoutArchived',
    getChannelsInCurrentTeam,
    (channels: Channel[]) => channels && channels.filter((c) => c.delete_at === 0 && c.type !== Constants.PRIVATE_CHANNEL),
);

const getArchivedOtherChannels = createSelector(
    'getArchivedOtherChannels',
    getChannelsInCurrentTeam,
    (channels: Channel[]) => channels && channels.filter((c) => c.delete_at !== 0),
);

const getPrivateChannelsSelector = createSelector(
    'getPrivateChannelsSelector',
    getChannelsInCurrentTeam,
    (channels: Channel[]) => channels && channels.filter((c) => c.type === Constants.PRIVATE_CHANNEL),
);

function mapStateToProps(state: GlobalState) {
    const team = getCurrentTeam(state);
    const getGlobalItem = makeGetGlobalItem(StoragePrefixes.HIDE_JOINED_CHANNELS, 'false');

    return {
        channels: getChannelsWithoutArchived(state) || [],
        archivedChannels: getArchivedOtherChannels(state) || [],
        privateChannels: getPrivateChannelsSelector(state) || [],
        currentUserId: getCurrentUserId(state),
        teamId: getCurrentTeamId(state),
        teamName: team?.name,
        channelsRequestStarted: state.requests.channels.getChannels.status === RequestStatus.STARTED,
        canShowArchivedChannels: (getConfig(state).ExperimentalViewArchivedChannels === 'true'),
        myChannelMemberships: getMyChannelMemberships(state) || {},
        shouldHideJoinedChannels: getGlobalItem(state) === 'true',
        rhsState: getRhsState(state),
        rhsOpen: getIsRhsOpen(state),
        channelsMemberCount: getChannelsMemberCountSelector(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getChannels,
            getArchivedChannels,
            joinChannel,
            searchAllChannels,
            openModal,
            closeModal,
            setGlobalItem,
            closeRightHandSide,
            getChannelsMemberCount,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(BrowseChannels);
