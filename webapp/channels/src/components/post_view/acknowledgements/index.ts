// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {General} from 'mattermost-redux/constants';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getHasReactions, getPost, makeGetPostAcknowledgementsWithProfiles} from 'mattermost-redux/selectors/entities/posts';
import {isDmGmWriteDenied} from 'mattermost-redux/selectors/entities/render_permissions';

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

        // Acknowledging is writing in conversations only; channels keep their existing gate.
        const channelType = getChannel(state, getPost(state, ownProps.postId).channel_id)?.type;
        const writeDenied = (channelType === General.DM_CHANNEL || channelType === General.GM_CHANNEL) && isDmGmWriteDenied(state);

        return {
            currentUserId,
            hasReactions,
            list,
            writeDenied,
        };
    };
}

export default connect(makeMapStateToProps)(PostAcknowledgements);
