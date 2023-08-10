// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {
    showMentions,
    showSearchResults,
    showFlaggedPosts,
    showPinnedPosts,
    closeRightHandSide,
    toggleRhsExpanded,
} from 'actions/views/rhs';
import {getIsRhsExpanded} from 'selectors/rhs';

import RhsCardHeader from './rhs_card_header';

import type {AnyAction, Dispatch} from 'redux';
import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    return {
        isExpanded: getIsRhsExpanded(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch<AnyAction>) {
    return {
        actions: bindActionCreators({
            showMentions,
            showSearchResults,
            showFlaggedPosts,
            showPinnedPosts,
            closeRightHandSide,
            toggleRhsExpanded,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(RhsCardHeader);
