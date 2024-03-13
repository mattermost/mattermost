// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import {selectPostFromRightHandSideSearchByPostId} from 'actions/views/rhs';

import type {GlobalState} from 'types/store/index.js';

import AdvancedCreatePost from './advanced_create_post';

function makeMapStateToProps() {
    return (state: GlobalState) => {
        const currentChannel = getCurrentChannel(state) || {};

        return {
            currentChannel,
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            selectPostFromRightHandSideSearchByPostId,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(AdvancedCreatePost);
