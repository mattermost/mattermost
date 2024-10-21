// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classnames from 'classnames';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {General, Posts} from 'mattermost-redux/constants';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {makeGetCommentCountForPost} from 'mattermost-redux/selectors/entities/posts';
import {get, isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {isPostEphemeral} from 'mattermost-redux/utils/post_utils';

import {emitShortcutReactToLastPostFrom} from 'actions/post_actions';
import {getShortcutReactToLastPostEmittedFrom} from 'selectors/emojis';

import ActionsMenu from 'components/actions_menu';
import CommentIcon from 'components/common/comment_icon';
import DotMenu from 'components/dot_menu';
import PostFlagIcon from 'components/post_view/post_flag_icon';
import PostReaction from 'components/post_view/post_reaction';
import PostRecentReactions from 'components/post_view/post_recent_reactions';

import {Locations, Constants, Preferences} from 'utils/constants';
import {isSystemMessage, fromAutoResponder, canDeletePost, shouldShowActionsMenu as shouldShowActionsMenuAction} from 'utils/post_utils';

import type {GlobalState} from 'types/store';

import {removePostCloseRHSDeleteDraft} from './actions';

type Props = {
    post: Post;
    teamId: string;
    isFlagged: boolean;
    channelIsArchived?: boolean;
    handleCommentClick?: (e: React.MouseEvent) => void;
    handleJumpClick?: (e: React.MouseEvent) => void;
    handleDropdownOpened?: (e: boolean) => void;
    hover?: boolean;
    isMobileView: boolean;
    hasReplies?: boolean;
    isFirstReply?: boolean;
    location: keyof typeof Locations;
    isLastPost?: boolean;
    isPostHeaderVisible?: boolean | null;
    isPostBeingEdited?: boolean;
};

const PostOptions = ({
    isFlagged,
    isMobileView,
    location,
    post,
    teamId,
    channelIsArchived,
    handleCommentClick,
    handleDropdownOpened,
    handleJumpClick,
    hasReplies,
    hover,
    isFirstReply,
    isLastPost,
    isPostBeingEdited,
    isPostHeaderVisible,
}: Props): JSX.Element => {
    const dispatch = useDispatch();
    const dotMenuRef = useRef<HTMLDivElement>(null);

    const getReplyCount = useMemo(() => makeGetCommentCountForPost(), []);

    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showDotMenu, setShowDotMenu] = useState(false);
    const [showActionsMenu, setShowActionsMenu] = useState(false);

    const oneClickReactionsEnabled = useSelector((state: GlobalState) => get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.ONE_CLICK_REACTIONS_ENABLED, Preferences.ONE_CLICK_REACTIONS_ENABLED_DEFAULT) === 'true');
    const shouldShowActionsMenu = useSelector((state: GlobalState) => shouldShowActionsMenuAction(state, post));
    const isExpanded = useSelector((state: GlobalState) => state.views.rhs.isSidebarExpanded);
    const collapsedThreadsEnabled = useSelector((state: GlobalState) => isCollapsedThreadsEnabled(state));
    const shortcutReactToLastPostEmittedFrom = useSelector((state: GlobalState) => getShortcutReactToLastPostEmittedFrom(state));
    const replyCount = useSelector((state: GlobalState) => getReplyCount(state, post));
    const enableEmojiPicker = useSelector((state: GlobalState) => getConfig(state).EnableEmojiPicker === 'true');
    const canReply = useSelector((state: GlobalState) => {
        const currentTeam = getCurrentTeam(state);
        const channel = state.entities.channels.channels[post.channel_id];
        const isDMorGM = channel.type === General.DM_CHANNEL || channel.type === General.GM_CHANNEL;
        return isDMorGM || (channel.team_id === currentTeam?.id);
    });
    const canDelete = useSelector((state: GlobalState) => {
        const channel = state.entities.channels.channels[post.channel_id];
        return canDeletePost(state, post, channel);
    });
    const pluginActions = useSelector((state: GlobalState) => state.plugins.components.PostAction);

    useEffect(() => {
        const locationToUse = location === 'RHS_COMMENT' ? Locations.RHS_ROOT : location;
        if (isLastPost &&
            (shortcutReactToLastPostEmittedFrom === locationToUse) &&
                isPostHeaderVisible) {
            toggleEmojiPicker();
            dispatch(emitShortcutReactToLastPostFrom(Locations.NO_WHERE));
        }
    }, [isLastPost, shortcutReactToLastPostEmittedFrom]);

    const isEphemeral = isPostEphemeral(post);
    const systemMessage = isSystemMessage(post);
    const isFromAutoResponder = fromAutoResponder(post);

    const removePost = useCallback(() => {
        dispatch(removePostCloseRHSDeleteDraft(post));
    }, [dispatch, post]);

    const toggleEmojiPicker = useCallback(() => {
        setShowEmojiPicker(!showEmojiPicker);
        handleDropdownOpened!(!showEmojiPicker);
    }, [handleDropdownOpened, showEmojiPicker]);

    const handleDotMenuOpened = useCallback((open: boolean) => {
        setShowDotMenu(open);
        handleDropdownOpened!(open);
    }, [handleDropdownOpened]);

    const handleActionsMenuOpened = useCallback((open: boolean) => {
        setShowActionsMenu(open);
        handleDropdownOpened!(open);
    }, [handleDropdownOpened]);

    const getDotMenuRef = useCallback(() => dotMenuRef.current, []);

    const isPostDeleted = post && post.state === Posts.POST_DELETED;
    const hoverLocal = hover || showEmojiPicker || showDotMenu || showActionsMenu;
    const showCommentIcon = isFromAutoResponder || (!systemMessage && (isMobileView ||
            hoverLocal || (!post.root_id && Boolean(hasReplies)) ||
            isFirstReply) && location === Locations.CENTER);
    const commentIconExtraClass = isMobileView ? '' : 'pull-right';

    const commentIcon = showCommentIcon && (
        <CommentIcon
            handleCommentClick={handleCommentClick}
            postId={post.id}
            extraClass={commentIconExtraClass}
            commentCount={collapsedThreadsEnabled ? 0 : replyCount}
        />
    );

    const showRecentlyUsedReactions = (!isMobileView && !isEphemeral && !post.failed && !systemMessage && !channelIsArchived && oneClickReactionsEnabled && enableEmojiPicker && hoverLocal);
    const showMoreReactions = isExpanded ||
        location === 'CENTER' ||
        (document.getElementById('sidebar-right')?.getBoundingClientRect().width ?? 0) > Constants.SIDEBAR_MINIMUM_WIDTH;
    const showRecentReactions: ReactNode = showRecentlyUsedReactions && (
        <PostRecentReactions
            channelId={post.channel_id}
            postId={post.id}
            teamId={teamId}
            size={showMoreReactions ? 3 : 1}
        />
    );

    const showReactionIcon = !systemMessage && !isEphemeral && !post.failed && enableEmojiPicker && !channelIsArchived;
    const postReaction = showReactionIcon && (
        <PostReaction
            channelId={post.channel_id}
            location={location}
            postId={post.id}
            teamId={teamId}
            getDotMenuRef={getDotMenuRef}
            showEmojiPicker={showEmojiPicker}
            toggleEmojiPicker={toggleEmojiPicker}
        />
    );

    const flagIcon: ReactNode = (!isMobileView && (!isEphemeral && !post.failed && !systemMessage)) && (
        <PostFlagIcon
            location={location}
            postId={post.id}
            isFlagged={isFlagged}
        />
    );

    // Action menus
    const showActionsMenuIcon = shouldShowActionsMenu && (isMobileView || hoverLocal);
    const actionsMenu = showActionsMenuIcon && (
        <ActionsMenu
            post={post}
            location={location}
            handleDropdownOpened={handleActionsMenuOpened}
            isMenuOpen={showActionsMenu}
        />
    );

    const pluginItems: ReactNode = ((!isEphemeral && !post.failed && !systemMessage) && hoverLocal) && (
        pluginActions?.
            map((item) => {
                if (item.component) {
                    const Component = item.component as any;
                    return (
                        <Component
                            post={post}
                            key={item.id}
                        />
                    );
                }
                return null;
            }) || []
    );

    const dotMenu = (
        <DotMenu
            post={post}
            location={location}
            isFlagged={isFlagged}
            handleDropdownOpened={handleDotMenuOpened}
            handleCommentClick={handleCommentClick}
            handleAddReactionClick={toggleEmojiPicker}
            isReadOnly={channelIsArchived}
            isMenuOpen={showDotMenu}
            enableEmojiPicker={enableEmojiPicker}
        />
    );

    // Build post options
    let options: ReactNode;
    if (isEphemeral) {
        options = (
            <div className='col col__remove'>
                <button
                    className='post__remove theme color--link style--none'
                    onClick={removePost}
                >
                    {'×'}
                </button>
            </div>
        );
    } else if (isPostDeleted || (systemMessage && !canDelete)) {
        options = null;
    } else if (location === Locations.SEARCH) {
        const hasCRTFooter = collapsedThreadsEnabled && !post.root_id && (post.reply_count > 0 || post.is_following);
        options = (
            <div className='col__controls post-menu'>
                {dotMenu}
                {flagIcon}
                {canReply && !hasCRTFooter &&
                    <CommentIcon
                        location={location}
                        handleCommentClick={handleCommentClick}
                        commentCount={replyCount}
                        postId={post.id}
                        searchStyle={'search-item__comment'}
                        extraClass={replyCount ? 'icon--visible' : ''}
                    />
                }
                <a
                    href='#'
                    onClick={handleJumpClick}
                    className='search-item__jump'
                >
                    <FormattedMessage
                        id='search_item.jump'
                        defaultMessage='Jump'
                    />
                </a>
            </div>
        );
    } else if (!isPostBeingEdited) {
        options = (
            <div
                ref={dotMenuRef}
                data-testid={`post-menu-${post.id}`}
                className={classnames('col post-menu', {'post-menu--position': !hoverLocal && showCommentIcon})}
            >
                {!collapsedThreadsEnabled && !showRecentlyUsedReactions && dotMenu}
                {showRecentReactions}
                {postReaction}
                {flagIcon}
                {pluginItems}
                {actionsMenu}
                {commentIcon}
                {(collapsedThreadsEnabled || showRecentlyUsedReactions) && dotMenu}
            </div>
        );
    }

    return <>{options}</>;
};

export default PostOptions;
