// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {removeUserFromTeam as leaveTeam} from 'mattermost-redux/actions/teams';
import {getMyChannels} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId, getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import type {GenericAction} from 'mattermost-redux/types/actions';

import {toggleSideBarRightMenuAction} from 'actions/global_actions';

import {Constants} from 'utils/constants';

import type {GlobalState} from 'types/store';

import LeaveTeamModal from './leave_team_modal';

function getNumOfPrivateChannels(state: GlobalState) {
    const channels = getMyChannels(state);

    return channels.filter((channel) => channel.type === Constants.PRIVATE_CHANNEL).length;
}

function getNumOfPublicChannels(state: GlobalState) {
    const channels = getMyChannels(state);

    return channels.filter((channel) => channel.type === Constants.OPEN_CHANNEL).length;
}

function mapStateToProps(state: GlobalState) {
    const currentUserId = getCurrentUserId(state);
    const currentTeamId = getCurrentTeamId(state);
    const currentUser = getCurrentUser(state);

    return {
        currentUserId,
        currentTeamId,
        currentUser,
        numOfPrivateChannels: getNumOfPrivateChannels(state),
        numOfPublicChannels: getNumOfPublicChannels(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            leaveTeam,
            toggleSideBarRightMenu: toggleSideBarRightMenuAction,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(LeaveTeamModal);
