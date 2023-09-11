// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {AnyAction, Dispatch} from 'redux';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/common';

import {
    closeRightHandSide,
    toggleRhsExpanded,
    goBack,
} from 'actions/views/rhs';
import {getIsRhsExpanded, getPreviousRhsState} from 'selectors/rhs';

import {RHSStates} from 'utils/constants';

import type {GlobalState} from 'types/store/index.js';

import SearchResultsHeader from './search_results_header';

function mapStateToProps(state: GlobalState) {
    const previousRhsState = getPreviousRhsState(state);
    const canGoBack = previousRhsState === RHSStates.CHANNEL_INFO ||
        previousRhsState === RHSStates.CHANNEL_MEMBERS ||
        previousRhsState === RHSStates.CHANNEL_FILES ||
        previousRhsState === RHSStates.PIN;

    return {
        isExpanded: getIsRhsExpanded(state),
        channelId: getCurrentChannelId(state),
        previousRhsState,
        canGoBack,
    };
}

function mapDispatchToProps(dispatch: Dispatch<AnyAction>) {
    return {
        actions: bindActionCreators({
            closeRightHandSide,
            toggleRhsExpanded,
            goBack,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(SearchResultsHeader);
