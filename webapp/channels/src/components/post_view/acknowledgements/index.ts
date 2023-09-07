// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getHasReactions, makeGetPostAcknowledgementsWithProfiles} from 'mattermost-redux/selectors/entities/posts';

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

        return {
            currentUserId,
            hasReactions,
            list,
        };
    };
}

export default connect(makeMapStateToProps)(PostAcknowledgements);
