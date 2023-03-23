// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, ActionCreatorsMapObject, Dispatch} from 'redux';

import {Action} from 'mattermost-redux/types/actions';

import {addReaction} from 'actions/post_actions';

import PostReaction, {Props} from './post_reaction';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, Props['actions']>({
            addReaction,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(PostReaction);
