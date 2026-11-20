// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getHasReactions, getPost, makeGetPostAcknowledgementsWithProfiles} from 'mattermost-redux/selectors/entities/posts';
import {isChannelWriteDenied} from 'mattermost-redux/selectors/entities/roles';

import type {GlobalState} from 'types/store';

import PostAcknowledgements from './post_acknowledgements';

type OwnProps = {
    postId: Post['id'];
};

function makeMapStateToProps() {
    const getPostAcknowledgementsWithProfiles = makeGetPostAcknowledgementsWithProfiles();

    return (state: GlobalState, ownProps: OwnProps) => {
        const currentUserId = getCurrentUserId(state);
        const hasReactions = getHasReactions(state, ownProps.postId);
        const list = getPostAcknowledgementsWithProfiles(state, ownProps.postId);
        const channelId = getPost(state, ownProps.postId)?.channel_id;

        return {
            currentUserId,
            hasReactions,
            list,

            // Acknowledging is shown to every member, so the channel's write rules govern it.
            isWriteDenied: Boolean(channelId) && isChannelWriteDenied(state, channelId),
        };
    };
}

export default connect(makeMapStateToProps)(PostAcknowledgements);
