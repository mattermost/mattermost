// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ComponentProps} from 'react';
import {connect} from 'react-redux';

import {
    setRhsExpanded,
    showMentions,
    showSearchResults,
    showFlaggedPosts,
    showPinnedPosts,
    showChannelFiles,
    closeRightHandSide,
    toggleRhsExpanded,
    goBack,
} from 'actions/views/rhs';
import {setThreadFollow} from 'mattermost-redux/actions/threads';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getInt, isCollapsedThreadsEnabled, onboardingTourTipsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId, getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {makeGetThreadOrSynthetic} from 'mattermost-redux/selectors/entities/threads';
import {getCurrentUserId, getCurrentUserMentionKeys} from 'mattermost-redux/selectors/entities/users';
import {getIsRhsExpanded} from 'selectors/rhs';
import {getIsMobileView} from 'selectors/views/browser';

import {GlobalState} from 'types/store';
import {CrtThreadPaneSteps, Preferences} from 'utils/constants';
import {matchUserMentionTriggersWithMessageMentions} from 'utils/post_utils';
import {allAtMentions} from 'utils/text_formatting';

import RhsHeaderPost from './rhs_header_post';

type OwnProps = Pick<ComponentProps<typeof RhsHeaderPost>, 'rootPostId'>

function makeMapStateToProps() {
    const getThreadOrSynthetic = makeGetThreadOrSynthetic();

    return function mapStateToProps(state: GlobalState, {rootPostId}: OwnProps) {
        let isFollowingThread = false;

        const collapsedThreads = isCollapsedThreadsEnabled(state);
        const root = getPost(state, rootPostId);
        const currentUserId = getCurrentUserId(state);
        const tipStep = getInt(state, Preferences.CRT_THREAD_PANE_STEP, currentUserId);

        if (root && collapsedThreads) {
            const thread = getThreadOrSynthetic(state, root);
            isFollowingThread = thread.is_following;

            if (isFollowingThread === null && thread.reply_count === 0) {
                const currentUserMentionKeys = getCurrentUserMentionKeys(state);
                const rootMessageMentionKeys = allAtMentions(root.message);

                isFollowingThread = matchUserMentionTriggersWithMessageMentions(currentUserMentionKeys, rootMessageMentionKeys);
            }
        }

        const showThreadsTutorialTip = tipStep === CrtThreadPaneSteps.THREADS_PANE_POPOVER && isCollapsedThreadsEnabled(state) && onboardingTourTipsEnabled(state);

        return {
            isExpanded: getIsRhsExpanded(state),
            isMobileView: getIsMobileView(state),
            relativeTeamUrl: getCurrentRelativeTeamUrl(state),
            currentTeamId: getCurrentTeamId(state),
            currentUserId,
            isCollapsedThreadsEnabled: collapsedThreads,
            isFollowingThread,
            showThreadsTutorialTip,
        };
    };
}

const actions = {
    setRhsExpanded,
    showSearchResults,
    showMentions,
    showFlaggedPosts,
    showPinnedPosts,
    showChannelFiles,
    closeRightHandSide,
    toggleRhsExpanded,
    setThreadFollow,
    goBack,
};

export default connect(makeMapStateToProps, actions)(RhsHeaderPost);
