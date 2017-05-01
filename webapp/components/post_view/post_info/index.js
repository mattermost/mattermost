// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {removePost, addReaction} from 'mattermost-redux/actions/posts';

import {getBool} from 'mattermost-redux/selectors/entities/preferences';

import {Preferences} from 'mattermost-redux/constants';

import PostInfo from './post_info.jsx';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps,
        useMilitaryTime: getBool(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.USE_MILITARY_TIME, false),
        isFlagged: getBool(state, Preferences.CATEGORY_FLAGGED_POST, ownProps.post.id)
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            removePost,
            addReaction
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(PostInfo);
