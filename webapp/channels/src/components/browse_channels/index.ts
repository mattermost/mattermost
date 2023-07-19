// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {RequestStatus} from 'mattermost-redux/constants';
import {Channel} from '@mattermost/types/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {Action, ActionResult} from 'mattermost-redux/types/actions';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getChannels, getArchivedChannels, joinChannel, getChannelsMemberCount} from 'mattermost-redux/actions/channels';
import {getChannelsInCurrentTeam, getMyChannelMemberships, getChannelsMemberCount as getChannelsMemberCountSelector} from 'mattermost-redux/selectors/entities/channels';

import {searchMoreChannels} from 'actions/channel_actions';
import {openModal, closeModal} from 'actions/views/modals';
import {closeRightHandSide} from 'actions/views/rhs';

import {getIsRhsOpen, getRhsState} from 'selectors/rhs';

import {ModalData} from 'types/actions';
import {GlobalState} from 'types/store';

import BrowseChannels from './browse_channels';
import {makeGetGlobalItem} from 'selectors/storage';
import Constants, {StoragePrefixes} from 'utils/constants';
import {setGlobalItem} from 'actions/storage';

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
    const team = getCurrentTeam(state) || {};
    const getGlobalItem = makeGetGlobalItem(StoragePrefixes.HIDE_JOINED_CHANNELS, 'false');

    return {
        channels: getChannelsWithoutArchived(state) || [],
        archivedChannels: getArchivedOtherChannels(state) || [],
        privateChannels: getPrivateChannelsSelector(state) || [],
        currentUserId: getCurrentUserId(state),
        teamId: team.id,
        teamName: team.name,
        channelsRequestStarted: state.requests.channels.getChannels.status === RequestStatus.STARTED,
        canShowArchivedChannels: (getConfig(state).ExperimentalViewArchivedChannels === 'true'),
        myChannelMemberships: getMyChannelMemberships(state) || {},
        shouldHideJoinedChannels: getGlobalItem(state) === 'true',
        rhsState: getRhsState(state),
        rhsOpen: getIsRhsOpen(state),
        channelsMemberCount: getChannelsMemberCountSelector(state),
    };
}

type Actions = {
    getChannels: (teamId: string, page: number, perPage: number) => Promise<ActionResult<Channel[], Error>>;
    getArchivedChannels: (teamId: string, page: number, channelsPerPage: number) => Promise<ActionResult<Channel[], Error>>;
    getPrivateChannels: (teamId: string, page: number, channelsPerPage: number) => Promise<ActionResult<Channel[], Error>>;
    joinChannel: (currentUserId: string, teamId: string, channelId: string) => Promise<ActionResult>;
    searchMoreChannels: (term: string, shouldShowArchivedChannels: boolean) => Promise<ActionResult>;
    openModal: <P>(modalData: ModalData<P>) => void;
    closeModal: (modalId: string) => void;
    setGlobalItem: (name: string, value: string) => void;
    closeRightHandSide: () => void;
    getChannelsMemberCount: (channelIds: string[]) => Promise<ActionResult>;
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, Actions>({
            getChannels,
            getArchivedChannels,
            joinChannel,
            searchMoreChannels,
            openModal,
            closeModal,
            setGlobalItem,
            closeRightHandSide,
            getChannelsMemberCount,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(BrowseChannels);
