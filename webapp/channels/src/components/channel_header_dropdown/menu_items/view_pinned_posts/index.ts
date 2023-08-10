// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {closeRightHandSide, showPinnedPosts} from 'actions/views/rhs';
import {getRhsState} from 'selectors/rhs';

import {RHSStates} from 'utils/constants';

import ViewPinnedPosts from './view_pinned_posts';

import type {GenericAction} from 'mattermost-redux/types/actions';
import type {Dispatch} from 'redux';
import type {GlobalState} from 'types/store';

const mapStateToProps = (state: GlobalState) => ({
    hasPinnedPosts: getRhsState(state) === RHSStates.PIN,
});

const mapDispatchToProps = (dispatch: Dispatch<GenericAction>) => ({
    actions: bindActionCreators({
        closeRightHandSide,
        showPinnedPosts,
    }, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(ViewPinnedPosts);
