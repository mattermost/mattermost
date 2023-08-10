// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {removePost} from 'mattermost-redux/actions/posts';

import {createPost} from 'actions/post_actions';

import FailedPostOptions from './failed_post_options';

import type {GenericAction} from 'mattermost-redux/types/actions';
import type {Dispatch} from 'redux';

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            createPost,
            removePost,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(FailedPostOptions);
