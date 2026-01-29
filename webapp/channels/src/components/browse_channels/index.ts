// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Channel} from '@mattermost/types/channels';
import type {UsersState} from '@mattermost/types/users';

import {getChannels, getArchivedChannels, joinChannel, getChannelsMemberCount, searchAllChannels, getChannelMembers} from 'mattermost-redux/actions/channels';
import {RequestStatus, General} from 'mattermost-redux/constants';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getChannelsInCurrentTeam, getMyChannelMemberships, getChannelsMemberCount as getChannelsMemberCountSelector, getAllChannels, getDirectChannelsSet, getChannelMembersInChannels} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam, getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId, getUsers} from 'mattermost-redux/selectors/entities/users';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {completeDirectChannelInfo} from 'mattermost-redux/utils/channel_utils';

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

const getDirectMessageChannels = createSelector(
    'getDirectMessageChannels',
    getAllChannels,
    getDirectChannelsSet,
    (state: GlobalState): UsersState => state.entities.users,
    getTeammateNameDisplaySetting,
    (channels, channelSet: Set<string>, users: UsersState, teammateNameDisplay: string): Channel[] => {
        const dmChannels: Channel[] = [];
        channelSet.forEach((id) => {
            const channel = channels[id];
            if (channel && channel.type === General.DM_CHANNEL) {
                dmChannels.push(completeDirectChannelInfo(users, teammateNameDisplay, channel));
            }
        });
        return dmChannels;
    },
);

function mapStateToProps(state: GlobalState) {
    const team = getCurrentTeam(state);
    const getGlobalItem = makeGetGlobalItem(StoragePrefixes.HIDE_JOINED_CHANNELS, 'false');

    return {
        channels: getChannelsWithoutArchived(state) || [],
        archivedChannels: getArchivedOtherChannels(state) || [],
        privateChannels: getPrivateChannelsSelector(state) || [],
        directMessageChannels: getDirectMessageChannels(state) || [],
        currentUserId: getCurrentUserId(state),
        teamId: getCurrentTeamId(state),
        teamName: team?.name,
        channelsRequestStarted: state.requests.channels.getChannels.status === RequestStatus.STARTED,
        myChannelMemberships: getMyChannelMemberships(state) || {},
        shouldHideJoinedChannels: getGlobalItem(state) === 'true',
        rhsState: getRhsState(state),
        rhsOpen: getIsRhsOpen(state),
        channelsMemberCount: getChannelsMemberCountSelector(state),
        channelMembers: getChannelMembersInChannels(state)
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
            getChannelMembers,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(BrowseChannels);
