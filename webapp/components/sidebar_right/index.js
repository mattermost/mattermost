// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import SidebarRight from './sidebar_right.jsx';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps,
        postRightVisible: Boolean(state.views.rhs.selectedPostId),
        fromSearch: state.views.rhs.fromSearch,
        fromFlaggedPosts: state.views.rhs.fromFlaggedPosts,
        fromPinnedPosts: state.views.rhs.fromPinnedPosts
    };
}

export default connect(mapStateToProps)(SidebarRight);
