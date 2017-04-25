// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {viewChannel} from 'mattermost-redux/actions/channels';

import PostViewCache from './post_view_cache.jsx';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            viewChannel
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(PostViewCache);
