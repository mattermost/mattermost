// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Post} from '@mattermost/types/posts';

import {General} from 'mattermost-redux/constants';
import {getDirectTeammate} from 'mattermost-redux/selectors/entities/channels';
import {getPost, makeGetCommentCountForPost, makeIsPostCommentMention, isPostAcknowledgementsEnabled, isPostPriorityEnabled, isPostFlagged} from 'mattermost-redux/selectors/entities/posts';
import type {UserActivityPost} from 'mattermost-redux/selectors/entities/posts';
import {
    get,
    isCollapsedThreadsEnabled,
} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeam, getTeam, getTeamMemberships} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId, getUser} from 'mattermost-redux/selectors/entities/users';

import {markPostAsUnread} from 'actions/post_actions';
import {closeRightHandSide, selectPost, setRhsExpanded, selectPostCard, selectPostFromRightHandSideSearch} from 'actions/views/rhs';
import {getIsPostBeingEdited, getIsPostBeingEditedInRHS, isEmbedVisible} from 'selectors/posts';
import {getHighlightedPostId, getRhsState, getSelectedPostCard} from 'selectors/rhs';
import {getIsMobileView} from 'selectors/views/browser';

import {isArchivedChannel} from 'utils/channel_utils';
import {Locations, Preferences, RHSStates} from 'utils/constants';
import {areConsecutivePostsBySameUser, shouldShowDotMenu} from 'utils/post_utils';
import {getDisplayNameByUser} from 'utils/utils';

import type {GlobalState} from 'types/store';

import PostComponent from './post_component';

interface OwnProps {
    post?: Post | UserActivityPost;
    previousPostId?: string;
    postId?: string;
    shouldHighlight?: boolean;
    location: keyof typeof Locations;
}

function isFirstReply(post: Post, previousPost?: Post | null): boolean {
    if (post.root_id) {
        if (previousPost) {
            // Returns true as long as the previous post is part of a different thread
            return post.root_id !== previousPost.id && post.root_id !== previousPost.root_id;
        }

        // The previous post is not a real post
        return true;
    }

    // This post is not a reply
    return false;
}

function isConsecutivePost(state: GlobalState, ownProps: OwnProps) {
    let post;
    if (ownProps.postId) {
        post = getPost(state, ownProps.postId);
    } else if (ownProps.post) {
        post = ownProps.post;
    }
    const previousPost = ownProps.previousPostId && getPost(state, ownProps.previousPostId);

    let consecutivePost = false;

    if (previousPost && post && !post.metadata?.priority?.priority) {
        consecutivePost = areConsecutivePostsBySameUser(post, previousPost);
    }
    return consecutivePost;
}

function makeMapStateToProps() {
    const isPostCommentMention = makeIsPostCommentMention();
    const getReplyCount = makeGetCommentCountForPost();

    return function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
        let post;
        if (ownProps.post) {
            post = ownProps.post;
        } else if (ownProps.postId) {
            post = getPost(state, ownProps.postId);
        }
        if (!post) {
            return null;
        }

        const channel = state.entities.channels.channels[post.channel_id];

        const user = getUser(state, post.user_id);
        const isBot = Boolean(user && user.is_bot);
        const highlightedPostId = getHighlightedPostId(state);

        const selectedCard = getSelectedPostCard(state);

        let previousPost = null;
        if (ownProps.previousPostId) {
            previousPost = getPost(state, ownProps.previousPostId);
        }

        let previousPostIsComment = false;

        if (previousPost && !post.props.priority) {
            previousPostIsComment = Boolean(previousPost.root_id);
        }

        const currentTeam = getCurrentTeam(state);
        const team = getTeam(state, channel.team_id);
        let teamName = currentTeam?.name;
        let teamDisplayName;

        const memberships = getTeamMemberships(state);
        const isDMorGM = channel.type === General.DM_CHANNEL || channel.type === General.GM_CHANNEL;
        const rhsState = getRhsState(state);
        if (
            rhsState !== RHSStates.PIN && // Not show in pinned posts since they are all for the same channel
            !isDMorGM && // Not show for DM or GMs since they don't belong to a team
            memberships && Object.values(memberships).length > 1 // Not show if the user only belongs to one team
        ) {
            teamDisplayName = team?.display_name;
            teamName = team?.name || currentTeam?.name;
        }

        const directTeammate = getDirectTeammate(state, channel.id);

        return {
            isEmbedVisible: isEmbedVisible(state, post.id),
            currentUserId: getCurrentUserId(state),
            isFirstReply: previousPost ? isFirstReply(post, previousPost) : false,
            hasReplies: getReplyCount(state, post) > 0,
            pluginPostTypes: state.plugins.postTypes,
            channelIsArchived: isArchivedChannel(channel),
            isConsecutivePost: isConsecutivePost(state, ownProps),
            previousPostIsComment,
            isFlagged: isPostFlagged(state, post.id),
            compactDisplay: get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.MESSAGE_DISPLAY, Preferences.MESSAGE_DISPLAY_DEFAULT) === Preferences.MESSAGE_DISPLAY_COMPACT,
            currentTeam,
            team,
            isBot,
            shouldHighlight: ownProps.shouldHighlight || highlightedPostId === post.id,
            center: get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_DISPLAY_MODE, Preferences.CHANNEL_DISPLAY_MODE_DEFAULT) === Preferences.CHANNEL_DISPLAY_MODE_CENTERED,
            isCollapsedThreadsEnabled: isCollapsedThreadsEnabled(state),
            isPostBeingEdited: ownProps.location === Locations.CENTER ? !getIsPostBeingEditedInRHS(state, post.id) && getIsPostBeingEdited(state, post.id) : getIsPostBeingEditedInRHS(state, post.id),
            isMobileView: getIsMobileView(state),
            post,
            channelName: channel.display_name,
            channelType: channel.type,
            teamDisplayName,
            displayName: getDisplayNameByUser(state, directTeammate),
            teamName,
            isFlaggedPosts: rhsState === RHSStates.FLAG,
            isPinnedPosts: rhsState === RHSStates.PIN,
            clickToReply: get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CLICK_TO_REPLY, Preferences.CLICK_TO_REPLY_DEFAULT) === 'true',
            isCommentMention: isPostCommentMention(state, post.id),
            isPostAcknowledgementsEnabled: isPostAcknowledgementsEnabled(state),
            isPostPriorityEnabled: isPostPriorityEnabled(state),
            isCardOpen: selectedCard && selectedCard.id === post.id,
            shouldShowDotMenu: shouldShowDotMenu(state, post, channel),
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            markPostAsUnread,
            selectPost,
            selectPostFromRightHandSideSearch,
            setRhsExpanded,
            closeRightHandSide,
            selectPostCard,
        }, dispatch),
    };
}

const connector = connect(makeMapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>

export default connector(PostComponent);

