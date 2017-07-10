// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {flagPost, unflagPost} from 'mattermost-redux/actions/posts';
import {pinPost, unpinPost} from 'actions/post_actions.jsx';

import DotMenu from './dot_menu.jsx';

function mapStateToProps(state, ownProps) {
    return ownProps;
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            flagPost,
            unflagPost,
            pinPost,
            unpinPost
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(DotMenu);

