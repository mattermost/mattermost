// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {showFlaggedPosts, showPinnedPosts} from 'actions/views/rhs';

import PostPreHeader from './post_pre_header';

import type {Dispatch} from 'redux';

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        showFlaggedPosts,
        showPinnedPosts,
    }, dispatch),
});

export default connect(null, mapDispatchToProps)(PostPreHeader);
