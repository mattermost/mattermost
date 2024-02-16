// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import ChannelPermissionGate from './channel_permission_gate';

type Props = {
    channelId?: string;
    permissions: string[];
}

function mapStateToProps(state: GlobalState, ownProps: Props) {
    if (!ownProps.channelId) {
        return {hasPermission: false};
    }

    const channel = getChannel(state, ownProps.channelId);
    const teamId = channel?.team_id || getCurrentTeamId(state);

    for (const permission of ownProps.permissions) {
        if (haveIChannelPermission(state, teamId, ownProps.channelId, permission)) {
            return {hasPermission: true};
        }
    }

    return {hasPermission: false};
}

export default connect(mapStateToProps)(ChannelPermissionGate);
