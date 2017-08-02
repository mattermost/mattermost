// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';

import CreateComment from './create_comment.jsx';

function mapStateToProps(state, ownProps) {
    const err = state.requests.posts.createPost.error || {};
    return {
        ...ownProps,
        createPostErrorId: err.server_error_id
    };
}

export default connect(mapStateToProps)(CreateComment);
