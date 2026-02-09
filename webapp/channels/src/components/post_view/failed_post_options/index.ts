// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {removePost} from 'mattermost-redux/actions/posts';

import {runMessageWillBePostedHooks} from 'actions/hooks';
import {createPost} from 'actions/post_actions';

import FailedPostOptions from './failed_post_options';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            createPost,
            removePost,
            runMessageWillBePostedHooks,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(FailedPostOptions);
