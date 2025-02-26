// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Channel} from '@mattermost/types/channels';
import type {GlobalState} from '@mattermost/types/store';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getCurrentChannelId, getRedirectChannelNameForTeam, makeGetGmChannelMemberCount} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import SidebarGroupChannel from './sidebar_group_channel';

type OwnProps = {
    channel: Channel;
}

function makeMapStateToProps() {
    const getMemberCount = makeGetGmChannelMemberCount();

    return (state: GlobalState, ownProps: OwnProps) => {
        const currentUserId = getCurrentUserId(state);
        const currentTeam = getCurrentTeam(state);
        const redirectChannel = currentTeam ? getRedirectChannelNameForTeam(state, currentTeam.id) : '';
        const currentChannelId = getCurrentChannelId(state);
        const membersCount = getMemberCount(state, ownProps.channel);
        const active = ownProps.channel.id === currentChannelId;

        return {
            currentUserId,
            redirectChannel,
            active,
            membersCount,
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            savePreferences,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(SidebarGroupChannel);
