// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getMorePostsForSearch, getMoreFilesForSearch} from 'mattermost-redux/actions/search';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';

import {autocompleteChannelsForSearch} from 'actions/channel_actions';
import {autocompleteUsersInTeam} from 'actions/user_actions';
import {
    updateSearchTerms,
    updateSearchTeam,
    updateSearchTermsForShortcut,
    showSearchResults,
    showChannelFiles,
    showMentions,
    showFlaggedPosts,
    closeRightHandSide,
    updateRhsState,
    setRhsExpanded,
    openRHSSearch,
    filterFilesSearchByExt,
    updateSearchType,
} from 'actions/views/rhs';
import {getRhsState, getSearchTeam, getSearchTerms, getSearchType, getIsSearchingTerm, getIsRhsOpen, getIsRhsExpanded} from 'selectors/rhs';
import {getIsMobileView} from 'selectors/views/browser';

import {RHSStates} from 'utils/constants';

import type {GlobalState} from 'types/store';

import Search from './search';

function mapStateToProps(state: GlobalState) {
    const rhsState = getRhsState(state);
    const currentChannel = getCurrentChannel(state);
    const isMobileView = getIsMobileView(state);
    const isRhsOpen = getIsRhsOpen(state);

    let searchTeam = getSearchTeam(state);
    if (!searchTeam) {
        searchTeam = currentChannel?.team_id || '';
    }

    return {
        currentChannel,
        isRhsExpanded: getIsRhsExpanded(state),
        isRhsOpen,
        isSearchingTerm: getIsSearchingTerm(state),
        searchTerms: getSearchTerms(state),
        searchTeam,
        searchType: getSearchType(state),
        searchVisible: rhsState !== null && (![
            RHSStates.PLUGIN,
            RHSStates.CHANNEL_INFO,
            RHSStates.CHANNEL_MEMBERS,
            RHSStates.EDIT_HISTORY,
        ].includes(rhsState)),
        hideMobileSearchBarInRHS: isMobileView && isRhsOpen && rhsState === RHSStates.CHANNEL_INFO,
        isMentionSearch: rhsState === RHSStates.MENTION,
        isFlaggedPosts: rhsState === RHSStates.FLAG,
        isPinnedPosts: rhsState === RHSStates.PIN,
        isChannelFiles: rhsState === RHSStates.CHANNEL_FILES,
        isMobileView,
        crossTeamSearchEnabled: getFeatureFlagValue(state, 'ExperimentalCrossTeamSearch') === 'true',
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            updateSearchTerms,
            updateSearchTeam,
            updateSearchTermsForShortcut,
            updateSearchType,
            showSearchResults,
            showChannelFiles,
            showMentions,
            showFlaggedPosts,
            setRhsExpanded,
            closeRightHandSide,
            autocompleteChannelsForSearch,
            autocompleteUsersInTeam,
            updateRhsState,
            getMorePostsForSearch,
            openRHSSearch,
            getMoreFilesForSearch,
            filterFilesSearchByExt,
        }, dispatch),
    };
}
export default connect(mapStateToProps, mapDispatchToProps)(Search);
