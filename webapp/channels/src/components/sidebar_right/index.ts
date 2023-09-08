// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {withRouter, RouteComponentProps} from 'react-router-dom';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {setRhsExpanded, showChannelInfo, showPinnedPosts, showChannelFiles, openRHSSearch, closeRightHandSide, openAtPrevious, updateSearchTerms} from 'actions/views/rhs';
import {
    getIsRhsExpanded,
    getIsRhsOpen,
    getRhsState,
    getSelectedChannel,
    getSelectedPostId,
    getSelectedPostCardId,
    getPreviousRhsState,
} from 'selectors/rhs';
import {RHSStates} from 'utils/constants';

import {GlobalState} from 'types/store';

import {selectCurrentProductId} from 'selectors/products';

import SidebarRight from './sidebar_right';

function mapStateToProps(state: GlobalState, props: RouteComponentProps) {
    const rhsState = getRhsState(state);
    const channel = getCurrentChannel(state);
    const team = getCurrentTeam(state);
    const teamId = team?.id ?? '';
    const productId = selectCurrentProductId(state, props.location.pathname);

    const selectedPostId = getSelectedPostId(state);
    const selectedPostCardId = getSelectedPostCardId(state);

    return {
        isExpanded: getIsRhsExpanded(state),
        isOpen: getIsRhsOpen(state),
        channel,
        postRightVisible: Boolean(selectedPostId) && rhsState !== RHSStates.EDIT_HISTORY,
        postCardVisible: Boolean(selectedPostCardId),
        searchVisible: Boolean(rhsState) && rhsState !== RHSStates.PLUGIN,
        previousRhsState: getPreviousRhsState(state),
        isPinnedPosts: rhsState === RHSStates.PIN,
        isChannelFiles: rhsState === RHSStates.CHANNEL_FILES,
        isChannelInfo: rhsState === RHSStates.CHANNEL_INFO,
        isChannelMembers: rhsState === RHSStates.CHANNEL_MEMBERS,
        isPluginView: rhsState === RHSStates.PLUGIN,
        isPostEditHistory: rhsState === RHSStates.EDIT_HISTORY,
        rhsChannel: getSelectedChannel(state),
        selectedPostId,
        selectedPostCardId,
        team,
        teamId,
        productId,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            setRhsExpanded,
            showPinnedPosts,
            openRHSSearch,
            closeRightHandSide,
            openAtPrevious,
            updateSearchTerms,
            showChannelFiles,
            showChannelInfo,
        }, dispatch),
    };
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(SidebarRight));
