// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect, ConnectedProps} from 'react-redux';
import {AnyAction, bindActionCreators, Dispatch} from 'redux';

import {setActionsMenuInitialisationState} from 'mattermost-redux/actions/preferences';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getPost, makeGetCommentCountForPost, makeIsPostCommentMention, isPostAcknowledgementsEnabled, isPostPriorityEnabled, UserActivityPost} from 'mattermost-redux/selectors/entities/posts';

import {
    get,
    getBool,
    isCollapsedThreadsEnabled,
} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeam, getTeam, getTeamMemberships} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId, getUser} from 'mattermost-redux/selectors/entities/users';

import {Emoji} from '@mattermost/types/emojis';
import {Post} from '@mattermost/types/posts';
import {closeRightHandSide, selectPost, setRhsExpanded, selectPostCard, selectPostFromRightHandSideSearch} from 'actions/views/rhs';

import {markPostAsUnread, emitShortcutReactToLastPostFrom} from 'actions/post_actions';

import {getShortcutReactToLastPostEmittedFrom, getOneClickReactionEmojis} from 'selectors/emojis';
import {getIsPostBeingEdited, getIsPostBeingEditedInRHS, isEmbedVisible} from 'selectors/posts';
import {getHighlightedPostId, getRhsState, getSelectedPostCard} from 'selectors/rhs';
import {getIsMobileView} from 'selectors/views/browser';

import {GlobalState} from 'types/store';

import {isArchivedChannel} from 'utils/channel_utils';
import {areConsecutivePostsBySameUser, canDeletePost, shouldShowActionsMenu, shouldShowDotMenu} from 'utils/post_utils';
import {Locations, Preferences, RHSStates} from 'utils/constants';

import {ExtendedPost, removePost} from 'mattermost-redux/actions/posts';
import {DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';
import {isThreadOpen} from 'selectors/views/threads';

import {General} from 'mattermost-redux/constants';

import {getDisplayNameByUser} from 'utils/utils';
import {getDirectTeammate} from 'mattermost-redux/selectors/entities/channels';

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

function removePostAndCloseRHS(post: ExtendedPost) {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState() as GlobalState;
        if (isThreadOpen(state, post.id)) {
            dispatch(closeRightHandSide());
        }
        return dispatch(removePost(post));
    };
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
        let parentPost;
        let parentPostUser;

        if (post.root_id) {
            parentPost = getPost(state, post.root_id);
            parentPostUser = parentPost ? getUser(state, parentPost.user_id) : null;
        }

        const config = getConfig(state);
        const enableEmojiPicker = config.EnableEmojiPicker === 'true';
        const enablePostUsernameOverride = config.EnablePostUsernameOverride === 'true';
        const channel = state.entities.channels.channels[post.channel_id];
        const shortcutReactToLastPostEmittedFrom = getShortcutReactToLastPostEmittedFrom(state);

        const user = getUser(state, post.user_id);
        const isBot = Boolean(user && user.is_bot);
        const highlightedPostId = getHighlightedPostId(state);

        const selectedCard = getSelectedPostCard(state);

        let emojis: Emoji[] = [];
        const oneClickReactionsEnabled = get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.ONE_CLICK_REACTIONS_ENABLED, Preferences.ONE_CLICK_REACTIONS_ENABLED_DEFAULT) === 'true';
        if (oneClickReactionsEnabled) {
            emojis = getOneClickReactionEmojis(state);
        }

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
        let teamName = currentTeam.name;
        let teamDisplayName = '';

        const memberships = getTeamMemberships(state);
        const isDMorGM = channel.type === General.DM_CHANNEL || channel.type === General.GM_CHANNEL;
        const rhsState = getRhsState(state);
        if (
            rhsState !== RHSStates.PIN && // Not show in pinned posts since they are all for the same channel
            !isDMorGM && // Not show for DM or GMs since they don't belong to a team
            memberships && Object.values(memberships).length > 1 // Not show if the user only belongs to one team
        ) {
            teamDisplayName = team?.display_name;
            teamName = team?.name || currentTeam.name;
        }

        const canReply = isDMorGM || (channel.team_id === currentTeam.id);
        const directTeammate = getDirectTeammate(state, channel.id);

        const previewCollapsed = get(
            state,
            Preferences.CATEGORY_DISPLAY_SETTINGS,
            Preferences.COLLAPSE_DISPLAY,
            Preferences.COLLAPSE_DISPLAY_DEFAULT,
        );

        const previewEnabled = getBool(
            state,
            Preferences.CATEGORY_DISPLAY_SETTINGS,
            Preferences.LINK_PREVIEW_DISPLAY,
            Preferences.LINK_PREVIEW_DISPLAY_DEFAULT === 'true',
        );

        return {
            enableEmojiPicker,
            enablePostUsernameOverride,
            isEmbedVisible: isEmbedVisible(state, post.id),
            isReadOnly: false,
            currentUserId: getCurrentUserId(state),
            isFirstReply: previousPost ? isFirstReply(post, previousPost) : false,
            hasReplies: getReplyCount(state, post) > 0,
            replyCount: getReplyCount(state, post),
            canReply,
            pluginPostTypes: state.plugins.postTypes,
            channelIsArchived: isArchivedChannel(channel),
            isConsecutivePost: isConsecutivePost(state, ownProps),
            previousPostIsComment,
            isFlagged: get(state, Preferences.CATEGORY_FLAGGED_POST, post.id, null) !== null,
            compactDisplay: get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.MESSAGE_DISPLAY, Preferences.MESSAGE_DISPLAY_DEFAULT) === Preferences.MESSAGE_DISPLAY_COMPACT,
            colorizeUsernames: get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.COLORIZE_USERNAMES, Preferences.COLORIZE_USERNAMES_DEFAULT) === 'true',
            shouldShowActionsMenu: shouldShowActionsMenu(state, post),
            currentTeam,
            team,
            shortcutReactToLastPostEmittedFrom,
            isBot,
            collapsedThreadsEnabled: isCollapsedThreadsEnabled(state),
            shouldHighlight: ownProps.shouldHighlight || highlightedPostId === post.id,
            oneClickReactionsEnabled,
            recentEmojis: emojis,
            center: get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_DISPLAY_MODE, Preferences.CHANNEL_DISPLAY_MODE_DEFAULT) === Preferences.CHANNEL_DISPLAY_MODE_CENTERED,
            isCollapsedThreadsEnabled: isCollapsedThreadsEnabled(state),
            isExpanded: state.views.rhs.isSidebarExpanded,
            isPostBeingEdited: ownProps.location === Locations.CENTER ? !getIsPostBeingEditedInRHS(state, post.id) && getIsPostBeingEdited(state, post.id) : getIsPostBeingEditedInRHS(state, post.id),
            isMobileView: getIsMobileView(state),
            previewCollapsed,
            previewEnabled,
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
            parentPost,
            parentPostUser,
            isPostAcknowledgementsEnabled: isPostAcknowledgementsEnabled(state),
            isPostPriorityEnabled: isPostPriorityEnabled(state),
            isCardOpen: selectedCard && selectedCard.id === post.id,
            shouldShowDotMenu: shouldShowDotMenu(state, post, channel),
            canDelete: canDeletePost(state, post, channel),
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch<AnyAction>) {
    return {
        actions: bindActionCreators({
            markPostAsUnread,
            emitShortcutReactToLastPostFrom,
            setActionsMenuInitialisationState,
            selectPost,
            selectPostFromRightHandSideSearch,
            setRhsExpanded,
            removePost: removePostAndCloseRHS,
            closeRightHandSide,
            selectPostCard,
        }, dispatch),
    };
}

const connector = connect(makeMapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>

export default connector(PostComponent);

