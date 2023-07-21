// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Channel} from '@mattermost/types/channels';
import {PreferenceType} from '@mattermost/types/preferences';
import {GlobalState} from '@mattermost/types/store';
import {connect} from 'react-redux';
import {bindActionCreators, Dispatch, ActionCreatorsMapObject} from 'redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getCurrentChannelId, getRedirectChannelNameForTeam, makeGetGmChannelMemberCount} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {ActionFunc} from 'mattermost-redux/types/actions';

import SidebarGroupChannel from './sidebar_group_channel';

type OwnProps = {
    channel: Channel;
}

function makeMapStateToProps() {
    const getMemberCount = makeGetGmChannelMemberCount();

    return (state: GlobalState, ownProps: OwnProps) => {
        const currentUserId = getCurrentUserId(state);
        const currentTeam = getCurrentTeam(state);
        const redirectChannel = getRedirectChannelNameForTeam(state, currentTeam.id);
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

type Actions = {
    savePreferences: (userId: string, preferences: PreferenceType[]) => Promise<{
        data: boolean;
    }>;
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            savePreferences,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(SidebarGroupChannel);
