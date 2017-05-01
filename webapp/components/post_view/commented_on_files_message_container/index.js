// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {getFileInfosForPost} from 'mattermost-redux/actions/posts';

import * as Selectors from 'mattermost-redux/selectors/entities/posts';

import CommentedOnFilesMessageContainer from './commented_on_files_message_container.jsx';

function mapStateToProps(state, ownProps) {
    let fileInfos;
    if (ownProps.posts.commentedOnPost) {
        fileInfos = Selectors.getFileInfosForPost(state, ownProps.posts.commentedOnPost.id);
    }

    return {
        ...ownProps,
        fileInfos
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            getFileInfosForPost
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(CommentedOnFilesMessageContainer);
