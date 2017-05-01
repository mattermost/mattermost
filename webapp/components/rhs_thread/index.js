// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {getPost, makeGetPostsForThread} from 'mattermost-redux/selectors/entities/posts';

import RhsThread from './rhs_thread.jsx';

function makeMapStateToProps() {
    const getPostsForThread = makeGetPostsForThread();

    return function mapStateToProps(state, ownProps) {
        const selected = getPost(state, state.views.rhs.selectedPostId);

        return {
            ...ownProps,
            selected,
            posts: getPostsForThread(state, {rootId: selected.id, channelId: selected.channel_id})
        };
    };
}

export default connect(makeMapStateToProps)(RhsThread);
