// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import type {Action} from 'mattermost-redux/types/actions';

import {flagPost, unflagPost} from 'actions/post_actions';

import PostFlagIcon from './post_flag_icon';
import type {Actions} from './post_flag_icon';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, Actions>({
            flagPost,
            unflagPost,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(PostFlagIcon);
