// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {toggleReaction} from 'actions/post_actions';

import PostReaction from './post_reaction';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            toggleReaction,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(PostReaction);
