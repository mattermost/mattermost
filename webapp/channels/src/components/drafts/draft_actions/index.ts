// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {getUser} from 'mattermost-redux/selectors/entities/users';
import {getUserIdFromChannelName} from 'mattermost-redux/utils/channel_utils';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';

import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {Constants} from 'utils/constants';

import type {GlobalState} from 'types/store';

import DraftActions from './draft_actions';

type OwnProps = {
    channelDisplayName: Channel['display_name'];
    channelType: Channel['type'];
    channelName: Channel['name'];
    userId: string;
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const {channelDisplayName, userId, channelName, channelType} = ownProps;

    let displayName = channelDisplayName;
    let teammateId;
    let teammate;

    if (channelType === Constants.DM_CHANNEL) {
        teammateId = getUserIdFromChannelName(userId, channelName);
        teammate = getUser(state, teammateId);
        displayName = displayUsername(teammate, getTeammateNameDisplaySetting(state));
    }

    return {
        displayName,
    };
}

export default connect(mapStateToProps)(DraftActions);
