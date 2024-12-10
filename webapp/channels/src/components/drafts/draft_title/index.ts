// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {makeGetGmChannelMemberCount} from 'mattermost-redux/selectors/entities/channels';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {getUserIdFromChannelName} from 'mattermost-redux/utils/channel_utils';

import {Constants} from 'utils/constants';

import type {GlobalState} from 'types/store';

import DraftTitle from './draft_title';

type OwnProps = {
    channel: Channel;
    userId: string;
};

function makeMapStateToProps() {
    const getMemberCount = makeGetGmChannelMemberCount();
    return (state: GlobalState, ownProps: OwnProps) => {
        const {channel, userId} = ownProps;

        let teammateId;
        let teammate;
        let membersCount;

        if (channel.type === Constants.GM_CHANNEL) {
            membersCount = getMemberCount(state, channel);
        }

        if (channel.type === Constants.DM_CHANNEL) {
            teammateId = getUserIdFromChannelName(userId, channel.name);
            teammate = getUser(state, teammateId);
        }

        return {
            channel,
            membersCount,
            selfDraft: teammateId === userId,
            teammate,
            teammateId,
        };
    };
}

export default connect(makeMapStateToProps)(DraftTitle);
