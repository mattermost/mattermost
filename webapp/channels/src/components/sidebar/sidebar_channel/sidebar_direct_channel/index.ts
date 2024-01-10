// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Channel} from '@mattermost/types/channels';
import type {GlobalState} from '@mattermost/types/store';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getCurrentChannelId, getRedirectChannelNameForTeam} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUser, getUser} from 'mattermost-redux/selectors/entities/users';

import {leaveDirectChannel} from 'actions/views/channel';

import SidebarDirectChannel from './sidebar_direct_channel';

type OwnProps = {
    channel: Channel;
    currentTeamName: string;
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const teammate = getUser(state, ownProps.channel.teammate_id!);
    const currentUser = getCurrentUser(state);
    const currentTeam = getCurrentTeam(state);
    const redirectChannel = getRedirectChannelNameForTeam(state, currentTeam.id);
    const currentChannelId = getCurrentChannelId(state);
    const active = ownProps.channel.id === currentChannelId;

    return {
        teammate,
        currentUserId: currentUser.id,
        redirectChannel,
        active,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            savePreferences,
            leaveDirectChannel,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(SidebarDirectChannel);
