// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';

import {getUser} from 'mattermost-redux/selectors/entities/users';
import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {Preferences} from 'mattermost-redux/constants';

import PostBody from './post_body.jsx';

function mapStateToProps(state, ownProps) {
    let parentPost;
    let parentPostUser;
    if (ownProps.post.root_id) {
        parentPost = getPost(state, ownProps.post.root_id);
        parentPostUser = getUser(state, parentPost.user_id);
    }

    return {
        ...ownProps,
        parentPost,
        parentPostUser,
        previewsCollapsed: get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.COLLAPSE_DISPLAY, 'false')
    };
}

export default connect(mapStateToProps)(PostBody);
