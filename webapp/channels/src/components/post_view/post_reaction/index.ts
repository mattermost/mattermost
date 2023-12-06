// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import {toggleReaction} from 'actions/post_actions';

import PostReaction from './post_reaction';
import type {Props} from './post_reaction';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject, Props['actions']>({
            toggleReaction,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(PostReaction);
